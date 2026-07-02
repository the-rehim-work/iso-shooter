// Returns the requested room: 'LOBBY' for quick play, '' to create a private
// room, or an entered 4-char code.
export function showJoinRoom(): Promise<string> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    Object.assign(overlay.style, {
      position: 'fixed', inset: '0', zIndex: '1200', background: 'rgba(0,0,0,0.92)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace',
    });

    const box = document.createElement('div');
    Object.assign(box.style, {
      background: '#13151b', border: '1px solid #333', borderRadius: '12px',
      padding: '30px 36px', minWidth: '340px', textAlign: 'center',
    });

    const h = document.createElement('div');
    Object.assign(h.style, { color: '#e6b800', fontSize: '20px', fontWeight: 'bold', letterSpacing: '3px', marginBottom: '22px' });
    h.textContent = 'PLAY';
    box.appendChild(h);

    const done = (code: string): void => { overlay.remove(); resolve(code); };

    const mkBtn = (label: string, primary: boolean): HTMLButtonElement => {
      const b = document.createElement('button');
      b.textContent = label;
      Object.assign(b.style, {
        display: 'block', width: '100%', padding: '12px', marginBottom: '12px',
        borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontFamily: 'monospace',
        letterSpacing: '2px', fontWeight: 'bold',
        background: primary ? '#e6b800' : '#20242c',
        color: primary ? '#111' : '#dde',
        border: primary ? 'none' : '1px solid #444',
      });
      box.appendChild(b);
      return b;
    };

    mkBtn('▶ QUICK PLAY', true).addEventListener('click', () => done('LOBBY'));
    mkBtn('+ CREATE PRIVATE ROOM', false).addEventListener('click', () => done(''));

    const row = document.createElement('div');
    Object.assign(row.style, { display: 'flex', gap: '8px', marginTop: '6px' });
    const input = document.createElement('input');
    input.placeholder = 'ROOM CODE';
    input.maxLength = 5;
    Object.assign(input.style, {
      flex: '1', background: '#1a1c22', border: '1px solid #444', borderRadius: '6px',
      color: '#eee', padding: '10px 12px', fontSize: '14px', fontFamily: 'monospace',
      letterSpacing: '3px', textTransform: 'uppercase', textAlign: 'center',
    });
    const joinBtn = document.createElement('button');
    joinBtn.textContent = 'JOIN';
    Object.assign(joinBtn.style, {
      padding: '10px 18px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px',
      fontFamily: 'monospace', letterSpacing: '2px', fontWeight: 'bold',
      background: '#2a6fb0', color: '#fff', border: 'none',
    });
    const tryJoin = (): void => {
      const code = input.value.trim().toUpperCase();
      if (code.length >= 4) done(code);
      else input.style.borderColor = '#e05555';
    };
    joinBtn.addEventListener('click', tryJoin);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') tryJoin(); });
    row.appendChild(input);
    row.appendChild(joinBtn);
    box.appendChild(row);

    overlay.appendChild(box);
    document.body.appendChild(overlay);
    input.focus();
  });
}
