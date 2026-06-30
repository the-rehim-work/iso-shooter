import type { InputCommand } from '../sim/movement.js';
import type { GameMode } from '../constants.js';

export const MSG = {
  Welcome: 'welcome',
  Input: 'input',
  Snapshot: 'snapshot',
} as const;

export interface WelcomeMessage {
  t: typeof MSG.Welcome;
  clientId: number;
  netId: number;
  mode: GameMode;
  team: number;
}

export interface InputMessage {
  t: typeof MSG.Input;
  cmd: InputCommand;
}

export interface KillEvent {
  killer: number;
  victim: number;
}

export interface EntitySnapshot {
  netId: number;
  x: number;
  z: number;
  yaw: number;
  health: number;
  ammo: number;
  reserveMags: number;
  team: number;
  kills: number;
  isDead: boolean;
  isBot: boolean;
  shotFired: boolean;
}

export interface SnapshotMessage {
  t: typeof MSG.Snapshot;
  serverTick: number;
  ackSeq: number;
  entities: EntitySnapshot[];
  teamScores: [number, number];
  recentKills: KillEvent[];
}

export type ClientToServer = InputMessage;
export type ServerToClient = WelcomeMessage | SnapshotMessage;

export function encode(msg: ClientToServer | ServerToClient): string {
  return JSON.stringify(msg);
}

export function decode<T>(raw: string): T {
  return JSON.parse(raw) as T;
}
