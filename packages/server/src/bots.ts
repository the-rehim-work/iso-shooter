import type { GameServer } from './gameLoop.js';

export type Difficulty = 'easy' | 'normal' | 'hard';

export interface BotOutput {
  moveX: number;
  moveZ: number;
  aimYaw: number;
  fire: boolean;
  reload: boolean;
}

interface DiffParams {
  aimError: number;
  aimLerp: number;
  reactionTicks: number;
  fireCone: number;
  jitterTicks: number;
}

const DIFFICULTY: Record<Difficulty, DiffParams> = {
  easy: { aimError: 0.30, aimLerp: 0.13, reactionTicks: 26, fireCone: 0.30, jitterTicks: 8 },
  normal: { aimError: 0.15, aimLerp: 0.26, reactionTicks: 15, fireCone: 0.26, jitterTicks: 6 },
  hard: { aimError: 0.06, aimLerp: 0.45, reactionTicks: 8, fireCone: 0.22, jitterTicks: 5 },
};

interface BotState {
  moveX: number;
  moveZ: number;
  nextChangeTick: number;
  aimYaw: number;
  aimError: number;
  nextAimTick: number;
  strafeDir: number;
  nextStrafeTick: number;
  fireReadyTick: number;
  hadLos: boolean;
  lastX: number;
  lastZ: number;
  stuckTicks: number;
  escapeUntil: number;
  escapeX: number;
  escapeZ: number;
}

function angleDelta(a: number, b: number): number {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export class BotController {
  private bots = new Map<number, BotState>();
  private diff: DiffParams = DIFFICULTY.normal;

  setDifficulty(d: Difficulty): void {
    this.diff = DIFFICULTY[d] ?? DIFFICULTY.normal;
  }

  register(netId: number): void {
    this.bots.set(netId, {
      moveX: 0, moveZ: 0, nextChangeTick: 0, aimYaw: 0, aimError: 0, nextAimTick: 0,
      strafeDir: 1, nextStrafeTick: 0, fireReadyTick: 0, hadLos: false,
      lastX: 0, lastZ: 0, stuckTicks: 0, escapeUntil: 0, escapeX: 0, escapeZ: 0,
    });
  }

  unregister(netId: number): void {
    this.bots.delete(netId);
  }

  generateInput(netId: number, eid: number, tick: number, server: GameServer): BotOutput {
    const b = this.bots.get(netId);
    if (!b) return { moveX: 0, moveZ: 0, aimYaw: 0, fire: false, reload: false };

    const me = server.posOf(eid);
    const target = server.enemyTargetFor(eid);
    const out = target === null || server.mode === 'practice'
      ? this.wander(b, tick)
      : this.combat(b, eid, tick, server, me, target);

    this.unstick(b, me, tick, out);
    return out;
  }

  private combat(b: BotState, eid: number, tick: number, server: GameServer, me: { x: number; z: number }, target: number): BotOutput {
    const d = this.diff;
    const tp = server.posOf(target);
    const dx = tp.x - me.x;
    const dz = tp.z - me.z;
    const dist = Math.hypot(dx, dz) || 0.0001;
    const range = server.weaponRangeOf(eid);
    const los = server.hasLineOfSight(eid, target);

    if (tick >= b.nextAimTick) {
      b.aimError = (Math.random() - 0.5) * d.aimError * 2;
      b.nextAimTick = tick + d.jitterTicks + Math.floor(Math.random() * d.jitterTicks);
    }
    const desiredYaw = Math.atan2(dx, dz) + b.aimError;
    b.aimYaw += angleDelta(desiredYaw, b.aimYaw) * d.aimLerp;

    if (los && !b.hadLos) b.fireReadyTick = tick + d.reactionTicks;
    b.hadLos = los;

    const aimClose = Math.abs(angleDelta(desiredYaw, b.aimYaw)) < d.fireCone;
    const inRange = dist < range * 0.94;
    const fire = los && inRange && aimClose && tick >= b.fireReadyTick;

    if (tick >= b.nextStrafeTick) {
      b.strafeDir = Math.random() < 0.5 ? 1 : -1;
      b.nextStrafeTick = tick + 22 + Math.floor(Math.random() * 40);
    }

    const nx = dx / dist;
    const nz = dz / dist;
    const px = -nz * b.strafeDir;
    const pz = nx * b.strafeDir;

    let moveX: number;
    let moveZ: number;
    if (!los) {
      moveX = nx; moveZ = nz;
    } else if (dist > range * 0.62) {
      moveX = nx * 0.75 + px * 0.5;
      moveZ = nz * 0.75 + pz * 0.5;
    } else if (dist < range * 0.3) {
      moveX = -nx * 0.6 + px * 0.6;
      moveZ = -nz * 0.6 + pz * 0.6;
    } else {
      moveX = px; moveZ = pz;
    }

    return { moveX, moveZ, aimYaw: b.aimYaw, fire, reload: false };
  }

  private unstick(b: BotState, me: { x: number; z: number }, tick: number, out: BotOutput): void {
    const moved = Math.hypot(me.x - b.lastX, me.z - b.lastZ);
    b.lastX = me.x;
    b.lastZ = me.z;
    const wantsMove = Math.hypot(out.moveX, out.moveZ) > 0.1;
    if (wantsMove && moved < 0.045) b.stuckTicks++;
    else b.stuckTicks = Math.max(0, b.stuckTicks - 2);

    if (b.stuckTicks > 4 && tick >= b.escapeUntil) {
      const inward = Math.atan2(-me.x, -me.z) + (Math.random() - 0.5) * 2.2;
      b.escapeX = Math.sin(inward);
      b.escapeZ = Math.cos(inward);
      b.escapeUntil = tick + 20;
      b.stuckTicks = 0;
    }
    if (tick < b.escapeUntil) {
      out.moveX = b.escapeX;
      out.moveZ = b.escapeZ;
    }
  }

  private wander(b: BotState, tick: number): BotOutput {
    if (tick >= b.nextChangeTick) {
      const angle = Math.random() * 2 * Math.PI;
      b.moveX = Math.cos(angle);
      b.moveZ = Math.sin(angle);
      b.aimYaw = Math.atan2(b.moveX, b.moveZ);
      b.nextChangeTick = tick + 24 + Math.floor(Math.random() * 40);
    }
    return { moveX: b.moveX, moveZ: b.moveZ, aimYaw: b.aimYaw, fire: false, reload: false };
  }
}
