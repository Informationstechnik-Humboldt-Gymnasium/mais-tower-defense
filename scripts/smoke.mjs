// Smoke-Test: baut nicht selbst — erwartet einen fertigen dist/-Ordner.
// Startet vite preview, lädt das Spiel headless, platziert Türme, spielt Runden,
// prüft Konsole auf Fehler und misst die Simulationszeit bei 1500+ Gegnern.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');

const PORT = 4173;
const URL = `http://localhost:${PORT}/`;
const shot = process.argv.includes('--shot') ? process.argv[process.argv.indexOf('--shot') + 1] : null;

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' });
await new Promise((res, rej) => {
  const to = setTimeout(() => rej(new Error('preview start timeout')), 20000);
  server.stdout.on('data', (d) => { if (String(d).includes(String(PORT))) { clearTimeout(to); res(); } });
});

let failed = false;
const check = (name, ok, info = '') => {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${info ? ' — ' + info : ''}`);
  if (!ok) failed = true;
};

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 820 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(URL);
  await page.waitForFunction(() => window.__mtd && window.__mtd.world);
  check('Spiel startet', true);

  // Turm über die UI platzieren: Shop-Klick + Klick auf Karte
  await page.click('.shop-item[data-id="kolben"]');
  const box = await page.locator('#c').boundingBox();
  const place = async (wx, wy) => {
    const p = await page.evaluate(([x, y]) => {
      const c = document.getElementById('c').getBoundingClientRect();
      const s = Math.min(c.width / 1280, c.height / 720);
      return { x: (c.width - 1280 * s) / 2 + x * s, y: (c.height - 720 * s) / 2 + y * s };
    }, [wx, wy]);
    await page.mouse.click(box.x + p.x, box.y + p.y);
  };
  await place(260, 230);
  const n1 = await page.evaluate(() => window.__mtd.world.towers.length);
  check('Turm per UI platziert', n1 === 1, `${n1} Türme`);
  check('Upgrade-Panel sichtbar', await page.locator('.paths .path').count() === 2);

  // Upgrade über UI
  await page.locator('.up-btn').first().click();
  const lv = await page.evaluate(() => window.__mtd.world.towers[0].lv.join('-'));
  check('Upgrade gekauft', lv === '1-0', lv);

  // 5-2-Regel
  const rule = await page.evaluate(() => {
    const w = window.__mtd.world; const t = w.towers[0]; w.cash = 1e7;
    for (let i = 0; i < 5; i++) w.upgrade(t, 0);
    w.upgrade(t, 1); w.upgrade(t, 1); const third = w.upgrade(t, 1);
    return { lv: t.lv.join('-'), third };
  });
  check('Crosspath 5-2 erzwungen', rule.lv === '5-2' && rule.third === false, rule.lv);

  // Runde 1 per Button starten und durchlaufen
  await page.click('.controls .btn-primary');
  await page.evaluate(() => window.__mtd.fast(60 * 60));
  const r1 = await page.evaluate(() => ({ round: window.__mtd.world.round, phase: window.__mtd.world.phase, lives: window.__mtd.world.lives, pops: window.__mtd.world.totalPops }));
  check('Runde 1 läuft und endet', r1.round === 1 && r1.phase === 'build' && r1.pops > 0, JSON.stringify(r1));

  // Mehr Verteidigung bauen und bis Runde 40 simulieren
  const prog = await page.evaluate(() => {
    const w = window.__mtd.world; const T = window.__mtd.TOWERS; w.cash = 1e6;
    const spots = [[380, 250], [460, 470], [700, 260], [760, 520], [960, 470], [1000, 250], [150, 220], [640, 640], [340, 520], [960, 330]];
    const kinds = ['kolben', 'moerser', 'laser', 'kolben', 'moerser', 'laser', 'funk', 'farm', 'laser', 'kolben'];
    spots.forEach(([x, y], i) => {
      const def = T.find((d) => d.id === kinds[i]);
      const t = w.placeTower(def, x, y);
      if (t) { for (let k = 0; k < 3; k++) w.upgrade(t, 0); w.upgrade(t, 1); w.upgrade(t, 1); }
    });
    let guard = 0;
    while (w.round < 40 && !w.isLost() && guard++ < 1e6) {
      if (w.phase === 'build') w.startRound();
      w.step(1 / 60);
    }
    return { round: w.round, lives: w.lives, towers: w.towers.length, phase: w.phase };
  });
  check('Runden bis 40 spielbar', prog.round >= 40, JSON.stringify(prog));

  // Panzer greifen Türme an
  const atk = await page.evaluate(() => {
    const w = window.__mtd.world;
    const t = w.towers[0];
    const hp0 = t.hp;
    // Schwerer Panzer (13) direkt neben dem ersten Turm platzieren
    const i = w.spawn(13, 0, 300, 0, 13);
    w.eX[i] = t.x + 40; w.eY[i] = t.y; w.eAtkT[i] = 0;
    for (let k = 0; k < 5; k++) w.step(1 / 60);
    return { hp0, hp: t.hp, stun: t.stunT };
  });
  check('Schwerer Panzer betäubt/beschädigt Turm', atk.stun > 0 || atk.hp < atk.hp0, JSON.stringify(atk));

  // Performance: 1500 Gegner + Türme, Simulationszeit pro Tick
  const perf = await page.evaluate(() => {
    const w = window.__mtd.world;
    for (let i = 0; i < 1500; i++) w.spawn(4, 0, (i * 1.3) % 2500, 0, 4);
    const t0 = performance.now();
    for (let k = 0; k < 120; k++) w.step(1 / 60);
    const ms = (performance.now() - t0) / 120;
    return { ms, enemies: w.eN, proj: w.pN };
  });
  check('Sim < 4 ms/Tick bei 1500 Gegnern', perf.ms < 4, `${perf.ms.toFixed(2)} ms, ${perf.enemies} Gegner, ${perf.proj} Projektile`);

  // Render-FPS messen
  const fps = await page.evaluate(() => new Promise((res) => {
    let n = 0; const t0 = performance.now();
    const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else res(n / 2); };
    requestAnimationFrame(f);
  }));
  check('Rendert flüssig (headless)', fps > 30, `${fps.toFixed(0)} FPS`);

  if (shot) await page.screenshot({ path: shot });
  check('Keine Konsolenfehler', errors.length === 0, errors.slice(0, 3).join(' | '));
} finally {
  await browser.close();
  server.kill();
}
process.exit(failed ? 1 : 0);
