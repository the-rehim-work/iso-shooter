export const TICK_RATE = 30;
export const FIXED_DT = 1 / TICK_RATE;

export const SNAPSHOT_RATE = 30;

export const MOVE_SPEED = 6;

export const ARENA_HALF_X = 30;
export const ARENA_HALF_Z = 30;

export const INTERP_DELAY_MS = 100;

export const CAMERA_ELEVATION_DEG = 55;
export const CAMERA_AZIMUTH_DEG = 45;
export const CAMERA_DISTANCE = 80;

export const RECONCILE_SNAP_EPSILON = 0.0005;

export const PLAYER_RADIUS = 0.4;
export const PLAYER_HEIGHT = 1.8;
export const PLAYER_EYE_HEIGHT = 1.6;
// Hitscan origin/travel height for flat (direction-only) shots: mid-torso, so a
// level shot registers as a body hit, not a head crit.
export const MUZZLE_HEIGHT = 1.15;
export const AIM_PITCH_LIMIT = 1.2;
export const GRAVITY = 24;
// apex ~1.76m: crates (1.6) and office desks (1.5) are mountable, walls (2.4) are not
export const JUMP_SPEED = 9.2;
export const GROUND_EPSILON = 0.05;
export const WALL_HEIGHT = 2.4;
export const PLAYER_MAX_HEALTH = 100;
export const PLAYER_RESPAWN_TICKS = 90;

export const WEAPON_DAMAGE = 25;
export const WEAPON_MAG_SIZE = 30;
export const WEAPON_NUM_MAGS = 4;
export const WEAPON_FIRE_INTERVAL_TICKS = 3;
export const WEAPON_RELOAD_TICKS = 45;
export const WEAPON_RANGE = 60;

export const MAX_VIEWPORT_ASPECT = 16 / 9;

export type GameMode = 'ffa' | 'tdm' | 'gungame' | 'domination' | 'bomb' | 'survival' | 'practice' | 'firefight' | 'blackout' | 'chosen';

export const GAME_MODES: GameMode[] = ['ffa', 'tdm', 'gungame', 'domination', 'bomb', 'survival', 'practice', 'firefight', 'blackout', 'chosen'];

export const MODE_NAMES: Record<GameMode, string> = {
  ffa: 'Free For All',
  tdm: 'Team Deathmatch',
  gungame: 'Gun Game',
  domination: 'Domination',
  bomb: 'Bomb Defusal',
  survival: 'Wave Survival',
  practice: 'Practice Range',
  firefight: 'Firefight',
  blackout: 'Blackout',
  chosen: 'The Chosen',
};

export const FOG_MODES: GameMode[] = ['blackout'];
export const FFA_LIKE_MODES: GameMode[] = ['ffa', 'gungame', 'firefight', 'blackout', 'chosen'];

// The Chosen: every interval one player is anointed and becomes immortal for
// the duration. Prior picks are heavily de-weighted so it rotates.
export const CHOSEN_INTERVAL_TICKS = 30 * 20;
export const CHOSEN_DURATION_TICKS = 30 * 10;
export const CHOSEN_REPEAT_WEIGHT = 0.18;

export const BACKSTAB_MULTIPLIER = 2.4;
export const VISION_RADIUS = 18;

export interface MatchConfig {
  mode: GameMode;
  map: string;
  winLimit: number;
  bots: number;
  difficulty: 'easy' | 'normal' | 'hard';
  friendlyFire: boolean;
  respawn: boolean;
}

export function defaultMatchConfig(mode: GameMode = 'ffa'): MatchConfig {
  return { mode, map: 'compound', winLimit: 0, bots: 4, difficulty: 'normal', friendlyFire: false, respawn: true };
}

// Score points (Kills.score). Kills.count still drives FFA/gungame win checks.
export const SCORE_KILL = 100;
export const SCORE_HEADSHOT_BONUS = 50;
export const SCORE_ASSIST = 50;
export const SCORE_CAPTURE = 150;
export const SCORE_PLANT = 300;
export const SCORE_DEFUSE = 300;
export const SCORE_WAVE_CLEAR = 75;
export const ASSIST_WINDOW_TICKS = 150;
export const STREAK_ANNOUNCEMENTS: Record<number, string> = {
  3: 'KILLING SPREE',
  5: 'RAMPAGE',
  8: 'UNSTOPPABLE',
  12: 'GODLIKE',
};

export function defaultWinLimit(mode: GameMode): number {
  switch (mode) {
    case 'gungame': return 8;
    case 'domination': return DOMINATION_SCORE_TARGET;
    case 'bomb': return BOMB_ROUNDS_TO_WIN;
    case 'tdm': return 40;
    case 'survival': return 0;
    case 'practice': return 0;
    default: return FFA_SCORE_TARGET;
  }
}

export const DOOR_OPEN_RADIUS = 2.8;

export const CRIT_MULTIPLIER = 1.9;
export const GRAZE_MULTIPLIER = 0.82;
export const HEAD_ZONE_FRACTION = 0.82;
export const LEG_ZONE_FRACTION = 0.22;

export type ThrowType = 0 | 1 | 2 | 3;
export const THROW_FRAG = 1;
export const THROW_MOLOTOV = 2;
export const THROW_SMOKE = 3;

export const THROW_RANGE = 16;
export const THROW_COOLDOWN_TICKS = 24;
export const GRENADE_TRAVEL_SPEED = 18;
export const GRENADE_GRAVITY = 30;
export const GRENADE_BOUNCE = 0.45;
export const GRENADE_RADIUS = 0.15;

export const FRAG_FUSE_TICKS = 12;
export const FRAG_RADIUS = 5.5;
export const FRAG_MAX_DAMAGE = 130;

export const MOLOTOV_TTL_TICKS = 30 * 6;
export const MOLOTOV_RADIUS = 4;
export const MOLOTOV_DPS = 34;

export const SMOKE_TTL_TICKS = 30 * 9;
export const SMOKE_RADIUS = 5;

export const GRENADE_LOADOUT = { frag: 2, molotov: 1, smoke: 1 };

export const DOMINATION_SCORE_TARGET = 250;
export const CAPTURE_TICKS = 90;

export const BOMB_PLANT_TICKS = 30;
export const BOMB_DEFUSE_TICKS = 45;
export const BOMB_FUSE_TICKS = 30 * 38;
export const BOMB_ROUND_TICKS = 30 * 110;
export const BOMB_ROUNDS_TO_WIN = 4;
export const ROUND_RESET_TICKS = 30 * 5;

export const SURVIVAL_BASE_ENEMIES = 4;
export const SURVIVAL_WAVE_BREAK_TICKS = 30 * 6;

export const FFA_SCORE_TARGET = 25;

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
  halfH: number;
}

export const STATIC_COVER: CoverBox[] = [
  { x:  6, z:  5, halfW: 1.5, halfD: 0.5, halfH: 0.8 },
  { x: -6, z: -5, halfW: 1.5, halfD: 0.5, halfH: 0.8 },
  { x:  5, z: -7, halfW: 0.5, halfD: 1.5, halfH: 0.8 },
  { x: -5, z:  7, halfW: 0.5, halfD: 1.5, halfH: 0.8 },
];
