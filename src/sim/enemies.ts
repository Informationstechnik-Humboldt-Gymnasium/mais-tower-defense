import { DMG } from './types';

export interface TowerAttack {
  range: number;
  interval: number;
  /** Betäubungsdauer in Sekunden. */
  stun: number;
  /** Schaden an Turm-HP. */
  dmg: number;
}

export interface EnemyDef {
  id: number;
  name: string;
  hp: number;
  /** Geschwindigkeit relativ zur Basis (Stufe-1-Soldat = 1). */
  speed: number;
  kids: number[];
  immune: number;
  radius: number;
  color: string;
  reward: number;
  tank: boolean;
  /** Immun gegen Verlangsamung, Rückstoß, Betäubung. */
  unstoppable?: boolean;
  alwaysCamo?: boolean;
  /** Nur besondere Gegner greifen Türme an. */
  attack?: TowerAttack;
}

export const BASE_SPEED = 55; // px/s

const S = DMG.SHARP, X = DMG.EXPLOSION, F = DMG.FROST, E = DMG.ENERGY, H = DMG.FIRE;

function d(
  id: number, name: string, hp: number, speed: number, kids: number[], immune: number,
  radius: number, color: string, reward = 1, extra: Partial<EnemyDef> = {},
): EnemyDef {
  return { id, name, hp, speed, kids, immune, radius, color, reward, tank: false, ...extra };
}

export const E_ID = {
  S1: 0, S2: 1, S3: 2, S4: 3, S5: 4,
  KRABBLER: 5, EISGEIST: 6, ARKAN: 7, EISEN: 8, GRAUBALG: 9, PRISMA: 10, GOLEM: 11,
  LPANZER: 12, SPANZER: 13, SUPER: 14, TARN: 15, KOLOSS: 16,
} as const;

export const ENEMIES: EnemyDef[] = [
  d(0, 'Rekrut (Stufe 1)', 1, 1.0, [], 0, 9, '#d4573f'),
  d(1, 'Gefreiter (Stufe 2)', 1, 1.4, [0], 0, 10, '#3f7bd4'),
  d(2, 'Unteroffizier (Stufe 3)', 1, 1.8, [1], 0, 10, '#3fae4f'),
  d(3, 'Feldwebel (Stufe 4)', 1, 3.2, [2], 0, 11, '#e6c33a'),
  d(4, 'Hauptmann (Stufe 5)', 1, 3.5, [3], 0, 11, '#e46fb0'),
  d(5, 'Schwarzkrabbler', 1, 1.8, [4, 4], X, 8, '#1e1e24'),
  d(6, 'Eisgeist', 1, 2.0, [4, 4], F, 8, '#eef4fb'),
  d(7, 'Arkanschimmer', 1, 3.0, [4, 4], E | H, 9, '#8a4fd8'),
  d(8, 'Eisenrüstung', 1, 1.0, [5, 5], S, 11, '#7d8794'),
  d(9, 'Graubalg', 1, 1.8, [5, 6], X | F, 11, '#9a9a9a'),
  d(10, 'Prisma-Geist', 4, 2.2, [9, 9], 0, 12, '#ff9a3c'),
  d(11, 'Keramik-Golem', 10, 2.5, [10, 10], 0, 13, '#a8673a', 2),
  d(12, 'Leichter Panzer', 200, 1.0, [11, 11, 11, 11], 0, 26, '#5d7a3a', 20, { tank: true }),
  d(13, 'Schwerer Panzer', 700, 0.25, [12, 12, 12, 12], 0, 34, '#3d5a2a', 40, {
    tank: true,
    attack: { range: 170, interval: 4, stun: 2.5, dmg: 20 },
  }),
  d(14, 'Superpanzer', 4000, 0.18, [13, 13, 13, 13], 0, 42, '#2f3d4f', 80, {
    tank: true,
    attack: { range: 200, interval: 3, stun: 3, dmg: 30 },
  }),
  d(15, 'Tarnpanzer', 400, 2.75, [11, 11, 11, 11, 11, 11], X, 24, '#2a2a2a', 40, {
    tank: true,
    alwaysCamo: true,
  }),
  d(16, 'Koloss-Panzer', 20000, 0.18, [14, 14, 15, 15, 15], 0, 52, '#4a1f1f', 150, {
    tank: true,
    unstoppable: true,
    attack: { range: 230, interval: 2.5, stun: 3.5, dmg: 40 },
  }),
];

/** HP-Multiplikator für „Gepanzert". */
export function fortMul(type: number): number {
  if (type === E_ID.EISEN) return 4;
  if (ENEMIES[type].tank || type === E_ID.GOLEM) return 2;
  return 1;
}

/** Gesamt-HP inkl. aller Nachkommen (Lebensverlust beim Durchbrechen). */
export const RBE: Float64Array = new Float64Array(ENEMIES.length);
export const RBE_FORT: Float64Array = new Float64Array(ENEMIES.length);
for (let t = 0; t < ENEMIES.length; t++) {
  const calc = (id: number, fort: boolean): number => {
    const e = ENEMIES[id];
    let s = e.hp * (fort ? fortMul(id) : 1);
    for (const k of e.kids) s += calc(k, fort);
    return s;
  };
  RBE[t] = calc(t, false);
  RBE_FORT[t] = calc(t, true);
}

/** Elterntyp für Regeneration (nur Soldaten-/Monsterkette, keine Panzer). */
export const PARENT: Int8Array = new Int8Array(ENEMIES.length).fill(-1);
for (const e of ENEMIES) {
  if (e.tank) continue;
  for (const k of e.kids) if (PARENT[k] === -1) PARENT[k] = e.id;
}
