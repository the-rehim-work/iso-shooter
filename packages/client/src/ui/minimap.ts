import { ARENA_HALF_X, ARENA_HALF_Z, type GameMap, type GameMode, type ModeState } from '@iso/shared';

export interface MinimapBlip {
  x: number;
  z: number;
  isMe: boolean;
  ally: boolean;
  visible: boolean;
  dead: boolean;
}

const SIZE = 168;
const WORLD = Math.max(ARENA_HALF_X, ARENA_HALF_Z) * 2 + 2;

export class Minimap {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private staticLayer: HTMLCanvasElement;
  private mapId = '';

  constructor(parent: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = SIZE;
    this.canvas.height = SIZE;
    Object.assign(this.canvas.style, {
      position: 'fixed', top: '108px', left: '12px', zIndex: '15',
      border: '1px solid rgba(120,130,150,0.45)', borderRadius: '6px',
      background: 'rgba(10,12,16,0.72)', pointerEvents: 'none',
    });
    parent.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;
    this.staticLayer = document.createElement('canvas');
    this.staticLayer.width = SIZE;
    this.staticLayer.height = SIZE;
  }

  private px(v: number): number {
    return ((v + WORLD / 2) / WORLD) * SIZE;
  }

  private span(v: number): number {
    return (v / WORLD) * SIZE;
  }

  setMap(map: GameMap): void {
    this.mapId = map.id;
    const ctx = this.staticLayer.getContext('2d')!;
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.strokeStyle = 'rgba(150,160,180,0.6)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(this.px(-ARENA_HALF_X), this.px(-ARENA_HALF_Z), this.span(ARENA_HALF_X * 2), this.span(ARENA_HALF_Z * 2));
    for (const c of map.cover) {
      const tall = c.halfH * 2 > 1.0;
      ctx.fillStyle = tall ? 'rgba(170,180,200,0.75)' : 'rgba(110,118,134,0.45)';
      ctx.fillRect(this.px(c.x - c.halfW), this.px(c.z - c.halfD), Math.max(1.5, this.span(c.halfW * 2)), Math.max(1.5, this.span(c.halfD * 2)));
    }
  }

  update(map: GameMap, mode: GameMode, ms: ModeState, doorMask: number, blips: MinimapBlip[]): void {
    if (map.id !== this.mapId) this.setMap(map);
    const ctx = this.ctx;
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.drawImage(this.staticLayer, 0, 0);

    for (let i = 0; i < map.doors.length; i++) {
      const d = map.doors[i]!;
      const open = (doorMask & (1 << i)) !== 0;
      ctx.fillStyle = open ? 'rgba(80,220,120,0.9)' : 'rgba(230,160,60,0.9)';
      ctx.fillRect(this.px(d.x - d.halfW), this.px(d.z - d.halfD), Math.max(2, this.span(d.halfW * 2)), Math.max(2, this.span(d.halfD * 2)));
    }

    if (mode === 'domination') {
      for (let i = 0; i < map.controlPoints.length; i++) {
        const pt = map.controlPoints[i]!;
        const owner = ms.pointOwners[i] ?? 0;
        ctx.strokeStyle = owner === 1 ? 'rgba(74,144,217,0.95)' : owner === 2 ? 'rgba(224,85,85,0.95)' : 'rgba(160,160,160,0.8)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(this.px(pt.x), this.px(pt.z), this.span(pt.radius), 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (mode === 'bomb') {
      for (let i = 0; i < map.bombSites.length; i++) {
        const s = map.bombSites[i]!;
        const armed = ms.bombSite === i;
        ctx.strokeStyle = armed ? 'rgba(255,70,50,0.95)' : 'rgba(255,150,40,0.9)';
        ctx.lineWidth = armed ? 2.5 : 1.5;
        ctx.beginPath();
        ctx.arc(this.px(s.x), this.px(s.z), this.span(s.radius), 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    for (const b of blips) {
      if (b.dead || b.isMe || !b.visible) continue;
      ctx.fillStyle = b.ally ? 'rgba(90,160,235,0.95)' : 'rgba(235,90,90,0.95)';
      ctx.beginPath();
      ctx.arc(this.px(b.x), this.px(b.z), 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
    const me = blips.find((b) => b.isMe);
    if (me && !me.dead) {
      ctx.fillStyle = 'rgba(255,215,0,1)';
      ctx.strokeStyle = 'rgba(0,0,0,0.8)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(this.px(me.x), this.px(me.z), 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
}
