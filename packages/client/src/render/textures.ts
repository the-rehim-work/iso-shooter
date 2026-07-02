import * as THREE from 'three';

function canvas(size: number): { c: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  return { c, ctx: c.getContext('2d')! };
}

function noise(ctx: CanvasRenderingContext2D, size: number, amount: number, alpha: number): void {
  for (let i = 0; i < amount; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const v = Math.floor(Math.random() * 90);
    ctx.fillStyle = `rgba(${v},${v},${v},${alpha})`;
    ctx.fillRect(x, y, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
}

export function groundTexture(repeat: number): THREE.Texture {
  const size = 256;
  const { c, ctx } = canvas(size);
  ctx.fillStyle = '#20242c';
  ctx.fillRect(0, 0, size, size);
  const tiles = 4;
  const step = size / tiles;
  ctx.strokeStyle = 'rgba(10,12,16,0.9)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= tiles; i++) {
    ctx.beginPath(); ctx.moveTo(i * step, 0); ctx.lineTo(i * step, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i * step); ctx.lineTo(size, i * step); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(70,78,90,0.15)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= tiles; i++) {
    ctx.beginPath(); ctx.moveTo(i * step + 1, 0); ctx.lineTo(i * step + 1, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i * step + 1); ctx.lineTo(size, i * step + 1); ctx.stroke();
  }
  noise(ctx, size, 2600, 0.5);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.anisotropy = 4;
  return tex;
}

export function concreteTexture(hex: string): THREE.Texture {
  const size = 128;
  const { c, ctx } = canvas(size);
  ctx.fillStyle = hex;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 3;
  ctx.strokeRect(2, 2, size - 4, size - 4);
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.beginPath(); ctx.moveTo(0, size / 2); ctx.lineTo(size, size / 2); ctx.stroke();
  noise(ctx, size, 900, 0.35);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function carpetTexture(repeat: number): THREE.Texture {
  const size = 256;
  const { c, ctx } = canvas(size);
  ctx.fillStyle = '#2e3440';
  ctx.fillRect(0, 0, size, size);
  // carpet tile seams
  const tiles = 4;
  const step = size / tiles;
  ctx.strokeStyle = 'rgba(15,18,24,0.8)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i <= tiles; i++) {
    ctx.beginPath(); ctx.moveTo(i * step, 0); ctx.lineTo(i * step, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i * step); ctx.lineTo(size, i * step); ctx.stroke();
  }
  // alternating tile tint
  for (let tx = 0; tx < tiles; tx++) {
    for (let ty = 0; ty < tiles; ty++) {
      if ((tx + ty) % 2 === 0) continue;
      ctx.fillStyle = 'rgba(70,85,110,0.10)';
      ctx.fillRect(tx * step, ty * step, step, step);
    }
  }
  // fiber speckle
  for (let i = 0; i < 5000; i++) {
    const v = 40 + Math.floor(Math.random() * 40);
    ctx.fillStyle = `rgba(${v},${v + 6},${v + 14},0.25)`;
    ctx.fillRect(Math.random() * size, Math.random() * size, 1, 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.anisotropy = 4;
  return tex;
}

export function woodTexture(hex = '#7a5230'): THREE.Texture {
  const size = 128;
  const { c, ctx } = canvas(size);
  ctx.fillStyle = hex;
  ctx.fillRect(0, 0, size, size);
  // grain streaks
  for (let i = 0; i < 26; i++) {
    const y = Math.random() * size;
    const w = 0.5 + Math.random() * 1.5;
    const dark = Math.random() > 0.5;
    ctx.strokeStyle = dark ? 'rgba(40,22,8,0.25)' : 'rgba(230,190,140,0.12)';
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(size * 0.3, y + (Math.random() - 0.5) * 8, size * 0.7, y + (Math.random() - 0.5) * 8, size, y);
    ctx.stroke();
  }
  noise(ctx, size, 250, 0.15);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function plasterTexture(hex = '#c9c4b8'): THREE.Texture {
  const size = 128;
  const { c, ctx } = canvas(size);
  ctx.fillStyle = hex;
  ctx.fillRect(0, 0, size, size);
  // baseboard strip
  ctx.fillStyle = 'rgba(60,58,54,0.85)';
  ctx.fillRect(0, size - 12, size, 12);
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, size * 0.35); ctx.lineTo(size, size * 0.35); ctx.stroke();
  noise(ctx, size, 500, 0.12);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function fabricTexture(hex = '#5f6f8f'): THREE.Texture {
  const size = 64;
  const { c, ctx } = canvas(size);
  ctx.fillStyle = hex;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(0,0,0,0.15)';
  ctx.lineWidth = 1;
  for (let i = 0; i < size; i += 3) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, size); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  for (let i = 0; i < size; i += 3) {
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(size, i); ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function serverRackTexture(): THREE.Texture {
  const size = 128;
  const { c, ctx } = canvas(size);
  ctx.fillStyle = '#181c22';
  ctx.fillRect(0, 0, size, size);
  // rack units with LED dots
  for (let y = 6; y < size - 6; y += 14) {
    ctx.fillStyle = '#242a33';
    ctx.fillRect(8, y, size - 16, 10);
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.strokeRect(8, y, size - 16, 10);
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = Math.random() > 0.4 ? '#3adf6e' : '#e0b23a';
      ctx.fillRect(14 + i * 7, y + 3, 3, 3);
    }
    ctx.fillStyle = 'rgba(90,100,115,0.8)';
    ctx.fillRect(size - 40, y + 3, 26, 4);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function whiteboardWallTexture(hex = '#dfe3e8'): THREE.Texture {
  const size = 128;
  const { c, ctx } = canvas(size);
  ctx.fillStyle = hex;
  ctx.fillRect(0, 0, size, size);
  // glass/panel divider lines
  ctx.strokeStyle = 'rgba(120,130,145,0.5)';
  ctx.lineWidth = 2;
  for (let x = 0; x <= size; x += 32) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, size); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(60,58,54,0.85)';
  ctx.fillRect(0, size - 10, size, 10);
  noise(ctx, size, 200, 0.06);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function metalTexture(hex: string): THREE.Texture {
  const size = 64;
  const { c, ctx } = canvas(size);
  ctx.fillStyle = hex;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 2;
  for (let y = 8; y < size; y += 16) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size, y); ctx.stroke(); }
  noise(ctx, size, 300, 0.3);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}
