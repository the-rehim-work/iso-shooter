const STORAGE_KEY = 'iso_player_name';

export function showAuthDialog(): Promise<string> {
  return new Promise((resolve) => {
    const saved = localStorage.getItem(STORAGE_KEY) ?? '';

    const overlay = document.createElement('div');
    Object.assign(overlay.style, {
      position: 'fixed', inset: '0', zIndex: '1000',
      background: 'rgba(0,0,0,0.88)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace',
    });

    const box = document.createElement('div');
    Object.assign(box.style, {
      background: '#13151b', border: '1px solid #333', borderRadius: '10px',
      padding: '36px 40px', minWidth: '300px', textAlign: 'center',
    });

    const title = document.createElement('div');
    Object.assign(title.style, { color: '#e6b800', fontSize: '22px', fontWeight: 'bold', letterSpacing: '4px', marginBottom: '6px' });
    title.textContent = 'ISO-SHOOTER';

    const sub = document.createElement('div');
    Object.assign(sub.style, { color: '#556', fontSize: '11px', letterSpacing: '2px', marginBottom: '28px' });
    sub.textContent = 'TACTICAL ARENA';

    const label = document.createElement('div');
    Object.assign(label.style, { color: '#aab', fontSize: '12px', letterSpacing: '1px', marginBottom: '10px' });
    label.textContent = 'ENTER YOUR CALLSIGN';

    const input = document.createElement('input');
    input.type = 'text';
    input.value = saved;
    input.maxLength = 20;
    input.placeholder = 'optional';
    Object.assign(input.style, {
      width: '100%', background: '#1a1c22', border: '1px solid #444', borderRadius: '6px',
      color: '#eee', padding: '10px 12px', fontSize: '14px', boxSizing: 'border-box',
      fontFamily: 'monospace', letterSpacing: '1px', marginBottom: '22px', textAlign: 'center',
      outline: 'none',
    });

    const btnRow = document.createElement('div');
    Object.assign(btnRow.style, { display: 'flex', gap: '10px' });

    const mkBtn = (text: string, primary: boolean): HTMLButtonElement => {
      const b = document.createElement('button');
      b.textContent = text;
      Object.assign(b.style, {
        flex: '1', padding: '10px', borderRadius: '6px', cursor: 'pointer',
        fontSize: '13px', fontFamily: 'monospace', letterSpacing: '1px', fontWeight: 'bold',
        background: primary ? '#e6b800' : 'transparent',
        color: primary ? '#111' : '#666',
        border: primary ? 'none' : '1px solid #333',
      });
      return b;
    };

    const playBtn = mkBtn('▶ PLAY', true);
    const skipBtn = mkBtn('SKIP', false);

    const confirm = (name: string): void => {
      const clean = name.replace(/[<>&"']/g, '').trim().slice(0, 20);
      if (clean) localStorage.setItem(STORAGE_KEY, clean);
      overlay.remove();
      resolve(clean);
    };

    playBtn.addEventListener('click', () => confirm(input.value));
    skipBtn.addEventListener('click', () => confirm(''));
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') confirm(input.value); });

    btnRow.appendChild(playBtn);
    btnRow.appendChild(skipBtn);
    box.appendChild(title);
    box.appendChild(sub);
    box.appendChild(label);
    box.appendChild(input);
    box.appendChild(btnRow);
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    setTimeout(() => input.focus(), 50);
  });
}

export function getSavedName(): string {
  return localStorage.getItem(STORAGE_KEY) ?? '';
}
