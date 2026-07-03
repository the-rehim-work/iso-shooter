import { MODE_NAMES, type GameMode, type ModeState } from '@iso/shared';

export interface ScoreRow {
  name: string;
  kills: number;
  deaths: number;
  score: number;
  team: number;
  isMe: boolean;
  isBot: boolean;
}

export interface HudUpdateState {
  health: number;
  maxHealth: number;
  ammo: number;
  reserveMags: number;
  isReloading: boolean;
  weaponName: string;
  melee: boolean;
  className: string;
  myKills: number;
  myDeaths: number;
  myScore: number;
  myNetId: number;
  mode: GameMode;
  modeState: ModeState;
  myTeam: number;
  interactHint: string;
  dead: boolean;
  grenades: { frag: number; molotov: number; smoke: number };
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
  private modeEl: HTMLElement;
  private scoreEl: HTMLElement;
  private objectiveEl: HTMLElement;
  private debugTopEl: HTMLElement;
  private feedEl: HTMLElement;
  private healthFill: HTMLElement;
  private healthText: HTMLElement;
  private classEl: HTMLElement;
  private ammoEl: HTMLElement;
  private weaponEl: HTMLElement;
  private grenadeEl: HTMLElement;
  private debugEl: HTMLElement;
  private bannerEl: HTMLElement;
  private hintEl: HTMLElement;
  private progressWrap: HTMLElement;
  private progressFill: HTMLElement;
  private pointsRow: HTMLElement;
  private pointDots: HTMLElement[] = [];
  private scoreboardEl: HTMLElement;
  private killFeed: KillFeedEntry[] = [];
  private lastBanner = '';
  private bannerShownMs = 0;

  constructor(container: HTMLElement) {
    container.innerHTML = '';
    Object.assign(container.style, {
      position: 'fixed', inset: '0', pointerEvents: 'none',
      userSelect: 'none', fontFamily: 'monospace', zIndex: '10',
    });

    const topLeft = el('div', {
      position: 'absolute', top: '12px', left: '12px',
      color: '#e6b800', fontSize: '15px', lineHeight: '1.6', textShadow: '0 1px 3px #000',
    });
    this.modeEl = el('div', { fontWeight: 'bold', letterSpacing: '2px' });
    this.scoreEl = el('div', { fontSize: '14px', color: '#ddd' });
    this.objectiveEl = el('div', { fontSize: '12px', color: '#9ab' });
    this.debugTopEl = el('div', { fontSize: '11px', color: '#667', marginTop: '4px' });
    topLeft.appendChild(this.modeEl);
    topLeft.appendChild(this.scoreEl);
    topLeft.appendChild(this.objectiveEl);
    topLeft.appendChild(this.debugTopEl);
    container.appendChild(topLeft);

    this.pointsRow = el('div', {
      position: 'absolute', top: '12px', left: '50%', transform: 'translateX(-50%)',
      display: 'flex', gap: '10px',
    });
    container.appendChild(this.pointsRow);

    this.feedEl = el('div', {
      position: 'absolute', top: '60px', right: '12px',
      textAlign: 'right', fontSize: '13px', lineHeight: '1.6',
      textShadow: '0 1px 3px #000', maxWidth: '260px',
    });
    container.appendChild(this.feedEl);

    this.bannerEl = el('div', {
      position: 'absolute', top: '74px', left: '50%', transform: 'translateX(-50%)',
      color: '#fff', fontSize: '26px', fontWeight: 'bold', letterSpacing: '4px',
      textShadow: '0 2px 8px #000', opacity: '0', transition: 'opacity 0.3s',
    });
    container.appendChild(this.bannerEl);

    const healthArea = el('div', { position: 'absolute', bottom: '24px', left: '20px' });
    this.classEl = el('div', { color: '#e6b800', fontSize: '12px', letterSpacing: '2px', marginBottom: '5px', textShadow: '0 1px 3px #000' });
    const barOuter = el('div', {
      width: '200px', height: '12px', background: '#222', borderRadius: '4px',
      overflow: 'hidden', marginBottom: '5px', border: '1px solid #444',
    });
    this.healthFill = el('div', { height: '100%', borderRadius: '3px', background: '#4caf50', transition: 'width 0.1s' });
    barOuter.appendChild(this.healthFill);
    this.healthText = el('div', { color: '#ccc', fontSize: '13px', textShadow: '0 1px 3px #000' });
    healthArea.appendChild(this.classEl);
    healthArea.appendChild(barOuter);
    healthArea.appendChild(this.healthText);
    container.appendChild(healthArea);

    const ammoArea = el('div', { position: 'absolute', bottom: '24px', right: '20px', textAlign: 'right' });
    this.weaponEl = el('div', { color: '#aab', fontSize: '13px', letterSpacing: '2px', textShadow: '0 1px 3px #000' });
    this.ammoEl = el('div', { color: '#fff', fontSize: '28px', textShadow: '0 1px 6px #000', lineHeight: '1.2' });
    this.grenadeEl = el('div', { color: '#9ab', fontSize: '13px', textShadow: '0 1px 3px #000', marginTop: '4px' });
    ammoArea.appendChild(this.weaponEl);
    ammoArea.appendChild(this.ammoEl);
    ammoArea.appendChild(this.grenadeEl);
    container.appendChild(ammoArea);

    this.hintEl = el('div', {
      position: 'absolute', bottom: '120px', left: '50%', transform: 'translateX(-50%)',
      color: '#ffd700', fontSize: '15px', letterSpacing: '1px', textShadow: '0 1px 4px #000',
    });
    container.appendChild(this.hintEl);

    this.progressWrap = el('div', {
      position: 'absolute', bottom: '96px', left: '50%', transform: 'translateX(-50%)',
      width: '220px', height: '8px', background: '#222', border: '1px solid #555',
      borderRadius: '4px', overflow: 'hidden', display: 'none',
    });
    this.progressFill = el('div', { height: '100%', width: '0%', background: '#ff8800' });
    this.progressWrap.appendChild(this.progressFill);
    container.appendChild(this.progressWrap);

    this.debugEl = el('div', {
      position: 'absolute', bottom: '70px', left: '20px',
      color: '#666', fontSize: '11px', textShadow: '0 1px 2px #000',
    });
    container.appendChild(this.debugEl);

    this.scoreboardEl = el('div', {
      position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
      background: 'rgba(12,14,18,0.94)', border: '1px solid #333', borderRadius: '10px',
      padding: '20px 26px', minWidth: '420px', display: 'none', fontSize: '13px',
    });
    container.appendChild(this.scoreboardEl);
  }

  update(s: HudUpdateState, nowMs: number): void {
    const pct = Math.max(0, Math.min(100, (s.health / Math.max(1, s.maxHealth)) * 100));
    this.healthFill.style.width = pct + '%';
    this.healthFill.style.background = pct > 50 ? '#4caf50' : pct > 25 ? '#ff9800' : '#f44336';
    this.healthText.textContent = Math.max(0, Math.round(s.health)) + ' / ' + s.maxHealth + ' HP';
    this.classEl.textContent = s.className.toUpperCase();

    if (s.dead) {
      this.weaponEl.textContent = '';
      this.ammoEl.textContent = 'ELIMINATED';
      this.ammoEl.style.color = '#f44336';
      this.ammoEl.style.fontSize = '20px';
    } else {
      this.weaponEl.textContent = s.weaponName.toUpperCase();
      this.ammoEl.textContent = s.melee ? '∞' : s.isReloading ? 'RELOAD' : s.ammo + ' | ' + Math.max(0, s.reserveMags);
      this.ammoEl.style.color = s.isReloading && !s.melee ? '#ffcc00' : '#fff';
      this.ammoEl.style.fontSize = s.isReloading && !s.melee ? '20px' : '28px';
    }

    const g = s.grenades;
    this.grenadeEl.textContent = '✚' + g.frag + '  ◈' + g.molotov + '  ☁' + g.smoke;

    this.modeEl.textContent = MODE_NAMES[s.mode];
    this.renderObjective(s);

    this.hintEl.textContent = s.interactHint;

    const ms = s.modeState;
    if ((s.mode === 'bomb' && ms.phase === 'planted') || (s.mode === 'bomb' && ms.bombProgress > 0 && ms.bombProgress < 1)) {
      this.progressWrap.style.display = 'block';
      this.progressFill.style.width = Math.round(ms.bombProgress * 100) + '%';
      this.progressFill.style.background = ms.phase === 'planted' ? '#33cc66' : '#ff8800';
    } else {
      this.progressWrap.style.display = 'none';
    }

    if (ms.banner && ms.banner !== this.lastBanner) {
      this.lastBanner = ms.banner;
      this.bannerShownMs = nowMs;
      this.bannerEl.textContent = ms.banner;
      this.bannerEl.style.opacity = '1';
    }
    if (this.bannerEl.style.opacity === '1' && nowMs - this.bannerShownMs > 2500) {
      this.bannerEl.style.opacity = '0';
    }

    this.killFeed = this.killFeed.filter((k) => k.expiresMs > nowMs);
    this.feedEl.innerHTML = this.killFeed
      .slice(-6).reverse()
      .map((k) => '<div style="color:#ffd700">' + k.text + '</div>')
      .join('');
  }

  private renderObjective(s: HudUpdateState): void {
    const ms = s.modeState;
    if (s.mode === 'ffa') {
      this.scoreEl.textContent = 'Leader ' + ms.scoreA + ' / ' + ms.targetScore;
      this.objectiveEl.textContent = 'You: ' + s.myKills + ' K · ' + s.myDeaths + ' D · ' + s.myScore + ' pts';
    } else if (s.mode === 'gungame') {
      this.scoreEl.textContent = 'Your level ' + (s.myKills + 1) + ' / ' + ms.targetScore;
      this.objectiveEl.textContent = 'Get a kill with every weapon';
    } else if (s.mode === 'tdm') {
      this.scoreEl.textContent = 'Blue ' + ms.scoreA + ' — Red ' + ms.scoreB;
      this.objectiveEl.textContent = 'Eliminate the enemy team  ·  [T] switch team';
    } else if (s.mode === 'domination') {
      this.scoreEl.textContent = 'Blue ' + ms.scoreA + ' — Red ' + ms.scoreB + ' / ' + ms.targetScore;
      this.objectiveEl.textContent = 'Hold control points  ·  [T] switch team';
      this.renderPoints(ms);
    } else if (s.mode === 'bomb') {
      this.scoreEl.textContent = 'Atk ' + ms.scoreA + ' — Def ' + ms.scoreB + ' (first to ' + ms.targetScore + ')';
      const t = Math.max(0, Math.ceil(ms.timeLeftTicks / 30));
      if (ms.phase === 'warmup') this.objectiveEl.textContent = 'Round starts in ' + t + 's · you are ' + (s.myTeam === 1 ? 'ATTACKING' : 'DEFENDING');
      else if (ms.phase === 'roundEnd') this.objectiveEl.textContent = 'Next round in ' + t + 's';
      else if (ms.phase === 'planted') this.objectiveEl.textContent = (s.myTeam === 2 ? 'DEFUSE — hold E at the site · ' : 'Defend the bomb · ') + t + 's';
      else if (s.myTeam === 1) {
        const role = ms.bombCarrier === s.myNetId ? '⬤ YOU HAVE THE BOMB — plant at a site (E)'
          : ms.bombDropped ? 'Bomb DROPPED — recover it'
          : 'Escort the bomb carrier';
        this.objectiveEl.textContent = role + ' · ' + t + 's';
      } else this.objectiveEl.textContent = 'Defend the sites · ' + t + 's';
    } else if (s.mode === 'survival') {
      if (ms.phase === 'break') {
        this.scoreEl.textContent = 'Wave ' + ms.wave + ' cleared';
        this.objectiveEl.textContent = 'Next wave in ' + Math.max(0, Math.ceil(ms.timeLeftTicks / 30)) + 's';
      } else {
        this.scoreEl.textContent = 'Wave ' + ms.wave;
        this.objectiveEl.textContent = 'Enemies left: ' + ms.enemiesLeft;
      }
    } else {
      this.scoreEl.textContent = 'Free practice';
      this.objectiveEl.textContent = 'Test weapons on the range';
    }
    if (s.mode !== 'domination') this.pointsRow.innerHTML = '', this.pointDots = [];
  }

  private renderPoints(ms: ModeState): void {
    if (this.pointDots.length !== ms.pointOwners.length) {
      this.pointsRow.innerHTML = '';
      this.pointDots = [];
      const labels = ['A', 'B', 'C', 'D', 'E'];
      for (let i = 0; i < ms.pointOwners.length; i++) {
        const d = el('div', {
          width: '34px', height: '34px', borderRadius: '50%', border: '2px solid #555',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: '15px', fontWeight: 'bold', textShadow: '0 1px 2px #000',
        });
        d.textContent = labels[i] ?? String(i);
        this.pointsRow.appendChild(d);
        this.pointDots.push(d);
      }
    }
    for (let i = 0; i < ms.pointOwners.length; i++) {
      const owner = ms.pointOwners[i] ?? 0;
      const bg = owner === 1 ? 'rgba(74,144,217,0.85)' : owner === 2 ? 'rgba(224,85,85,0.85)' : 'rgba(80,80,80,0.7)';
      this.pointDots[i]!.style.background = bg;
    }
  }

  setScoreboard(rows: ScoreRow[], visible: boolean, mode: GameMode): void {
    this.scoreboardEl.style.display = visible ? 'block' : 'none';
    if (!visible) return;
    const teamMode = mode === 'tdm' || mode === 'domination' || mode === 'bomb' || mode === 'survival';
    const sorted = rows.slice().sort((a, b) => (b.score - a.score) || (b.kills - a.kills));
    const head = '<div style="display:flex;justify-content:space-between;color:#e6b800;letter-spacing:2px;border-bottom:1px solid #333;padding-bottom:6px;margin-bottom:6px;font-weight:bold"><span>' + MODE_NAMES[mode].toUpperCase() + '</span><span>K / D / SCORE</span></div>';
    const body = sorted.map((r) => {
      const color = r.isMe ? '#ffd700' : teamMode ? (r.team === 1 ? '#7fb3ee' : '#ee8b8b') : '#ddd';
      const tag = r.isBot ? ' <span style="color:#667">[bot]</span>' : '';
      return '<div style="display:flex;justify-content:space-between;color:' + color + ';padding:2px 0">'
        + '<span>' + escapeHtml(r.name) + tag + '</span>'
        + '<span>' + r.kills + ' / ' + r.deaths + ' / ' + r.score + '</span></div>';
    }).join('');
    const controls: [string, string][] = [
      ['WASD', 'Move'], ['Mouse', 'Aim'], ['LMB', 'Fire'], ['R', 'Reload'],
      ['Space', 'Jump'], ['1/2 · Q', 'Weapons'], ['3/4/5', 'Grenades'],
      ['E', 'Plant/Defuse'], ['C', 'Class'], ['T', 'Team'],
    ];
    const legend = '<div style="border-top:1px solid #333;margin-top:10px;padding-top:8px;display:grid;grid-template-columns:1fr 1fr;gap:2px 18px">'
      + controls.map(([k, a]) =>
        '<div style="display:flex;justify-content:space-between;font-size:11px">'
        + '<span style="color:#e6b800">' + k + '</span><span style="color:#889">' + a + '</span></div>').join('')
      + '</div>';
    this.scoreboardEl.innerHTML = head + body + legend;
  }

  pushKill(killerLabel: string, victimLabel: string, headshot = false, streak = 0): void {
    this.killFeed.push({
      text: killerLabel + (headshot ? ' ✸ ' : ' ▸ ') + victimLabel + (streak >= 3 ? ' 🔥' + streak : ''),
      expiresMs: performance.now() + 5000,
    });
    if (this.killFeed.length > 12) this.killFeed.shift();
  }

  setDebug(text: string): void {
    this.debugEl.textContent = text;
    this.debugTopEl.textContent = text;
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[<>&"']/g, '');
}
