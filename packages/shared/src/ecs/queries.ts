import { defineQuery } from 'bitecs';
import { NetId, Player, Transform, Bot, Dead } from './components.js';

export const playerQuery = defineQuery([Player, Transform, NetId]);
export const transformNetQuery = defineQuery([Transform, NetId]);
export const botQuery = defineQuery([Bot, Transform, NetId]);
export const deadQuery = defineQuery([Dead]);
