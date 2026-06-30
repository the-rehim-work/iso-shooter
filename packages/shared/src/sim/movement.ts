import { ARENA_HALF_X, ARENA_HALF_Z, MOVE_SPEED } from '../constants.js';
import type { CollisionWorld } from './collision.js';

export interface MoveState {
  x: number;
  z: number;
  yaw: number;
}

export interface InputCommand {
  seq: number;
  moveX: number;
  moveZ: number;
  aimYaw: number;
  dt: number;
  fire: boolean;
  reload: boolean;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function normalizedDir(mx: number, mz: number): { dx: number; dz: number } {
  const len = Math.hypot(mx, mz);
  if (len > 1e-6) return { dx: mx / len, dz: mz / len };
  return { dx: 0, dz: 0 };
}

export function integrate(state: MoveState, input: InputCommand): MoveState {
  const { dx, dz } = normalizedDir(input.moveX, input.moveZ);
  const nx = clamp(state.x + dx * MOVE_SPEED * input.dt, -ARENA_HALF_X, ARENA_HALF_X);
  const nz = clamp(state.z + dz * MOVE_SPEED * input.dt, -ARENA_HALF_Z, ARENA_HALF_Z);
  return { x: nx, z: nz, yaw: input.aimYaw };
}

export function integrateWithCollision(
  state: MoveState,
  input: InputCommand,
  netId: number,
  cw: CollisionWorld,
): MoveState {
  const { dx, dz } = normalizedDir(input.moveX, input.moveZ);
  const wantDx = dx * MOVE_SPEED * input.dt;
  const wantDz = dz * MOVE_SPEED * input.dt;
  const resolved = cw.resolveMovement(netId, state.x, state.z, wantDx, wantDz);
  return { x: state.x + resolved.dx, z: state.z + resolved.dz, yaw: input.aimYaw };
}
