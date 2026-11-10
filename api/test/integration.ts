/**
 * Integrationstest der API gegen ein nachgebautes Bürgerportal (Supabase-Mock).
 * Prüft Login, Abo-Abbuchung (einmal pro Monat, keine Doppelabbuchung), Guthaben zu gering,
 * Refresh-Rotation, Logout, Spielstand, Rate-Limits und CORS.
 */
import { createServer, type IncomingMessage } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { handle, type Ctx } from '../src/app.ts';
import { readConfig } from '../src/config.ts';
import { migrate, sqliteDb } from '../server/sqlite.ts';

// ---------------- Supabase-Mock ----------------
const users: Record<string, { pw: string; uid: string; name: string }> = {
  'anna@maiskolbistan.app': { pw: 'richtig', uid: '11111111-1111-1111-1111-111111111111', name: 'Anna Korn' },
  'ben@maiskolbistan.app': { pw: 'geheim', uid: '22222222-2222-2222-2222-222222222222', name: 'Ben Kolben' },
};
const balances: Record<string, number> = { [users['anna@maiskolbistan.app'].uid]: 120000, [users['ben@maiskolbistan.app'].uid]: 30000, GAME: 0 };
const idem = new Map<string, unknown>();
let debits = 0;

async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  let s = '';
  for await (const c of req) s += c;
  return s ? JSON.parse(s) : {};
}

const mock = createServer(async (req, res) => {
  const send = (st: number, j: unknown) => { res.writeHead(st, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(j)); };
  if (req.headers.apikey !== 'anon-test-key') return send(401, { message: 'no api key' });
  const url = new URL(req.url!, 'http://x');
  const token = String(req.headers.authorization || '').replace('Bearer ', '');
  const uidOf = (t: string) => (t.startsWith('tok-') ? t.slice(4) : null);
  if (url.pathname === '/auth/v1/token') {
    const b = await body(req);
    const u = users[String(b.email)];
    if (!u || u.pw !== b.password) return send(400, { error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
    return send(200, { access_token: 'tok-' + u.uid, user: { id: u.uid, email: b.email } });
  }
  if (url.pathname === '/rest/v1/profiles') {
    const uid = uidOf(token);
    const u = Object.values(users).find((x) => x.uid === uid);
    return send(200, u ? [{ id: uid, display_name: u.name }] : []);
  }
  if (url.pathname === '/rest/v1/rpc/bank_transfer') {
    const uid = uidOf(token);
    if (!uid) return send(401, { message: 'JWT' });
    const b = await body(req);
    const key = String(b.p_idempotency_key);
    if (idem.has(key)) return send(200, { ...(idem.get(key) as object), replayed: true });
    await new Promise((r) => setTimeout(r, 30)); // Latenz, damit Parallelität sichtbar wird
    if (idem.has(key)) return send(200, { ...(idem.get(key) as object), replayed: true });
    const amt = Number(b.p_amount_minor);
    let result: Record<string, unknown>;
    if (b.p_recipient !== 'GAME') result = { ok: false, reason: 'recipient_not_found' };
    else if (balances[uid] < amt) result = { ok: false, reason: 'insufficient_funds' };
    else {
      balances[uid] -= amt;
      balances.GAME += amt;
      debits++;
      result = { ok: true, transaction_id: 'tx-' + debits };
    }
    idem.set(key, result);
    return send(200, result);
  }
  send(404, {});
});
await new Promise<void>((r) => mock.listen(0, '127.0.0.1', () => r()));
const mockUrl = `http://127.0.0.1:${(mock.address() as { port: number }).port}`;

// ---------------- API mit SQLite ----------------
const { db, raw } = sqliteDb(':memory:');
migrate(raw, join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations'));
const baseEnv = {
  SUPABASE_URL: mockUrl,
  SUPABASE_ANON_KEY: 'anon-test-key',
  SESSION_SECRET: 'x'.repeat(48),
  WALLET_TRANSFER_RPC: 'bank_transfer',
  WALLET_RECIPIENT: 'GAME',
  ALLOWED_ORIGINS: 'https://spiel.example',
};
let env: Record<string, string> = { ...baseEnv };
let now = Date.UTC(2026, 10, 10, 12); // 10. Nov 2026
let ipCounter = 0;

async function call(method: string, path: string, opts: { body?: unknown; token?: string; ip?: string; origin?: string } = {}) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.token) headers.Authorization = 'Bearer ' + opts.token;
  if (opts.origin) headers.Origin = opts.origin;
  const req = new Request('http://api.local' + path, { method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) });
  const ctx: Ctx = { db, cfg: readConfig(env), ip: opts.ip ?? `10.0.0.${++ipCounter % 250}`, now };
  const r = await handle(req, ctx);
  return { status: r.status, headers: r.headers, j: (await r.json().catch(() => null)) as Record<string, any> };
}

let failed = 0;
function check(name: string, ok: boolean, info: unknown = '') {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${info !== '' ? ' — ' + (typeof info === 'string' ? info : JSON.stringify(info)) : ''}`);
  if (!ok) failed++;
}

try {
  const anna = { ident: 'anna@maiskolbistan.app', password: 'richtig' };

  let r = await call('GET', '/api/health');
  check('Health: konfiguriert', r.status === 200 && r.j.ok === true && r.j.wallet === true, r.j);

  r = await call('POST', '/api/login', { body: { ident: 'anna@maiskolbistan.app', password: 'falsch' } });
  check('Falsches Passwort -> 401', r.status === 401 && r.j.code === 'invalid_credentials', r.j.message);

  r = await call('POST', '/api/login', { body: { ident: 'anna', password: 'x' } });
  check('Kennung ohne @ -> 400', r.status === 400);

  env = { ...baseEnv, WALLET_TRANSFER_RPC: '' };
  r = await call('POST', '/api/login', { body: anna });
  check('Wallet nicht eingerichtet -> 503, keine Sitzung', r.status === 503 && !r.j.accessToken && debits === 0, r.j.code);
  env = { ...baseEnv };

  r = await call('POST', '/api/login', { body: anna });
  check('Erster Login im Monat bucht 500 M$ ab', r.status === 200 && debits === 1 && balances[users['anna@maiskolbistan.app'].uid] === 70000, { status: r.status, debits });
  check('Anzeigename aus Profil', r.j.player?.name === 'Anna Korn', r.j.player);
  const t1 = r.j as { accessToken: string; refreshToken: string };

  r = await call('POST', '/api/login', { body: anna });
  check('Zweiter Login im selben Monat bucht nicht erneut ab', r.status === 200 && debits === 1, { debits });

  // Neuer Monat: 5 parallele Logins -> genau eine Abbuchung
  now = Date.UTC(2026, 11, 2, 12);
  const par = await Promise.all(Array.from({ length: 5 }, () => call('POST', '/api/login', { body: anna })));
  check('Parallele Logins: genau eine Abbuchung', par.every((p) => p.status === 200) && debits === 2 && balances[users['anna@maiskolbistan.app'].uid] === 20000, { status: par.map((p) => p.status), debits });

  // Zu wenig Guthaben
  r = await call('POST', '/api/login', { body: { ident: 'ben@maiskolbistan.app', password: 'geheim' } });
  check('Guthaben < 500 -> Login abgelehnt (402, Abo fällig)', r.status === 402 && r.j.code === 'subscription_due' && /Abo fällig/.test(r.j.message) && !r.j.accessToken, r.j.message);
  balances[users['ben@maiskolbistan.app'].uid] = 60000; // aufgeladen
  r = await call('POST', '/api/login', { body: { ident: 'ben@maiskolbistan.app', password: 'geheim' } });
  check('Nach Aufladen klappt Login (neuer Idempotenz-Schlüssel)', r.status === 200 && balances[users['ben@maiskolbistan.app'].uid] === 10000, r.status);

  // Sitzungen
  now = Date.UTC(2026, 11, 3, 12);
  r = await call('POST', '/api/login', { body: anna });
  const s = r.j as { accessToken: string; refreshToken: string };
  r = await call('GET', '/api/me', { token: s.accessToken });
  check('Zugriffstoken gültig', r.status === 200 && r.j.player.paidMonth === '2026-12', r.j.player);
  r = await call('GET', '/api/me', { token: s.accessToken.slice(0, -2) + 'xx' });
  check('Manipuliertes Token abgelehnt', r.status === 401);
  r = await call('GET', '/api/me', { token: t1.accessToken });
  check('Abgelaufenes Token (Vormonat) abgelehnt', r.status === 401);

  r = await call('POST', '/api/refresh', { body: { refreshToken: s.refreshToken } });
  check('Refresh liefert neue Tokens', r.status === 200 && r.j.refreshToken && r.j.refreshToken !== s.refreshToken);
  const s2 = r.j as { accessToken: string; refreshToken: string };
  r = await call('POST', '/api/refresh', { body: { refreshToken: s.refreshToken } });
  check('Altes Refresh-Token nach Rotation ungültig', r.status === 401);

  // Spielstand
  r = await call('PUT', '/api/save', { token: s2.accessToken, body: { data: { knowledge: { primaer: 3 }, coins: 120 } } });
  check('Spielstand speichern', r.status === 200);
  r = await call('GET', '/api/save', { token: s2.accessToken });
  check('Spielstand laden', r.status === 200 && r.j.data?.coins === 120, r.j.data);
  r = await call('PUT', '/api/save', { token: s2.accessToken, body: { data: { blob: 'x'.repeat(70000) } } });
  check('Zu großer Spielstand abgelehnt', r.status === 413 || r.status === 400, r.status);
  r = await call('PUT', '/api/save', { body: { data: { coins: 1 } } });
  check('Spielstand ohne Anmeldung abgelehnt', r.status === 401);

  // Monatswechsel erzwingt neue Anmeldung
  now = Date.UTC(2027, 0, 1, 12);
  r = await call('POST', '/api/refresh', { body: { refreshToken: s2.refreshToken } });
  check('Neuer Monat: Refresh verlangt Neuanmeldung', r.status === 401 && r.j.code === 'subscription_check', r.j.code);

  // Logout widerruft sofort
  r = await call('POST', '/api/login', { body: anna });
  const s3 = r.j as { accessToken: string; refreshToken: string };
  await call('POST', '/api/logout', { body: { refreshToken: s3.refreshToken } });
  r = await call('GET', '/api/me', { token: s3.accessToken });
  check('Logout widerruft Zugriffstoken', r.status === 401);

  // Rate-Limit pro Kennung (verschiedene IPs)
  const codes: number[] = [];
  for (let i = 0; i < 7; i++) codes.push((await call('POST', '/api/login', { body: { ident: 'ben@maiskolbistan.app', password: 'nein' } })).status);
  check('Rate-Limit pro Kennung greift', codes.slice(0, 5).every((c) => c === 401) && codes[6] === 429, codes);
  // Rate-Limit pro IP
  const ipCodes: number[] = [];
  for (let i = 0; i < 12; i++) ipCodes.push((await call('POST', '/api/login', { ip: '203.0.113.9', body: { ident: `x${i}@y.de`, password: 'nein' } })).status);
  check('Rate-Limit pro IP greift', ipCodes[11] === 429, ipCodes);

  // SQL-Injection-Versuch bleibt wirkungslos
  r = await call('POST', '/api/login', { body: { ident: "x'); DROP TABLE players; --@y.de", password: 'a' } });
  const still = raw.prepare('SELECT COUNT(*) AS n FROM players').get() as { n: number };
  check('SQL-Injection wirkungslos', r.status === 401 && still.n === 2, { status: r.status, players: still.n });

  // CORS
  r = await call('GET', '/api/health', { origin: 'https://spiel.example' });
  check('CORS für erlaubte Herkunft', r.headers.get('Access-Control-Allow-Origin') === 'https://spiel.example');
  r = await call('GET', '/api/health', { origin: 'https://boese.example' });
  check('Kein CORS für fremde Herkunft', r.headers.get('Access-Control-Allow-Origin') === null);

  // Keine Passwörter in der Datenbank
  const dump = JSON.stringify(raw.prepare('SELECT * FROM players').all()) + JSON.stringify(raw.prepare('SELECT * FROM sessions').all());
  check('Keine Passwörter/Refresh-Tokens im Klartext gespeichert', !dump.includes('richtig') && !dump.includes('geheim') && !dump.includes(s3.refreshToken));

  // Fehlende Secrets -> 503
  env = { ...baseEnv, SESSION_SECRET: 'kurz' };
  r = await call('POST', '/api/login', { body: anna });
  check('Unsicheres SESSION_SECRET -> Dienst gesperrt', r.status === 503);
} finally {
  mock.close();
}
console.log(failed ? `\n${failed} Test(s) fehlgeschlagen` : '\nAlle Tests bestanden');
process.exit(failed ? 1 : 0);
