import type { WeaponDef } from './weapons.js';

export const EQUIP_TICKS = 7;

const BLOOM_PER_SHOT = 0.26;
const BLOOM_MAX = 1.5;
const BLOOM_RECOVER = 0.2;

export interface WeaponSimState {
  ammo0: number;
  reserve0: number;
  ammo1: number;
  reserve1: number;
  activeSlot: number;
  cooldownTick: number;
  reloadEndTick: number;
  prevFire: number;
  heat: number;
}

export interface WeaponInput {
  fire: boolean;
  reload: boolean;
  switchTo: number;
}

export type WeaponPair = readonly [WeaponDef, WeaponDef];

export function initialWeaponState(loadout: WeaponPair): WeaponSimState {
  return {
    ammo0: loadout[0].magSize,
    reserve0: loadout[0].numMags - 1,
    ammo1: loadout[1].magSize,
    reserve1: loadout[1].numMags - 1,
    activeSlot: 0,
    cooldownTick: 0,
    reloadEndTick: 0,
    prevFire: 0,
    heat: 0,
  };
}

function getAmmo(s: WeaponSimState, slot: number): number {
  return slot === 0 ? s.ammo0 : s.ammo1;
}

function getReserve(s: WeaponSimState, slot: number): number {
  return slot === 0 ? s.reserve0 : s.reserve1;
}

export function tickWeapon(
  s: WeaponSimState,
  input: WeaponInput,
  tick: number,
  loadout: WeaponPair,
): { next: WeaponSimState; didFire: boolean; firedWith: WeaponDef | null; spread: number } {
  const next: WeaponSimState = { ...s };
  let didFire = false;
  let firedWith: WeaponDef | null = null;
  let spread = 0;

  if (
    input.switchTo >= 0 &&
    input.switchTo <= 1 &&
    input.switchTo !== next.activeSlot
  ) {
    next.activeSlot = input.switchTo;
    next.reloadEndTick = 0;
    next.cooldownTick = tick + EQUIP_TICKS;
  }

  const slot = next.activeSlot;
  const def = loadout[slot]!;

  if (def.melee) {
    if (input.fire && !(!def.automatic && next.prevFire === 1) && tick >= next.cooldownTick) {
      next.cooldownTick = tick + def.fireIntervalTicks;
      didFire = true;
      firedWith = def;
    }
    next.prevFire = input.fire ? 1 : 0;
    return { next, didFire, firedWith, spread: 0 };
  }

  next.heat = Math.max(0, next.heat - def.spread * BLOOM_RECOVER);

  if (next.reloadEndTick !== 0 && tick >= next.reloadEndTick) {
    const reserve = getReserve(next, slot);
    if (slot === 0) { next.reserve0 = Math.max(0, reserve - 1); next.ammo0 = def.magSize; }
    else { next.reserve1 = Math.max(0, reserve - 1); next.ammo1 = def.magSize; }
    next.reloadEndTick = 0;
  }

  const isReloading = next.reloadEndTick !== 0;
  const ammo = getAmmo(next, slot);
  const reserve = getReserve(next, slot);

  const semiBlocked = !def.automatic && next.prevFire === 1;

  if (!isReloading && reserve > 0 && ammo < def.magSize && (input.reload || (ammo === 0 && input.fire))) {
    next.reloadEndTick = tick + def.reloadTicks;
  } else if (!isReloading && input.fire && !semiBlocked && ammo > 0 && tick >= next.cooldownTick) {
    if (slot === 0) next.ammo0 = ammo - 1;
    else next.ammo1 = ammo - 1;
    next.cooldownTick = tick + def.fireIntervalTicks;
    didFire = true;
    firedWith = def;
    spread = next.heat;
    next.heat = Math.min(def.spread * BLOOM_MAX, next.heat + def.spread * BLOOM_PER_SHOT);
  }

  next.prevFire = input.fire ? 1 : 0;

  return { next, didFire, firedWith, spread };
}

export function activeDef(s: WeaponSimState, loadout: WeaponPair): WeaponDef {
  return loadout[s.activeSlot]! ?? loadout[0]!;
}

export function activeAmmo(s: WeaponSimState): number {
  return s.activeSlot === 0 ? s.ammo0 : s.ammo1;
}

export function activeReserve(s: WeaponSimState): number {
  return s.activeSlot === 0 ? s.reserve0 : s.reserve1;
}
