/**
 * Self-Hosting: dieselbe API wie der Cloudflare Worker, aber mit SQLite.
 *   DB_ADAPTER=sqlite DB_FILE=./maistd.db PORT=8787 npm run selfhost
 * Konfiguration über Umgebungsvariablen (gleiche Namen wie im Worker).
 */
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { handle } from '../src/app.ts';
import { readConfig, configProblems } from '../src/config.ts';
import { migrate, sqliteDb } from './sqlite.ts';

const adapter = process.env.DB_ADAPTER || 'sqlite';
if (adapter !== 'sqlite') {
  console.error(`DB_ADAPTER=${adapter} wird noch nicht unterstützt (verfügbar: sqlite).`);
  process.exit(1);
}
const here = dirname(fileURLToPath(import.meta.url));
const { db, raw } = sqliteDb(process.env.DB_FILE || './maistd.db');
const applied = migrate(raw, join(here, '..', 'migrations'));
if (applied.length) console.log('Migrationen angewendet:', applied.join(', '));

const cfg = readConfig(process.env as Record<string, unknown>);
const problems = configProblems(cfg);
if (problems.length) console.warn('Fehlende Einstellungen:', problems.join(', '));
const trustProxy = process.env.TRUST_PROXY === '1';
const port = Number(process.env.PORT || 8787);

createServer(async (req, res) => {
  try {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const c of req) {
      size += (c as Buffer).length;
      if (size > 100 * 1024) {
        res.writeHead(413).end();
        return;
      }
      chunks.push(c as Buffer);
    }
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
    const fwd = trustProxy ? String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() : '';
    const ip = fwd || req.socket.remoteAddress || 'unknown';
    const method = req.method || 'GET';
    const request = new Request(`http://localhost${req.url}`, {
      method,
      headers,
      body: method === 'GET' || method === 'HEAD' ? undefined : Buffer.concat(chunks),
    });
    const r = await handle(request, { db, cfg, ip, now: Date.now() });
    res.writeHead(r.status, Object.fromEntries(r.headers));
    res.end(Buffer.from(await r.arrayBuffer()));
  } catch {
    res.writeHead(500).end();
  }
}).listen(port, () => console.log(`Mais Tower Defense API läuft auf Port ${port}`));
