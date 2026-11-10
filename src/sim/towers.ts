import { DMG } from './types';

export type TowerClass = 'Primär' | 'Militär' | 'Support';
export type AttackKind = 'proj' | 'mortar' | 'beam' | 'none';

/** Kampfwerte eines Turms — Basis + Upgrades, danach Buffs. */
export interface Stats {
  kind: AttackKind;
  range: number;
  interval: number;
  dmg: number;
  pierce: number;
  speed: number;
  dmgType: number;
  splash: number;
  count: number;
  spread: number;
  camo: boolean;
  /** Schadensmultiplikator gegen Panzer. */
  tankMult: number;
  /** Betäubung von Gegnern (Sekunden). */
  stun: number;
  /** Zusätzliche Kettenziele (Strahl). */
  chain: number;
  /** Geld pro Rundenende. */
  income: number;
  /** Leben pro Rundenende. */
  lives: number;
  // Support-Effekte auf Türme in Reichweite (nicht stapelbar, bester Wert zählt)
  buffRange: number;
  buffRate: number;
  buffDmg: number;
  buffPierce: number;
  grantCamo: boolean;
  discount: number;
  /** Turm-Reparatur HP/s. */
  repair: number;
  /** Reduziert Betäubung durch Panzer (0..1). */
  stunRes: number;
}

export interface Upgrade {
  name: string;
  cost: number;
  desc: string;
  mod: (s: Stats) => void;
}

export interface TowerDef {
  id: string;
  name: string;
  cls: TowerClass;
  cost: number;
  /** Platzierungslimit pro Partie (TDX-Prinzip). */
  limit: number;
  radius: number;
  water: boolean;
  hp: number;
  color: string;
  desc: string;
  base: Partial<Stats>;
  pathNames: [string, string];
  paths: [Upgrade[], Upgrade[]];
}

export function baseStats(p: Partial<Stats>): Stats {
  return {
    kind: 'none', range: 150, interval: 1, dmg: 1, pierce: 1, speed: 600, dmgType: DMG.NORMAL,
    splash: 0, count: 1, spread: 0, camo: false, tankMult: 1, stun: 0, chain: 0, income: 0,
    lives: 0, buffRange: 0, buffRate: 0, buffDmg: 0, buffPierce: 0, grantCamo: false,
    discount: 0, repair: 0, stunRes: 0, ...p,
  };
}

const u = (name: string, cost: number, desc: string, mod: (s: Stats) => void): Upgrade => ({ name, cost, desc, mod });

export const TOWERS: TowerDef[] = [
  {
    id: 'kolben',
    name: 'Kolbenschütze',
    cls: 'Primär',
    cost: 200,
    limit: 40,
    radius: 14,
    water: false,
    hp: 100,
    color: '#e8c547',
    desc: 'Günstiger Schütze mit harten Maiskörnern.',
    base: { kind: 'proj', range: 150, interval: 0.95, dmg: 1, pierce: 2, speed: 650, dmgType: DMG.SHARP },
    pathNames: ['Präzision', 'Sturmtrupp'],
    paths: [
      [
        u('Lange Läufe', 120, '+30 Reichweite', (s) => { s.range += 30; }),
        u('Zielfernrohr', 180, 'Erkennt getarnte Gegner, +15 Reichweite', (s) => { s.camo = true; s.range += 15; }),
        u('Panzerbrechend', 650, '+1 Schaden, +2 Durchschlag', (s) => { s.dmg += 1; s.pierce += 2; }),
        u('Gefechtsschütze', 1900, '+3 Schaden, schneller', (s) => { s.dmg += 3; s.interval *= 0.8; }),
        u('Elite-Kolbenschütze', 9500, '+8 Schaden, doppelter Panzerschaden', (s) => { s.dmg += 8; s.interval *= 0.6; s.pierce += 4; s.tankMult *= 2; }),
      ],
      [
        u('Schnellladen', 140, 'Feuert 25 % schneller', (s) => { s.interval *= 0.8; }),
        u('Kolbenhagel', 220, '+2 Durchschlag', (s) => { s.pierce += 2; }),
        u('Dreifachschuss', 600, 'Schießt 3 Körner im Fächer', (s) => { s.count = 3; s.spread = 0.22; }),
        u('Salvenfeuer', 1700, 'Feuert deutlich schneller', (s) => { s.interval *= 0.6; }),
        u('Maisgewitter', 8500, '7 Körner pro Schuss, noch schneller', (s) => { s.count = 7; s.spread = 0.16; s.interval *= 0.6; s.dmg += 1; }),
      ],
    ],
  },
  {
    id: 'moerser',
    name: 'Körnermörser',
    cls: 'Primär',
    cost: 500,
    limit: 20,
    radius: 16,
    water: false,
    hp: 120,
    color: '#b5763b',
    desc: 'Explosive Flächengranaten mit großer Reichweite.',
    base: { kind: 'mortar', range: 260, interval: 1.6, dmg: 1, pierce: 14, speed: 380, dmgType: DMG.EXPLOSION, splash: 38 },
    pathNames: ['Großkaliber', 'Feuerwalze'],
    paths: [
      [
        u('Größere Ladung', 300, '+12 Explosionsradius', (s) => { s.splash += 12; }),
        u('Schwere Granaten', 450, '+1 Schaden', (s) => { s.dmg += 1; }),
        u('Panzerknacker', 1200, '+1 Schaden, dreifacher Panzerschaden', (s) => { s.dmg += 1; s.tankMult *= 3; }),
        u('Bunkerbrecher', 3600, '+4 Schaden, größerer Radius', (s) => { s.dmg += 4; s.splash += 10; s.pierce += 10; }),
        u('Erdbebengranate', 14500, '+12 Schaden, betäubt Gegner', (s) => { s.dmg += 12; s.splash += 25; s.pierce += 30; s.stun = 0.6; }),
      ],
      [
        u('Ladeschützen', 300, 'Feuert 33 % schneller', (s) => { s.interval *= 0.75; }),
        u('Weitreichend', 250, '+60 Reichweite', (s) => { s.range += 60; }),
        u('Brandgranaten', 950, 'Feuerschaden (trifft Schwarzkrabbler), +6 Durchschlag', (s) => { s.dmgType = DMG.FIRE; s.pierce += 6; }),
        u('Doppelrohr', 2900, 'Zwei Granaten pro Salve', (s) => { s.count = 2; }),
        u('Feuerwalze', 11500, 'Drei Granaten, viel schneller, +2 Schaden', (s) => { s.count = 3; s.interval *= 0.4; s.dmg += 2; }),
      ],
    ],
  },
  {
    id: 'laser',
    name: 'Laserposten',
    cls: 'Militär',
    cost: 900,
    limit: 12,
    radius: 15,
    water: false,
    hp: 100,
    color: '#5fd3e8',
    desc: 'Energiestrahl, trifft sofort, erkennt Getarnte.',
    base: { kind: 'beam', range: 170, interval: 0.45, dmg: 2, pierce: 1, dmgType: DMG.ENERGY, camo: true },
    pathNames: ['Kettenlaser', 'Panzerjäger'],
    paths: [
      [
        u('Fokuslinse', 400, '+25 Reichweite', (s) => { s.range += 25; }),
        u('Streustrahl', 650, 'Strahl springt auf 2 weitere Ziele', (s) => { s.chain += 2; }),
        u('Kettenblitz', 1600, '+3 Sprünge, +1 Schaden', (s) => { s.chain += 3; s.dmg += 1; }),
        u('Plasmagitter', 5200, '+5 Sprünge, schneller', (s) => { s.chain += 5; s.interval *= 0.7; }),
        u('Sonnenlanze', 21000, '+10 Sprünge, +6 Schaden', (s) => { s.chain += 10; s.dmg += 6; s.interval *= 0.6; }),
      ],
      [
        u('Überladung', 500, '+2 Schaden', (s) => { s.dmg += 2; }),
        u('Kühlsystem', 700, 'Feuert 25 % schneller', (s) => { s.interval *= 0.8; }),
        u('Hitzestrahl', 2300, 'Dreifacher Panzerschaden', (s) => { s.tankMult *= 3; }),
        u('Railgun-Modul', 7200, '+15 Schaden, etwas langsamer', (s) => { s.dmg += 15; s.interval *= 1.3; s.range += 40; }),
        u('Orbitallaser', 29000, '+60 Schaden, vierfacher Panzerschaden', (s) => { s.dmg += 60; s.tankMult *= 4 / 3; }),
      ],
    ],
  },
  {
    id: 'farm',
    name: 'Maisfarm',
    cls: 'Support',
    cost: 1100,
    limit: 12,
    radius: 22,
    water: false,
    hp: 150,
    color: '#86b84a',
    desc: 'Erzeugt Geld am Ende jeder Runde.',
    base: { kind: 'none', range: 0, income: 80 },
    pathNames: ['Großfarm', 'Hilfswerk'],
    paths: [
      [
        u('Mehr Felder', 500, '+40 Geld pro Runde', (s) => { s.income += 40; }),
        u('Bewässerung', 650, '+60 Geld pro Runde', (s) => { s.income += 60; }),
        u('Maisplantage', 3100, '+250 Geld pro Runde', (s) => { s.income += 250; }),
        u('Agrarkonzern', 7800, '+600 Geld pro Runde', (s) => { s.income += 600; }),
        u('Maisimperium', 31000, '+2000 Geld pro Runde', (s) => { s.income += 2000; }),
      ],
      [
        u('Erntehelfer', 300, '+20 Geld pro Runde', (s) => { s.income += 20; }),
        u('Marktstand', 800, '+50 Geld pro Runde', (s) => { s.income += 50; }),
        u('Lebensmittelspende', 2600, '+2 Leben pro Runde, +80 Geld', (s) => { s.lives += 2; s.income += 80; }),
        u('Feldlazarett', 6200, '+5 Leben pro Runde, +300 Geld', (s) => { s.lives += 3; s.income += 300; }),
        u('Ernährungsministerium', 26000, '+15 Leben pro Runde, +900 Geld', (s) => { s.lives += 10; s.income += 900; }),
      ],
    ],
  },
  {
    id: 'funk',
    name: 'Funkmast',
    cls: 'Support',
    cost: 1000,
    limit: 6,
    radius: 16,
    water: false,
    hp: 120,
    color: '#c9a0ff',
    desc: 'Verstärkt, schützt und repariert Türme in Reichweite.',
    base: { kind: 'none', range: 160 },
    pathNames: ['Kommando', 'Logistik'],
    paths: [
      [
        u('Funkverstärker', 300, 'Türme in Reichweite: +10 % Reichweite', (s) => { s.buffRange = 0.1; }),
        u('Taktikfunk', 800, 'Türme feuern 15 % schneller', (s) => { s.buffRate = 0.15; }),
        u('Radar', 1900, 'Türme in Reichweite erkennen Getarnte', (s) => { s.grantCamo = true; s.range += 20; }),
        u('Feldkommando', 6200, 'Türme feuern 30 % schneller, +1 Durchschlag', (s) => { s.buffRate = 0.3; s.buffPierce = 1; }),
        u('Oberkommando', 21000, '+60 % Feuerrate, +30 % Reichweite, +1 Schaden', (s) => { s.buffRate = 0.6; s.buffRange = 0.3; s.buffDmg = 1; }),
      ],
      [
        u('Werkstatt', 400, 'Repariert Türme (4 HP/s)', (s) => { s.repair = 4; }),
        u('Rabattverträge', 700, 'Upgrades in Reichweite 10 % günstiger', (s) => { s.discount = 0.1; }),
        u('Schildgenerator', 2100, 'Halbiert Betäubung durch Panzer', (s) => { s.stunRes = 0.5; }),
        u('Großhandel', 5200, '20 % Rabatt, Reparatur 12 HP/s', (s) => { s.discount = 0.2; s.repair = 12; }),
        u('Versorgungszentrale', 18500, '30 % Rabatt, fast keine Betäubung, Reparatur 40 HP/s', (s) => { s.discount = 0.3; s.stunRes = 0.9; s.repair = 40; }),
      ],
    ],
  },
];

export const TOWER_BY_ID: Record<string, TowerDef> = Object.fromEntries(TOWERS.map((t) => [t.id, t]));

/** TDX-Crosspath „5-2": Ein Pfad bis 5, der andere höchstens bis 2. */
export function canUpgrade(lv: [number, number], path: 0 | 1): boolean {
  const next = lv[path] + 1;
  if (next > 5) return false;
  const other = lv[1 - path];
  return next <= 2 || other <= 2;
}

export function statsFor(def: TowerDef, lv: [number, number]): Stats {
  const s = baseStats(def.base);
  for (let p = 0; p < 2; p++) for (let i = 0; i < lv[p]; i++) def.paths[p][i].mod(s);
  return s;
}
