import { createWorld, type IWorld } from 'bitecs';

export interface GameWorld extends IWorld {
  tick: number;
}

export function createGameWorld(): GameWorld {
  const world = createWorld() as GameWorld;
  world.tick = 0;
  return world;
}
