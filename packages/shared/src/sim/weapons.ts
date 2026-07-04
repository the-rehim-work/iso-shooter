export type WeaponId =
  | 'pistol'
  | 'smg'
  | 'rifle'
  | 'shotgun'
  | 'sniper'
  | 'lmg'
  | 'dmr'
  | 'knife'
  | 'revolver'
  | 'carbine'
  | 'mp';

export interface WeaponDef {
  id: WeaponId;
  name: string;
  damage: number;
  fireIntervalTicks: number;
  magSize: number;
  numMags: number;
  reloadTicks: number;
  range: number;
  falloff: number;
  pellets: number;
  spread: number;
  automatic: boolean;
  muzzleSpeed: number;
  recoil: number;
  melee: boolean;
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  pistol: {
    id: 'pistol', name: 'Sidearm', damage: 24, fireIntervalTicks: 6, magSize: 12,
    numMags: 4, reloadTicks: 33, range: 30, falloff: 0.45, pellets: 1, spread: 0.01, automatic: false, muzzleSpeed: 1, recoil: 0.12, melee: false },
  smg: {
    id: 'smg', name: 'SMG', damage: 15, fireIntervalTicks: 3, magSize: 30,
    numMags: 5, reloadTicks: 36, range: 28, falloff: 0.4, pellets: 1, spread: 0.034, automatic: true, muzzleSpeed: 1, recoil: 0.08, melee: false },
  rifle: {
    id: 'rifle', name: 'Rifle', damage: 26, fireIntervalTicks: 4, magSize: 30,
    numMags: 4, reloadTicks: 45, range: 46, falloff: 0.55, pellets: 1, spread: 0.015, automatic: true, muzzleSpeed: 1, recoil: 0.16, melee: false },
  shotgun: {
    id: 'shotgun', name: 'Shotgun', damage: 11, fireIntervalTicks: 12, magSize: 6,
    numMags: 5, reloadTicks: 60, range: 13, falloff: 0.2, pellets: 8, spread: 0.20, automatic: false, muzzleSpeed: 1, recoil: 0.4, melee: false },
  sniper: {
    id: 'sniper', name: 'Sniper', damage: 92, fireIntervalTicks: 30, magSize: 5,
    numMags: 4, reloadTicks: 70, range: 130, falloff: 0.9, pellets: 1, spread: 0.003, automatic: false, muzzleSpeed: 1, recoil: 1.0, melee: false },
  lmg: {
    id: 'lmg', name: 'LMG', damage: 21, fireIntervalTicks: 4, magSize: 75,
    numMags: 3, reloadTicks: 84, range: 52, falloff: 0.5, pellets: 1, spread: 0.05, automatic: true, muzzleSpeed: 1, recoil: 0.2, melee: false },
  dmr: {
    id: 'dmr', name: 'Marksman', damage: 36, fireIntervalTicks: 12, magSize: 15,
    numMags: 4, reloadTicks: 51, range: 72, falloff: 0.7, pellets: 1, spread: 0.008, automatic: false, muzzleSpeed: 1, recoil: 0.5, melee: false },
  knife: {
    id: 'knife', name: 'Combat Knife', damage: 62, fireIntervalTicks: 14, magSize: 1,
    numMags: 1, reloadTicks: 0, range: 3.0, falloff: 1, pellets: 1, spread: 0, automatic: false, muzzleSpeed: 1, recoil: 0.06, melee: true },
  revolver: {
    id: 'revolver', name: 'Magnum', damage: 52, fireIntervalTicks: 16, magSize: 6,
    numMags: 4, reloadTicks: 55, range: 42, falloff: 0.6, pellets: 1, spread: 0.012, automatic: false, muzzleSpeed: 1, recoil: 0.55, melee: false },
  carbine: {
    id: 'carbine', name: 'Carbine', damage: 30, fireIntervalTicks: 6, magSize: 20,
    numMags: 4, reloadTicks: 42, range: 58, falloff: 0.6, pellets: 1, spread: 0.012, automatic: true, muzzleSpeed: 1, recoil: 0.2, melee: false },
  mp: {
    id: 'mp', name: 'Machine Pistol', damage: 12, fireIntervalTicks: 2, magSize: 24,
    numMags: 5, reloadTicks: 32, range: 22, falloff: 0.35, pellets: 1, spread: 0.045, automatic: true, muzzleSpeed: 1, recoil: 0.07, melee: false },
};

export type ClassId = 'assault' | 'recon' | 'scout' | 'heavy' | 'ronin' | 'demolition' | 'marksman';

export interface GrenadeKit {
  frag: number;
  molotov: number;
  smoke: number;
}

export interface ClassDef {
  id: ClassId;
  name: string;
  blurb: string;
  primary: WeaponId;
  secondary: WeaponId;
  maxHealth: number;
  speedMul: number;
  grenades: GrenadeKit;
}

export const CLASSES: Record<ClassId, ClassDef> = {
  assault: {
    id: 'assault', name: 'Assault', blurb: 'Balanced frontline rifleman', primary: 'rifle',
    secondary: 'pistol', maxHealth: 105, speedMul: 1.0, grenades: { frag: 2, molotov: 0, smoke: 1 },
  },
  recon: {
    id: 'recon', name: 'Recon', blurb: 'Long-range sniper, fragile up close', primary: 'sniper',
    secondary: 'pistol', maxHealth: 85, speedMul: 1.0, grenades: { frag: 0, molotov: 0, smoke: 2 },
  },
  scout: {
    id: 'scout', name: 'Scout', blurb: 'Fast SMG skirmisher', primary: 'smg',
    secondary: 'pistol', maxHealth: 90, speedMul: 1.25, grenades: { frag: 1, molotov: 0, smoke: 1 },
  },
  heavy: {
    id: 'heavy', name: 'Heavy', blurb: 'Tanky LMG suppressor, slow', primary: 'lmg',
    secondary: 'pistol', maxHealth: 145, speedMul: 0.84, grenades: { frag: 1, molotov: 1, smoke: 0 },
  },
  ronin: {
    id: 'ronin', name: 'Ronin', blurb: 'Blazing melee duelist with a magnum', primary: 'knife',
    secondary: 'revolver', maxHealth: 110, speedMul: 1.38, grenades: { frag: 0, molotov: 1, smoke: 2 },
  },
  demolition: {
    id: 'demolition', name: 'Demolition', blurb: 'Close-range explosives specialist', primary: 'shotgun',
    secondary: 'pistol', maxHealth: 115, speedMul: 0.92, grenades: { frag: 3, molotov: 2, smoke: 1 },
  },
  marksman: {
    id: 'marksman', name: 'Marksman', blurb: 'Mid-range precision, weak up close', primary: 'dmr',
    secondary: 'mp', maxHealth: 95, speedMul: 1.05, grenades: { frag: 1, molotov: 0, smoke: 1 },
  },
};

export const CLASS_IDS: ClassId[] = ['assault', 'recon', 'scout', 'heavy', 'ronin', 'demolition', 'marksman'];

// default ladder — servers shuffle the guns per match, knife always last
export const GUNGAME_LADDER: WeaponId[] = ['pistol', 'mp', 'smg', 'shotgun', 'revolver', 'carbine', 'rifle', 'dmr', 'lmg', 'sniper', 'knife'];

export const WEAPON_ORDER: WeaponId[] = ['pistol', 'smg', 'rifle', 'shotgun', 'sniper', 'lmg', 'dmr', 'knife', 'revolver', 'carbine', 'mp'];

export function classIdToIndex(id: ClassId): number {
  return CLASS_IDS.indexOf(id);
}

export function classFromIndex(i: number): ClassDef {
  return CLASSES[CLASS_IDS[i] ?? 'assault']!;
}

export function weaponIdToIndex(id: WeaponId): number {
  return WEAPON_ORDER.indexOf(id);
}

export function weaponFromIndex(i: number): WeaponDef {
  return WEAPONS[WEAPON_ORDER[i] ?? 'rifle']!;
}
