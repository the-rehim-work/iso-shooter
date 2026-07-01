import { FIXED_DT, initRapier, CollisionWorld, DEFAULT_MAP, MODE_NAMES, type GameMode } from '@iso/shared';
import { GameServer } from './gameLoop.js';
import { IsoWsServer } from './net/wsServer.js';

const PORT = Math.max(1, parseInt(process.env['PORT'] ?? '5175', 10));
const mode = (process.env['GAME_MODE'] ?? 'ffa') as GameMode;
const numBots = Math.max(0, parseInt(process.env['GAME_BOTS'] ?? '3', 10));

await initRapier();

const difficulty = (process.env['GAME_DIFFICULTY'] ?? 'normal') as 'easy' | 'normal' | 'hard';
const winLimit = Math.max(0, parseInt(process.env['GAME_WINLIMIT'] ?? '0', 10));

const game = new GameServer(mode);
game.setPhysics(new CollisionWorld(DEFAULT_MAP));
game.applyConfig({ mode, winLimit, bots: numBots, difficulty, friendlyFire: false, respawn: true });

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

console.log(`[server] ${MODE_NAMES[mode]} on ${DEFAULT_MAP.name} @ ${1 / FIXED_DT}Hz · ${mode === 'survival' ? 'waves' : numBots + ' bots'} · ${difficulty}`);
