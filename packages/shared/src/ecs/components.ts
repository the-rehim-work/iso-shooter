import { defineComponent, Types } from 'bitecs';

export const Transform = defineComponent({ x: Types.f32, z: Types.f32, yaw: Types.f32 });
export const Velocity = defineComponent({ x: Types.f32, z: Types.f32 });
export const NetId = defineComponent({ value: Types.ui32 });
export const Owner = defineComponent({ clientId: Types.ui32 });
export const ColliderHandle = defineComponent({ rapier: Types.ui32 });

export const Health = defineComponent({ current: Types.ui16, max: Types.ui8 });
export const WeaponState = defineComponent({
  ammo: Types.ui8,
  reserveMags: Types.ui8,
  cooldownTick: Types.ui32,
  reloadEndTick: Types.ui32,
});
export const Team = defineComponent({ id: Types.ui8 });
export const Kills = defineComponent({ count: Types.ui16 });
export const Dead = defineComponent({ respawnTick: Types.ui32 });

export const Player = defineComponent();
export const LocalPlayer = defineComponent();
export const RemotePlayer = defineComponent();
export const Bot = defineComponent();
