import { BASE_SPEED, ENEMIES, PARENT, RBE, RBE_FORT, fortMul } from './enemies';
import { MapDef, Path, WORLD_H, WORLD_W, inEllipse } from './map';
import { Rng } from './rng';
import { LAST_ROUND, SpawnEvent, buildSpawnQueue, cashMultiplier } from './rounds';
import { Stats, TowerDef, canUpgrade, statsFor } from './towers';
import { FLAG } from './types';

export const TICK = 1 / 60;
const CAP_E = 8192;
const CAP_P = 8192;
const CAP_FX = 2048;
const HITS = 8; // gemerkte Treffer pro Projektil
const CELL = 64;
const GW = Math.ceil(WORLD_W / CELL) + 2;
const GH = Math.ceil(WORLD_H / CELL) + 2;
const REGROW_TIME = 2.5;

export type TargetMode = 'first' | 'last' | 'strong' | 'close';
export const TARGET_NAMES: Record<TargetMode, string> = {
  first: 'Erster',
  last: 'Letzter',
  strong: 'Stärkster',
  close: 'Nächster',
};

export interface Tower {
  id: number;
  def: TowerDef;
  x: number;
  y: number;
  lv: [number, number];
  /** Werte aus Basis + Upgrades. */
  base: Stats;
  /** Werte inkl. Support-Buffs. */
  s: Stats;
  cd: number;
  angle: number;
  mode: TargetMode;
  spent: number;
  hp: number;
  stunT: number;
  disabled: boolean;
  pops: number;
  /** Bester Rabatt durch Support in Reichweite. */
  discount: number;
  stunRes: number;
  flash: number;
}

export const FX = { EXPLOSION: 0, BEAM: 1, SHELL: 2, POP: 3 } as const;

export type GamePhase = 'build' | 'wave' | 'lost';

export interface WorldEvents {
  onChange?: () => void;
  onRoundEnd?: (round: number) => void;
  onLost?: () => void;
  onVictory?: () => void;
}

/**
 * Deterministische Simulation. Gegner/Projektile/Effekte liegen in Structure-of-Arrays
 * (TypedArrays, dicht gepackt, Kompaktierung am Tick-Ende) -> keine GC-Last.
 */
export class World {
  readonly map: MapDef;
  readonly paths: Path[];
  readonly rng: Rng;

  // --- Gegner (SoA) ---
  eN = 0;
  eType = new Uint8Array(CAP_E);
  eFlags = new Uint8Array(CAP_E);
  eOrig = new Uint8Array(CAP_E);
  ePath = new Uint8Array(CAP_E);
  eDead = new Uint8Array(CAP_E);
  eSeg = new Uint16Array(CAP_E);
  eUid = new Int32Array(CAP_E);
  eHp = new Float32Array(CAP_E);
  eDist = new Float32Array(CAP_E);
  eX = new Float32Array(CAP_E);
  eY = new Float32Array(CAP_E);
  ePX = new Float32Array(CAP_E);
  ePY = new Float32Array(CAP_E);
  eAng = new Float32Array(CAP_E);
  eSlowT = new Float32Array(CAP_E);
  eStunT = new Float32Array(CAP_E);
  eAtkT = new Float32Array(CAP_E);
  eRegT = new Float32Array(CAP_E);
  private eArrays: (Uint8Array | Uint16Array | Int32Array | Float32Array)[];
  private nextUid = 1;

  // --- Projektile (SoA) ---
  pN = 0;
  pX = new Float32Array(CAP_P);
  pY = new Float32Array(CAP_P);
  pPX = new Float32Array(CAP_P);
  pPY = new Float32Array(CAP_P);
  pVX = new Float32Array(CAP_P);
  pVY = new Float32Array(CAP_P);
  pLife = new Float32Array(CAP_P);
  pDmg = new Float32Array(CAP_P);
  pTank = new Float32Array(CAP_P);
  pSplash = new Float32Array(CAP_P);
  pStun = new Float32Array(CAP_P);
  pPierce = new Int16Array(CAP_P);
  pType = new Uint8Array(CAP_P);
  pMortar = new Uint8Array(CAP_P);
  pDead = new Uint8Array(CAP_P);
  pTower = new Int32Array(CAP_P);
  pHitN = new Uint8Array(CAP_P);
  pHits = new Int32Array(CAP_P * HITS);
  private pArrays: (Uint8Array | Int16Array | Int32Array | Float32Array)[];

  // --- Effekte (SoA) ---
  fxN = 0;
  fxKind = new Uint8Array(CAP_FX);
  fxX = new Float32Array(CAP_FX);
  fxY = new Float32Array(CAP_FX);
  fxX2 = new Float32Array(CAP_FX);
  fxY2 = new Float32Array(CAP_FX);
  fxR = new Float32Array(CAP_FX);
  fxT = new Float32Array(CAP_FX);
  fxMax = new Float32Array(CAP_FX);
  private fxArrays: (Uint8Array | Float32Array)[];

  // --- Spatial Grid (Counting Sort, jeden Tick neu) ---
  private gStart = new Int32Array(GW * GH + 1);
  private gItems = new Int32Array(CAP_E);
  private gCell = new Int32Array(CAP_E);

  // --- Türme ---
  towers: Tower[] = [];
  private nextTowerId = 1;
  private towersDirty = true;
  private curTower: Tower | null = null;

  // --- Spielstand ---
  lives = 150;
  cash = 650;
  round = 0; // zuletzt gestartete Runde
  phase: GamePhase = 'build';
  time = 0;
  totalPops = 0;
  victory = false;
  private queue: SpawnEvent[] = [];
  private qi = 0;
  private roundT = 0;
  private spawnCounter = 0;

  events: WorldEvents = {};
  private tmp = { x: 0, y: 0, a: 0 };

  constructor(map: MapDef, seed = 1) {
    this.map = map;
    this.paths = map.paths.map((p) => new Path(p));
    this.rng = new Rng(seed);
    this.eArrays = [
      this.eType, this.eFlags, this.eOrig, this.ePath, this.eDead, this.eSeg, this.eUid, this.eHp,
      this.eDist, this.eX, this.eY, this.ePX, this.ePY, this.eAng, this.eSlowT, this.eStunT,
      this.eAtkT, this.eRegT,
    ];
    this.pArrays = [
      this.pX, this.pY, this.pPX, this.pPY, this.pVX, this.pVY, this.pLife, this.pDmg, this.pTank,
      this.pSplash, this.pStun, this.pPierce, this.pType, this.pMortar, this.pDead, this.pTower,
      this.pHitN,
    ];
    this.fxArrays = [this.fxKind, this.fxX, this.fxY, this.fxX2, this.fxY2, this.fxR, this.fxT, this.fxMax];
  }

  // =====================================================================
  // Runden
  // =====================================================================

  startRound(): boolean {
    if (this.phase !== 'build') return false;
    this.round++;
    this.queue = buildSpawnQueue(this.round);
    this.qi = 0;
    this.roundT = 0;
    this.phase = 'wave';
    this.changed();
    return true;
  }

  private endRound(): void {
    this.phase = 'build';
    let income = 100 + this.round;
    let lives = 0;
    for (const t of this.towers) {
      if (t.disabled) continue;
      income += t.s.income;
      lives += t.s.lives;
    }
    this.cash += income;
    this.lives += lives;
    this.events.onRoundEnd?.(this.round);
    if (this.round === LAST_ROUND && !this.victory) {
      this.victory = true;
      this.events.onVictory?.();
    }
    this.changed();
  }

  // =====================================================================
  // Türme
  // =====================================================================

  towerCount(def: TowerDef): number {
    let n = 0;
    for (const t of this.towers) if (t.def === def) n++;
    return n;
  }

  /** Prüft Platzierung: Pfad, Hindernisse, andere Türme, Wasser/Land, Limit, Geld. */
  placementError(def: TowerDef, x: number, y: number): string | null {
    const r = def.radius;
    if (x < r || y < r || x > WORLD_W - r || y > WORLD_H - r) return 'Außerhalb der Karte';
    if (this.towerCount(def) >= def.limit) return `Limit erreicht (${def.limit})`;
    if (this.cash < def.cost) return 'Nicht genug Geld';
    for (const p of this.paths) if (p.distanceTo(x, y) < this.map.pathWidth / 2 + r - 2) return 'Auf dem Weg';
    for (const o of this.map.obstacles) if (Math.hypot(o.x - x, o.y - y) < o.r + r) return 'Hindernis im Weg';
    for (const t of this.towers) if (Math.hypot(t.x - x, t.y - y) < t.def.radius + r) return 'Zu nah an einem Turm';
    const onWater = this.map.water.some((w) => inEllipse(w, x, y));
    if (def.water && !onWater) return 'Nur auf Wasser';
    if (!def.water && this.map.water.some((w) => inEllipse(w, x, y, r * 0.6))) return 'Nicht auf Wasser';
    return null;
  }

  placeTower(def: TowerDef, x: number, y: number): Tower | null {
    if (this.placementError(def, x, y)) return null;
    const lv: [number, number] = [0, 0];
    const base = statsFor(def, lv);
    const t: Tower = {
      id: this.nextTowerId++, def, x, y, lv, base, s: { ...base }, cd: 0, angle: -Math.PI / 2,
      mode: 'first', spent: def.cost, hp: def.hp, stunT: 0, disabled: false, pops: 0, discount: 0,
      stunRes: 0, flash: 0,
    };
    this.cash -= def.cost;
    this.towers.push(t);
    this.towersDirty = true;
    this.changed();
    return t;
  }

  upgradeCost(t: Tower, path: 0 | 1): number {
    const up = t.def.paths[path][t.lv[path]];
    if (!up) return Infinity;
    return Math.round((up.cost * (1 - t.discount)) / 5) * 5;
  }

  upgrade(t: Tower, path: 0 | 1): boolean {
    if (!canUpgrade(t.lv, path)) return false;
    const cost = this.upgradeCost(t, path);
    if (this.cash < cost) return false;
    this.cash -= cost;
    t.spent += cost;
    t.lv[path]++;
    t.base = statsFor(t.def, t.lv);
    this.towersDirty = true;
    this.changed();
    return true;
  }

  sellValue(t: Tower): number {
    return Math.floor(t.spent * 0.7);
  }

  sell(t: Tower): void {
    const i = this.towers.indexOf(t);
    if (i < 0) return;
    this.cash += this.sellValue(t);
    this.towers.splice(i, 1);
    this.towersDirty = true;
    this.changed();
  }

  repairCost(t: Tower): number {
    if (t.hp >= t.def.hp) return 0;
    return Math.max(10, Math.round((t.def.cost * 0.15 * (1 - t.hp / t.def.hp)) / 5) * 5);
  }

  repair(t: Tower): boolean {
    const c = this.repairCost(t);
    if (c === 0 || this.cash < c) return false;
    this.cash -= c;
    t.hp = t.def.hp;
    if (t.disabled) {
      t.disabled = false;
      this.towersDirty = true;
    }
    this.changed();
    return true;
  }

  /** Wendet Support-Buffs an (nicht stapelbar — bester Wert je Effekt). */
  private recomputeBuffs(): void {
    this.towersDirty = false;
    for (const t of this.towers) {
      let bRange = 0, bRate = 0, bDmg = 0, bPierce = 0, camo = false, disc = 0, sRes = 0;
      for (const u of this.towers) {
        if (u === t || u.disabled || u.def.cls !== 'Support' || u.base.range <= 0) continue;
        const b = u.base;
        if (Math.hypot(u.x - t.x, u.y - t.y) > b.range + t.def.radius) continue;
        if (b.buffRange > bRange) bRange = b.buffRange;
        if (b.buffRate > bRate) bRate = b.buffRate;
        if (b.buffDmg > bDmg) bDmg = b.buffDmg;
        if (b.buffPierce > bPierce) bPierce = b.buffPierce;
        if (b.grantCamo) camo = true;
        if (b.discount > disc) disc = b.discount;
        if (b.stunRes > sRes) sRes = b.stunRes;
      }
      const s = (t.s = { ...t.base });
      if (s.kind !== 'none') {
        s.range *= 1 + bRange;
        s.interval /= 1 + bRate;
        s.dmg += bDmg;
        s.pierce += bPierce;
        s.camo ||= camo;
      }
      t.discount = disc;
      t.stunRes = Math.max(sRes, 0);
    }
  }

  // =====================================================================
  // Haupt-Tick
  // =====================================================================

  step(dt = TICK): void {
    if (this.isLost()) return;
    this.time += dt;
    if (this.towersDirty) this.recomputeBuffs();

    if (this.phase === 'wave') {
      this.roundT += dt;
      while (this.qi < this.queue.length && this.queue[this.qi].t <= this.roundT) {
        const ev = this.queue[this.qi++];
        const path = this.spawnCounter++ % this.paths.length;
        this.spawn(ev.type, path, 0, ev.flags, ev.type);
      }
    }

    this.moveEnemies(dt);
    if (this.isLost()) return;
    this.buildGrid();
    this.updateTowers(dt);
    this.updateProjectiles(dt);
    this.compactEnemies();
    this.compactProjectiles();
    this.updateFx(dt);

    if (this.phase === 'wave' && this.qi >= this.queue.length && this.eN === 0) this.endRound();
  }

  // =====================================================================
  // Gegner
  // =====================================================================

  spawn(type: number, path: number, dist: number, flags: number, orig: number): number {
    if (this.eN >= CAP_E) return -1;
    const i = this.eN++;
    const def = ENEMIES[type];
    if (def.alwaysCamo) flags |= FLAG.CAMO;
    this.eType[i] = type;
    this.eFlags[i] = flags;
    this.eOrig[i] = orig;
    this.ePath[i] = path;
    this.eDead[i] = 0;
    this.eUid[i] = this.nextUid++;
    this.eHp[i] = def.hp * (flags & FLAG.FORTIFIED ? fortMul(type) : 1);
    this.eDist[i] = dist;
    this.eSlowT[i] = 0;
    this.eStunT[i] = 0;
    this.eAtkT[i] = def.attack ? def.attack.interval * 0.5 : 0;
    this.eRegT[i] = 0;
    this.eSeg[i] = this.paths[path].sample(dist, 0, this.tmp);
    this.eX[i] = this.ePX[i] = this.tmp.x;
    this.eY[i] = this.ePY[i] = this.tmp.y;
    this.eAng[i] = this.tmp.a;
    return i;
  }

  private moveEnemies(dt: number): void {
    const tmp = this.tmp;
    for (let i = 0; i < this.eN; i++) {
      if (this.eDead[i]) continue;
      const type = this.eType[i];
      const def = ENEMIES[type];
      this.ePX[i] = this.eX[i];
      this.ePY[i] = this.eY[i];
      let sp = def.speed * BASE_SPEED;
      if (this.eStunT[i] > 0) {
        this.eStunT[i] -= dt;
        sp = 0;
      }
      if (this.eSlowT[i] > 0) {
        this.eSlowT[i] -= dt;
        sp *= 0.5;
      }
      const path = this.paths[this.ePath[i]];
      const d = (this.eDist[i] += sp * dt);
      if (d >= path.length) {
        this.leak(i);
        if (this.isLost()) return;
        continue;
      }
      this.eSeg[i] = path.sample(d, this.eSeg[i], tmp);
      this.eX[i] = tmp.x;
      this.eY[i] = tmp.y;
      this.eAng[i] = tmp.a;

      // Regeneration: wächst zur nächsthöheren Stufe zurück (bis zum Ursprungstyp)
      if (this.eFlags[i] & FLAG.REGROW && type !== this.eOrig[i]) {
        this.eRegT[i] += dt;
        if (this.eRegT[i] >= REGROW_TIME) {
          this.eRegT[i] = 0;
          const p = PARENT[type];
          if (p >= 0 && RBE[p] <= RBE[this.eOrig[i]]) {
            this.eType[i] = p;
            this.eHp[i] = ENEMIES[p].hp * (this.eFlags[i] & FLAG.FORTIFIED ? fortMul(p) : 1);
          }
        }
      }

      // Besondere Gegner greifen Türme an
      const atk = def.attack;
      if (atk && this.towers.length) {
        this.eAtkT[i] -= dt;
        if (this.eAtkT[i] <= 0) {
          this.eAtkT[i] = atk.interval;
          let best: Tower | null = null;
          let bd = atk.range * atk.range;
          for (const t of this.towers) {
            if (t.disabled) continue;
            const dx = t.x - tmp.x, dy = t.y - tmp.y, dd = dx * dx + dy * dy;
            if (dd < bd) {
              bd = dd;
              best = t;
            }
          }
          if (best) this.hitTower(best, atk.stun, atk.dmg, tmp.x, tmp.y);
        }
      }
    }
  }

  private hitTower(t: Tower, stun: number, dmg: number, fromX: number, fromY: number): void {
    const res = t.stunRes;
    t.stunT = Math.max(t.stunT, stun * (1 - res));
    t.hp -= dmg * (1 - res * 0.5);
    this.addFx(FX.SHELL, fromX, fromY, t.x, t.y, 0, 0.35);
    this.addFx(FX.EXPLOSION, t.x, t.y, 0, 0, 22, 0.3);
    if (t.hp <= 0) {
      t.hp = 0;
      t.disabled = true;
      this.towersDirty = true;
      this.changed();
    }
  }

  private leak(i: number): void {
    const type = this.eType[i];
    const fort = (this.eFlags[i] & FLAG.FORTIFIED) !== 0;
    const full = fort ? RBE_FORT[type] : RBE[type];
    const maxHp = ENEMIES[type].hp * (fort ? fortMul(type) : 1);
    const cost = Math.max(1, Math.ceil(full - (maxHp - this.eHp[i])));
    this.eDead[i] = 1;
    this.lives -= cost;
    if (this.lives <= 0) {
      this.lives = 0;
      this.phase = 'lost';
      this.events.onLost?.();
    }
    this.changed();
  }

  /** Schaden mit Immunitätsprüfung. Rückgabe: false wenn immun (Projektil prallt ab). */
  damage(i: number, dmg: number, dmgType: number, tankMult: number, stun: number): boolean {
    if (this.eDead[i]) return true;
    const def = ENEMIES[this.eType[i]];
    if (def.immune & dmgType) return false;
    if (def.tank) dmg *= tankMult;
    if (stun > 0 && !def.unstoppable) this.eStunT[i] = Math.max(this.eStunT[i], def.tank ? stun * 0.5 : stun);
    this.eRegT[i] = 0;
    this.pop(i, dmg);
    return true;
  }

  private pop(i: number, dmg: number): void {
    const hp = this.eHp[i];
    if (dmg < hp) {
      this.eHp[i] = hp - dmg;
      return;
    }
    let rem = dmg - hp;
    const type = this.eType[i];
    const def = ENEMIES[type];
    this.eDead[i] = 1;
    this.totalPops++;
    if (this.curTower) this.curTower.pops++;
    this.cash += def.reward * cashMultiplier(this.round);
    if (def.tank || type === 11) this.addFx(FX.EXPLOSION, this.eX[i], this.eY[i], 0, 0, def.radius * 1.4, 0.4);
    else if (this.fxN < CAP_FX / 2) this.addFx(FX.POP, this.eX[i], this.eY[i], 0, 0, def.radius, 0.18);
    const flags = this.eFlags[i];
    const kidFlags = def.tank ? flags : flags & ~FLAG.FORTIFIED;
    const path = this.ePath[i];
    const dist = this.eDist[i];
    for (let k = 0; k < def.kids.length; k++) {
      const kt = def.kids[k];
      const j = this.spawn(kt, path, Math.max(0, dist - k * 6), kidFlags, flags & FLAG.REGROW ? this.eOrig[i] : kt);
      if (j < 0) break;
      if (k === 0 && rem > 0) {
        const kh = this.eHp[j];
        this.pop(j, rem);
        rem -= kh;
        if (rem <= 0) rem = 0;
      }
    }
  }

  // =====================================================================
  // Spatial Grid
  // =====================================================================

  private buildGrid(): void {
    const start = this.gStart, cell = this.gCell, items = this.gItems;
    start.fill(0);
    for (let i = 0; i < this.eN; i++) {
      let cx = ((this.eX[i] / CELL) | 0) + 1, cy = ((this.eY[i] / CELL) | 0) + 1;
      cx = cx < 0 ? 0 : cx >= GW ? GW - 1 : cx;
      cy = cy < 0 ? 0 : cy >= GH ? GH - 1 : cy;
      const c = cy * GW + cx;
      cell[i] = c;
      start[c + 1]++;
    }
    for (let c = 0; c < GW * GH; c++) start[c + 1] += start[c];
    // Füllen über Kopie der Startindizes (in gItems via Zähler)
    const fill = this.fillTmp;
    fill.set(start);
    for (let i = 0; i < this.eN; i++) items[fill[cell[i]]++] = i;
  }
  private fillTmp = new Int32Array(GW * GH + 1);

  /** Ruft fn(i) für alle Gegner in Zellen auf, die den Kreis (x,y,r) überdecken. */
  private forEachNear(x: number, y: number, r: number, fn: (i: number) => void | boolean): void {
    let x0 = (((x - r) / CELL) | 0) + 1, x1 = (((x + r) / CELL) | 0) + 1;
    let y0 = (((y - r) / CELL) | 0) + 1, y1 = (((y + r) / CELL) | 0) + 1;
    if (x0 < 0) x0 = 0;
    if (y0 < 0) y0 = 0;
    if (x1 >= GW) x1 = GW - 1;
    if (y1 >= GH) y1 = GH - 1;
    const start = this.gStart, items = this.gItems;
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const c = cy * GW + cx;
        for (let k = start[c]; k < start[c + 1]; k++) if (fn(items[k]) === true) return;
      }
    }
  }

  // =====================================================================
  // Türme feuern
  // =====================================================================

  private findTarget(t: Tower): number {
    const s = t.s;
    const r = s.range, r2 = r * r;
    let best = -1;
    let bestScore = -Infinity;
    const mode = t.mode;
    this.forEachNear(t.x, t.y, r + 50, (i) => {
      if (this.eDead[i]) return;
      if (this.eFlags[i] & FLAG.CAMO && !s.camo) return;
      const er = ENEMIES[this.eType[i]].radius;
      const dx = this.eX[i] - t.x, dy = this.eY[i] - t.y;
      const dd = dx * dx + dy * dy;
      if (dd > r2 + 2 * r * er + er * er) return;
      let score: number;
      switch (mode) {
        case 'first': score = this.eDist[i]; break;
        case 'last': score = -this.eDist[i]; break;
        case 'strong': score = RBE[this.eType[i]] * 1000 + this.eDist[i] * 0.001; break;
        default: score = -dd;
      }
      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
    });
    return best;
  }

  private updateTowers(dt: number): void {
    // Reparatur durch Support
    for (const u of this.towers) {
      if (u.disabled || u.base.repair <= 0) continue;
      for (const t of this.towers) {
        if (t.hp >= t.def.hp) continue;
        if (Math.hypot(u.x - t.x, u.y - t.y) > u.base.range + t.def.radius) continue;
        t.hp = Math.min(t.def.hp, t.hp + u.base.repair * dt);
        if (t.disabled && t.hp >= t.def.hp * 0.5) {
          t.disabled = false;
          this.towersDirty = true;
          this.changed();
        }
      }
    }

    for (const t of this.towers) {
      if (t.flash > 0) t.flash -= dt;
      if (t.stunT > 0) {
        t.stunT -= dt;
        continue;
      }
      if (t.disabled) continue;
      const s = t.s;
      if (s.kind === 'none') continue;
      t.cd -= dt;
      if (t.cd > 0) continue;
      const target = this.findTarget(t);
      if (target < 0) {
        t.cd = 0;
        continue;
      }
      t.cd += s.interval;
      if (t.cd < 0) t.cd = 0;
      t.flash = 0.06;
      const tx = this.eX[target], ty = this.eY[target];
      t.angle = Math.atan2(ty - t.y, tx - t.x);
      this.curTower = t;
      if (s.kind === 'proj') this.fireProjectiles(t, s);
      else if (s.kind === 'mortar') this.fireMortar(t, s, target);
      else if (s.kind === 'beam') this.fireBeam(t, s, target);
      this.curTower = null;
    }
  }

  private fireProjectiles(t: Tower, s: Stats): void {
    const n = s.count;
    const life = (s.range * 1.25) / s.speed;
    for (let k = 0; k < n; k++) {
      if (this.pN >= CAP_P) return;
      const a = t.angle + (k - (n - 1) / 2) * s.spread;
      const j = this.pN++;
      this.pX[j] = this.pPX[j] = t.x + Math.cos(a) * t.def.radius;
      this.pY[j] = this.pPY[j] = t.y + Math.sin(a) * t.def.radius;
      this.pVX[j] = Math.cos(a) * s.speed;
      this.pVY[j] = Math.sin(a) * s.speed;
      this.pLife[j] = life;
      this.pDmg[j] = s.dmg;
      this.pTank[j] = s.tankMult;
      this.pSplash[j] = 0;
      this.pStun[j] = s.stun;
      this.pPierce[j] = s.pierce;
      this.pType[j] = s.dmgType;
      this.pMortar[j] = 0;
      this.pDead[j] = 0;
      this.pTower[j] = t.id;
      this.pHitN[j] = 0;
    }
  }

  private fireMortar(t: Tower, s: Stats, target: number): void {
    // Vorhalt: Zielpunkt ungefähr dort, wo der Gegner bei Einschlag ist
    const def = ENEMIES[this.eType[target]];
    const dist0 = Math.hypot(this.eX[target] - t.x, this.eY[target] - t.y);
    const flight = dist0 / s.speed;
    const path = this.paths[this.ePath[target]];
    path.sample(this.eDist[target] + def.speed * BASE_SPEED * flight, this.eSeg[target], this.tmp);
    for (let k = 0; k < s.count; k++) {
      if (this.pN >= CAP_P) return;
      const ox = k === 0 ? 0 : this.rng.range(-22, 22), oy = k === 0 ? 0 : this.rng.range(-22, 22);
      const tx = this.tmp.x + ox, ty = this.tmp.y + oy;
      const j = this.pN++;
      const dx = tx - t.x, dy = ty - t.y, dl = Math.hypot(dx, dy) || 1;
      this.pX[j] = this.pPX[j] = t.x;
      this.pY[j] = this.pPY[j] = t.y;
      this.pVX[j] = (dx / dl) * s.speed;
      this.pVY[j] = (dy / dl) * s.speed;
      this.pLife[j] = dl / s.speed;
      this.pDmg[j] = s.dmg;
      this.pTank[j] = s.tankMult;
      this.pSplash[j] = s.splash;
      this.pStun[j] = s.stun;
      this.pPierce[j] = s.pierce;
      this.pType[j] = s.dmgType;
      this.pMortar[j] = 1;
      this.pDead[j] = 0;
      this.pTower[j] = t.id;
      this.pHitN[j] = 0;
    }
  }

  private chainSeen = new Int32Array(64);

  private fireBeam(t: Tower, s: Stats, target: number): void {
    let cur = target;
    let fx = t.x, fy = t.y;
    let n = 0;
    const seen = this.chainSeen;
    const maxHops = Math.min(63, s.chain);
    for (let hop = 0; hop <= maxHops && cur >= 0; hop++) {
      const x = this.eX[cur], y = this.eY[cur];
      seen[n++] = this.eUid[cur];
      this.addFx(FX.BEAM, fx, fy, x, y, hop === 0 ? 3 : 2, 0.12);
      this.damage(cur, s.dmg, s.dmgType, s.tankMult, s.stun);
      fx = x;
      fy = y;
      if (hop === maxHops) break;
      // nächstes Kettenziel
      let next = -1;
      let bd = 95 * 95;
      this.forEachNear(x, y, 95, (i) => {
        if (this.eDead[i]) return;
        if (this.eFlags[i] & FLAG.CAMO && !s.camo) return;
        const uid = this.eUid[i];
        for (let q = 0; q < n; q++) if (seen[q] === uid) return;
        const dx = this.eX[i] - x, dy = this.eY[i] - y, dd = dx * dx + dy * dy;
        if (dd < bd) {
          bd = dd;
          next = i;
        }
      });
      cur = next;
    }
  }

  // =====================================================================
  // Projektile
  // =====================================================================

  private towerById(id: number): Tower | null {
    for (const t of this.towers) if (t.id === id) return t;
    return null;
  }

  private explode(j: number): void {
    const x = this.pX[j], y = this.pY[j], r = this.pSplash[j];
    let left = this.pPierce[j];
    const dmg = this.pDmg[j], type = this.pType[j], tank = this.pTank[j], stun = this.pStun[j];
    this.curTower = this.towerById(this.pTower[j]);
    this.forEachNear(x, y, r + 30, (i) => {
      if (this.eDead[i]) return;
      const er = ENEMIES[this.eType[i]].radius;
      const dx = this.eX[i] - x, dy = this.eY[i] - y;
      if (dx * dx + dy * dy > (r + er) * (r + er)) return;
      this.damage(i, dmg, type, tank, stun);
      if (--left <= 0) return true;
    });
    this.curTower = null;
    this.addFx(FX.EXPLOSION, x, y, 0, 0, r, 0.3);
  }

  private updateProjectiles(dt: number): void {
    const HB = HITS;
    for (let j = 0; j < this.pN; j++) {
      if (this.pDead[j]) continue;
      this.pPX[j] = this.pX[j];
      this.pPY[j] = this.pY[j];
      const x = (this.pX[j] += this.pVX[j] * dt);
      const y = (this.pY[j] += this.pVY[j] * dt);
      this.pLife[j] -= dt;
      if (this.pMortar[j]) {
        if (this.pLife[j] <= 0) {
          this.explode(j);
          this.pDead[j] = 1;
        }
        continue;
      }
      if (this.pLife[j] <= 0 || x < -20 || y < -20 || x > WORLD_W + 20 || y > WORLD_H + 20) {
        this.pDead[j] = 1;
        continue;
      }
      // Kollision über Grid
      this.curTower = null;
      let tower: Tower | null | undefined;
      this.forEachNear(x, y, 60, (i) => {
        if (this.eDead[i]) return;
        const er = ENEMIES[this.eType[i]].radius + 4;
        const dx = this.eX[i] - x, dy = this.eY[i] - y;
        if (dx * dx + dy * dy > er * er) return;
        const uid = this.eUid[i];
        const hn = this.pHitN[j];
        const base = j * HB;
        for (let q = 0; q < hn && q < HB; q++) if (this.pHits[base + q] === uid) return;
        this.pHits[base + (hn % HB)] = uid;
        this.pHitN[j] = hn + 1 > 250 ? 250 : hn + 1;
        if (tower === undefined) tower = this.towerById(this.pTower[j]);
        this.curTower = tower;
        this.damage(i, this.pDmg[j], this.pType[j], this.pTank[j], this.pStun[j]);
        if (--this.pPierce[j] <= 0) {
          this.pDead[j] = 1;
          return true;
        }
      });
      this.curTower = null;
    }
  }

  // =====================================================================
  // Kompaktierung
  // =====================================================================

  private compactEnemies(): void {
    const dead = this.eDead;
    const arrs = this.eArrays;
    let w = 0;
    for (let r = 0; r < this.eN; r++) {
      if (dead[r]) continue;
      if (w !== r) for (let a = 0; a < arrs.length; a++) arrs[a][w] = arrs[a][r];
      w++;
    }
    this.eN = w;
  }

  private compactProjectiles(): void {
    const dead = this.pDead;
    const arrs = this.pArrays;
    const hits = this.pHits;
    let w = 0;
    for (let r = 0; r < this.pN; r++) {
      if (dead[r]) continue;
      if (w !== r) {
        for (let a = 0; a < arrs.length; a++) arrs[a][w] = arrs[a][r];
        hits.copyWithin(w * HITS, r * HITS, r * HITS + HITS);
      }
      w++;
    }
    this.pN = w;
  }

  // =====================================================================
  // Effekte
  // =====================================================================

  addFx(kind: number, x: number, y: number, x2: number, y2: number, r: number, dur: number): void {
    if (this.fxN >= CAP_FX) return;
    const k = this.fxN++;
    this.fxKind[k] = kind;
    this.fxX[k] = x;
    this.fxY[k] = y;
    this.fxX2[k] = x2;
    this.fxY2[k] = y2;
    this.fxR[k] = r;
    this.fxT[k] = 0;
    this.fxMax[k] = dur;
  }

  private updateFx(dt: number): void {
    const arrs = this.fxArrays;
    let w = 0;
    for (let r = 0; r < this.fxN; r++) {
      this.fxT[r] += dt;
      if (this.fxT[r] >= this.fxMax[r]) continue;
      if (w !== r) for (let a = 0; a < arrs.length; a++) arrs[a][w] = arrs[a][r];
      w++;
    }
    this.fxN = w;
  }

  isLost(): boolean {
    return this.phase === 'lost';
  }

  private changed(): void {
    this.events.onChange?.();
  }
}
