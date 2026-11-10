import { defineConfig, loadEnv, type Plugin } from 'vite';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

/** Trägt die API-Adresse in die Content-Security-Policy (connect-src) von dist/_headers ein. */
function cspApi(apiUrl: string): Plugin {
  return {
    name: 'csp-api',
    apply: 'build',
    closeBundle() {
      const f = 'dist/_headers';
      if (!existsSync(f)) return;
      let origin = '';
      try {
        origin = apiUrl ? new URL(apiUrl).origin : '';
      } catch {
        throw new Error('VITE_API_URL ist keine gültige URL');
      }
      const src = origin ? `'self' ${origin}` : `'self'`;
      writeFileSync(f, readFileSync(f, 'utf8').replace('connect-src __CONNECT_SRC__', `connect-src ${src}`));
    },
  };
}

// Relative Basis: funktioniert auf GitHub Pages (Unterordner) und Netlify (Root).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    base: './',
    define: { __APP_VERSION__: JSON.stringify(pkg.version) },
    plugins: [cspApi(env.VITE_API_URL || process.env.VITE_API_URL || '')],
    build: {
      target: 'es2022',
      outDir: 'dist',
      assetsInlineLimit: 0,
      sourcemap: false,
      reportCompressedSize: true,
    },
  };
});
