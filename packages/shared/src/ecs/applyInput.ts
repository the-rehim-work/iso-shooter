import { Transform } from './components.js';
import { integrate, type InputCommand, type MoveState } from '../sim/movement.js';
import type { GameWorld } from './world.js';

export function readTransform(eid: number): MoveState {
  return { x: Transform.x[eid]!, z: Transform.z[eid]!, yaw: Transform.yaw[eid]! };
}

export function writeTransform(eid: number, s: MoveState): void {
  Transform.x[eid] = s.x;
  Transform.z[eid] = s.z;
  Transform.yaw[eid] = s.yaw;
}

export function applyInputToEntity(_world: GameWorld, eid: number, input: InputCommand): void {
  const next = integrate(readTransform(eid), input);
  writeTransform(eid, next);
}
