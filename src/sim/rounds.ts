import { E_ID as E, RBE } from './enemies';
import { FLAG } from './types';
import { Rng } from './rng';

export interface Group {
  type: number;
  count: number;
  /** Abstand zwischen Spawns (s). */
  spacing: number;
  /** Startzeit innerhalb der Runde (s). */
  start: number;
  flags: number;
}

const C = FLAG.CAMO, R = FLAG.REGROW, F = FLAG.FORTIFIED;
const g = (type: number, count: number, spacing: number, start = 0, flags = 0): Group => ({ type, count, spacing, start, flags });

/** Handgebaute Runden 1–40 (BTD6-artige Kurve: Spaltungen, Cluster, Eigenschaften). */
const HAND: Group[][] = [
  /* 1 */ [g(E.S1, 20, 0.7)],
  /* 2 */ [g(E.S1, 35, 0.5)],
  /* 3 */ [g(E.S1, 25, 0.5), g(E.S2, 5, 0.8, 6)],
  /* 4 */ [g(E.S1, 35, 0.4), g(E.S2, 18, 0.6, 4)],
  /* 5 */ [g(E.S1, 5, 0.6), g(E.S2, 27, 0.45, 2)],
  /* 6 */ [g(E.S1, 15, 0.5), g(E.S2, 15, 0.5, 3), g(E.S3, 4, 0.8, 8)],
  /* 7 */ [g(E.S1, 20, 0.4), g(E.S2, 25, 0.4, 3), g(E.S3, 5, 0.7, 10)],
  /* 8 */ [g(E.S1, 10, 0.4), g(E.S2, 20, 0.4, 2), g(E.S3, 14, 0.5, 8)],
  /* 9 */ [g(E.S3, 30, 0.45)],
  /* 10 */ [g(E.S2, 102, 0.18)],
  /* 11 */ [g(E.S1, 10, 0.4), g(E.S2, 10, 0.4, 2), g(E.S3, 12, 0.4, 5), g(E.S4, 3, 0.8, 9)],
  /* 12 */ [g(E.S2, 15, 0.4), g(E.S3, 10, 0.4, 4), g(E.S4, 5, 0.6, 8)],
  /* 13 */ [g(E.S2, 50, 0.25), g(E.S3, 23, 0.35, 6)],
  /* 14 */ [g(E.S1, 49, 0.2), g(E.S2, 15, 0.35, 5), g(E.S3, 10, 0.4, 9), g(E.S4, 9, 0.5, 12)],
  /* 15 */ [g(E.S1, 20, 0.3), g(E.S2, 15, 0.3, 3), g(E.S3, 12, 0.35, 6), g(E.S4, 10, 0.4, 9), g(E.S5, 5, 0.6, 12)],
  /* 16 */ [g(E.S3, 40, 0.25), g(E.S4, 8, 0.5, 6)],
  /* 17 */ [g(E.S4, 12, 0.5, 0, R)],
  /* 18 */ [g(E.S3, 80, 0.15)],
  /* 19 */ [g(E.S3, 10, 0.3), g(E.S4, 4, 0.5, 3, R), g(E.S5, 5, 0.5, 6), g(E.S4, 10, 0.4, 9)],
  /* 20 */ [g(E.KRABBLER, 6, 0.8)],
  /* 21 */ [g(E.S5, 14, 0.5), g(E.S4, 20, 0.3, 4)],
  /* 22 */ [g(E.EISGEIST, 16, 0.6)],
  /* 23 */ [g(E.KRABBLER, 7, 0.7), g(E.EISGEIST, 7, 0.7, 1)],
  /* 24 */ [g(E.S3, 1, 1, 0, C), g(E.S2, 20, 0.4, 1)],
  /* 25 */ [g(E.S4, 25, 0.4, 0, R), g(E.S5, 8, 0.6, 6)],
  /* 26 */ [g(E.S5, 23, 0.35), g(E.GRAUBALG, 4, 1, 6)],
  /* 27 */ [g(E.S1, 60, 0.1), g(E.S2, 45, 0.12, 2), g(E.S3, 45, 0.12, 5), g(E.S4, 45, 0.12, 8)],
  /* 28 */ [g(E.EISEN, 6, 1.2)],
  /* 29 */ [g(E.S4, 50, 0.2, 0, R), g(E.S5, 20, 0.3, 6, R)],
  /* 30 */ [g(E.EISEN, 9, 0.9), g(E.S5, 15, 0.4, 4)],
  /* 31 */ [g(E.GRAUBALG, 8, 0.8), g(E.KRABBLER, 10, 0.5, 4, R)],
  /* 32 */ [g(E.KRABBLER, 25, 0.35), g(E.EISGEIST, 28, 0.35, 3), g(E.ARKAN, 8, 0.6, 7)],
  /* 33 */ [g(E.S4, 20, 0.3, 0, C), g(E.S1, 20, 0.2, 2)],
  /* 34 */ [g(E.S4, 140, 0.08), g(E.S5, 20, 0.3, 6)],
  /* 35 */ [g(E.S5, 35, 0.2), g(E.KRABBLER, 25, 0.3, 4), g(E.PRISMA, 5, 1, 9)],
  /* 36 */ [g(E.S5, 81, 0.12)],
  /* 37 */ [g(E.KRABBLER, 20, 0.3), g(E.EISGEIST, 20, 0.3, 3), g(E.EISEN, 7, 0.8, 6), g(E.GRAUBALG, 10, 0.5, 9), g(E.KRABBLER, 6, 0.5, 12, C)],
  /* 38 */ [g(E.S5, 42, 0.2), g(E.EISGEIST, 17, 0.3, 4), g(E.EISEN, 14, 0.5, 8), g(E.GRAUBALG, 10, 0.5, 11), g(E.GOLEM, 2, 1.5, 14)],
  /* 39 */ [g(E.KRABBLER, 10, 0.3), g(E.EISGEIST, 10, 0.3, 2), g(E.GRAUBALG, 20, 0.35, 5), g(E.PRISMA, 18, 0.5, 10)],
  /* 40 */ [g(E.LPANZER, 1, 1)],
];

/** Meilenstein-Runden mit schweren Gegnern. */
const MILESTONE: Record<number, Group[]> = {
  50: [g(E.LPANZER, 2, 3), g(E.GOLEM, 20, 0.4, 4)],
  60: [g(E.SPANZER, 1, 1)],
  63: [g(E.GOLEM, 75, 0.15, 0, R), g(E.SPANZER, 2, 4, 6)],
  70: [g(E.SPANZER, 2, 3), g(E.LPANZER, 6, 1.5, 4, F)],
  76: [g(E.SPANZER, 4, 2, 0, F), g(E.GOLEM, 40, 0.2, 2, F)],
  80: [g(E.SUPER, 1, 1)],
  90: [g(E.TARN, 3, 1.2), g(E.SPANZER, 4, 2, 3, F)],
  95: [g(E.SUPER, 2, 3, 0, F), g(E.TARN, 6, 0.8, 6)],
  100: [g(E.KOLOSS, 1, 1)],
};

const POOL_EARLY = [E.S5, E.KRABBLER, E.EISGEIST, E.ARKAN, E.EISEN, E.GRAUBALG, E.PRISMA, E.GOLEM];
const POOL_LATE = [E.GOLEM, E.PRISMA, E.LPANZER, E.SPANZER, E.TARN];

/** Budget-basierter Generator für Runden > 40 (und Freeplay). Deterministisch pro Runde. */
function generated(round: number): Group[] {
  const rng = new Rng(round * 7919 + 13);
  const budget = Math.floor(120 * Math.pow(1.105, round - 40) + round * 40);
  const groups: Group[] = [];
  let spent = 0;
  let t = 0;
  const pool = round < 70 ? POOL_EARLY : round < 90 ? [...POOL_EARLY.slice(5), ...POOL_LATE.slice(0, 3)] : POOL_LATE;
  let guard = 0;
  while (spent < budget && guard++ < 40) {
    const type = pool[Math.floor(rng.next() * pool.length)];
    let flags = 0;
    if (rng.next() < Math.min(0.5, (round - 30) / 120)) flags |= R;
    if (rng.next() < Math.min(0.4, (round - 35) / 140)) flags |= C;
    if (rng.next() < Math.min(0.6, (round - 60) / 80)) flags |= F;
    const unit = RBE[type] * (flags & F ? 2 : 1);
    const count = Math.max(1, Math.min(120, Math.floor((budget - spent) / unit / (1 + rng.next() * 2))));
    const spacing = Math.max(0.06, Math.min(1.5, 14 / count));
    groups.push(g(type, count, spacing, t, flags));
    spent += unit * count;
    t += count * spacing * 0.6 + 1;
  }
  // Ab 100 im Freeplay: zusätzlich skalierende Panzerwellen
  if (round > 100) groups.push(g(E.SUPER, Math.floor((round - 95) / 5), 2.5, 2, F));
  return groups;
}

export function roundGroups(round: number): Group[] {
  if (round <= HAND.length) return HAND[round - 1];
  if (MILESTONE[round]) return MILESTONE[round];
  return generated(round);
}

export interface SpawnEvent { t: number; type: number; flags: number }

export function buildSpawnQueue(round: number): SpawnEvent[] {
  const q: SpawnEvent[] = [];
  for (const gr of roundGroups(round)) {
    for (let i = 0; i < gr.count; i++) q.push({ t: gr.start + i * gr.spacing, type: gr.type, flags: gr.flags });
  }
  q.sort((a, b) => a.t - b.t);
  return q;
}

/** Pop-Geld-Multiplikator nach Runde (BTD6-artig abnehmend). */
export function cashMultiplier(round: number): number {
  if (round <= 50) return 1;
  if (round <= 60) return 0.5;
  if (round <= 85) return 0.2;
  if (round <= 100) return 0.1;
  if (round <= 120) return 0.05;
  return 0.02;
}

export const LAST_ROUND = 100;
