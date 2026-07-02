import { FIXED_DT, initRapier, getMap, MODE_NAMES, type GameMode, type MatchConfig } from '@iso/shared';
import { IsoWsServer } from './net/wsServer.js';

const PORT = Math.max(1, parseInt(process.env['PORT'] ?? '5175', 10));
const mode = (process.env['GAME_MODE'] ?? 'ffa') as GameMode;
const numBots = Math.max(0, parseInt(process.env['GAME_BOTS'] ?? '3', 10));

await initRapier();

const difficulty = (process.env['GAME_DIFFICULTY'] ?? 'normal') as 'easy' | 'normal' | 'hard';
const winLimit = Math.max(0, parseInt(process.env['GAME_WINLIMIT'] ?? '0', 10));
const gameMap = getMap(process.env['GAME_MAP'] ?? 'compound');

const defaultConfig: MatchConfig = {
  mode, map: gameMap.id, winLimit, bots: numBots, difficulty, friendlyFire: false, respawn: true,
};

const ws = new IsoWsServer(PORT, defaultConfig);

const stepMs = FIXED_DT * 1000;
let last = performance.now();
let acc = 0;

setInterval(() => {
  const now = performance.now();
  acc += now - last;
  last = now;
  while (acc >= stepMs) {
    ws.stepAll();
    acc -= stepMs;
  }
  ws.broadcastAll();
}, stepMs);

console.log(`[server] rooms @ ${1 / FIXED_DT}Hz · default: ${MODE_NAMES[mode]} on ${gameMap.name} · ${mode === 'survival' ? 'waves' : numBots + ' bots'} · ${difficulty}`);
