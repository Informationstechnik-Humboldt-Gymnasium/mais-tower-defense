import { TOWERS, TowerDef, canUpgrade } from '../sim/towers';
import { DMG_NAMES } from '../sim/types';
import { TARGET_NAMES, TargetMode, Tower, World } from '../sim/world';

const fmt = (n: number) => Math.floor(n).toLocaleString('de-DE');

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

export interface HudCallbacks {
  pickTower(def: TowerDef): void;
  start(): void;
  toggleSpeed(): void;
  deselect(): void;
  restart(): void;
}

/** DOM-HUD: wird nur bei Zustandsänderungen neu aufgebaut, Zahlen per Diff aktualisiert. */
export class Hud {
  private livesEl: HTMLElement;
  private cashEl: HTMLElement;
  private roundEl: HTMLElement;
  private startBtn: HTMLButtonElement;
  private speedBtn: HTMLButtonElement;
  private autoChk: HTMLInputElement;
  private shop: HTMLElement;
  private panel: HTMLElement;
  private toast: HTMLElement;
  private overlay: HTMLElement;
  private shopBtns = new Map<string, HTMLButtonElement>();
  private last = { lives: -1, cash: -1, round: -1, phase: '' };
  private toastTimer = 0;
  selected: Tower | null = null;
  placing: TowerDef | null = null;
  speed = 1;

  constructor(private world: World, root: HTMLElement, private cb: HudCallbacks) {
    const top = root.querySelector<HTMLElement>('#topbar')!;
    const side = root.querySelector<HTMLElement>('#side')!;
    this.overlay = root.querySelector<HTMLElement>('#overlay')!;

    const stat = (label: string) => {
      const box = el('div', 'stat');
      box.append(el('span', 'stat-label', label));
      const v = el('span', 'stat-value', '0');
      box.append(v);
      top.append(box);
      return v;
    };
    this.livesEl = stat('Leben');
    this.cashEl = stat('Geld');
    this.roundEl = stat('Runde');

    const ctrls = el('div', 'controls');
    this.startBtn = el('button', 'btn btn-primary', 'Runde starten');
    this.startBtn.title = 'Leertaste';
    this.startBtn.onclick = () => cb.start();
    this.speedBtn = el('button', 'btn', 'Tempo 1x');
    this.speedBtn.onclick = () => cb.toggleSpeed();
    const autoLbl = el('label', 'auto');
    this.autoChk = el('input');
    this.autoChk.type = 'checkbox';
    autoLbl.append(this.autoChk, document.createTextNode(' Auto-Start'));
    ctrls.append(this.startBtn, this.speedBtn, autoLbl);
    top.append(ctrls);

    this.shop = el('div', 'shop');
    this.panel = el('div', 'panel');
    side.append(el('h2', 'side-title', 'Türme'), this.shop, this.panel);
    this.buildShop();

    this.toast = el('div', 'toast');
    root.querySelector('#stage')!.append(this.toast);
  }

  get autoStart(): boolean {
    return this.autoChk.checked;
  }

  private buildShop(): void {
    const classes = ['Primär', 'Militär', 'Support'] as const;
    TOWERS.forEach((def, idx) => {
      const b = el('button', `shop-item cls-${classes.indexOf(def.cls)}`);
      b.dataset.id = def.id;
      const sw = el('span', 'swatch');
      sw.style.background = def.color;
      const info = el('span', 'shop-info');
      info.append(el('span', 'shop-name', def.name), el('span', 'shop-meta', `${def.cls} · Taste ${idx + 1}`));
      const price = el('span', 'shop-price', `$${fmt(def.cost)}`);
      const cnt = el('span', 'shop-count', '');
      b.append(sw, info, price, cnt);
      b.title = def.desc;
      b.onclick = () => this.cb.pickTower(def);
      this.shop.append(b);
      this.shopBtns.set(def.id, b);
    });
  }

  showToast(msg: string): void {
    this.toast.textContent = msg;
    this.toast.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toast.classList.remove('show'), 1600);
  }

  setSpeed(s: number): void {
    this.speed = s;
    this.speedBtn.textContent = `Tempo ${s}x`;
  }

  /** Billige Per-Frame-Aktualisierung (nur bei Wertänderung DOM schreiben). */
  tick(): void {
    const w = this.world;
    const l = this.last;
    if (w.lives !== l.lives) {
      l.lives = w.lives;
      this.livesEl.textContent = fmt(w.lives);
    }
    const cash = Math.floor(w.cash);
    if (cash !== l.cash) {
      l.cash = cash;
      this.cashEl.textContent = '$' + fmt(cash);
      this.refreshAffordability();
    }
    if (w.round !== l.round || w.phase !== l.phase) {
      l.round = w.round;
      l.phase = w.phase;
      this.roundEl.textContent = `${w.round} / 100`;
      this.startBtn.disabled = w.phase !== 'build';
      this.startBtn.textContent = w.phase === 'wave' ? 'Runde läuft' : `Runde ${w.round + 1} starten`;
    }
  }

  private refreshAffordability(): void {
    for (const def of TOWERS) {
      const b = this.shopBtns.get(def.id)!;
      const n = this.world.towerCount(def);
      b.classList.toggle('poor', this.world.cash < def.cost);
      b.classList.toggle('full', n >= def.limit);
      (b.lastChild as HTMLElement).textContent = `${n}/${def.limit}`;
      b.classList.toggle('active', this.placing === def);
    }
    if (this.selected) this.refreshPanelButtons();
  }

  /** Vollständiger Neuaufbau (bei Auswahl/Upgrade/Platzierung). */
  refresh(): void {
    this.last.cash = -1;
    this.tick();
    this.buildPanel();
  }

  private panelBtns: { b: HTMLButtonElement; check: () => boolean }[] = [];

  private refreshPanelButtons(): void {
    for (const p of this.panelBtns) p.b.disabled = !p.check();
  }

  private buildPanel(): void {
    const t = this.selected;
    this.panel.replaceChildren();
    this.panelBtns = [];
    if (!t) {
      this.panel.append(el('p', 'hint', 'Turm wählen und auf die Karte klicken. Platzierten Turm anklicken für Upgrades. Esc bricht ab.'));
      return;
    }
    const w = this.world;
    const head = el('div', 'panel-head');
    head.append(el('h3', '', t.def.name), el('span', 'tag', t.def.cls));
    const close = el('button', 'btn btn-small', 'Schließen');
    close.onclick = () => this.cb.deselect();
    head.append(close);
    this.panel.append(head);

    const s = t.s;
    const facts = el('div', 'facts');
    const fact = (k: string, v: string) => {
      const f = el('div', 'fact');
      f.append(el('span', '', k), el('b', '', v));
      facts.append(f);
    };
    if (s.kind !== 'none') {
      fact('Schaden', `${s.dmg}${s.count > 1 ? ' x' + s.count : ''}`);
      fact('Feuerrate', `${(1 / s.interval).toFixed(2)}/s`);
      fact('Reichweite', `${Math.round(s.range)}`);
      fact('Durchschlag', s.kind === 'beam' ? `${1 + s.chain} Ziele` : `${s.pierce}`);
      fact('Art', DMG_NAMES[s.dmgType] ?? '-');
      fact('Getarnte', s.camo ? 'ja' : 'nein');
    }
    if (s.income) fact('Einkommen', `$${s.income}/Runde`);
    if (s.lives) fact('Leben', `+${s.lives}/Runde`);
    if (t.def.cls === 'Support' && t.def.id === 'funk') fact('Reichweite', `${Math.round(t.base.range)}`);
    fact('Turm-HP', `${Math.ceil(t.hp)}/${t.def.hp}`);
    fact('Besiegt', fmt(t.pops));
    this.panel.append(facts);

    if (t.disabled) this.panel.append(el('p', 'warn', 'Außer Gefecht — reparieren!'));
    else if (t.stunT > 0) this.panel.append(el('p', 'warn', 'Betäubt'));

    // Zwei Upgrade-Pfade (TDX-Stil, Crosspath 5-2)
    const paths = el('div', 'paths');
    for (const p of [0, 1] as const) {
      const col = el('div', 'path');
      col.append(el('div', 'path-name', t.def.pathNames[p]));
      const pips = el('div', 'pips');
      for (let i = 0; i < 5; i++) pips.append(el('span', i < t.lv[p] ? 'pip on' : 'pip'));
      col.append(pips);
      const next = t.def.paths[p][t.lv[p]];
      if (!next) {
        col.append(el('div', 'up-max', 'Maximal'));
      } else if (!canUpgrade(t.lv, p)) {
        col.append(el('div', 'up-locked', 'Gesperrt (5-2-Regel)'));
      } else {
        const b = el('button', 'btn up-btn');
        const cost = w.upgradeCost(t, p);
        b.append(el('span', 'up-name', next.name), el('span', 'up-desc', next.desc), el('span', 'up-cost', `$${fmt(cost)}`));
        b.onclick = () => {
          if (w.upgrade(t, p)) this.refresh();
        };
        this.panelBtns.push({ b, check: () => w.cash >= w.upgradeCost(t, p) });
        col.append(b);
      }
      paths.append(col);
    }
    this.panel.append(paths);

    if (t.s.kind !== 'none') {
      const tm = el('div', 'targets');
      tm.append(el('span', 'tm-label', 'Ziel:'));
      (Object.keys(TARGET_NAMES) as TargetMode[]).forEach((m) => {
        const b = el('button', 'btn btn-small' + (t.mode === m ? ' on' : ''), TARGET_NAMES[m]);
        b.onclick = () => {
          t.mode = m;
          this.buildPanel();
        };
        tm.append(b);
      });
      this.panel.append(tm);
    }

    const actions = el('div', 'actions');
    if (t.hp < t.def.hp) {
      const rb = el('button', 'btn', `Reparieren $${fmt(w.repairCost(t))}`);
      rb.onclick = () => {
        if (w.repair(t)) this.refresh();
      };
      this.panelBtns.push({ b: rb, check: () => w.cash >= w.repairCost(t) });
      actions.append(rb);
    }
    const sb = el('button', 'btn btn-danger', `Verkaufen $${fmt(w.sellValue(t))}`);
    sb.onclick = () => {
      w.sell(t);
      this.cb.deselect();
    };
    actions.append(sb);
    this.panel.append(actions);
    this.refreshPanelButtons();
  }

  showOverlay(title: string, text: string, btnText: string, onClick: () => void): void {
    this.overlay.replaceChildren();
    const box = el('div', 'ov-box');
    box.append(el('h2', '', title), el('p', '', text));
    const b = el('button', 'btn btn-primary', btnText);
    b.onclick = () => {
      this.overlay.classList.remove('show');
      onClick();
    };
    box.append(b);
    this.overlay.append(box);
    this.overlay.classList.add('show');
  }
}
