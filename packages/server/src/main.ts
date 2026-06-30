import { FIXED_DT, initRapier, CollisionWorld, type GameMode } from '@iso/shared';
import { GameServer } from './gameLoop.js';
import { IsoWsServer } from './net/wsServer.js';

const PORT = 8080;
const mode = (process.env['GAME_MODE'] ?? 'ffa') as GameMode;
const numBots = Math.max(0, parseInt(process.env['GAME_BOTS'] ?? '3', 10));

await initRapier();

const game = new GameServer(mode);
game.setPhysics(new CollisionWorld());

for (let i = 0; i < numBots; i++) {
  game.addBot();
}

const ws = new IsoWsServer(game, PORT);

const stepMs = FIXED_DT * 1000;
let last = performance.now();
let acc = 0;

setInterval(() => {
  const now = performance.now();
  acc += now - last;
  last = now;
  while (acc >= stepMs) {
    game.step();
    acc -= stepMs;
  }
  ws.broadcastSnapshot();
}, stepMs);

console.log(`[server] ${mode.toUpperCase()} @ ${1 / FIXED_DT}Hz · ${numBots} bots`);
