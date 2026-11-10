import { configProblems, type Config } from './config.ts';
import { randomToken, sha256, signJwt, verifyJwt } from './crypto.ts';
import type { Db } from './db.ts';
import { WALLET_REASON_TEXT, normalizeIdent, portalDisplayName, portalPay, portalSignIn } from './portal.ts';

const ACCESS_TTL = 15 * 60; // s
const REFRESH_TTL = 30 * 24 * 3600; // s
const MAX_SAVE = 64 * 1024;
const MAX_BODY = 80 * 1024;

export interface Ctx {
  db: Db;
  cfg: Config;
  ip: string;
  now: number; // ms
}

// ---------------------------------------------------------------------------
// Hilfen
// ---------------------------------------------------------------------------

function cors(cfg: Config, origin: string | null): Record<string, string> {
  if (!origin || !cfg.allowedOrigins.includes(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  };
}

function json(status: number, body: unknown, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...extra,
    },
  });
}

const fail = (status: number, code: string, message: string) => json(status, { ok: false, code, message });

/** Aktueller Abrechnungsmonat (Zeitzone Berlin), z. B. "2026-11". */
export function billingMonth(nowMs: number): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit' }).formatToParts(new Date(nowMs));
  const y = parts.find((p) => p.type === 'year')!.value;
  const m = parts.find((p) => p.type === 'month')!.value;
  return `${y}-${m}`;
}

async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  const len = Number(req.headers.get('Content-Length') || '0');
  if (len > MAX_BODY) return null;
  const text = await req.text();
  if (text.length > MAX_BODY) return null;
  try {
    const v = JSON.parse(text);
    return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

/** Fixes Zeitfenster, atomar per UPSERT … RETURNING. true = erlaubt. */
async function rateLimit(ctx: Ctx, key: string, limit: number, windowSec: number): Promise<boolean> {
  const win = Math.floor(ctx.now / 1000 / windowSec);
  const row = await ctx.db
    .prepare(
      `INSERT INTO rate_limits (key, window_start, count) VALUES (?1, ?2, 1)
       ON CONFLICT(key) DO UPDATE SET
         count = CASE WHEN rate_limits.window_start = ?2 THEN rate_limits.count + 1 ELSE 1 END,
         window_start = ?2
       RETURNING count`,
    )
    .bind(key, win)
    .first<{ count: number }>();
  return (row?.count ?? 1) <= limit;
}

async function issueSession(ctx: Ctx, playerId: number): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const sid = randomToken(16);
  const refreshToken = randomToken(32);
  const nowSec = Math.floor(ctx.now / 1000);
  await ctx.db
    .prepare('INSERT INTO sessions (id, player_id, refresh_hash, expires_at, created_at) VALUES (?1, ?2, ?3, ?4, ?5)')
    .bind(sid, playerId, await sha256(refreshToken), nowSec + REFRESH_TTL, nowSec)
    .run();
  const accessToken = await signJwt({ sub: playerId, sid, exp: nowSec + ACCESS_TTL }, ctx.cfg.sessionSecret);
  return { accessToken, refreshToken, expiresIn: ACCESS_TTL };
}

async function authed(ctx: Ctx, req: Request): Promise<{ playerId: number; sid: string } | null> {
  const h = req.headers.get('Authorization') || '';
  if (!h.startsWith('Bearer ')) return null;
  const nowSec = Math.floor(ctx.now / 1000);
  const c = await verifyJwt(h.slice(7), ctx.cfg.sessionSecret, nowSec);
  if (!c) return null;
  // Sitzung muss noch existieren (Logout widerruft sofort)
  const s = await ctx.db.prepare('SELECT player_id FROM sessions WHERE id = ?1 AND expires_at > ?2').bind(c.sid, nowSec).first<{ player_id: number }>();
  if (!s || s.player_id !== c.sub) return null;
  return { playerId: c.sub, sid: c.sid };
}

// ---------------------------------------------------------------------------
// Abo: 500 Maisdollar pro Kalendermonat, serverseitig, ohne Doppelabbuchung
// ---------------------------------------------------------------------------

type PayOutcome = { ok: true } | { ok: false; status: number; code: string; message: string };

async function ensureSubscription(ctx: Ctx, player: { id: number; uid: string; paid: string | null }, portalToken: string): Promise<PayOutcome> {
  const month = billingMonth(ctx.now);
  if (player.paid === month) return { ok: true };
  const { cfg, db } = ctx;
  if (!cfg.walletRpc || !cfg.walletRecipient) {
    return { ok: false, status: 503, code: 'wallet_not_configured', message: 'Die Abo-Zahlung ist noch nicht eingerichtet. Bitte später erneut versuchen.' };
  }
  const nowSec = Math.floor(ctx.now / 1000);
  await db
    .prepare("INSERT OR IGNORE INTO payments (player_id, month, amount_minor, attempt, status, created_at) VALUES (?1, ?2, ?3, 0, 'pending', ?4)")
    .bind(player.id, month, cfg.priceMinor, nowSec)
    .run();
  const pay = await db
    .prepare('SELECT status, attempt FROM payments WHERE player_id = ?1 AND month = ?2')
    .bind(player.id, month)
    .first<{ status: string; attempt: number }>();
  if (!pay) return { ok: false, status: 500, code: 'internal', message: 'Interner Fehler.' };

  if (pay.status !== 'paid') {
    // Gleicher Schlüssel für parallele Logins -> das Bürgerportal bucht nur einmal ab
    const key = `mtd-abo-${player.uid}-${month}-${pay.attempt}`;
    const r = await portalPay(cfg, portalToken, cfg.priceMinor, key, month);
    if (!r.ok) {
      if (r.definitive) {
        // Nächster Versuch (z. B. nach Aufladen) bekommt einen neuen Schlüssel
        await db
          .prepare('UPDATE payments SET attempt = attempt + 1 WHERE player_id = ?1 AND month = ?2 AND attempt = ?3 AND status = ?4')
          .bind(player.id, month, pay.attempt, 'pending')
          .run();
      }
      const maisdollar = (cfg.priceMinor / 100).toLocaleString('de-DE');
      if (r.reason === 'insufficient_funds') {
        return { ok: false, status: 402, code: 'subscription_due', message: `Abo fällig — ${maisdollar} Maisdollar benötigt. Dein Guthaben reicht nicht.` };
      }
      if (!r.definitive) return { ok: false, status: 502, code: 'wallet_unavailable', message: 'Das Bürgerportal ist gerade nicht erreichbar. Es wurde nichts abgebucht.' };
      console.warn('[abo] Zahlung abgelehnt', r.reason);
      return { ok: false, status: 402, code: 'payment_rejected', message: WALLET_REASON_TEXT[r.reason] ?? 'Die Abo-Zahlung wurde vom Bürgerportal abgelehnt.' };
    }
    await db
      .prepare("UPDATE payments SET status = 'paid', tx_ref = ?3, paid_at = ?4 WHERE player_id = ?1 AND month = ?2")
      .bind(player.id, month, r.ref, nowSec)
      .run();
  }
  await db.prepare('UPDATE players SET last_payment_month = ?2 WHERE id = ?1').bind(player.id, month).run();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Routen
// ---------------------------------------------------------------------------

async function login(ctx: Ctx, req: Request): Promise<Response> {
  const body = await readJson(req);
  const ident = typeof body?.ident === 'string' ? body.ident : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  if (!ident || ident.length > 254 || !password || password.length > 200) {
    return fail(400, 'bad_request', 'Bitte Kennung und Passwort eingeben.');
  }
  const email = normalizeIdent(ident);
  if (!email.includes('@')) return fail(400, 'bad_request', 'Bitte die vollständige E-Mail-Adresse des Bürgerportals eingeben.');

  const identHash = await sha256(email);
  if (!(await rateLimit(ctx, `login-ip:${ctx.ip}`, 10, 300)) || !(await rateLimit(ctx, `login-id:${identHash}`, 5, 300))) {
    return fail(429, 'rate_limited', 'Zu viele Anmeldeversuche. Bitte in einigen Minuten erneut versuchen.');
  }

  const portal = await portalSignIn(ctx.cfg, email, password);
  if (!portal.ok) {
    switch (portal.code) {
      case 'invalid': return fail(401, 'invalid_credentials', 'E-Mail-Adresse oder Passwort ist falsch.');
      case 'unconfirmed': return fail(403, 'unconfirmed', 'Das Bürgerportal-Konto ist noch nicht bestätigt.');
      case 'banned': return fail(403, 'banned', 'Dieses Bürgerportal-Konto ist gesperrt.');
      case 'rate': return fail(429, 'rate_limited', 'Zu viele Versuche. Bitte später erneut versuchen.');
      default: return fail(502, 'portal_unavailable', 'Das Bürgerportal ist gerade nicht erreichbar.');
    }
  }

  const name = await portalDisplayName(ctx.cfg, portal.uid, portal.accessToken, portal.email);
  const nowSec = Math.floor(ctx.now / 1000);
  const row = await ctx.db
    .prepare(
      `INSERT INTO players (portal_uid, display_name, created_at, last_login_at) VALUES (?1, ?2, ?3, ?3)
       ON CONFLICT(portal_uid) DO UPDATE SET display_name = excluded.display_name, last_login_at = excluded.last_login_at
       RETURNING id, last_payment_month`,
    )
    .bind(portal.uid, name, nowSec)
    .first<{ id: number; last_payment_month: string | null }>();
  if (!row) return fail(500, 'internal', 'Interner Fehler.');

  const sub = await ensureSubscription(ctx, { id: row.id, uid: portal.uid, paid: row.last_payment_month }, portal.accessToken);
  if (!sub.ok) return fail(sub.status, sub.code, sub.message);

  // Abgelaufene Sitzungen gelegentlich aufräumen
  await ctx.db.prepare('DELETE FROM sessions WHERE player_id = ?1 AND expires_at <= ?2').bind(row.id, nowSec).run();
  const tokens = await issueSession(ctx, row.id);
  return json(200, { ok: true, ...tokens, player: { name, paidMonth: billingMonth(ctx.now) } });
}

async function refresh(ctx: Ctx, req: Request): Promise<Response> {
  if (!(await rateLimit(ctx, `refresh-ip:${ctx.ip}`, 60, 300))) return fail(429, 'rate_limited', 'Zu viele Anfragen.');
  const body = await readJson(req);
  const token = typeof body?.refreshToken === 'string' ? body.refreshToken : '';
  if (!token || token.length > 100) return fail(401, 'invalid_session', 'Bitte erneut anmelden.');
  const nowSec = Math.floor(ctx.now / 1000);
  const hash = await sha256(token);
  const s = await ctx.db
    .prepare(
      `SELECT s.id, s.player_id, p.last_payment_month FROM sessions s JOIN players p ON p.id = s.player_id
       WHERE s.refresh_hash = ?1 AND s.expires_at > ?2`,
    )
    .bind(hash, nowSec)
    .first<{ id: string; player_id: number; last_payment_month: string | null }>();
  if (!s) return fail(401, 'invalid_session', 'Bitte erneut anmelden.');
  // Neuer Monat -> neue Anmeldung (dabei wird das Abo geprüft)
  if (s.last_payment_month !== billingMonth(ctx.now)) {
    await ctx.db.prepare('DELETE FROM sessions WHERE id = ?1').bind(s.id).run();
    return fail(401, 'subscription_check', 'Neuer Monat — bitte erneut anmelden.');
  }
  // Rotation: altes Refresh-Token wird ungültig
  const next = randomToken(32);
  await ctx.db.prepare('UPDATE sessions SET refresh_hash = ?2 WHERE id = ?1').bind(s.id, await sha256(next)).run();
  const accessToken = await signJwt({ sub: s.player_id, sid: s.id, exp: nowSec + ACCESS_TTL }, ctx.cfg.sessionSecret);
  return json(200, { ok: true, accessToken, refreshToken: next, expiresIn: ACCESS_TTL });
}

async function logout(ctx: Ctx, req: Request): Promise<Response> {
  const body = await readJson(req);
  const token = typeof body?.refreshToken === 'string' ? body.refreshToken : '';
  if (token && token.length <= 100) await ctx.db.prepare('DELETE FROM sessions WHERE refresh_hash = ?1').bind(await sha256(token)).run();
  return json(200, { ok: true });
}

async function me(ctx: Ctx, req: Request): Promise<Response> {
  const a = await authed(ctx, req);
  if (!a) return fail(401, 'invalid_session', 'Bitte erneut anmelden.');
  const p = await ctx.db.prepare('SELECT display_name, last_payment_month FROM players WHERE id = ?1').bind(a.playerId).first<{ display_name: string; last_payment_month: string | null }>();
  if (!p) return fail(401, 'invalid_session', 'Bitte erneut anmelden.');
  return json(200, { ok: true, player: { name: p.display_name, paidMonth: p.last_payment_month } });
}

async function getSave(ctx: Ctx, req: Request): Promise<Response> {
  const a = await authed(ctx, req);
  if (!a) return fail(401, 'invalid_session', 'Bitte erneut anmelden.');
  const r = await ctx.db.prepare('SELECT data, updated_at FROM saves WHERE player_id = ?1').bind(a.playerId).first<{ data: string; updated_at: number }>();
  return json(200, { ok: true, data: r ? JSON.parse(r.data) : null, updatedAt: r?.updated_at ?? null });
}

async function putSave(ctx: Ctx, req: Request): Promise<Response> {
  const a = await authed(ctx, req);
  if (!a) return fail(401, 'invalid_session', 'Bitte erneut anmelden.');
  if (!(await rateLimit(ctx, `save:${a.playerId}`, 30, 60))) return fail(429, 'rate_limited', 'Zu viele Speichervorgänge.');
  const body = await readJson(req);
  const data = body?.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) return fail(400, 'bad_request', 'Ungültiger Spielstand.');
  const text = JSON.stringify(data);
  if (text.length > MAX_SAVE) return fail(413, 'too_large', 'Spielstand zu groß.');
  const nowSec = Math.floor(ctx.now / 1000);
  await ctx.db
    .prepare('INSERT INTO saves (player_id, data, updated_at) VALUES (?1, ?2, ?3) ON CONFLICT(player_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at')
    .bind(a.playerId, text, nowSec)
    .run();
  return json(200, { ok: true, updatedAt: nowSec });
}

/** Zentraler Einstieg — identisch für Cloudflare Worker und Self-Hosting. */
export async function handle(req: Request, ctx: Ctx): Promise<Response> {
  const url = new URL(req.url);
  const c = cors(ctx.cfg, req.headers.get('Origin'));
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: c });
  let res: Response;
  try {
    const route = `${req.method} ${url.pathname.replace(/\/+$/, '')}`;
    if (route === 'GET /api/health') {
      const problems = configProblems(ctx.cfg);
      res = json(200, { ok: problems.length === 0, wallet: Boolean(ctx.cfg.walletRpc && ctx.cfg.walletRecipient), missing: problems });
    } else if (configProblems(ctx.cfg).length) {
      res = fail(503, 'not_configured', 'Server ist noch nicht vollständig eingerichtet.');
    } else if (route === 'POST /api/login') res = await login(ctx, req);
    else if (route === 'POST /api/refresh') res = await refresh(ctx, req);
    else if (route === 'POST /api/logout') res = await logout(ctx, req);
    else if (route === 'GET /api/me') res = await me(ctx, req);
    else if (route === 'GET /api/save') res = await getSave(ctx, req);
    else if (route === 'PUT /api/save') res = await putSave(ctx, req);
    else res = fail(404, 'not_found', 'Nicht gefunden.');
  } catch (e) {
    // Keine Interna nach außen, keine personenbezogenen Daten ins Log
    console.error('[api] Fehler', e instanceof Error ? e.name : 'unbekannt');
    res = fail(500, 'internal', 'Interner Fehler.');
  }
  for (const [k, v] of Object.entries(c)) res.headers.set(k, v);
  return res;
}
