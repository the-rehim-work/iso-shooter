import { CLASSES, CLASS_IDS, WEAPONS, type ClassId } from '@iso/shared';

const CLASS_KEY = 'iso_player_class';

export function getSavedClass(): ClassId {
  const v = localStorage.getItem(CLASS_KEY) as ClassId | null;
  return v && CLASS_IDS.includes(v) ? v : 'assault';
}

function card(id: ClassId, selected: boolean, onPick: (id: ClassId) => void): HTMLElement {
  const cd = CLASSES[id];
  const wrap = document.createElement('div');
  Object.assign(wrap.style, {
    flex: '1 1 150px', background: selected ? 'rgba(230,184,0,0.12)' : '#1a1c22',
    border: '1px solid ' + (selected ? '#e6b800' : '#333'), borderRadius: '8px',
    padding: '13px', cursor: 'pointer', transition: 'all 0.12s', minWidth: '150px',
  });
  wrap.addEventListener('mouseenter', () => { if (!selected) wrap.style.borderColor = '#666'; });
  wrap.addEventListener('mouseleave', () => { if (!selected) wrap.style.borderColor = '#333'; });
  wrap.addEventListener('click', () => onPick(id));

  const name = document.createElement('div');
  Object.assign(name.style, { color: '#e6b800', fontSize: '16px', fontWeight: 'bold', letterSpacing: '2px', marginBottom: '3px' });
  name.textContent = cd.name.toUpperCase();

  const blurb = document.createElement('div');
  Object.assign(blurb.style, { color: '#889', fontSize: '10px', marginBottom: '9px', minHeight: '24px' });
  blurb.textContent = cd.blurb;

  const line = (label: string, value: string, color = '#ccd'): HTMLElement => {
    const r = document.createElement('div');
    Object.assign(r.style, { display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '2px' });
    const l = document.createElement('span'); l.textContent = label; l.style.color = '#667';
    const v = document.createElement('span'); v.textContent = value; v.style.color = color;
    r.appendChild(l); r.appendChild(v);
    return r;
  };

  const g = cd.grenades;
  wrap.appendChild(name);
  wrap.appendChild(blurb);
  wrap.appendChild(line('PRIMARY', WEAPONS[cd.primary].name, '#9cc'));
  wrap.appendChild(line('SIDEARM', WEAPONS[cd.secondary].name, '#9cc'));
  wrap.appendChild(line('HEALTH', String(cd.maxHealth)));
  wrap.appendChild(line('SPEED', Math.round(cd.speedMul * 100) + '%'));
  wrap.appendChild(line('NADES', '✚' + g.frag + ' ◈' + g.molotov + ' ☁' + g.smoke));
  return wrap;
}

export function showClassSelect(initial: ClassId = getSavedClass()): Promise<ClassId> {
  return new Promise((resolve) => {
    let chosen: ClassId = initial;

    const overlay = document.createElement('div');
    Object.assign(overlay.style, {
      position: 'fixed', inset: '0', zIndex: '1000', background: 'rgba(0,0,0,0.9)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace',
    });

    const box = document.createElement('div');
    Object.assign(box.style, {
      background: '#13151b', border: '1px solid #333', borderRadius: '12px',
      padding: '26px', maxWidth: '760px', width: '94%',
    });

    const title = document.createElement('div');
    Object.assign(title.style, { color: '#e6b800', fontSize: '20px', fontWeight: 'bold', letterSpacing: '3px', marginBottom: '4px', textAlign: 'center' });
    title.textContent = 'SELECT CLASS';
    const hint = document.createElement('div');
    Object.assign(hint.style, { color: '#556', fontSize: '11px', letterSpacing: '1px', marginBottom: '16px', textAlign: 'center' });
    hint.textContent = 'each class has a fixed kit · press C in-game to swap class';

    const row = document.createElement('div');
    Object.assign(row.style, { display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' });
    const rebuild = (): void => {
      row.innerHTML = '';
      for (const id of CLASS_IDS) row.appendChild(card(id, id === chosen, pick));
    };
    const pick = (id: ClassId): void => { chosen = id; rebuild(); };
    rebuild();

    const deploy = document.createElement('button');
    deploy.textContent = '▶ DEPLOY';
    Object.assign(deploy.style, {
      width: '100%', padding: '12px', borderRadius: '6px', cursor: 'pointer',
      fontSize: '14px', fontFamily: 'monospace', letterSpacing: '2px', fontWeight: 'bold',
      background: '#e6b800', color: '#111', border: 'none',
    });
    deploy.addEventListener('click', () => {
      localStorage.setItem(CLASS_KEY, chosen);
      overlay.remove();
      resolve(chosen);
    });

    box.appendChild(title);
    box.appendChild(hint);
    box.appendChild(row);
    box.appendChild(deploy);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
  });
}
