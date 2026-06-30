import * as THREE from 'three';
import {
  FIXED_DT,
  INTERP_DELAY_MS,
  ARENA_HALF_X,
  ARENA_HALF_Z,
  MAX_VIEWPORT_ASPECT,
  WEAPON_RANGE,
  MSG,
  initRapier,
  CollisionWorld,
  PredictedEntity,
  InterpolationBuffer,
  integrateWithCollision,
  initialWeaponState,
  tickWeapon,
  encode,
  decode,
  type InputCommand,
  type MoveState,
  type ServerToClient,
  type WeaponSimState,
  type GameMode,
  type KillEvent,
} from '@iso/shared';
import { WsClient } from './net/wsClient.js';
import { LatencySim } from './net/latencySim.js';
import { createScene } from './render/scene.js';
import {
  createIsoCamera,
  resizeIsoCamera,
  moveCameraTarget,
  screenToGround,
  cameraGroundBasis,
  applyViewportCap,
} from './render/isoCamera.js';
import { EntityView } from './render/entityView.js';
import { CharacterModel } from './render/characterModel.js';
import { EffectsSystem } from './render/effects.js';
import { InputSampler } from './input.js';
import { Hud } from './render/hud.js';
import { AudioSystem } from './audio/audioSystem.js';
import { SettingsPanel } from './ui/settings.js';
import { showAuthDialog, getSavedName } from './ui/auth.js';

const playerNamePromise = showAuthDialog();

await initRapier();

let playerName = await playerNamePromise;

const clientPhysics = new CollisionWorld();

const VIEW_SIZE = 16;
const app = document.getElementById('app')!;
const hudEl = document.getElementById('hud')!;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x15171c);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
app.appendChild(renderer.domElement);

const scene = createScene();
const camera = createIsoCamera(VIEW_SIZE, Math.min(window.innerWidth / window.innerHeight, MAX_VIEWPORT_ASPECT));

function handleResize(): void {
  renderer.setSize(window.innerWidth, window.innerHeight);
  resizeIsoCamera(camera, VIEW_SIZE, window.innerWidth / window.innerHeight);
  applyViewportCap(renderer, VIEW_SIZE);
}
window.addEventListener('resize', handleResize);
applyViewportCap(renderer, VIEW_SIZE);

const input = new InputSampler(renderer.domElement);
const hud = new Hud(hudEl);
const audio = new AudioSystem();
const effects = new EffectsSystem(scene);

const raw = new WsClient(`ws://${location.hostname}:8080`);
const net = new LatencySim(raw, 75);

new SettingsPanel(document.body, {
  initialVolume: 0.8,
  initialLatency: 75,
  initialName: getSavedName(),
  onVolumeChange: (v) => audio.setVolume(v),
  onLatencyChange: (ms) => net.setLatency(ms),
  onNameChange: (name) => { playerName = name; },
});

document.addEventListener('mousedown', () => audio.init(), { once: true });
document.addEventListener('keydown', () => audio.init(), { once: true });

let myNetId = -1;
let myMode: GameMode = 'ffa';
let myTeam = 0;
let predicted: PredictedEntity | null = null;
let localWeapon: WeaponSimState = initialWeaponState();
let localTick = 0;

const views = new Map<number, EntityView>();
const interp = new Map<number, InterpolationBuffer>();
const entityTeams = new Map<number, number>();
const entityIsBot = new Map<number, boolean>();
const entityHealth = new Map<number, number>();
const entityKills = new Map<number, number>();
const entityWasDead = new Map<number, boolean>();
const entityLastPos = new Map<number, { x: number; z: number }>();
const entitySpeeds = new Map<number, number>();
let myKills = 0;
let teamScores: [number, number] = [0, 0];
let serverTimeMs = 0;
let seq = 0;

function entityColor(netId: number, team: number, isBot: boolean): number {
  if (netId === myNetId) return 0xe6b800;
  if (myMode === 'ffa') return isBot ? 0xcc8833 : 0xe55555;
  if (team === myTeam) return isBot ? 0x6699cc : 0x4a90d9;
  return isBot ? 0xcc5533 : 0xe55555;
}

function labelFor(netId: number): string {
  if (netId === myNetId && playerName) return playerName;
  return entityIsBot.get(netId) ? 'Bot#' + netId : '#' + netId;
}

function getOrCreateView(netId: number, team: number, isBot: boolean): EntityView {
  let v = views.get(netId);
  if (!v) {
    v = new EntityView(scene, entityColor(netId, team, isBot));
    views.set(netId, v);
  }
  return v;
}

net.onMessage((dataStr) => {
  const msg = decode<ServerToClient>(dataStr);

  if (msg.t === MSG.Welcome) {
    myNetId = msg.netId;
    myMode = msg.mode;
    myTeam = msg.team;
    clientPhysics.addCharacter(myNetId, 0, 0);
    localWeapon = initialWeaponState();
    localTick = 0;
    predicted = new PredictedEntity(
      { x: 0, z: 0, yaw: 0 },
      (state: MoveState, cmd: InputCommand) =>
        integrateWithCollision(state, cmd, myNetId, clientPhysics),
    );
    return;
  }

  if (msg.t === MSG.Snapshot) {
    const tMs = msg.serverTick * FIXED_DT * 1000;
    if (tMs > serverTimeMs) serverTimeMs = tMs;
    teamScores = msg.teamScores;

    for (const kill of (msg.recentKills as KillEvent[])) {
      hud.pushKill(labelFor(kill.killer), labelFor(kill.victim));
    }

    const seenNetIds = new Set<number>();
    for (const e of msg.entities) {
      seenNetIds.add(e.netId);
      entityTeams.set(e.netId, e.team);
      entityIsBot.set(e.netId, e.isBot);

      const prevHealth = entityHealth.get(e.netId) ?? e.health;
      entityHealth.set(e.netId, e.health);
      entityKills.set(e.netId, e.kills);

      const wasDeadPrev = entityWasDead.get(e.netId) ?? false;
      entityWasDead.set(e.netId, e.isDead);

      const view = getOrCreateView(e.netId, e.team, e.isBot);

      if (e.netId === myNetId) {
        localWeapon = { ...localWeapon, ammo: e.ammo, reserveMags: e.reserveMags };
        myKills = e.kills;
        predicted?.reconcile({ x: e.x, z: e.z, yaw: e.yaw }, msg.ackSeq);
        view.setState(e.x, e.z, e.yaw);
        if (!e.isDead && wasDeadPrev) { view.respawn(); audio.playDeath(); }
        else if (e.isDead && !wasDeadPrev) { view.triggerDeath(); audio.playDeath(); }
        else if (!e.isDead && e.health < prevHealth) view.hitFlash();
      } else {
        let b = interp.get(e.netId);
        if (!b) { b = new InterpolationBuffer(); interp.set(e.netId, b); }
        b.push(tMs, { x: e.x, z: e.z, yaw: e.yaw });

        if (!e.isDead && wasDeadPrev) view.respawn();
        else if (e.isDead && !wasDeadPrev) view.triggerDeath();
        if (!e.isDead && !wasDeadPrev && e.health < prevHealth) view.hitFlash();

        if (e.shotFired && !e.isDead) {
          view.triggerShoot();
          const mPos = CharacterModel.muzzleWorldPos(e.x, e.z, e.yaw);
          effects.muzzleFlash(mPos);
          const end = new THREE.Vector3(
            e.x + Math.sin(e.yaw) * WEAPON_RANGE,
            1.08,
            e.z + Math.cos(e.yaw) * WEAPON_RANGE,
          );
          effects.bulletTracer(mPos, end);
        }

        if (!e.isDead && !view.isDead) view.setVisible(true);
      }
    }

    for (const [netId, view] of views) {
      if (!seenNetIds.has(netId)) {
        view.dispose(scene);
        views.delete(netId);
        interp.delete(netId);
        entityWasDead.delete(netId);
        entityLastPos.delete(netId);
        entitySpeeds.delete(netId);
      }
    }
  }
});

let last = performance.now();
let inputAcc = 0;
let prevPredX = 0;
let prevPredZ = 0;

function frame(now: number): void {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  serverTimeMs += dt * 1000;
  inputAcc += dt;

  if (predicted) {
    prevPredX = predicted.state.x;
    prevPredZ = predicted.state.z;

    while (inputAcc >= FIXED_DT) {
      inputAcc -= FIXED_DT;
      localTick++;

      const { forward, strafe } = input.axis();
      const basis = cameraGroundBasis(camera);
      const wx = basis.forward.x * forward + basis.right.x * strafe;
      const wz = basis.forward.z * forward + basis.right.z * strafe;

      const ground = screenToGround(camera, input.mouseX, input.mouseY, window.innerWidth, window.innerHeight);
      let yaw = predicted.state.yaw;
      if (ground) yaw = Math.atan2(ground.x - predicted.state.x, ground.z - predicted.state.z);

      const fireNow = input.fire;
      const reloadNow = input.consumeReload();
      const prevWeapon = localWeapon;
      const { next, didFire } = tickWeapon(localWeapon, fireNow, reloadNow, localTick);
      localWeapon = next;

      if (didFire) {
        audio.init();
        audio.playGunshot();
        const mPos = CharacterModel.muzzleWorldPos(predicted.state.x, predicted.state.z, yaw);
        effects.muzzleFlash(mPos);
        const end = new THREE.Vector3(
          predicted.state.x + Math.sin(yaw) * WEAPON_RANGE,
          1.08,
          predicted.state.z + Math.cos(yaw) * WEAPON_RANGE,
        );
        effects.bulletTracer(mPos, end);
        views.get(myNetId)?.triggerShoot();
      }

      if (next.reloadEndTick !== 0 && prevWeapon.reloadEndTick === 0) {
        audio.init();
        audio.playReload();
      }

      const cmd: InputCommand = { seq: ++seq, moveX: wx, moveZ: wz, aimYaw: yaw, dt: FIXED_DT, fire: fireNow, reload: reloadNow };
      predicted.predict(cmd);
      net.send(encode({ t: MSG.Input, cmd }));
    }

    const s = predicted.state;
    const localSpeed = Math.hypot(s.x - prevPredX, s.z - prevPredZ) / Math.max(dt, 0.001);
    entitySpeeds.set(myNetId, localSpeed);

    const myView = views.get(myNetId);
    if (myView) myView.setState(s.x, s.z, s.yaw);

    const cx = Math.max(-ARENA_HALF_X, Math.min(ARENA_HALF_X, s.x));
    const cz = Math.max(-ARENA_HALF_Z, Math.min(ARENA_HALF_Z, s.z));
    moveCameraTarget(camera, cx, cz);
  }

  const renderTime = serverTimeMs - INTERP_DELAY_MS;
  for (const [netId, buf] of interp) {
    const s = buf.sample(renderTime);
    if (s) {
      const lp = entityLastPos.get(netId);
      const speed = lp ? Math.hypot(s.x - lp.x, s.z - lp.z) / Math.max(dt, 0.001) : 0;
      entityLastPos.set(netId, { x: s.x, z: s.z });
      entitySpeeds.set(netId, speed);
      views.get(netId)?.setState(s.x, s.z, s.yaw);
    }
  }

  effects.update(dt);

  const nowMs = performance.now();
  for (const [netId, view] of views) {
    const speed = entitySpeeds.get(netId) ?? 0;
    view.tick(nowMs, dt, speed);
  }

  const isReloading = localWeapon.reloadEndTick !== 0 && localTick < localWeapon.reloadEndTick;
  hud.update({
    health: entityHealth.get(myNetId) ?? 100,
    maxHealth: 100,
    ammo: localWeapon.ammo,
    reserveMags: localWeapon.reserveMags,
    isReloading,
    myKills,
    mode: myMode,
    teamScores,
    myTeam,
  }, nowMs);

  hud.setDebug(
    `netId:${myNetId === -1 ? '-' : myNetId} seq:${seq} ents:${views.size} pending:${predicted?.pendingCount() ?? 0}`,
  );

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
