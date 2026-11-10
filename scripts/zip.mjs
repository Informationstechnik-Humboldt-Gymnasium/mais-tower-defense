// Packt dist/ in release/mais-tower-defense-vX.Y.Z-netlify.zip (Inhalt = Netlify-Root).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
if (!existsSync('dist/index.html')) {
  console.error('dist/ fehlt — zuerst "npm run build" ausführen.');
  process.exit(1);
}
mkdirSync('release', { recursive: true });
const out = resolve(`release/mais-tower-defense-v${version}-netlify.zip`);
rmSync(out, { force: true });
execFileSync('zip', ['-qr', out, '.'], { cwd: 'dist', stdio: 'inherit' });
console.log(out);
