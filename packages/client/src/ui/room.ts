import { GAME_MODES, MODE_NAMES, MAPS, defaultWinLimit, type GameMode, type MatchConfig } from '@iso/shared';

function field(label: string, control: HTMLElement): HTMLElement {
  const r = document.createElement('div');
  Object.assign(r.style, { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' });
  const l = document.createElement('span');
  Object.assign(l.style, { color: '#aab', fontSize: '13px', letterSpacing: '1px' });
  l.textContent = label;
  r.appendChild(l); r.appendChild(control);
  return r;
}

function select(options: [string, string][], value: string): HTMLSelectElement {
  const s = document.createElement('select');
  Object.assign(s.style, { background: '#1a1c22', border: '1px solid #444', borderRadius: '5px', color: '#eee', padding: '7px 10px', fontSize: '13px', fontFamily: 'monospace', cursor: 'pointer', minWidth: '180px' });
  for (const [v, label] of options) {
    const o = document.createElement('option'); o.value = v; o.textContent = label;
    if (v === value) o.selected = true;
    s.appendChild(o);
  }
  return s;
}

function numberInput(value: number): HTMLInputElement {
  const i = document.createElement('input');
  i.type = 'number'; i.min = '0'; i.value = String(value);
  Object.assign(i.style, { background: '#1a1c22', border: '1px solid #444', borderRadius: '5px', color: '#eee', padding: '7px 10px', fontSize: '13px', fontFamily: 'monospace', width: '80px' });
  return i;
}

function toggle(value: boolean): HTMLInputElement {
  const i = document.createElement('input');
  i.type = 'checkbox'; i.checked = value;
  Object.assign(i.style, { width: '20px', height: '20px', accentColor: '#e6b800', cursor: 'pointer' });
  return i;
}

function winLabelFor(m: GameMode): string {
  switch (m) {
    case 'ffa': case 'firefight': case 'blackout': return 'Kills to win';
    case 'tdm': return 'Team score to win';
    case 'domination': return 'Score target';
    case 'bomb': return 'Rounds to win';
    default: return '';
  }
}

function modeNote(m: GameMode): string {
  switch (m) {
    case 'gungame': return 'Cycle a kill with every weapon to win.';
    case 'survival': return 'Co-op vs escalating enemy waves — survive as long as possible.';
    case 'practice': return 'Free sandbox with target dummies. No win condition.';
    case 'blackout': return 'Fog of war — you only see your line of sight.';
    default: return '';
  }
}

export function showRoomSetup(current: MatchConfig, title = 'CREATE ROOM'): Promise<MatchConfig> {
  return new Promise((resolve) => {
    const cfg: MatchConfig = { ...current };

    const overlay = document.createElement('div');
    Object.assign(overlay.style, { position: 'fixed', inset: '0', zIndex: '1100', background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace' });

    const box = document.createElement('div');
    Object.assign(box.style, { background: '#13151b', border: '1px solid #333', borderRadius: '12px', padding: '28px 32px', minWidth: '400px' });

    const h = document.createElement('div');
    Object.assign(h.style, { color: '#e6b800', fontSize: '19px', fontWeight: 'bold', letterSpacing: '3px', marginBottom: '18px', textAlign: 'center' });
    h.textContent = title;
    box.appendChild(h);

    const modeSel = select(GAME_MODES.map((m) => [m, MODE_NAMES[m]] as [string, string]), cfg.mode);
    box.appendChild(field('Game mode', modeSel));

    const mapSel = select(Object.values(MAPS).map((m) => [m.id, m.name] as [string, string]), cfg.map || 'compound');
    box.appendChild(field('Map', mapSel));

    const note = document.createElement('div');
    Object.assign(note.style, { color: '#778', fontSize: '11px', lineHeight: '1.5', marginBottom: '14px', minHeight: '16px' });
    box.appendChild(note);

    const botInput = numberInput(cfg.bots);
    const diffSel = select([['easy', 'EASY'], ['normal', 'NORMAL'], ['hard', 'HARD']], cfg.difficulty);
    const ffToggle = toggle(cfg.friendlyFire);
    const respawnToggle = toggle(cfg.respawn);

    const dyn = document.createElement('div');
    box.appendChild(dyn);
    let winInput: HTMLInputElement | null = null;

    const rebuild = (): void => {
      dyn.innerHTML = '';
      const m = cfg.mode;
      note.textContent = modeNote(m);
      const teamMode = m === 'tdm' || m === 'domination' || m === 'bomb';

      const wl = winLabelFor(m);
      if (wl) {
        winInput = numberInput(cfg.winLimit > 0 ? cfg.winLimit : defaultWinLimit(m));
        winInput.placeholder = String(defaultWinLimit(m));
        dyn.appendChild(field(wl + ' (0 = default)', winInput));
      } else {
        winInput = null;
      }

      dyn.appendChild(field('Bots', botInput));
      dyn.appendChild(field('Bot difficulty', diffSel));
      if (teamMode) dyn.appendChild(field('Friendly fire', ffToggle));
      if (m !== 'bomb' && m !== 'survival') dyn.appendChild(field('Respawns', respawnToggle));
    };

    modeSel.addEventListener('change', () => { cfg.mode = modeSel.value as GameMode; rebuild(); });
    rebuild();

    const start = document.createElement('button');
    start.textContent = '▶ START MATCH';
    Object.assign(start.style, { width: '100%', padding: '12px', borderRadius: '6px', cursor: 'pointer', marginTop: '10px', fontSize: '14px', fontFamily: 'monospace', letterSpacing: '2px', fontWeight: 'bold', background: '#e6b800', color: '#111', border: 'none' });
    start.addEventListener('click', () => {
      cfg.mode = modeSel.value as GameMode;
      cfg.map = mapSel.value;
      cfg.winLimit = winInput ? Math.max(0, parseInt(winInput.value || '0', 10)) : 0;
      cfg.bots = Math.max(0, Math.min(24, parseInt(botInput.value || '0', 10)));
      cfg.difficulty = diffSel.value as 'easy' | 'normal' | 'hard';
      cfg.friendlyFire = ffToggle.checked;
      cfg.respawn = respawnToggle.checked;
      overlay.remove();
      resolve(cfg);
    });
    box.appendChild(start);

    overlay.appendChild(box);
    document.body.appendChild(overlay);
  });
}
