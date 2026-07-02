import { defineComponent, Types } from 'bitecs';

export const Transform = defineComponent({ x: Types.f32, y: Types.f32, z: Types.f32, yaw: Types.f32, pitch: Types.f32 });
export const Velocity = defineComponent({ x: Types.f32, y: Types.f32, z: Types.f32 });
export const NetId = defineComponent({ value: Types.ui32 });
export const Owner = defineComponent({ clientId: Types.ui32 });
export const ColliderHandle = defineComponent({ rapier: Types.ui32 });

export const Health = defineComponent({ current: Types.ui16, max: Types.ui16 });
export const WeaponState = defineComponent({
  ammo0: Types.ui16,
  reserve0: Types.ui8,
  ammo1: Types.ui16,
  reserve1: Types.ui8,
  activeSlot: Types.ui8,
  cooldownTick: Types.ui32,
  reloadEndTick: Types.ui32,
  prevFire: Types.ui8,
  heat: Types.f32,
});
export const Loadout = defineComponent({ classId: Types.ui8, speed: Types.f32, w0: Types.ui8, w1: Types.ui8 });
export const Team = defineComponent({ id: Types.ui8 });
export const Kills = defineComponent({ count: Types.ui16, deaths: Types.ui16, score: Types.ui16 });
export const Dead = defineComponent({ respawnTick: Types.ui32 });

export const Player = defineComponent();
export const LocalPlayer = defineComponent();
export const RemotePlayer = defineComponent();
export const Bot = defineComponent();
