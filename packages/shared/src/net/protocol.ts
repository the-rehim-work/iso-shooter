import type { InputCommand } from '../sim/movement.js';
import type { GameMode, MatchConfig } from '../constants.js';
import type { ClassId } from '../sim/weapons.js';

export const MSG = {
  Welcome: 'welcome',
  Input: 'input',
  Snapshot: 'snapshot',
  SetClass: 'setclass',
  SetName: 'setname',
  SetDifficulty: 'setdifficulty',
  ConfigureMatch: 'configure',
  SetTeam: 'setteam',
} as const;

export interface WelcomeMessage {
  t: typeof MSG.Welcome;
  clientId: number;
  netId: number;
  mode: GameMode;
  team: number;
  classId: ClassId;
  mapId: string;
  isHost: boolean;
  config: MatchConfig;
}

export interface ConfigureMatchMessage {
  t: typeof MSG.ConfigureMatch;
  config: MatchConfig;
}

export interface SetTeamMessage {
  t: typeof MSG.SetTeam;
  team: number;
}

export interface InputMessage {
  t: typeof MSG.Input;
  cmd: InputCommand;
}

export interface SetClassMessage {
  t: typeof MSG.SetClass;
  classId: ClassId;
}

export interface SetNameMessage {
  t: typeof MSG.SetName;
  name: string;
}

export interface SetDifficultyMessage {
  t: typeof MSG.SetDifficulty;
  difficulty: 'easy' | 'normal' | 'hard';
}

export interface KillEvent {
  killer: number;
  victim: number;
  headshot: boolean;
}

export interface HitEvent {
  x: number;
  z: number;
  fatal: boolean;
  crit: boolean;
  dmg: number;
}

export interface ProjectileSnapshot {
  id: number;
  type: number;
  x: number;
  z: number;
  h: number;
}

export interface ZoneSnapshot {
  id: number;
  type: number;
  x: number;
  z: number;
  radius: number;
}

export interface BlastEvent {
  type: number;
  x: number;
  z: number;
}

export interface EntitySnapshot {
  netId: number;
  x: number;
  z: number;
  yaw: number;
  health: number;
  maxHealth: number;
  ammo: number;
  reserveMags: number;
  team: number;
  kills: number;
  deaths: number;
  score: number;
  classId: number;
  weaponId: number;
  isDead: boolean;
  isBot: boolean;
  shotFired: boolean;
  reloading: boolean;
  name: string;
}

export interface ModeState {
  gameMode: GameMode;
  matchPhase: string;
  winner: string;
  phase: string;
  banner: string;
  timeLeftTicks: number;
  scoreA: number;
  scoreB: number;
  pointOwners: number[];
  pointProgress: number[];
  bombSite: number;
  bombProgress: number;
  wave: number;
  enemiesLeft: number;
  targetScore: number;
}

export interface SnapshotMessage {
  t: typeof MSG.Snapshot;
  serverTick: number;
  ackSeq: number;
  entities: EntitySnapshot[];
  teamScores: [number, number];
  recentKills: KillEvent[];
  hits: HitEvent[];
  doors: number;
  mode: ModeState;
  projectiles: ProjectileSnapshot[];
  zones: ZoneSnapshot[];
  blasts: BlastEvent[];
  grenades: { frag: number; molotov: number; smoke: number };
}

export type ClientToServer = InputMessage | SetClassMessage | SetNameMessage | SetDifficultyMessage | ConfigureMatchMessage | SetTeamMessage;
export type ServerToClient = WelcomeMessage | SnapshotMessage;

export function encode(msg: ClientToServer | ServerToClient): string {
  return JSON.stringify(msg);
}

export function decode<T>(raw: string): T {
  return JSON.parse(raw) as T;
}
