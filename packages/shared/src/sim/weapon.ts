import {
  WEAPON_MAG_SIZE,
  WEAPON_NUM_MAGS,
  WEAPON_FIRE_INTERVAL_TICKS,
  WEAPON_RELOAD_TICKS,
} from '../constants.js';

export interface WeaponSimState {
  ammo: number;
  reserveMags: number;
  cooldownTick: number;
  reloadEndTick: number;
}

export function initialWeaponState(): WeaponSimState {
  return {
    ammo: WEAPON_MAG_SIZE,
    reserveMags: WEAPON_NUM_MAGS - 1,
    cooldownTick: 0,
    reloadEndTick: 0,
  };
}

export function tickWeapon(
  s: WeaponSimState,
  fire: boolean,
  reload: boolean,
  tick: number,
): { next: WeaponSimState; didFire: boolean } {
  let { ammo, reserveMags, cooldownTick, reloadEndTick } = s;
  let didFire = false;

  if (reloadEndTick !== 0 && tick >= reloadEndTick) {
    reserveMags = Math.max(0, reserveMags - 1);
    ammo = WEAPON_MAG_SIZE;
    reloadEndTick = 0;
  }

  const isReloading = reloadEndTick !== 0;

  if (!isReloading && reserveMags > 0 && (reload || (ammo === 0 && fire))) {
    reloadEndTick = tick + WEAPON_RELOAD_TICKS;
  } else if (!isReloading && fire && ammo > 0 && tick >= cooldownTick) {
    ammo--;
    cooldownTick = tick + WEAPON_FIRE_INTERVAL_TICKS;
    didFire = true;
  }

  return { next: { ammo, reserveMags, cooldownTick, reloadEndTick }, didFire };
}
