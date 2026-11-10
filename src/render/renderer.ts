import { ENEMIES, fortMul } from '../sim/enemies';
import { WORLD_H, WORLD_W } from '../sim/map';
import { TowerDef } from '../sim/towers';
import { DMG, FLAG } from '../sim/types';
import { FX, Tower, World } from '../sim/world';
import { Rng } from '../sim/rng';

export interface Ghost {
  def: TowerDef;
  x: number;
  y: number;
  ok: boolean;
}

const PROJ_COLORS: Record<number, string> = {
  [DMG.NORMAL]: '#ffffff',
  [DMG.SHARP]: '#ffe066',
  [DMG.EXPLOSION]: '#3a3a3a',
  [DMG.FROST]: '#bfe8ff',
  [DMG.ENERGY]: '#7ff3ff',
  [DMG.FIRE]: '#ff7a2f',
};

const CLASS_RING: Record<string, string> = {
  'Primär': '#f2d16b',
  'Militär': '#6fa86a',
  'Support': '#b48cf0',
};

/**
 * Canvas-2D-Renderer. Hintergrund wird einmal in ein Offscreen-Canvas gezeichnet,
 * Gegner/Projektile werden nach Typ gebündelt (wenige State-Wechsel).
 */
export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private bg: HTMLCanvasElement;
  scale = 1;
  offX = 0;
  offY = 0;
  private dpr = 1;

  constructor(private canvas: HTMLCanvasElement, private world: World) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D nicht verfügbar');
    this.ctx = ctx;
    this.bg = document.createElement('canvas');
  }

  resize(cssW: number, cssH: number): void {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(cssW * this.dpr);
    this.canvas.height = Math.round(cssH * this.dpr);
    this.canvas.style.width = cssW + 'px';
    this.canvas.style.height = cssH + 'px';
    this.scale = Math.min(cssW / WORLD_W, cssH / WORLD_H);
    this.offX = (cssW - WORLD_W * this.scale) / 2;
    this.offY = (cssH - WORLD_H * this.scale) / 2;
    this.renderBackground();
  }

  /** Bildschirm (CSS-Pixel) -> Welt. */
  toWorld(sx: number, sy: number): { x: number; y: number } {
    return { x: (sx - this.offX) / this.scale, y: (sy - this.offY) / this.scale };
  }

  private renderBackground(): void {
    const s = this.scale * this.dpr;
    const bg = this.bg;
    bg.width = Math.ceil(WORLD_W * s);
    bg.height = Math.ceil(WORLD_H * s);
    const c = bg.getContext('2d')!;
    c.setTransform(s, 0, 0, s, 0, 0);
    const map = this.world.map;

    const grad = c.createLinearGradient(0, 0, 0, WORLD_H);
    grad.addColorStop(0, '#5f8f3a');
    grad.addColorStop(1, '#4d7a2f');
    c.fillStyle = grad;
    c.fillRect(0, 0, WORLD_W, WORLD_H);

    // Maisreihen als Dekoration
    const rng = new Rng(42);
    c.fillStyle = 'rgba(40,70,20,0.35)';
    for (let i = 0; i < 900; i++) {
      const x = rng.next() * WORLD_W, y = rng.next() * WORLD_H;
      c.fillRect(x, y, 2, 5);
    }
    c.fillStyle = 'rgba(240,210,90,0.35)';
    for (let i = 0; i < 260; i++) {
      const x = rng.next() * WORLD_W, y = rng.next() * WORLD_H;
      c.beginPath();
      c.ellipse(x, y, 2, 4, 0.4, 0, Math.PI * 2);
      c.fill();
    }

    // Wasser
    for (const w of map.water) {
      c.fillStyle = '#2f6f9f';
      c.beginPath();
      c.ellipse(w.x, w.y, w.rx + 6, w.ry + 6, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#3f8fc8';
      c.beginPath();
      c.ellipse(w.x, w.y, w.rx, w.ry, 0, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.25)';
      c.lineWidth = 2;
      c.beginPath();
      c.ellipse(w.x - w.rx * 0.2, w.y - w.ry * 0.2, w.rx * 0.5, w.ry * 0.3, 0, 0.2, 2);
      c.stroke();
    }

    // Pfade
    for (const pts of map.paths) {
      const stroke = (width: number, color: string) => {
        c.strokeStyle = color;
        c.lineWidth = width;
        c.lineJoin = 'round';
        c.lineCap = 'round';
        c.beginPath();
        c.moveTo(pts[0], pts[1]);
        for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
        c.stroke();
      };
      stroke(map.pathWidth + 8, '#6b4a2b');
      stroke(map.pathWidth, '#b88b58');
      stroke(map.pathWidth - 18, 'rgba(210,170,110,0.5)');
    }

    // Hindernisse (Felsen)
    for (const o of map.obstacles) {
      c.fillStyle = '#5b5b5b';
      c.beginPath();
      c.arc(o.x, o.y, o.r, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#7c7c7c';
      c.beginPath();
      c.arc(o.x - o.r * 0.25, o.y - o.r * 0.25, o.r * 0.65, 0, Math.PI * 2);
      c.fill();
    }
  }

  render(alpha: number, selected: Tower | null, ghost: Ghost | null): void {
    const ctx = this.ctx;
    const w = this.world;
    const dpr = this.dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#1b1f17';
    ctx.fillRect(0, 0, this.canvas.width / dpr, this.canvas.height / dpr);
    ctx.drawImage(this.bg, this.offX, this.offY, WORLD_W * this.scale, WORLD_H * this.scale);
    const s = this.scale;
    ctx.setTransform(s * dpr, 0, 0, s * dpr, this.offX * dpr, this.offY * dpr);

    // Reichweite des gewählten Turms
    if (selected) this.rangeCircle(selected.x, selected.y, selected.s.kind === 'none' && selected.def.cls !== 'Support' ? 0 : selected.s.range, true);

    this.drawTowers(w);
    this.drawEnemies(w, alpha);
    this.drawProjectiles(w, alpha);
    this.drawFx(w);

    if (ghost) {
      const r = ghost.def.base.range ?? 0;
      this.rangeCircle(ghost.x, ghost.y, r, ghost.ok);
      ctx.globalAlpha = 0.7;
      this.towerBody(ghost.def, ghost.x, ghost.y, -Math.PI / 2, 0, false);
      ctx.globalAlpha = 1;
      if (!ghost.ok) {
        ctx.strokeStyle = '#ff4040';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(ghost.x, ghost.y, ghost.def.radius + 3, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  private rangeCircle(x: number, y: number, r: number, ok: boolean): void {
    if (r <= 0) return;
    const ctx = this.ctx;
    ctx.fillStyle = ok ? 'rgba(255,255,255,0.12)' : 'rgba(255,60,60,0.15)';
    ctx.strokeStyle = ok ? 'rgba(255,255,255,0.5)' : 'rgba(255,60,60,0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  private towerBody(def: TowerDef, x: number, y: number, angle: number, flash: number, dim: boolean): void {
    const ctx = this.ctx;
    const r = def.radius;
    ctx.fillStyle = '#2a2a2a';
    ctx.beginPath();
    ctx.arc(x, y + 2, r + 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = dim ? '#666' : def.color;
    ctx.strokeStyle = CLASS_RING[def.cls] ?? '#fff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    if (def.id === 'farm') ctx.rect(x - r, y - r, r * 2, r * 2);
    else ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (def.id === 'farm') {
      ctx.fillStyle = '#e8c547';
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.ellipse(x + i * 8, y, 3, 8, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }
    if (def.id === 'funk') {
      ctx.strokeStyle = '#2a2a2a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y + 6);
      ctx.lineTo(x, y - r - 8);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y - r - 8, 5, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
      return;
    }
    // Lauf
    const len = r + 8 - (flash > 0 ? 3 : 0);
    ctx.strokeStyle = '#222';
    ctx.lineWidth = def.id === 'moerser' ? 9 : 5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
    ctx.stroke();
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(x, y, r * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawTowers(w: World): void {
    const ctx = this.ctx;
    for (const t of w.towers) {
      this.towerBody(t.def, t.x, t.y, t.angle, t.flash, t.disabled);
      // Upgrade-Stufen
      const pips = `${t.lv[0]}-${t.lv[1]}`;
      if (t.lv[0] + t.lv[1] > 0) {
        ctx.font = 'bold 10px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(t.x - 12, t.y + t.def.radius + 2, 24, 12);
        ctx.fillStyle = '#fff';
        ctx.fillText(pips, t.x, t.y + t.def.radius + 12);
      }
      // HP-Balken bei Schaden
      if (t.hp < t.def.hp) {
        const bw = t.def.radius * 2;
        ctx.fillStyle = '#300';
        ctx.fillRect(t.x - bw / 2, t.y - t.def.radius - 9, bw, 4);
        ctx.fillStyle = t.disabled ? '#888' : '#5fd35f';
        ctx.fillRect(t.x - bw / 2, t.y - t.def.radius - 9, (bw * t.hp) / t.def.hp, 4);
      }
      if (t.stunT > 0 && !t.disabled) {
        ctx.strokeStyle = '#ffe14a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        const r = t.def.radius + 6;
        for (let k = 0; k <= 12; k++) {
          const a = (k / 12) * Math.PI * 2 + w.time * 6;
          const rr = r + (k % 2 ? 4 : 0);
          if (k === 0) ctx.moveTo(t.x + Math.cos(a) * rr, t.y + Math.sin(a) * rr);
          else ctx.lineTo(t.x + Math.cos(a) * rr, t.y + Math.sin(a) * rr);
        }
        ctx.stroke();
      }
      if (t.disabled) {
        ctx.strokeStyle = '#ff3b3b';
        ctx.lineWidth = 3;
        const r = t.def.radius * 0.6;
        ctx.beginPath();
        ctx.moveTo(t.x - r, t.y - r);
        ctx.lineTo(t.x + r, t.y + r);
        ctx.moveTo(t.x + r, t.y - r);
        ctx.lineTo(t.x - r, t.y + r);
        ctx.stroke();
      }
    }
  }

  private drawEnemies(w: World, alpha: number): void {
    const ctx = this.ctx;
    const n = w.eN;
    if (n === 0) return;
    const ia = 1 - alpha;
    const X = w.eX, Y = w.eY, PX = w.ePX, PY = w.ePY, T = w.eType, F = w.eFlags;

    // Pro Typ ein Pfad -> ein fill() je Typ (Soldaten/Monster)
    for (let type = 0; type < ENEMIES.length; type++) {
      const def = ENEMIES[type];
      if (def.tank) continue;
      let any = false;
      const r = def.radius;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        if (T[i] !== type || F[i] & FLAG.CAMO) continue;
        const x = PX[i] * ia + X[i] * alpha, y = PY[i] * ia + Y[i] * alpha;
        ctx.moveTo(x + r, y);
        ctx.arc(x, y, r, 0, Math.PI * 2);
        any = true;
      }
      if (any) {
        ctx.fillStyle = def.color;
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.55)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    // Einzelzeichnung: getarnte, gepanzerte, regenerierende, Panzer
    for (let i = 0; i < n; i++) {
      const def = ENEMIES[T[i]];
      const f = F[i];
      if (!def.tank && !f) continue;
      const x = PX[i] * ia + X[i] * alpha, y = PY[i] * ia + Y[i] * alpha;
      const r = def.radius;
      if (def.tank) {
        this.drawTank(w, i, x, y);
        continue;
      }
      if (f & FLAG.CAMO) {
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = def.color;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = '#d9f0c0';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.setLineDash([]);
      }
      if (f & FLAG.FORTIFIED) {
        ctx.strokeStyle = '#c0c6cc';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, r + 1.5, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (f & FLAG.REGROW) {
        ctx.fillStyle = '#4cff6a';
        ctx.beginPath();
        ctx.arc(x + r * 0.6, y - r * 0.6, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      if (def.hp > 1) this.hpBar(x, y - r - 6, r * 2, w.eHp[i] / (def.hp * (f & FLAG.FORTIFIED ? fortMul(T[i]) : 1)));
    }

    // HP-Balken für Golems/Prisma ohne Flags
    for (let i = 0; i < n; i++) {
      const def = ENEMIES[T[i]];
      if (def.tank || F[i] || def.hp <= 1) continue;
      const x = PX[i] * ia + X[i] * alpha, y = PY[i] * ia + Y[i] * alpha;
      this.hpBar(x, y - def.radius - 6, def.radius * 2, w.eHp[i] / def.hp);
    }
  }

  private drawTank(w: World, i: number, x: number, y: number): void {
    const ctx = this.ctx;
    const def = ENEMIES[w.eType[i]];
    const r = def.radius;
    const camo = (w.eFlags[i] & FLAG.CAMO) !== 0;
    const fort = (w.eFlags[i] & FLAG.FORTIFIED) !== 0;
    const a = w.eAng[i];
    const cos = Math.cos(a), sin = Math.sin(a);
    const s = this.scale * this.dpr;
    ctx.save();
    ctx.setTransform(cos * s, sin * s, -sin * s, cos * s, (x * this.scale + this.offX) * this.dpr, (y * this.scale + this.offY) * this.dpr);
    if (camo) ctx.globalAlpha = 0.55;
    // Ketten
    ctx.fillStyle = '#222';
    ctx.fillRect(-r * 1.1, -r * 0.85, r * 2.2, r * 0.35);
    ctx.fillRect(-r * 1.1, r * 0.5, r * 2.2, r * 0.35);
    // Wanne
    ctx.fillStyle = def.color;
    ctx.fillRect(-r, -r * 0.6, r * 2, r * 1.2);
    ctx.strokeStyle = fort ? '#c0c6cc' : 'rgba(0,0,0,0.6)';
    ctx.lineWidth = fort ? 4 : 2;
    ctx.strokeRect(-r, -r * 0.6, r * 2, r * 1.2);
    // Turm + Rohr
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(0, -r * 0.1, r * 1.3, r * 0.2);
    ctx.restore();
    this.hpBar(x, y - r - 8, r * 2, w.eHp[i] / (def.hp * (fort ? fortMul(w.eType[i]) : 1)));
  }

  private hpBar(x: number, y: number, wdt: number, frac: number): void {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(x - wdt / 2, y, wdt, 3);
    ctx.fillStyle = frac > 0.5 ? '#6fe06f' : frac > 0.25 ? '#e8c547' : '#e85a47';
    ctx.fillRect(x - wdt / 2, y, wdt * Math.max(0, Math.min(1, frac)), 3);
  }

  private drawProjectiles(w: World, alpha: number): void {
    const ctx = this.ctx;
    const n = w.pN;
    if (n === 0) return;
    const ia = 1 - alpha;
    for (const key of Object.keys(PROJ_COLORS)) {
      const type = Number(key);
      let any = false;
      ctx.beginPath();
      for (let j = 0; j < n; j++) {
        if (w.pType[j] !== type) continue;
        const x = w.pPX[j] * ia + w.pX[j] * alpha, y = w.pPY[j] * ia + w.pY[j] * alpha;
        const r = w.pMortar[j] ? 6 : 3;
        ctx.moveTo(x + r, y);
        ctx.arc(x, y, r, 0, Math.PI * 2);
        any = true;
      }
      if (any) {
        ctx.fillStyle = PROJ_COLORS[type];
        ctx.fill();
        if (type === DMG.EXPLOSION) {
          ctx.strokeStyle = '#d9a441';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }
    }
  }

  private drawFx(w: World): void {
    const ctx = this.ctx;
    for (let k = 0; k < w.fxN; k++) {
      const p = w.fxT[k] / w.fxMax[k];
      const kind = w.fxKind[k];
      if (kind === FX.EXPLOSION) {
        ctx.globalAlpha = 1 - p;
        ctx.fillStyle = '#ffb347';
        ctx.beginPath();
        ctx.arc(w.fxX[k], w.fxY[k], w.fxR[k] * (0.5 + p * 0.6), 0, Math.PI * 2);
        ctx.fill();
      } else if (kind === FX.POP) {
        ctx.globalAlpha = 1 - p;
        ctx.strokeStyle = '#fff6c8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(w.fxX[k], w.fxY[k], w.fxR[k] * (0.6 + p), 0, Math.PI * 2);
        ctx.stroke();
      } else if (kind === FX.BEAM) {
        ctx.globalAlpha = 1 - p;
        ctx.strokeStyle = '#7ff3ff';
        ctx.lineWidth = w.fxR[k];
        ctx.beginPath();
        ctx.moveTo(w.fxX[k], w.fxY[k]);
        ctx.lineTo(w.fxX2[k], w.fxY2[k]);
        ctx.stroke();
      } else if (kind === FX.SHELL) {
        ctx.globalAlpha = 1 - p;
        ctx.strokeStyle = '#ff5a3a';
        ctx.lineWidth = 3;
        const x = w.fxX[k] + (w.fxX2[k] - w.fxX[k]) * Math.min(1, p * 2);
        const y = w.fxY[k] + (w.fxY2[k] - w.fxY[k]) * Math.min(1, p * 2);
        ctx.beginPath();
        ctx.moveTo(w.fxX[k], w.fxY[k]);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }
}
