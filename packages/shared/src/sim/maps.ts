import type { CoverBox } from '../constants.js';

export interface DoorDef {
  x: number;
  z: number;
  halfW: number;
  halfD: number;
  halfH: number;
  axis: 'x' | 'z';
}

export interface ZoneDef {
  id: string;
  label: string;
  x: number;
  z: number;
  radius: number;
}

// Visual style of a cover box — collision is always the plain box; the client
// picks materials/decoration per kind.
export type CoverKind = 'wall' | 'crate' | 'desk' | 'cabinet' | 'planter' | 'partition' | 'table' | 'sofa' | 'server';

export type MapTheme = 'industrial' | 'office';

export interface ThemedCover extends CoverBox {
  kind?: CoverKind;
}

export interface SpawnSet {
  any: { x: number; z: number }[];
  team1: { x: number; z: number }[];
  team2: { x: number; z: number }[];
}

export interface GameMap {
  id: string;
  name: string;
  theme: MapTheme;
  cover: ThemedCover[];
  doors: DoorDef[];
  controlPoints: ZoneDef[];
  bombSites: ZoneDef[];
  spawns?: SpawnSet;
}

const WALL = 0.4;

const INNER_WALL_HALF_H = 1.2;
const CRATE_HALF_H = 0.8;

const COMPOUND_COVER: ThemedCover[] = [
  { x: -11, z: 3, halfW: 3.5, halfD: WALL, halfH: INNER_WALL_HALF_H, kind: 'wall' },
  { x: -1, z: 3, halfW: 2.5, halfD: WALL, halfH: INNER_WALL_HALF_H, kind: 'wall' },

  { x: 12, z: 16, halfW: WALL, halfD: 4, halfH: INNER_WALL_HALF_H, kind: 'wall' },
  { x: 12, z: 4, halfW: WALL, halfD: 4, halfH: INNER_WALL_HALF_H, kind: 'wall' },

  { x: -18, z: -8, halfW: 6, halfD: WALL, halfH: INNER_WALL_HALF_H, kind: 'wall' },
  { x: -24, z: -13, halfW: WALL, halfD: 5, halfH: INNER_WALL_HALF_H, kind: 'wall' },

  { x: 20, z: 18, halfW: WALL, halfD: 5, halfH: INNER_WALL_HALF_H, kind: 'wall' },
  { x: 16, z: 22, halfW: 4, halfD: WALL, halfH: INNER_WALL_HALF_H, kind: 'wall' },

  { x: 9, z: 9, halfW: 1.6, halfD: 1.6, halfH: CRATE_HALF_H, kind: 'crate' },
  { x: -3, z: -3, halfW: 1.5, halfD: 1.5, halfH: CRATE_HALF_H, kind: 'crate' },

  { x: -3, z: -16, halfW: 1.2, halfD: 1.2, halfH: CRATE_HALF_H, kind: 'crate' },
  { x: 6, z: -9, halfW: 1.0, halfD: 1.0, halfH: CRATE_HALF_H, kind: 'crate' },
  { x: 23, z: -6, halfW: 1.3, halfD: 1.3, halfH: CRATE_HALF_H, kind: 'crate' },
  { x: -13, z: 15, halfW: 1.1, halfD: 1.1, halfH: CRATE_HALF_H, kind: 'crate' },
  { x: 2, z: 20, halfW: 1.4, halfD: 0.6, halfH: CRATE_HALF_H, kind: 'crate' },
  { x: -8, z: -22, halfW: 0.9, halfD: 0.9, halfH: CRATE_HALF_H, kind: 'crate' },
  { x: 25, z: 6, halfW: 1.0, halfD: 1.0, halfH: CRATE_HALF_H, kind: 'crate' },
  { x: -25, z: 22, halfW: 1.2, halfD: 1.2, halfH: CRATE_HALF_H, kind: 'crate' },
  { x: 14, z: -20, halfW: 1.1, halfD: 1.1, halfH: CRATE_HALF_H, kind: 'crate' },
];

const COMPOUND_DOORS: DoorDef[] = [
  { x: -5.5, z: 3, halfW: 1.5, halfD: WALL, halfH: 0.9, axis: 'x' },
  { x: 12, z: 10, halfW: WALL, halfD: 1.5, halfH: 0.9, axis: 'z' },
];

export const COMPOUND_MAP: GameMap = {
  id: 'compound',
  name: 'Compound',
  theme: 'industrial',
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
  spawns: {
    any: [
      { x: -26, z: -24 }, { x: 0, z: -27 }, { x: 26, z: -24 }, { x: -27, z: 0 },
      { x: 27, z: 0 }, { x: -26, z: 24 }, { x: 0, z: 27 }, { x: 26, z: 24 },
      { x: -14, z: 8 }, { x: 14, z: -8 }, { x: 8, z: 24 }, { x: -8, z: -24 },
    ],
    team1: [
      { x: -26, z: -24 }, { x: -27, z: -8 }, { x: -27, z: 8 }, { x: -26, z: 24 },
      { x: -18, z: -14 }, { x: -20, z: 18 }, { x: -22, z: 0 }, { x: -14, z: -24 },
    ],
    team2: [
      { x: 26, z: -24 }, { x: 27, z: -8 }, { x: 27, z: 8 }, { x: 26, z: 24 },
      { x: 18, z: -18 }, { x: 20, z: 14 }, { x: 22, z: 0 }, { x: 14, z: 24 },
    ],
  },
};

// ── Headquarters — open-plan office ──────────────────────────────────────────
// Central conference room, two cubicle farms, a server room in the NE, a
// lounge in the SW. Outer ring (|x|,|z| > 24) stays clear for spawns.

const DESK_H = 0.75;
const PARTITION_H = 1.15;

function cubicleRow(cx: number, cz: number, dir: 1 | -1): ThemedCover[] {
  // one row = partition spine + two desks against it
  return [
    { x: cx, z: cz, halfW: 4, halfD: 0.15, halfH: PARTITION_H, kind: 'partition' },
    { x: cx - 2, z: cz + dir * 0.85, halfW: 1.5, halfD: 0.7, halfH: DESK_H, kind: 'desk' },
    { x: cx + 2, z: cz + dir * 0.85, halfW: 1.5, halfD: 0.7, halfH: DESK_H, kind: 'desk' },
  ];
}

const OFFICE_COVER: ThemedCover[] = [
  // Conference room shell (12×10 centered at 0,0); the west and south walls
  // have gaps that the two conference doors fill when closed
  { x: -2.6, z: -5, halfW: 3.4, halfD: WALL, halfH: INNER_WALL_HALF_H, kind: 'wall' },   // south wall, west of door gap
  { x: 5.4, z: -5, halfW: 0.6, halfD: WALL, halfH: INNER_WALL_HALF_H, kind: 'wall' },    // south wall, east of door gap
  { x: 0, z: 5, halfW: 6, halfD: WALL, halfH: INNER_WALL_HALF_H, kind: 'wall' },         // north wall
  { x: 6, z: 0, halfW: WALL, halfD: 4.6, halfH: INNER_WALL_HALF_H, kind: 'wall' },       // east wall
  { x: -6, z: 3, halfW: WALL, halfD: 1.6, halfH: INNER_WALL_HALF_H, kind: 'wall' },      // west wall upper stub
  { x: -6, z: -3, halfW: WALL, halfD: 1.6, halfH: INNER_WALL_HALF_H, kind: 'wall' },     // west wall lower stub
  { x: 0, z: 0, halfW: 3.2, halfD: 1.2, halfH: DESK_H, kind: 'table' },                  // conference table

  // NW cubicle farm
  ...cubicleRow(-16, 12, 1),
  ...cubicleRow(-16, 17, 1),
  // SE cubicle farm
  ...cubicleRow(14, -12, -1),
  ...cubicleRow(14, -17, -1),

  // Server room (NE corner, L-shaped walls; door gap in the west wall z 8..11)
  { x: 13, z: 12.5, halfW: WALL, halfD: 1.5, halfH: INNER_WALL_HALF_H, kind: 'wall' },
  { x: 13, z: 7, halfW: WALL, halfD: 1, halfH: INNER_WALL_HALF_H, kind: 'wall' },
  { x: 18, z: 6, halfW: 5.4, halfD: WALL, halfH: INNER_WALL_HALF_H, kind: 'wall' },
  { x: 16, z: 12, halfW: 0.8, halfD: 1.6, halfH: 1.0, kind: 'server' },
  { x: 19, z: 12, halfW: 0.8, halfD: 1.6, halfH: 1.0, kind: 'server' },
  { x: 22, z: 12, halfW: 0.8, halfD: 1.6, halfH: 1.0, kind: 'server' },

  // Lounge (SW): sofas + low table
  { x: -16, z: -12, halfW: 2.2, halfD: 0.8, halfH: 0.55, kind: 'sofa' },
  { x: -16, z: -17, halfW: 2.2, halfD: 0.8, halfH: 0.55, kind: 'sofa' },
  { x: -16, z: -14.5, halfW: 1.0, halfD: 0.9, halfH: 0.4, kind: 'table' },
  { x: -21, z: -14.5, halfW: 0.8, halfD: 0.8, halfH: 0.55, kind: 'sofa' },

  // Reception counter near west entrance corridor
  { x: -12, z: 0, halfW: 0.9, halfD: 3.2, halfH: 0.9, kind: 'cabinet' },

  // Filing cabinets + planters scattered as mid cover
  { x: 6, z: 14, halfW: 1.4, halfD: 0.6, halfH: 1.0, kind: 'cabinet' },
  { x: -6, z: -14, halfW: 1.4, halfD: 0.6, halfH: 1.0, kind: 'cabinet' },
  { x: 22, z: -4, halfW: 0.7, halfD: 0.7, halfH: 0.9, kind: 'planter' },
  { x: -22, z: 6, halfW: 0.7, halfD: 0.7, halfH: 0.9, kind: 'planter' },
  { x: 2, z: 20, halfW: 0.7, halfD: 0.7, halfH: 0.9, kind: 'planter' },
  { x: -2, z: -20, halfW: 0.7, halfD: 0.7, halfH: 0.9, kind: 'planter' },
  { x: 20, z: 20, halfW: 0.7, halfD: 0.7, halfH: 0.9, kind: 'planter' },
];

const OFFICE_DOORS: DoorDef[] = [
  { x: -6, z: 0, halfW: WALL, halfD: 1.4, halfH: 0.9, axis: 'z' },     // conference west door (gap z -1.4..1.4)
  { x: 2.8, z: -5, halfW: 2.0, halfD: WALL, halfH: 0.9, axis: 'x' },   // conference south door (gap x 0.8..4.8)
  { x: 13, z: 9.5, halfW: WALL, halfD: 1.5, halfH: 0.9, axis: 'z' },   // server room door (gap z 8..11)
];

export const OFFICE_MAP: GameMap = {
  id: 'office',
  name: 'Headquarters',
  theme: 'office',
  cover: OFFICE_COVER,
  doors: OFFICE_DOORS,
  controlPoints: [
    { id: 'A', label: 'A', x: -16, z: 5, radius: 4 },
    { id: 'B', label: 'B', x: 0, z: 0, radius: 4 },
    { id: 'C', label: 'C', x: 16, z: -5, radius: 4 },
  ],
  bombSites: [
    { id: 'A', label: 'A', x: 0, z: 0, radius: 3.6 },
    { id: 'B', label: 'B', x: 18, z: 10, radius: 3.4 },
  ],
  spawns: {
    any: [
      { x: -26, z: -26 }, { x: 0, z: -27 }, { x: 26, z: -26 }, { x: -27, z: 0 },
      { x: 27, z: 0 }, { x: -26, z: 26 }, { x: 0, z: 27 }, { x: 26, z: 26 },
      { x: 8, z: 22 }, { x: -8, z: -22 }, { x: 24, z: -14 }, { x: -24, z: 14 },
    ],
    team1: [
      { x: -26, z: -24 }, { x: -27, z: -8 }, { x: -27, z: 8 }, { x: -26, z: 24 },
      { x: -22, z: -22 }, { x: -22, z: 22 }, { x: -24, z: 0 }, { x: -14, z: -26 },
    ],
    team2: [
      { x: 26, z: -24 }, { x: 27, z: -8 }, { x: 27, z: 8 }, { x: 26, z: 24 },
      { x: 22, z: -22 }, { x: 24, z: 20 }, { x: 26, z: 0 }, { x: 14, z: 26 },
    ],
  },
};

// ── Warrens — corridor maze ──────────────────────────────────────────────────
// A ring corridor around a pinwheel core: every fight happens at a corner or
// down a hallway. Doors guard the north/south entries into the ring.

const WARRENS_COVER: ThemedCover[] = [
  // ring walls at ±18 with north/south door gaps (x -4..4) and open east/west gaps (z -4..4)
  { x: -11, z: 18, halfW: 7, halfD: WALL, halfH: INNER_WALL_HALF_H, kind: 'wall' },
  { x: 11, z: 18, halfW: 7, halfD: WALL, halfH: INNER_WALL_HALF_H, kind: 'wall' },
  { x: -11, z: -18, halfW: 7, halfD: WALL, halfH: INNER_WALL_HALF_H, kind: 'wall' },
  { x: 11, z: -18, halfW: 7, halfD: WALL, halfH: INNER_WALL_HALF_H, kind: 'wall' },
  { x: -18, z: -11, halfW: WALL, halfD: 7, halfH: INNER_WALL_HALF_H, kind: 'wall' },
  { x: -18, z: 11, halfW: WALL, halfD: 7, halfH: INNER_WALL_HALF_H, kind: 'wall' },
  { x: 18, z: -11, halfW: WALL, halfD: 7, halfH: INNER_WALL_HALF_H, kind: 'wall' },
  { x: 18, z: 11, halfW: WALL, halfD: 7, halfH: INNER_WALL_HALF_H, kind: 'wall' },

  // pinwheel core: four rotationally symmetric arms make spiral corridors
  { x: -8, z: 4, halfW: 6, halfD: WALL, halfH: INNER_WALL_HALF_H, kind: 'wall' },
  { x: 8, z: -4, halfW: 6, halfD: WALL, halfH: INNER_WALL_HALF_H, kind: 'wall' },
  { x: -4, z: -8, halfW: WALL, halfD: 6, halfH: INNER_WALL_HALF_H, kind: 'wall' },
  { x: 4, z: 8, halfW: WALL, halfD: 6, halfH: INNER_WALL_HALF_H, kind: 'wall' },

  // cover crates: door approaches, quadrant corridors, center
  { x: 6, z: 22, halfW: 1.1, halfD: 1.1, halfH: CRATE_HALF_H, kind: 'crate' },
  { x: -6, z: -22, halfW: 1.1, halfD: 1.1, halfH: CRATE_HALF_H, kind: 'crate' },
  { x: 22, z: 6, halfW: 1.0, halfD: 1.0, halfH: CRATE_HALF_H, kind: 'crate' },
  { x: -22, z: -6, halfW: 1.0, halfD: 1.0, halfH: CRATE_HALF_H, kind: 'crate' },
  { x: 10, z: 10, halfW: 1.2, halfD: 1.2, halfH: CRATE_HALF_H, kind: 'crate' },
  { x: -10, z: -10, halfW: 1.2, halfD: 1.2, halfH: CRATE_HALF_H, kind: 'crate' },
  { x: 0, z: 0, halfW: 1.3, halfD: 1.3, halfH: CRATE_HALF_H, kind: 'crate' },
  { x: -12, z: 12, halfW: 0.9, halfD: 0.9, halfH: CRATE_HALF_H, kind: 'crate' },
  { x: 12, z: -12, halfW: 0.9, halfD: 0.9, halfH: CRATE_HALF_H, kind: 'crate' },
];

const WARRENS_DOORS: DoorDef[] = [
  { x: 0, z: 18, halfW: 4, halfD: WALL, halfH: 0.9, axis: 'x' },
  { x: 0, z: -18, halfW: 4, halfD: WALL, halfH: 0.9, axis: 'x' },
];

export const WARRENS_MAP: GameMap = {
  id: 'warrens',
  name: 'Warrens',
  theme: 'industrial',
  cover: WARRENS_COVER,
  doors: WARRENS_DOORS,
  controlPoints: [
    { id: 'A', label: 'A', x: -11, z: -11, radius: 4 },
    { id: 'B', label: 'B', x: 0, z: 0, radius: 4 },
    { id: 'C', label: 'C', x: 11, z: 11, radius: 4 },
  ],
  bombSites: [
    { id: 'A', label: 'A', x: 0, z: 0, radius: 3.4 },
    { id: 'B', label: 'B', x: 23, z: 23, radius: 3.2 },
  ],
  spawns: {
    any: [
      { x: -26, z: -26 }, { x: 0, z: -26 }, { x: 26, z: -26 }, { x: -26, z: 0 },
      { x: 26, z: 0 }, { x: -26, z: 26 }, { x: 0, z: 26 }, { x: 26, z: 26 },
      { x: 14, z: -26 }, { x: -14, z: 26 }, { x: 26, z: 14 }, { x: -26, z: -14 },
    ],
    team1: [
      { x: -26, z: -24 }, { x: -26, z: -8 }, { x: -26, z: 8 }, { x: -26, z: 24 },
      { x: -24, z: -16 }, { x: -24, z: 16 }, { x: -26, z: 0 }, { x: -22, z: -26 },
    ],
    team2: [
      { x: 26, z: -24 }, { x: 26, z: -8 }, { x: 26, z: 8 }, { x: 26, z: 24 },
      { x: 24, z: -16 }, { x: 24, z: 16 }, { x: 26, z: 0 }, { x: 22, z: 26 },
    ],
  },
};

export const EMPTY_MAP: GameMap = {
  id: 'empty',
  name: 'Proving Ground',
  theme: 'industrial',
  cover: [],
  doors: [],
  controlPoints: [],
  bombSites: [],
};

export const DEFAULT_MAP = COMPOUND_MAP;

export const MAPS: Record<string, GameMap> = {
  compound: COMPOUND_MAP,
  office: OFFICE_MAP,
  warrens: WARRENS_MAP,
  empty: EMPTY_MAP,
};

export function getMap(id: string): GameMap {
  return MAPS[id] ?? DEFAULT_MAP;
}
