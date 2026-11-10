export const WORLD_W = 1280;
export const WORLD_H = 720;

export interface Ellipse { x: number; y: number; rx: number; ry: number }
export interface Circle { x: number; y: number; r: number }

export interface MapDef {
  id: string;
  name: string;
  difficulty: 'Anfänger' | 'Fortgeschritten' | 'Profi' | 'Experte';
  /** Pfade als Punktlisten [x0,y0,x1,y1,...] in Weltkoordinaten. */
  paths: number[][];
  pathWidth: number;
  water: Ellipse[];
  obstacles: Circle[];
}

/** Vorberechneter Pfad: Positionsabfrage über zurückgelegte Strecke. */
export class Path {
  readonly xs: Float32Array;
  readonly ys: Float32Array;
  readonly cum: Float32Array;
  readonly length: number;
  readonly n: number;

  constructor(pts: number[]) {
    this.n = pts.length / 2;
    this.xs = new Float32Array(this.n);
    this.ys = new Float32Array(this.n);
    this.cum = new Float32Array(this.n);
    let acc = 0;
    for (let i = 0; i < this.n; i++) {
      this.xs[i] = pts[i * 2];
      this.ys[i] = pts[i * 2 + 1];
      if (i > 0) acc += Math.hypot(this.xs[i] - this.xs[i - 1], this.ys[i] - this.ys[i - 1]);
      this.cum[i] = acc;
    }
    this.length = acc;
  }

  /** Schreibt Position + Winkel in out; seg ist ein Hinweis (monoton steigend). Gibt Segment zurück. */
  sample(dist: number, seg: number, out: { x: number; y: number; a: number }): number {
    const cum = this.cum;
    if (dist <= 0) {
      out.x = this.xs[0];
      out.y = this.ys[0];
      out.a = Math.atan2(this.ys[1] - this.ys[0], this.xs[1] - this.xs[0]);
      return 0;
    }
    if (seg >= this.n - 1 || cum[seg] > dist) seg = 0;
    while (seg < this.n - 2 && cum[seg + 1] < dist) seg++;
    const x0 = this.xs[seg], y0 = this.ys[seg];
    const dx = this.xs[seg + 1] - x0, dy = this.ys[seg + 1] - y0;
    const len = cum[seg + 1] - cum[seg] || 1;
    const t = Math.min(1, (dist - cum[seg]) / len);
    out.x = x0 + dx * t;
    out.y = y0 + dy * t;
    out.a = Math.atan2(dy, dx);
    return seg;
  }

  /** Abstand eines Punktes zum Pfad (für Platzierungsregeln). */
  distanceTo(px: number, py: number): number {
    let best = Infinity;
    for (let i = 0; i < this.n - 1; i++) {
      const x0 = this.xs[i], y0 = this.ys[i];
      const dx = this.xs[i + 1] - x0, dy = this.ys[i + 1] - y0;
      const l2 = dx * dx + dy * dy || 1;
      let t = ((px - x0) * dx + (py - y0) * dy) / l2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const ex = x0 + dx * t - px, ey = y0 + dy * t - py;
      const d = ex * ex + ey * ey;
      if (d < best) best = d;
    }
    return Math.sqrt(best);
  }
}

export function inEllipse(e: Ellipse, x: number, y: number, pad = 0): boolean {
  const dx = (x - e.x) / (e.rx + pad), dy = (y - e.y) / (e.ry + pad);
  return dx * dx + dy * dy <= 1;
}

export const MAPS: MapDef[] = [
  {
    id: 'maisfeld',
    name: 'Maisfeld am Bach',
    difficulty: 'Anfänger',
    pathWidth: 44,
    paths: [
      [
        -40, 140, 220, 140, 300, 170, 330, 250, 300, 360, 220, 420, 200, 520, 260, 600, 400, 620,
        520, 580, 560, 470, 540, 330, 580, 220, 680, 160, 800, 170, 870, 240, 880, 360, 840, 470,
        880, 570, 1000, 610, 1120, 560, 1150, 440, 1100, 330, 1130, 220, 1210, 170, 1320, 170,
      ],
    ],
    water: [
      { x: 700, y: 400, rx: 95, ry: 70 },
      { x: 90, y: 620, rx: 70, ry: 55 },
    ],
    obstacles: [
      { x: 420, y: 90, r: 26 },
      { x: 1010, y: 90, r: 30 },
      { x: 1000, y: 380, r: 22 },
      { x: 110, y: 330, r: 24 },
      { x: 1220, y: 660, r: 28 },
    ],
  },
];
