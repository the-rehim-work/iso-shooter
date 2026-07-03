import type { GameServer } from './gameLoop.js';

export type Difficulty = 'easy' | 'normal' | 'hard';

export interface BotOutput {
  moveX: number;
  moveZ: number;
  aimYaw: number;
  aimPitch: number;
  fire: boolean;
  reload: boolean;
}

// Whole-roster skill band per difficulty; individual bots vary inside it and
// exactly one bot per controller is the "ace" at the top of the band.
const DIFFICULTY_SCALE: Record<Difficulty, number> = { easy: 0.55, normal: 0.85, hard: 1.1 };

const SIGHT_RADIUS = 26;
const MEMORY_TICKS = 90;

interface BotState {
  skill: number;
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
  targetEid: number;
  lastSeenTick: number;
  lastSeenX: number;
  lastSeenZ: number;
  lastX: number;
  lastZ: number;
  stuckTicks: number;
  escapeUntil: number;
  escapeX: number;
  escapeZ: number;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

function angleDelta(a: number, b: number): number {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export class BotController {
  private bots = new Map<number, BotState>();
  private scale = DIFFICULTY_SCALE.normal;
  private aceNetId = -1;

  setDifficulty(d: Difficulty): void {
    this.scale = DIFFICULTY_SCALE[d] ?? DIFFICULTY_SCALE.normal;
  }

  register(netId: number): void {
    // one ace per roster; everyone else lands in a mediocre-to-decent band
    let skill: number;
    if (this.aceNetId === -1 || !this.bots.has(this.aceNetId)) {
      this.aceNetId = netId;
      skill = 1.0;
    } else {
      skill = 0.35 + Math.random() * 0.4;
    }
    this.bots.set(netId, {
      skill,
      moveX: 0, moveZ: 0, nextChangeTick: 0, aimYaw: 0, aimError: 0, nextAimTick: 0,
      strafeDir: 1, nextStrafeTick: 0, fireReadyTick: 0, hadLos: false,
      targetEid: -1, lastSeenTick: -9999, lastSeenX: 0, lastSeenZ: 0,
      lastX: 0, lastZ: 0, stuckTicks: 0, escapeUntil: 0, escapeX: 0, escapeZ: 0,
    });
  }

  unregister(netId: number): void {
    this.bots.delete(netId);
    if (netId === this.aceNetId) this.aceNetId = -1;
  }

  private params(b: BotState) {
    const s = Math.min(1, b.skill * this.scale);
    return {
      aimError: lerp(0.34, 0.05, s),
      aimLerp: lerp(0.12, 0.42, s),
      reactionTicks: Math.round(lerp(30, 8, s)),
      fireCone: lerp(0.32, 0.2, s),
      jitterTicks: Math.round(lerp(9, 5, s)),
    };
  }

  generateInput(netId: number, eid: number, tick: number, server: GameServer): BotOutput {
    const b = this.bots.get(netId);
    if (!b) return { moveX: 0, moveZ: 0, aimYaw: 0, aimPitch: 0, fire: false, reload: false };

    const me = server.posOf(eid);
    const target = server.mode === 'practice' ? null : this.pickTarget(b, eid, tick, server);
    const out = target === null
      ? this.seekOrWander(b, eid, tick, server, me)
      : this.combat(b, eid, tick, server, me, target);

    this.avoidWalls(b, eid, server, out);
    this.unstick(b, me, tick, out);
    return out;
  }

  // Bots only acquire what they can actually see, keep a short memory of the
  // last sighting, and stick to their current target so a whole lobby doesn't
  // pile onto one player.
  private pickTarget(b: BotState, eid: number, tick: number, server: GameServer): number | null {
    // survival waves are a horde — they always know where the players are
    if (server.mode === 'survival') {
      const t = server.enemyTargetFor(eid);
      if (t !== null) {
        const p = server.posOf(t);
        b.targetEid = t; b.lastSeenTick = tick; b.lastSeenX = p.x; b.lastSeenZ = p.z;
      }
      return t;
    }

    const visible = server.visibleEnemiesFor(eid, SIGHT_RADIUS);

    const current = visible.find((v) => v.eid === b.targetEid);
    if (current) {
      const p = server.posOf(current.eid);
      b.lastSeenTick = tick; b.lastSeenX = p.x; b.lastSeenZ = p.z;
      return current.eid;
    }

    if (visible.length > 0) {
      // weighted pick among the two nearest spreads aggro across targets
      const pick = visible.length > 1 && Math.random() < 0.35 ? visible[1]! : visible[0]!;
      b.targetEid = pick.eid;
      const p = server.posOf(pick.eid);
      b.lastSeenTick = tick; b.lastSeenX = p.x; b.lastSeenZ = p.z;
      return pick.eid;
    }

    if (b.targetEid !== -1 && tick - b.lastSeenTick > MEMORY_TICKS) b.targetEid = -1;
    return null;
  }

  private combat(b: BotState, eid: number, tick: number, server: GameServer, me: { x: number; z: number }, target: number): BotOutput {
    const d = this.params(b);
    const tp = server.posOf(target);
    const dx = tp.x - me.x;
    const dz = tp.z - me.z;
    const dist = Math.hypot(dx, dz) || 0.0001;
    const aimPitch = Math.atan2(server.chestYOf(target) - server.muzzleYOf(eid), dist);
    const range = server.weaponRangeOf(eid);
    const los = server.hasLineOfSight(eid, target);

    if (tick >= b.nextAimTick) {
      // accuracy degrades with distance — no more cross-map laser bots
      const distPenalty = 0.55 + (dist / SIGHT_RADIUS) * 0.9;
      b.aimError = (Math.random() - 0.5) * d.aimError * 2 * distPenalty;
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

    return { moveX, moveZ, aimYaw: b.aimYaw, aimPitch, fire, reload: false };
  }

  // no visible target: investigate the last sighting, otherwise wander
  private seekOrWander(b: BotState, eid: number, tick: number, server: GameServer, me: { x: number; z: number }): BotOutput {
    if (b.targetEid !== -1 && tick - b.lastSeenTick <= MEMORY_TICKS) {
      const dx = b.lastSeenX - me.x, dz = b.lastSeenZ - me.z;
      const d = Math.hypot(dx, dz);
      if (d > 1.5) {
        const yaw = Math.atan2(dx, dz);
        b.aimYaw += angleDelta(yaw, b.aimYaw) * 0.3;
        return { moveX: dx / d, moveZ: dz / d, aimYaw: b.aimYaw, aimPitch: 0, fire: false, reload: false };
      }
      b.targetEid = -1; // reached the last known spot, give up
    }
    return this.wander(b, tick);
  }

  // two whiskers ahead: steer along whichever side is clearer instead of
  // face-planting into walls
  private avoidWalls(b: BotState, eid: number, server: GameServer, out: BotOutput): void {
    const len = Math.hypot(out.moveX, out.moveZ);
    if (len < 0.1) return;
    const dx = out.moveX / len, dz = out.moveZ / len;
    const ahead = server.wallClearance(eid, dx, dz, 1.6);
    if (ahead >= 1.6) return;
    const cos = Math.cos(0.9), sin = Math.sin(0.9);
    const lx = dx * cos - dz * sin, lz = dx * sin + dz * cos;
    const rx = dx * cos + dz * sin, rz = -dx * sin + dz * cos;
    const leftClear = server.wallClearance(eid, lx, lz, 2.2);
    const rightClear = server.wallClearance(eid, rx, rz, 2.2);
    if (leftClear >= rightClear) { out.moveX = lx * len; out.moveZ = lz * len; }
    else { out.moveX = rx * len; out.moveZ = rz * len; }
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
    return { moveX: b.moveX, moveZ: b.moveZ, aimYaw: b.aimYaw, aimPitch: 0, fire: false, reload: false };
  }
}
