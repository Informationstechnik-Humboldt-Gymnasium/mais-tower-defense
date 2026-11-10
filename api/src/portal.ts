import type { Config } from './config.ts';

/**
 * Zugriff auf das Bürgerportal (Supabase) — exakt wie das Portal selbst:
 * Anmeldung über Supabase Auth, Bankvorgänge über die Bank-RPCs mit dem Token des Bürgers.
 * Es wird nichts am Schema verändert und kein Konto angelegt.
 */

export const LOGIN_ALIASES: Record<string, string> = {
  administrator: 'administrator@maiskolbistan.app',
  admin: 'administrator@maiskolbistan.app',
};

export function normalizeIdent(ident: string): string {
  const m = ident.trim().toLowerCase();
  return LOGIN_ALIASES[m] ?? m;
}

export type PortalLogin =
  | { ok: true; uid: string; email: string; accessToken: string }
  | { ok: false; code: 'invalid' | 'unconfirmed' | 'banned' | 'rate' | 'unavailable' };

const TIMEOUT = 8000;

async function timedFetch(url: string, init: RequestInit): Promise<Response> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT);
  try {
    return await fetch(url, { ...init, signal: ctl.signal });
  } finally {
    clearTimeout(t);
  }
}

export async function portalSignIn(cfg: Config, email: string, password: string): Promise<PortalLogin> {
  let r: Response;
  try {
    r = await timedFetch(`${cfg.supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: cfg.supabaseAnonKey },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    return { ok: false, code: 'unavailable' };
  }
  if (r.status === 429) return { ok: false, code: 'rate' };
  const j = (await r.json().catch(() => null)) as Record<string, unknown> | null;
  if (r.ok && j && typeof j.access_token === 'string' && j.user && typeof (j.user as { id?: unknown }).id === 'string') {
    const u = j.user as { id: string; email?: string };
    return { ok: true, uid: u.id, email: u.email ?? email, accessToken: j.access_token };
  }
  if (r.status >= 500) return { ok: false, code: 'unavailable' };
  const msg = String((j && (j.error_description || j.msg || j.message || j.error_code)) || '').toLowerCase();
  if (msg.includes('not confirmed')) return { ok: false, code: 'unconfirmed' };
  if (msg.includes('banned')) return { ok: false, code: 'banned' };
  return { ok: false, code: 'invalid' };
}

/** Anzeigename aus dem Profil (falls lesbar), sonst E-Mail-Präfix. */
export async function portalDisplayName(cfg: Config, uid: string, token: string, email: string): Promise<string> {
  const fallback = email.split('@')[0] || 'Spieler';
  try {
    const r = await timedFetch(`${cfg.supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(uid)}&select=*`, {
      headers: { apikey: cfg.supabaseAnonKey, Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return fallback;
    const rows = (await r.json()) as Record<string, unknown>[];
    const p = rows[0] ?? {};
    for (const k of ['display_name', 'name', 'full_name', 'username', 'vorname']) {
      const v = p[k];
      if (typeof v === 'string' && v.trim()) return v.trim().slice(0, 40);
    }
  } catch {
    /* Profil optional */
  }
  return fallback.slice(0, 40);
}

export type WalletResult =
  | { ok: true; ref: string | null }
  | { ok: false; definitive: boolean; reason: string };

/** Setzt Platzhalter typerhaltend in die RPC-Argumente ein. */
export function buildArgs(template: string, vars: Record<string, string | number>): unknown {
  const fill = (v: unknown): unknown => {
    if (typeof v === 'string') {
      const whole = /^\{\{(\w+)\}\}$/.exec(v);
      if (whole && whole[1] in vars) return vars[whole[1]];
      return v.replace(/\{\{(\w+)\}\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
    }
    if (Array.isArray(v)) return v.map(fill);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fill(x)]));
    return v;
  };
  return fill(JSON.parse(template));
}

/**
 * Überweist den Abo-Betrag vom Konto des Bürgers an das Spielkonto.
 * Der Idempotenz-Schlüssel verhindert Doppelabbuchungen (auch bei parallelen Logins).
 */
export async function portalPay(cfg: Config, token: string, amountMinor: number, key: string, month: string): Promise<WalletResult> {
  const args = buildArgs(cfg.walletArgs, { recipient: cfg.walletRecipient, amount: amountMinor, key, month });
  let r: Response;
  try {
    r = await timedFetch(`${cfg.supabaseUrl}/rest/v1/rpc/${encodeURIComponent(cfg.walletRpc)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: cfg.supabaseAnonKey, Authorization: `Bearer ${token}` },
      body: JSON.stringify(args),
    });
  } catch {
    return { ok: false, definitive: false, reason: 'unavailable' };
  }
  const j = (await r.json().catch(() => null)) as Record<string, unknown> | null;
  if (!r.ok) {
    // 4xx = Anfrage abgelehnt (z. B. Rechte/Funktion fehlt) -> endgültig; 5xx = unklar
    return { ok: false, definitive: r.status < 500, reason: r.status === 404 ? 'rpc_missing' : 'rejected' };
  }
  if (j && j.ok === true) {
    const ref = j.transaction_id ?? j.tx_id ?? j.id ?? null;
    return { ok: true, ref: ref == null ? null : String(ref) };
  }
  const reason = String((j && (j.reason ?? j.code ?? j.failure_reason ?? j.error)) || 'unknown');
  return { ok: false, definitive: true, reason };
}

export const WALLET_REASON_TEXT: Record<string, string> = {
  insufficient_funds: 'Abo fällig — 500 Maisdollar benötigt. Dein Guthaben reicht nicht.',
  sender_blocked: 'Dein Bankkonto ist gesperrt.',
  recipient_not_found: 'Das Spielkonto ist im Bürgerportal nicht bekannt.',
  recipient_blocked: 'Das Spielkonto ist im Bürgerportal gesperrt.',
  balance_limit: 'Zahlung wegen Kontostand-Obergrenze abgelehnt.',
};
