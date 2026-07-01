export type DifficultyOpt = 'easy' | 'normal' | 'hard';

export interface SettingsOptions {
  initialVolume: number;
  initialLatency: number;
  initialName: string;
  initialDifficulty: DifficultyOpt;
  onVolumeChange(v: number): void;
  onLatencyChange(ms: number): void;
  onNameChange(name: string): void;
  onDifficultyChange(d: DifficultyOpt): void;
}

function el(tag: string, css: Partial<CSSStyleDeclaration>, attrs: Record<string, string> = {}): HTMLElement {
  const e = document.createElement(tag);
  Object.assign(e.style, css);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

function row(label: string, control: HTMLElement): HTMLElement {
  const r = el('div', { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' });
  const l = el('span', { color: '#aab', fontSize: '13px', letterSpacing: '1px' });
  l.textContent = label;
  r.appendChild(l);
  r.appendChild(control);
  return r;
}

function sliderEl(min: number, max: number, value: number, step = 1): HTMLInputElement {
  const s = document.createElement('input');
  s.type = 'range';
  s.min = String(min); s.max = String(max); s.value = String(value); s.step = String(step);
  Object.assign(s.style, { width: '130px', accentColor: '#e6b800', cursor: 'pointer' });
  return s;
}

export class SettingsPanel {
  private panel: HTMLElement;
  private btn: HTMLButtonElement;
  private _open = false;

  constructor(container: HTMLElement, opts: SettingsOptions) {
    this.btn = document.createElement('button');
    this.btn.textContent = '⚙';
    Object.assign(this.btn.style, {
      position: 'fixed', top: '12px', right: '12px', zIndex: '200',
      width: '38px', height: '38px', borderRadius: '8px',
      border: '1px solid #555', background: 'rgba(24,26,32,0.92)',
      color: '#ccc', fontSize: '18px', cursor: 'pointer', lineHeight: '1',
    });
    this.btn.addEventListener('click', () => this.toggle());
    container.appendChild(this.btn);

    this.panel = el('div', {
      position: 'fixed', top: '0', right: '0', bottom: '0',
      width: '280px', background: 'rgba(18,20,26,0.97)',
      borderLeft: '1px solid #333', zIndex: '199',
      transform: 'translateX(100%)', transition: 'transform 0.22s ease',
      padding: '20px', boxSizing: 'border-box', overflowY: 'auto',
      fontFamily: 'monospace',
    });

    const title = el('div', { color: '#e6b800', fontSize: '16px', fontWeight: 'bold', letterSpacing: '3px', marginBottom: '24px' });
    title.textContent = 'SETTINGS';
    this.panel.appendChild(title);

    const closeBtn = el('div', {
      position: 'absolute', top: '16px', right: '16px', cursor: 'pointer',
      color: '#666', fontSize: '18px',
    });
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', () => this.toggle());
    this.panel.appendChild(closeBtn);

    const section = (name: string): void => {
      const h = el('div', { color: '#556', fontSize: '11px', letterSpacing: '2px', marginBottom: '12px', marginTop: '20px', borderBottom: '1px solid #2a2a2a', paddingBottom: '6px' });
      h.textContent = name;
      this.panel.appendChild(h);
    };

    section('PROFILE');
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = opts.initialName;
    nameInput.maxLength = 20;
    nameInput.placeholder = 'callsign';
    Object.assign(nameInput.style, {
      width: '100%', background: '#1a1c22', border: '1px solid #444', borderRadius: '5px',
      color: '#eee', padding: '7px 10px', fontSize: '13px', boxSizing: 'border-box', fontFamily: 'monospace',
      marginBottom: '14px',
    });
    nameInput.addEventListener('input', () => opts.onNameChange(nameInput.value.trim()));
    this.panel.appendChild(nameInput);

    section('BOTS');
    const diffSelect = document.createElement('select');
    Object.assign(diffSelect.style, {
      background: '#1a1c22', border: '1px solid #444', borderRadius: '5px',
      color: '#eee', padding: '6px 8px', fontSize: '12px', fontFamily: 'monospace', cursor: 'pointer',
    });
    for (const d of ['easy', 'normal', 'hard'] as const) {
      const o = document.createElement('option');
      o.value = d; o.textContent = d.toUpperCase();
      if (d === opts.initialDifficulty) o.selected = true;
      diffSelect.appendChild(o);
    }
    diffSelect.addEventListener('change', () => opts.onDifficultyChange(diffSelect.value as DifficultyOpt));
    this.panel.appendChild(row('Difficulty', diffSelect));

    section('AUDIO');
    const volSlider = sliderEl(0, 100, Math.round(opts.initialVolume * 100));
    const volLabel = el('span', { color: '#eee', fontSize: '12px', minWidth: '32px', textAlign: 'right' });
    volLabel.textContent = Math.round(opts.initialVolume * 100) + '%';
    volSlider.addEventListener('input', () => {
      const v = Number(volSlider.value) / 100;
      volLabel.textContent = Math.round(v * 100) + '%';
      opts.onVolumeChange(v);
    });
    const volRow = row('Volume', volSlider);
    volRow.appendChild(volLabel);
    this.panel.appendChild(volRow);

    section('NETWORK');
    const latSlider = sliderEl(0, 300, opts.initialLatency);
    const latLabel = el('span', { color: '#eee', fontSize: '12px', minWidth: '40px', textAlign: 'right' });
    latLabel.textContent = opts.initialLatency + 'ms';
    latSlider.addEventListener('input', () => {
      const v = Number(latSlider.value);
      latLabel.textContent = v + 'ms';
      opts.onLatencyChange(v);
    });
    const latRow = row('Sim Latency', latSlider);
    latRow.appendChild(latLabel);
    this.panel.appendChild(latRow);

    section('CONTROLS');
    const controls: [string, string][] = [
      ['WASD', 'Move'], ['Mouse', 'Aim'], ['LClick', 'Fire'], ['R', 'Reload'],
      ['1 / 2', 'Weapon'], ['Q / Wheel', 'Swap'], ['3 / 4 / 5', 'Frag/Molo/Smoke'],
      ['E', 'Interact'], ['C', 'Class'], ['T', 'Switch team'], ['Tab', 'Scores'],
    ];
    for (const [key, action] of controls) {
      const r2 = el('div', { display: 'flex', justifyContent: 'space-between', marginBottom: '8px' });
      const k = el('span', { color: '#e6b800', fontSize: '12px', background: 'rgba(230,184,0,0.12)', padding: '2px 8px', borderRadius: '4px', border: '1px solid #554400' });
      k.textContent = key;
      const a = el('span', { color: '#aab', fontSize: '12px' });
      a.textContent = action;
      r2.appendChild(k); r2.appendChild(a);
      this.panel.appendChild(r2);
    }

    container.appendChild(this.panel);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this._open) this.toggle();
    });
  }

  toggle(): void {
    this._open = !this._open;
    this.panel.style.transform = this._open ? 'translateX(0)' : 'translateX(100%)';
    this.btn.style.color = this._open ? '#e6b800' : '#ccc';
  }

  get isOpen(): boolean { return this._open; }
}
