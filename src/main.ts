import './style.css';
import { MAPS } from './sim/map';
import { TOWERS, TowerDef } from './sim/towers';
import { TICK, Tower, World } from './sim/world';
import { Ghost, Renderer } from './render/renderer';
import { Hud } from './ui/hud';

declare const __APP_VERSION__: string;
document.getElementById('ver')!.textContent = 'v' + __APP_VERSION__;

const SPEEDS = [1, 2, 3];

let world: World;
let renderer: Renderer;
let hud: Hud;
let ghost: Ghost | null = null;
let hudDirty = true;

const root = document.getElementById('app')!;
const stage = document.getElementById('stage')!;
const canvas = document.getElementById('c') as HTMLCanvasElement;

function newGame(): void {
  world = new World(MAPS[0], Date.now() & 0xffff);
  world.events = {
    onChange: () => { hudDirty = true; },
    onRoundEnd: () => {
      if (hud.autoStart) world.startRound();
    },
    onLost: () => hud.showOverlay('Verloren', `Die Felder sind gefallen in Runde ${world.round}.`, 'Neues Spiel', restart),
    onVictory: () => hud.showOverlay('Sieg', 'Runde 100 geschafft! Weiter im Freeplay?', 'Weiterspielen', () => {}),
  };
}

function restart(): void {
  newGame();
  renderer = new Renderer(canvas, world);
  resize();
  const side = document.getElementById('side')!;
  const top = document.getElementById('topbar')!;
  side.replaceChildren();
  top.querySelectorAll(':scope > :not(.brand)').forEach((n) => n.remove());
  stage.querySelectorAll('.toast').forEach((n) => n.remove());
  const speed = hud?.speed ?? 1;
  hud = new Hud(world, root, callbacks);
  hud.setSpeed(speed);
  hud.refresh();
}

const callbacks = {
  pickTower(def: TowerDef) {
    if (hud.placing === def) return cancelPlacing();
    const n = world.towerCount(def);
    if (n >= def.limit) return hud.showToast(`Limit erreicht (${def.limit})`);
    if (world.cash < def.cost) return hud.showToast('Nicht genug Geld');
    hud.selected = null;
    hud.placing = def;
    hud.refresh();
  },
  start() {
    world.startRound();
  },
  toggleSpeed() {
    const i = SPEEDS.indexOf(hud.speed);
    hud.setSpeed(SPEEDS[(i + 1) % SPEEDS.length]);
  },
  deselect() {
    hud.selected = null;
    hud.refresh();
  },
  restart,
};

function cancelPlacing(): void {
  hud.placing = null;
  ghost = null;
  hud.refresh();
}

function resize(): void {
  const r = stage.getBoundingClientRect();
  renderer.resize(Math.max(1, r.width), Math.max(1, r.height));
}
new ResizeObserver(() => renderer && resize()).observe(stage);

function pointerWorld(e: PointerEvent) {
  const r = canvas.getBoundingClientRect();
  return renderer.toWorld(e.clientX - r.left, e.clientY - r.top);
}

canvas.addEventListener('pointermove', (e) => {
  if (!hud.placing) return;
  const p = pointerWorld(e);
  ghost = { def: hud.placing, x: p.x, y: p.y, ok: world.placementError(hud.placing, p.x, p.y) === null };
});
canvas.addEventListener('pointerleave', () => {
  if (ghost && hud.placing && hud.placing) ghost = null;
});
canvas.addEventListener('pointerdown', (e) => {
  const p = pointerWorld(e);
  if (hud.placing) {
    const def = hud.placing;
    const err = world.placementError(def, p.x, p.y);
    if (err) {
      hud.showToast(err);
      ghost = { def, x: p.x, y: p.y, ok: false };
      return;
    }
    const t = world.placeTower(def, p.x, p.y);
    if (!e.shiftKey || world.cash < def.cost) {
      hud.placing = null;
      ghost = null;
      hud.selected = t;
    }
    hud.refresh();
    return;
  }
  let hit: Tower | null = null;
  for (const t of world.towers) {
    if (Math.hypot(t.x - p.x, t.y - p.y) <= t.def.radius + 6) hit = t;
  }
  hud.selected = hit;
  hud.refresh();
});

window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement) return;
  if (e.key === 'Escape') {
    if (hud.placing) cancelPlacing();
    else callbacks.deselect();
  } else if (e.key === ' ') {
    e.preventDefault();
    world.startRound();
  } else if (/^[1-9]$/.test(e.key)) {
    const def = TOWERS[Number(e.key) - 1];
    if (def) callbacks.pickTower(def);
  } else if (hud.selected && (e.key === ',' || e.key === '.')) {
    if (world.upgrade(hud.selected, e.key === ',' ? 0 : 1)) hud.refresh();
  }
});

// --- Spielschleife: fester Zeitschritt + Interpolation ---
let acc = 0;
let last = performance.now();
let panelT = 0;
function frame(now: number): void {
  const dt = Math.min(0.25, (now - last) / 1000);
  last = now;
  acc += dt * hud.speed;
  let steps = 0;
  while (acc >= TICK && steps < 12) {
    world.step(TICK);
    acc -= TICK;
    steps++;
  }
  if (steps === 12) acc = 0; // Spirale des Todes vermeiden
  panelT += dt;
  if (hudDirty || (hud.selected && panelT > 0.5)) {
    hudDirty = false;
    panelT = 0;
    if (hud.selected && !world.towers.includes(hud.selected)) hud.selected = null;
    hud.refresh();
  } else hud.tick();
  renderer.render(acc / TICK, hud.selected, ghost);
  requestAnimationFrame(frame);
}

restart();
requestAnimationFrame(frame);

// Test-Schnittstelle für automatisierte Smoke-Tests (keine Geheimnisse, nur Spielzustand)
(window as unknown as { __mtd: unknown }).__mtd = {
  get world() { return world; },
  TOWERS,
  fast(steps: number) { for (let i = 0; i < steps; i++) world.step(TICK); },
};
