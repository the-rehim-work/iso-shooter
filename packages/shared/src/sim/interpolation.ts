import type { MoveState } from './movement.js';

interface Stamped {
  t: number;
  state: MoveState;
}

function lerp(a: number, b: number, f: number): number {
  return a + (b - a) * f;
}

function lerpAngle(a: number, b: number, f: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * f;
}

export class InterpolationBuffer {
  private buf: Stamped[] = [];
  private maxSamples = 32;

  push(t: number, state: MoveState): void {
    this.buf.push({ t, state: { ...state } });
    if (this.buf.length > this.maxSamples) this.buf.shift();
  }

  sample(renderTime: number): MoveState | null {
    if (this.buf.length === 0) return null;
    if (this.buf.length === 1) return { ...this.buf[0]!.state };

    if (renderTime <= this.buf[0]!.t) return { ...this.buf[0]!.state };
    const last = this.buf[this.buf.length - 1]!;
    if (renderTime >= last.t) return { ...last.state };

    for (let i = 0; i < this.buf.length - 1; i++) {
      const a = this.buf[i]!;
      const b = this.buf[i + 1]!;
      if (renderTime >= a.t && renderTime <= b.t) {
        const span = b.t - a.t;
        const f = span > 1e-6 ? (renderTime - a.t) / span : 0;
        return {
          x: lerp(a.state.x, b.state.x, f),
          z: lerp(a.state.z, b.state.z, f),
          yaw: lerpAngle(a.state.yaw, b.state.yaw, f),
        };
      }
    }
    return { ...last.state };
  }
}
