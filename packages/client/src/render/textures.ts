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
