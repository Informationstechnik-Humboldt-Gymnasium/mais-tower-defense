// E2E: Browser -> Frontend (Build mit VITE_API_URL) -> Self-Host-API (SQLite) -> Bürgerportal-Mock.
// Aufruf: npm run e2e:login   (baut selbst mit passender API-URL)
import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const { chromium } = createRequire(import.meta.url)('playwright');
const API_PORT = 8788, WEB_PORT = 4175;

// --- Bürgerportal-Mock ---
const balances = { 'u-anna': 80000, 'u-ben': 100 };
const users = { 'anna@maiskolbistan.app': ['richtig', 'u-anna', 'Anna Korn'], 'ben@maiskolbistan.app': ['geheim', 'u-ben', 'Ben'] };
const seen = new Set();
const mock = createServer(async (req, res) => {
  let s = '';
  for await (const c of req) s += c;
  const b = s ? JSON.parse(s) : {};
  const send = (st, j) => { res.writeHead(st, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(j)); };
  const uid = String(req.headers.authorization || '').replace('Bearer tok-', '');
  if (req.url.startsWith('/auth/v1/token')) {
    const u = users[b.email];
    return u && u[0] === b.password ? send(200, { access_token: 'tok-' + u[1], user: { id: u[1], email: b.email } }) : send(400, { msg: 'Invalid login credentials' });
  }
  if (req.url.startsWith('/rest/v1/profiles')) return send(200, [{ display_name: Object.values(users).find((u) => u[1] === uid)?.[2] }]);
  if (req.url.startsWith('/rest/v1/rpc/bank_transfer')) {
    if (seen.has(b.p_idempotency_key)) return send(200, { ok: true, replayed: true });
    if (balances[uid] < b.p_amount_minor) return send(200, { ok: false, reason: 'insufficient_funds' });
    balances[uid] -= b.p_amount_minor;
    seen.add(b.p_idempotency_key);
    return send(200, { ok: true, transaction_id: 'tx1' });
  }
  send(404, {});
});
await new Promise((r) => mock.listen(0, '127.0.0.1', r));
const mockUrl = `http://127.0.0.1:${mock.address().port}`;

const procs = [];
const start = (cmd, args, env, marker) => new Promise((res, rej) => {
  const p = spawn(cmd, args, { env: { ...process.env, ...env }, detached: true, stdio: 'pipe' });
  procs.push(p);
  const to = setTimeout(() => rej(new Error('Start-Timeout: ' + args.join(' '))), 20000);
  const on = (d) => { if (String(d).includes(marker)) { clearTimeout(to); res(); } };
  p.stdout.on('data', on);
  p.stderr.on('data', on);
});

let failed = false;
const check = (n, ok, info = '') => { console.log(`${ok ? 'OK  ' : 'FAIL'} ${n}${info ? ' — ' + info : ''}`); if (!ok) failed = true; };

const browser = await chromium.launch();
try {
  const dbDir = mkdtempSync(join(tmpdir(), 'mtd-e2e-'));
  await start('npm', ['--prefix', 'api', 'run', 'selfhost'], {
    DB_FILE: join(dbDir, 'e2e.db'), PORT: String(API_PORT), SUPABASE_URL: mockUrl, SUPABASE_ANON_KEY: 'anon',
    SESSION_SECRET: 'e2e-'.repeat(12), WALLET_TRANSFER_RPC: 'bank_transfer', WALLET_RECIPIENT: 'GAME',
    ALLOWED_ORIGINS: `http://localhost:${WEB_PORT}`,
  }, 'läuft auf Port');
  execFileSync('npx', ['vite', 'build', '--outDir', join(dbDir, 'dist')], { env: { ...process.env, VITE_API_URL: `http://127.0.0.1:${API_PORT}` }, stdio: 'ignore' });
  await start('npx', ['vite', 'preview', '--outDir', join(dbDir, 'dist'), '--port', String(WEB_PORT), '--strictPort'], {}, String(WEB_PORT));

  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`http://localhost:${WEB_PORT}/`);
  await page.waitForSelector('.login-box');
  check('Login-Maske erscheint', true);

  await page.fill('input[name=ident]', 'ben@maiskolbistan.app');
  await page.fill('input[name=password]', 'geheim');
  await page.click('.login-box button');
  await page.waitForFunction(() => document.querySelector('.login-msg').textContent.length > 0);
  const m1 = await page.textContent('.login-msg');
  check('Zu wenig Maisdollar: Login abgelehnt mit Meldung', /Abo fällig/.test(m1), m1);

  await page.fill('input[name=ident]', 'anna@maiskolbistan.app');
  await page.fill('input[name=password]', 'falsch');
  await page.click('.login-box button');
  await page.waitForFunction(() => /falsch/.test(document.querySelector('.login-msg').textContent));
  check('Falsches Passwort: Meldung', true);

  await page.fill('input[name=password]', 'richtig');
  await page.click('.login-box button');
  await page.waitForSelector('.login-box', { state: 'detached' });
  await page.waitForFunction(() => window.__mtd && window.__mtd.world);
  const who = await page.textContent('.who');
  check('Login ok, Spiel startet, Name sichtbar', /Anna Korn/.test(who), who);
  check('500 Maisdollar abgebucht', balances['u-anna'] === 30000, String(balances['u-anna']));

  await page.reload();
  await page.waitForFunction(() => window.__mtd && window.__mtd.world);
  check('Nach Neuladen automatisch angemeldet (Refresh-Token)', (await page.locator('.login-box').count()) === 0);
  check('Keine zweite Abbuchung', balances['u-anna'] === 30000);

  await page.click('.who button');
  await page.waitForSelector('.login-box');
  check('Abmelden führt zur Login-Maske', true);
  check('Keine Seitenfehler', errors.length === 0, errors.join(' | '));
} catch (e) {
  check('Ablauf', false, String(e));
} finally {
  await browser.close();
  mock.close();
  for (const p of procs) try { process.kill(-p.pid); } catch {}
}
process.exit(failed ? 1 : 0);
