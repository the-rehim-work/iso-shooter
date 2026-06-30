export interface HudUpdateState {
  health: number;
  maxHealth: number;
  ammo: number;
  reserveMags: number;
  isReloading: boolean;
  myKills: number;
  mode: string;
  teamScores: [number, number];
  myTeam: number;
}

interface KillFeedEntry {
  text: string;
  expiresMs: number;
}

function el(tag: string, css: Partial<CSSStyleDeclaration>): HTMLElement {
  const e = document.createElement(tag);
  Object.assign(e.style, css);
  return e;
}

export class Hud {
  private topLeft: HTMLElement;
  private modeEl: HTMLElement;
  private scoreEl: HTMLElement;
  private feedEl: HTMLElement;
  private healthFill: HTMLElement;
  private healthText: HTMLElement;
  private ammoEl: HTMLElement;
  private debugEl: HTMLElement;
  private killFeed: KillFeedEntry[] = [];

  constructor(container: HTMLElement) {
    container.innerHTML = '';
    Object.assign(container.style, {
      position: 'fixed', inset: '0', pointerEvents: 'none',
      userSelect: 'none', fontFamily: 'monospace',
    });

    this.topLeft = el('div', {
      position: 'absolute', top: '12px', left: '12px',
      color: '#e6b800', fontSize: '15px', lineHeight: '1.7',
      textShadow: '0 1px 3px #000',
    });
    this.modeEl = el('div', { fontWeight: 'bold', letterSpacing: '2px' });
    this.scoreEl = el('div', { fontSize: '14px' });
    this.topLeft.appendChild(this.modeEl);
    this.topLeft.appendChild(this.scoreEl);
    container.appendChild(this.topLeft);

    this.feedEl = el('div', {
      position: 'absolute', top: '12px', right: '12px',
      textAlign: 'right', fontSize: '13px', lineHeight: '1.6',
      textShadow: '0 1px 3px #000', maxWidth: '240px',
    });
    container.appendChild(this.feedEl);

    const healthArea = el('div', {
      position: 'absolute', bottom: '24px', left: '20px',
    });
    const barOuter = el('div', {
      width: '180px', height: '10px', background: '#222',
      borderRadius: '4px', overflow: 'hidden', marginBottom: '5px',
      border: '1px solid #444',
    });
    this.healthFill = el('div', { height: '100%', borderRadius: '3px', background: '#4caf50' });
    barOuter.appendChild(this.healthFill);
    this.healthText = el('div', { color: '#ccc', fontSize: '13px', textShadow: '0 1px 3px #000' });
    healthArea.appendChild(barOuter);
    healthArea.appendChild(this.healthText);
    container.appendChild(healthArea);

    this.ammoEl = el('div', {
      position: 'absolute', bottom: '24px', right: '20px',
      color: '#fff', fontSize: '26px', textAlign: 'right',
      textShadow: '0 1px 6px #000', lineHeight: '1.2',
    });
    container.appendChild(this.ammoEl);

    this.debugEl = el('div', {
      position: 'absolute', bottom: '64px', left: '20px',
      color: '#666', fontSize: '11px', textShadow: '0 1px 2px #000',
    });
    container.appendChild(this.debugEl);
  }

  update(s: HudUpdateState, nowMs: number): void {
    const pct = Math.max(0, Math.min(100, (s.health / s.maxHealth) * 100));
    this.healthFill.style.width = pct + '%';
    this.healthFill.style.background = pct > 50 ? '#4caf50' : pct > 25 ? '#ff9800' : '#f44336';
    this.healthText.textContent = s.health + ' HP';

    const mags = Math.max(0, s.reserveMags);
    this.ammoEl.textContent = s.isReloading ? 'RELOADING...' : s.ammo + ' | ' + mags + ' mags';
    this.ammoEl.style.color = s.isReloading ? '#ffcc00' : '#fff';
    this.ammoEl.style.fontSize = s.isReloading ? '18px' : '26px';

    this.modeEl.textContent = s.mode.toUpperCase();
    if (s.mode === 'tdm') {
      this.scoreEl.textContent = 'Blue ' + s.teamScores[0] + ' - Red ' + s.teamScores[1];
    } else {
      this.scoreEl.textContent = 'Kills: ' + s.myKills;
    }

    this.killFeed = this.killFeed.filter((k) => k.expiresMs > nowMs);
    this.feedEl.innerHTML = this.killFeed
      .slice(-5)
      .reverse()
      .map((k) => '<div style="color:#ffd700">' + k.text + '</div>')
      .join('');
  }

  pushKill(killerLabel: string, victimLabel: string): void {
    this.killFeed.push({
      text: killerLabel + ' killed ' + victimLabel,
      expiresMs: performance.now() + 5000,
    });
    if (this.killFeed.length > 10) this.killFeed.shift();
  }

  setDebug(text: string): void {
    this.debugEl.textContent = text;
  }
}
