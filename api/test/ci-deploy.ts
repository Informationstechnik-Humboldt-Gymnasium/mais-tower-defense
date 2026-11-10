/**
 * Test des Einrichtungs-Skripts scripts/ci-deploy.sh gegen eine nachgebaute Cloudflare-API
 * und ein Fake-wrangler. Prüft: Account-ID-Ermittlung, D1 anlegen bzw. wiederfinden,
 * Migrationen, Deploy mit Variablen, Secrets (SESSION_SECRET nur einmal), Subdomain, api_url.
 */
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execFileP = promisify(execFile);
import { mkdtempSync, readFileSync, writeFileSync, chmodSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const apiDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const state = { dbs: [] as { name: string; uuid: string }[], subdomain: '' as string, calls: [] as string[], sites: [] as { id: string; name: string }[], zipBytes: 0 };

const server = createServer(async (req, res) => {
  let body = '';
  for await (const c of req) body += c;
  const send = (j: unknown) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(j)); };
  const u = new URL(req.url!, 'http://x');
  state.calls.push(`${req.method} ${u.pathname}`);
  if (!u.pathname.startsWith('/nf/') && req.headers.authorization !== 'Bearer cf-token') return send({ success: false, errors: [{ message: 'auth' }] });
  if (u.pathname === '/accounts') return send({ success: true, result: [{ id: 'abcdef1234567890abcdef1234567890' }] });
  if (u.pathname.endsWith('/d1/database') && req.method === 'GET') return send({ success: true, result: state.dbs.filter((d) => d.name === u.searchParams.get('name')) });
  if (u.pathname.endsWith('/d1/database') && req.method === 'POST') {
    const db = { name: JSON.parse(body).name, uuid: 'db-uuid-1' };
    state.dbs.push(db);
    return send({ success: true, result: db });
  }
  if (u.pathname.endsWith('/workers/subdomain') && req.method === 'GET') return send({ success: true, result: state.subdomain ? { subdomain: state.subdomain } : null });
  if (u.pathname.endsWith('/workers/subdomain') && req.method === 'PUT') { state.subdomain = JSON.parse(body).subdomain; return send({ success: true, result: { subdomain: state.subdomain } }); }
  if (u.pathname.includes('/workers/scripts/')) return send({ success: true });
  // Netlify-Mock
  if (u.pathname === '/nf/sites' && req.method === 'GET') return send(state.sites.filter((s) => s.name === u.searchParams.get('name')));
  if (u.pathname === '/nf/sites' && req.method === 'POST') { const s = { id: 'site-1', name: JSON.parse(body).name }; state.sites.push(s); return send(s); }
  if (/^\/nf\/sites\/site-1\/deploys$/.test(u.pathname)) { state.zipBytes = body.length; return send({ id: 'dep-1' }); }
  send({ success: false });
});
await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
const CF_API = `http://127.0.0.1:${(server.address() as { port: number }).port}`;

// Fake-wrangler: protokolliert Aufrufe und Secrets
const work = mkdtempSync(join(tmpdir(), 'mtd-ci-'));
const log = join(work, 'wrangler.log');
const secrets = join(work, 'secrets.json');
writeFileSync(secrets, '[]');
const fake = join(work, 'wrangler');
writeFileSync(fake, `#!/usr/bin/env bash
echo "$*" >> ${log}
if [ "$1" = "secret" ] && [ "$2" = "list" ]; then cat ${secrets}; exit 0; fi
if [ "$1" = "secret" ] && [ "$2" = "put" ]; then v="$(cat)"; node -e "const f='${secrets}';const a=JSON.parse(require('fs').readFileSync(f));a.push({name:process.argv[1],type:'secret_text'});require('fs').writeFileSync(f,JSON.stringify(a));console.error('len',process.argv[2])" "$3" "\${#v}"; exit 0; fi
exit 0
`);
chmodSync(fake, 0o755);

// Skript in Kopie des api-Ordners ausführen (wrangler.toml wird verändert)
const copy = join(work, 'api');
cpSync(apiDir, copy, { recursive: true, filter: (p) => !p.includes('node_modules') });

// Asynchron ausführen — der Mock-Server läuft im selben Prozess
async function run(extra: Record<string, string>) {
  const out = join(work, `out-${Math.random()}`);
  writeFileSync(out, '');
  const { stdout } = await execFileP('bash', [join(copy, 'scripts/ci-deploy.sh')], {
    env: { PATH: process.env.PATH!, CF_API, WRANGLER: fake, GITHUB_OUTPUT: out, ...extra },
    encoding: 'utf8',
    timeout: 30000,
  });
  return { stdout, output: readFileSync(out, 'utf8') };
}

let failed = 0;
const check = (n: string, ok: boolean, info = '') => { console.log(`${ok ? 'OK  ' : 'FAIL'} ${n}${info ? ' — ' + info : ''}`); if (!ok) failed++; };

try {
  let r = await run({});
  check('Ohne Token: übersprungen, api_url leer', r.output.trim() === 'api_url=' && r.stdout.includes('übersprungen'));

  r = await run({ CLOUDFLARE_API_TOKEN: 'cf-token', SUPABASE_ANON_KEY: 'anon-xyz', WALLET_TRANSFER_RPC: 'bank_transfer', WALLET_RECIPIENT: 'uuid-game', EXTRA_ORIGIN: 'https://x.netlify.app' });
  const wl = readFileSync(log, 'utf8');
  check('D1 angelegt und in wrangler.toml eingetragen', state.dbs.length === 1 && readFileSync(join(copy, 'wrangler.toml'), 'utf8').includes('database_id = "db-uuid-1"'));
  check('Migrationen vor Deploy', wl.indexOf('d1 migrations apply maistd --remote') >= 0 && wl.indexOf('d1 migrations') < wl.indexOf('deploy'));
  check('Deploy mit Wallet-Variablen und Origins', /deploy --var ALLOWED_ORIGINS:https:\/\/informationstechnik-humboldt-gymnasium\.github\.io,https:\/\/x\.netlify\.app --var WALLET_TRANSFER_RPC:bank_transfer --var WALLET_RECIPIENT:uuid-game/.test(wl), wl.split('\n').find((l) => l.startsWith('deploy')));
  const sec = JSON.parse(readFileSync(secrets, 'utf8')).map((s: { name: string }) => s.name);
  check('Secrets gesetzt (anon-Key, Sitzungsgeheimnis)', sec.includes('SUPABASE_ANON_KEY') && sec.includes('SESSION_SECRET'), sec.join(','));
  check('Subdomain angelegt, api_url ausgegeben', state.subdomain === 'maistd-abcdef12' && r.output.includes('api_url=https://mais-tower-defense-api.maistd-abcdef12.workers.dev'), r.output.trim());
  check('Account-ID automatisch ermittelt', state.calls.includes('GET /accounts'));

  // Zweiter Lauf: nichts doppelt anlegen, SESSION_SECRET nicht neu erzeugen
  r = await run({ CLOUDFLARE_API_TOKEN: 'cf-token' });
  const sec2 = JSON.parse(readFileSync(secrets, 'utf8')).map((s: { name: string }) => s.name);
  check('Zweiter Lauf: keine zweite DB, kein neues SESSION_SECRET', state.dbs.length === 1 && sec2.filter((n: string) => n === 'SESSION_SECRET').length === 1, sec2.join(','));
  check('Zweiter Lauf: gleiche api_url', r.output.includes('maistd-abcdef12.workers.dev'));

  // Falsches Token: klare Fehlermeldung, Abbruch
  let errOut = '';
  try { await run({ CLOUDFLARE_API_TOKEN: 'falsch' }); } catch (e) { errOut = String((e as { stdout?: string }).stdout ?? ''); }
  check('Falsches Token: Abbruch mit Hinweis', errOut.includes('::error::'), errOut.trim().split('\n').pop());

  // Netlify-Automatik
  const zip = join(work, 'test.zip');
  writeFileSync(zip, 'PK-test-zip-inhalt');
  const nfScript = join(apiDir, '..', 'scripts', 'netlify-deploy.sh');
  const nenv = { PATH: process.env.PATH!, NETLIFY_API: `${CF_API}/nf` };
  let n = await execFileP('bash', [nfScript, zip], { env: nenv, encoding: 'utf8' });
  check('Netlify ohne Token: übersprungen', n.stdout.includes('nicht eingerichtet'));
  n = await execFileP('bash', [nfScript, zip], { env: { ...nenv, NETLIFY_AUTH_TOKEN: 't' }, encoding: 'utf8' });
  check('Netlify: Seite angelegt und ZIP hochgeladen', state.sites.length === 1 && state.zipBytes > 0 && n.stdout.includes('mais-tower-defense-maiskolbistan.netlify.app'));
  await execFileP('bash', [nfScript, zip], { env: { ...nenv, NETLIFY_AUTH_TOKEN: 't' }, encoding: 'utf8' });
  check('Netlify zweiter Lauf: keine zweite Seite', state.sites.length === 1);
} finally {
  server.close();
}
console.log(failed ? `\n${failed} Test(s) fehlgeschlagen` : '\nAlle Tests bestanden');
process.exit(failed ? 1 : 0);
