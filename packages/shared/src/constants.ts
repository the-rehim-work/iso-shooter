export const TICK_RATE = 30;
export const FIXED_DT = 1 / TICK_RATE;

export const SNAPSHOT_RATE = 30;

export const MOVE_SPEED = 6;

export const ARENA_HALF_X = 20;
export const ARENA_HALF_Z = 20;

export const INTERP_DELAY_MS = 100;

export const CAMERA_ELEVATION_DEG = 55;
export const CAMERA_AZIMUTH_DEG = 45;
export const CAMERA_DISTANCE = 80;

export const RECONCILE_SNAP_EPSILON = 0.0005;

export const PLAYER_RADIUS = 0.4;
export const PLAYER_MAX_HEALTH = 100;
export const PLAYER_RESPAWN_TICKS = 90;

export const WEAPON_DAMAGE = 25;
export const WEAPON_MAG_SIZE = 30;
export const WEAPON_NUM_MAGS = 4;
export const WEAPON_FIRE_INTERVAL_TICKS = 3;
export const WEAPON_RELOAD_TICKS = 45;
export const WEAPON_RANGE = 60;

export const MAX_VIEWPORT_ASPECT = 16 / 9;

export type GameMode = 'ffa' | 'tdm';

export const SPAWN_POINTS: { x: number; z: number }[] = [
  { x: -14, z: -14 },
  { x:   0, z: -16 },
  { x:  14, z: -14 },
  { x: -16, z:   0 },
  { x:  16, z:   0 },
  { x: -14, z:  14 },
  { x:   0, z:  16 },
  { x:  14, z:  14 },
];

export const TEAM_SPAWN_POINTS: { [team: number]: { x: number; z: number }[] } = {
  1: [{ x: -14, z: -14 }, { x: -16, z: 0 }, { x: -14, z: 14 }, { x: -10, z: -10 }],
  2: [{ x:  14, z: -14 }, { x:  16, z: 0 }, { x:  14, z:  14 }, { x:  10, z:  10 }],
};

export interface CoverBox {
  x: number;
  z: number;
  halfW: number;
  halfD: number;
}

export const STATIC_COVER: CoverBox[] = [
  { x:  6, z:  5, halfW: 1.5, halfD: 0.5 },
  { x: -6, z: -5, halfW: 1.5, halfD: 0.5 },
  { x:  5, z: -7, halfW: 0.5, halfD: 1.5 },
  { x: -5, z:  7, halfW: 0.5, halfD: 1.5 },
];
