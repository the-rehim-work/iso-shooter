import {
  FIXED_DT,
  ARENA_HALF_X,
  PLAYER_RADIUS,
  initRapier,
  CollisionWorld,
  PredictedEntity,
  integrate,
  integrateWithCollision,
  type InputCommand,
  type MoveState,
} from '@iso/shared';
import { GameServer } from './gameLoop.js';

const RTT_MS = 150;
const HALF = RTT_MS / 2;
const SERVER_STEP_MS = 1000 / 30;
const CLIENT_FRAME_MS = 1000 / 60;
const DURATION_MS = 6000;
const EPSILON = 1e-3;

interface Delayed<T> {
  deliverAt: number;
  payload: T;
}

function scriptedDir(timeMs: number): { mx: number; mz: number } {
  const phase = Math.floor(timeMs / 800) % 4;
  switch (phase) {
    case 0: return { mx: 1, mz: 0 };
    case 1: return { mx: 0, mz: 1 };
    case 2: return { mx: -1, mz: 0 };
    default: return { mx: 0, mz: -1 };
  }
}

function dist(a: MoveState, b: MoveState): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function run(perturbStart: boolean): {
  maxCorrection: number;
  finalGap: number;
  serverMatchesPureSim: boolean;
} {
  const server = new GameServer();
  const clientId = 1;
  server.addClient(clientId, { x: 0, z: 0 });

  const start: MoveState = perturbStart
    ? { x: 5, z: -3, yaw: 0 }
    : { x: 0, z: 0, yaw: 0 };
  const predicted = new PredictedEntity(start);

  const toServer: Delayed<{ clientId: number; cmd: InputCommand }>[] = [];
  const toClient: Delayed<{ ack: number; selfState: MoveState }>[] = [];

  const allInputs: InputCommand[] = [];

  let seq = 0;
  let nextServerStep = SERVER_STEP_MS;
  let nextClientFrame = CLIENT_FRAME_MS;
  let maxCorrection = 0;

  for (let now = 0; now <= DURATION_MS; now += 1) {
    if (now >= nextClientFrame && now < DURATION_MS - 1500) {
      const dir = scriptedDir(now);
      const cmd: InputCommand = {
        seq: ++seq,
        moveX: dir.mx,
        moveZ: dir.mz,
        aimYaw: 0,
        dt: FIXED_DT,
        fire: false,
        reload: false,
      };
      predicted.predict(cmd);
      allInputs.push(cmd);
      toServer.push({ deliverAt: now + HALF, payload: { clientId, cmd } });
      nextClientFrame += CLIENT_FRAME_MS;
    }

    while (toServer.length && toServer[0]!.deliverAt <= now) {
      const m = toServer.shift()!;
      server.enqueueInput(m.payload.clientId, m.payload.cmd);
    }

    if (now >= nextServerStep) {
      server.step();
      const snap = server.snapshotEntities()[0]!;
      toClient.push({
        deliverAt: now + HALF,
        payload: {
          ack: server.ackFor(clientId),
          selfState: { x: snap.x, z: snap.z, yaw: snap.yaw },
        },
      });
      nextServerStep += SERVER_STEP_MS;
    }

    while (toClient.length && toClient[0]!.deliverAt <= now) {
      const m = toClient.shift()!;
      const before: MoveState = { ...predicted.state };
      predicted.reconcile(m.payload.selfState, m.payload.ack);
      const correction = dist(before, predicted.state);
      if (correction > maxCorrection) maxCorrection = correction;
    }
  }

  let pure: MoveState = { x: 0, z: 0, yaw: 0 };
  for (const cmd of allInputs) pure = integrate(pure, cmd);
  const serverFinal = server.snapshotEntities()[0]!;
  const serverMatchesPureSim =
    dist(pure, { x: serverFinal.x, z: serverFinal.z, yaw: 0 }) < EPSILON;

  const finalGap = dist(predicted.state, {
    x: serverFinal.x,
    z: serverFinal.z,
    yaw: 0,
  });

  return { maxCorrection, finalGap, serverMatchesPureSim };
}

function runWallCollision(): { stuckAtWall: boolean; finalGap: number; maxCorrection: number } {
  const serverPhysics = new CollisionWorld();
  const clientPhysics = new CollisionWorld();

  const server = new GameServer();
  server.setPhysics(serverPhysics);

  const clientId = 1;
  const { netId } = server.addClient(clientId, { x: 0, z: 0 });
  clientPhysics.addCharacter(netId, 0, 0);

  const stepFn = (state: MoveState, cmd: InputCommand): MoveState =>
    integrateWithCollision(state, cmd, netId, clientPhysics);
  const predicted = new PredictedEntity({ x: 0, z: 0, yaw: 0 }, stepFn);

  const toServer: Delayed<{ clientId: number; cmd: InputCommand }>[] = [];
  const toClient: Delayed<{ ack: number; selfState: MoveState }>[] = [];

  let seq = 0;
  let nextServerStep = SERVER_STEP_MS;
  let nextClientFrame = CLIENT_FRAME_MS;
  let maxCorrection = 0;

  const WALL_DURATION_MS = 4000;

  for (let now = 0; now <= WALL_DURATION_MS; now += 1) {
    if (now >= nextClientFrame) {
      const cmd: InputCommand = { seq: ++seq, moveX: 1, moveZ: 0, aimYaw: 0, dt: FIXED_DT, fire: false, reload: false };
      predicted.predict(cmd);
      toServer.push({ deliverAt: now + HALF, payload: { clientId, cmd } });
      nextClientFrame += CLIENT_FRAME_MS;
    }

    while (toServer.length && toServer[0]!.deliverAt <= now) {
      const m = toServer.shift()!;
      server.enqueueInput(m.payload.clientId, m.payload.cmd);
    }

    if (now >= nextServerStep) {
      server.step();
      const snap = server.snapshotEntities()[0]!;
      toClient.push({
        deliverAt: now + HALF,
        payload: {
          ack: server.ackFor(clientId),
          selfState: { x: snap.x, z: snap.z, yaw: snap.yaw },
        },
      });
      nextServerStep += SERVER_STEP_MS;
    }

    while (toClient.length && toClient[0]!.deliverAt <= now) {
      const m = toClient.shift()!;
      const before: MoveState = { ...predicted.state };
      predicted.reconcile(m.payload.selfState, m.payload.ack);
      const correction = dist(before, predicted.state);
      if (correction > maxCorrection) maxCorrection = correction;
    }
  }

  const serverFinal = server.snapshotEntities()[0]!;
  const expectedWallX = ARENA_HALF_X - PLAYER_RADIUS;
  const stuckAtWall = Math.abs(serverFinal.x - expectedWallX) < 0.15;
  const finalGap = Math.abs(predicted.state.x - serverFinal.x);

  return { stuckAtWall, finalGap, maxCorrection };
}

await initRapier();

console.log('--- NETCODE CONVERGENCE PROOF ---');
console.log(`RTT=${RTT_MS}ms  server=30Hz  client=60Hz  duration=${DURATION_MS}ms\n`);

const clean = run(false);
console.log('[lossless, correct start]');
console.log(`  server == pure shared sim:      ${clean.serverMatchesPureSim}`);
console.log(`  max reconcile correction:       ${clean.maxCorrection.toExponential(2)} (want ~0)`);
console.log(`  final predicted vs server gap:  ${clean.finalGap.toExponential(2)} (want ~0)\n`);

const perturbed = run(true);
console.log('[perturbed client start -> reconcile must pull it back]');
console.log(`  max reconcile correction:       ${perturbed.maxCorrection.toFixed(3)} (want > 0, proves correction fires)`);
console.log(`  final predicted vs server gap:  ${perturbed.finalGap.toExponential(2)} (want ~0, proves convergence)\n`);

const wall = runWallCollision();
console.log('[wall collision — player moves east into arena wall]');
console.log(`  server player stuck at wall:    ${wall.stuckAtWall} (want true)`);
console.log(`  max reconcile correction:       ${wall.maxCorrection.toExponential(2)} (want ~0, client+server agree)`);
console.log(`  final predicted vs server gap:  ${wall.finalGap.toExponential(2)} (want ~0)\n`);

const pass =
  clean.serverMatchesPureSim &&
  clean.maxCorrection < EPSILON &&
  clean.finalGap < EPSILON &&
  perturbed.maxCorrection > 0.1 &&
  perturbed.finalGap < EPSILON &&
  wall.stuckAtWall &&
  wall.finalGap < 0.05 &&
  wall.maxCorrection < 0.15;

console.log(pass
  ? 'RESULT: PASS — loop is authoritative, predicted, convergent, and collision-aware.'
  : 'RESULT: FAIL');
process.exit(pass ? 0 : 1);
