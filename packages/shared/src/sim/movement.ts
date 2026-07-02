import { AIM_PITCH_LIMIT, ARENA_HALF_X, ARENA_HALF_Z, GRAVITY, GROUND_EPSILON, JUMP_SPEED, MOVE_SPEED } from '../constants.js';
import type { CollisionWorld } from './collision.js';

export interface MoveState {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  vy: number;
}

export interface InputCommand {
  seq: number;
  moveX: number;
  moveZ: number;
  aimYaw: number;
  aimPitch: number;
  dt: number;
  jump: boolean;
  fire: boolean;
  reload: boolean;
  switchTo: number;
  interact: boolean;
  throwType: number;
  throwX: number;
  throwZ: number;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function normalizedDir(mx: number, mz: number): { dx: number; dz: number } {
  const len = Math.hypot(mx, mz);
  if (len > 1e-6) return { dx: mx / len, dz: mz / len };
  return { dx: 0, dz: 0 };
}

export function clampPitch(pitch: number): number {
  return clamp(pitch, -AIM_PITCH_LIMIT, AIM_PITCH_LIMIT);
}

function verticalStep(y: number, vy: number, jump: boolean, dt: number): { vy: number } {
  let nvy = jump && y <= GROUND_EPSILON && vy <= 0 ? JUMP_SPEED : vy;
  nvy -= GRAVITY * dt;
  return { vy: nvy };
}

export function integrate(state: MoveState, input: InputCommand, moveSpeed = MOVE_SPEED): MoveState {
  const { dx, dz } = normalizedDir(input.moveX, input.moveZ);
  const nx = clamp(state.x + dx * moveSpeed * input.dt, -ARENA_HALF_X, ARENA_HALF_X);
  const nz = clamp(state.z + dz * moveSpeed * input.dt, -ARENA_HALF_Z, ARENA_HALF_Z);
  let { vy } = verticalStep(state.y, state.vy, input.jump, input.dt);
  let ny = state.y + vy * input.dt;
  if (ny <= 0) {
    ny = 0;
    if (vy < 0) vy = 0;
  }
  return { x: nx, y: ny, z: nz, yaw: input.aimYaw, pitch: clampPitch(input.aimPitch), vy };
}

export function integrateWithCollision(
  state: MoveState,
  input: InputCommand,
  netId: number,
  cw: CollisionWorld,
  moveSpeed = MOVE_SPEED,
): MoveState {
  const { dx, dz } = normalizedDir(input.moveX, input.moveZ);
  const wantDx = dx * moveSpeed * input.dt;
  const wantDz = dz * moveSpeed * input.dt;
  const groundY = cw.groundHeightAt(netId, state.x, state.y, state.z);
  const onGround = state.y - groundY <= GROUND_EPSILON;
  let vy = input.jump && onGround && state.vy <= 0 ? JUMP_SPEED : state.vy;
  vy -= GRAVITY * input.dt;
  const wantDy = vy * input.dt;
  const resolved = cw.resolveMovement(netId, state.x, state.y, state.z, wantDx, wantDy, wantDz);
  let ny = state.y + resolved.dy;
  if (resolved.grounded && vy < 0) vy = 0;
  if (ny <= 0) {
    ny = 0;
    if (vy < 0) vy = 0;
  }
  return { x: state.x + resolved.dx, y: ny, z: state.z + resolved.dz, yaw: input.aimYaw, pitch: clampPitch(input.aimPitch), vy };
}
