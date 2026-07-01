import type { CoverBox } from '../constants.js';

export interface DoorDef {
  x: number;
  z: number;
  halfW: number;
  halfD: number;
  axis: 'x' | 'z';
}

export interface ZoneDef {
  id: string;
  label: string;
  x: number;
  z: number;
  radius: number;
}

export interface GameMap {
  id: string;
  name: string;
  cover: CoverBox[];
  doors: DoorDef[];
  controlPoints: ZoneDef[];
  bombSites: ZoneDef[];
}

const WALL = 0.4;

const COMPOUND_COVER: CoverBox[] = [
  { x: -11, z: 3, halfW: 3.5, halfD: WALL },
  { x: -1, z: 3, halfW: 2.5, halfD: WALL },

  { x: 12, z: 16, halfW: WALL, halfD: 4 },
  { x: 12, z: 4, halfW: WALL, halfD: 4 },

  { x: -18, z: -8, halfW: 6, halfD: WALL },
  { x: -24, z: -13, halfW: WALL, halfD: 5 },

  { x: 20, z: 18, halfW: WALL, halfD: 5 },
  { x: 16, z: 22, halfW: 4, halfD: WALL },

  { x: 9, z: 9, halfW: 1.6, halfD: 1.6 },
  { x: -3, z: -3, halfW: 1.5, halfD: 1.5 },

  { x: -3, z: -16, halfW: 1.2, halfD: 1.2 },
  { x: 6, z: -9, halfW: 1.0, halfD: 1.0 },
  { x: 23, z: -6, halfW: 1.3, halfD: 1.3 },
  { x: -13, z: 15, halfW: 1.1, halfD: 1.1 },
  { x: 2, z: 20, halfW: 1.4, halfD: 0.6 },
  { x: -8, z: -22, halfW: 0.9, halfD: 0.9 },
  { x: 25, z: 6, halfW: 1.0, halfD: 1.0 },
  { x: -25, z: 22, halfW: 1.2, halfD: 1.2 },
  { x: 14, z: -20, halfW: 1.1, halfD: 1.1 },
];

const COMPOUND_DOORS: DoorDef[] = [
  { x: -5.5, z: 3, halfW: 1.5, halfD: WALL, axis: 'x' },
  { x: 12, z: 10, halfW: WALL, halfD: 1.5, axis: 'z' },
];

export const COMPOUND_MAP: GameMap = {
  id: 'compound',
  name: 'Compound',
  cover: COMPOUND_COVER,
  doors: COMPOUND_DOORS,
  controlPoints: [
    { id: 'A', label: 'A', x: -16, z: 6, radius: 4 },
    { id: 'B', label: 'B', x: 2, z: -4, radius: 4 },
    { id: 'C', label: 'C', x: 18, z: 13, radius: 4 },
  ],
  bombSites: [
    { id: 'A', label: 'A', x: -18, z: -11, radius: 3.6 },
    { id: 'B', label: 'B', x: 17, z: 20, radius: 3.6 },
  ],
};

export const EMPTY_MAP: GameMap = {
  id: 'empty',
  name: 'Proving Ground',
  cover: [],
  doors: [],
  controlPoints: [],
  bombSites: [],
};

export const DEFAULT_MAP = COMPOUND_MAP;

export const MAPS: Record<string, GameMap> = {
  compound: COMPOUND_MAP,
  empty: EMPTY_MAP,
};

export function getMap(id: string): GameMap {
  return MAPS[id] ?? DEFAULT_MAP;
}
