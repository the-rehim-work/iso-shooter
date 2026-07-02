import { PLAYER_HEIGHT, PLAYER_RADIUS } from '../constants.js';

export function raySphere(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, cx: number, cy: number, cz: number, r: number): number | null {
  const rx = ox - cx, ry = oy - cy, rz = oz - cz;
  const b = 2 * (rx * dx + ry * dy + rz * dz);
  const c = rx * rx + ry * ry + rz * rz - r * r;
  const disc = b * b - 4 * c;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  const t0 = (-b - s) / 2;
  if (t0 >= 0) return t0;
  const t1 = (-b + s) / 2;
  return t1 >= 0 ? 0 : null;
}

export function rayCapsuleDistance(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, cx: number, feetY: number, cz: number): number | null {
  const r = PLAYER_RADIUS;
  const y0 = feetY + r;
  const y1 = feetY + PLAYER_HEIGHT - r;
  const relX = ox - cx, relZ = oz - cz;
  const a = dx * dx + dz * dz;
  if (a > 1e-9) {
    const b = 2 * (relX * dx + relZ * dz);
    const c = relX * relX + relZ * relZ - r * r;
    const disc = b * b - 4 * a * c;
    if (disc >= 0) {
      const s = Math.sqrt(disc);
      let t = (-b - s) / (2 * a);
      if (t < 0 && (-b + s) / (2 * a) > 0) t = 0;
      if (t >= 0) {
        const hy = oy + dy * t;
        if (hy >= y0 && hy <= y1) return t;
      }
    }
  }
  const tBottom = raySphere(ox, oy, oz, dx, dy, dz, cx, y0, cz, r);
  const tTop = raySphere(ox, oy, oz, dx, dy, dz, cx, y1, cz, r);
  if (tBottom === null) return tTop;
  if (tTop === null) return tBottom;
  return Math.min(tBottom, tTop);
}
