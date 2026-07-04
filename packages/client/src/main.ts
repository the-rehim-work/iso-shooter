import * as THREE from 'three';
import {
  FIXED_DT,
  INTERP_DELAY_MS,
  ARENA_HALF_X,
  ARENA_HALF_Z,
  MAX_VIEWPORT_ASPECT,
  MOVE_SPEED,
  PLAYER_HEIGHT,
  MUZZLE_HEIGHT,
  DOOR_OPEN_RADIUS,
  FFA_LIKE_MODES,
  rayCapsuleDistance,
  clampPitch,
  MSG,
  initRapier,
  CollisionWorld,
  PredictedEntity,
  InterpolationBuffer,
  integrateWithCollision,
  initialWeaponState,
  tickWeapon,
  activeDef,
  activeAmmo,
  activeReserve,
  CLASSES,
  CLASS_IDS,
  WEAPONS,
  GUNGAME_LADDER,
  FOG_MODES,
  VISION_RADIUS,
  weaponFromIndex,
  weaponIdToIndex,
  getMap,
  encode,
  decode,
  type InputCommand,
  type MoveState,
  type ServerToClient,
  type WeaponSimState,
  type WeaponPair,
  type GameMode,
  type ModeState,
  defaultMatchConfig,
  type ClassId,
  type KillEvent,
  type EntitySnapshot,
  type ZoneSnapshot,
  type MatchConfig,
} from '@iso/shared';
import { WsClient } from './net/wsClient.js';
import { LatencySim } from './net/latencySim.js';
import { createScene } from './render/scene.js';
import {
  createIsoCamera,
  resizeIsoCamera,
  moveCameraTarget,
  screenToGround,
  screenToWorldRay,
  cameraGroundBasis,
  applyViewportCap,
} from './render/isoCamera.js';
import { EntityView } from './render/entityView.js';
import { CharacterModel } from './render/characterModel.js';
import { preloadSoldier } from './render/gltfCharacter.js';
import { EffectsSystem } from './render/effects.js';
import { InputSampler } from './input.js';
import { Hud, type ScoreRow } from './render/hud.js';
import { AudioSystem } from './audio/audioSystem.js';
import { SettingsPanel } from './ui/settings.js';
import { showAuthDialog, getSavedName } from './ui/auth.js';
import { showJoinRoom } from './ui/joinRoom.js';
import { showClassSelect, getSavedClass } from './ui/classSelect.js';
import { Crosshair } from './ui/crosshair.js';
import { VisionOverlay } from './ui/vision.js';
import { showRoomSetup } from './ui/room.js';
import { Minimap, type MinimapBlip } from './ui/minimap.js';
import { ThrowablesView } from './render/throwables.js';

let playerName = await showAuthDialog();
let myClassId: ClassId = await showClassSelect();
const urlRoom = new URLSearchParams(location.search).get('room');
let requestedRoom = urlRoom ? urlRoom.toUpperCase() : await showJoinRoom();

await initRapier();
await preloadSoldier();

let gameMap = getMap('compound');
let clientPhysics = new CollisionWorld(gameMap);

const VIEW_SIZE = 16;
const app = document.getElementById('app')!;
const hudEl = document.getElementById('hud')!;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x15171c);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.domElement.style.cursor = 'none';
app.appendChild(renderer.domElement);

const crosshair = new Crosshair(document.body);
const vision = new VisionOverlay(document.body);
const minimap = new Minimap(document.body);
let fogMode = false;
let smokeZones: ZoneSnapshot[] = [];

let isHost = false;
let currentConfig: MatchConfig = defaultMatchConfig();
let roomOpen = false;
let endShown = false;

const roomBtn = document.createElement('button');
roomBtn.textContent = 'ROOM';
Object.assign(roomBtn.style, {
  position: 'fixed', top: '12px', left: '50%', transform: 'translateX(-50%)', zIndex: '210',
  padding: '6px 14px', borderRadius: '8px', border: '1px solid #555', background: 'rgba(24,26,32,0.92)',
  color: '#e6b800', fontSize: '12px', fontFamily: 'monospace', letterSpacing: '2px', cursor: 'pointer', display: 'none',
});
document.body.appendChild(roomBtn);
roomBtn.addEventListener('click', () => openRoom());

const endEl = document.createElement('div');
Object.assign(endEl.style, {
  position: 'fixed', top: '38%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: '190',
  textAlign: 'center', fontFamily: 'monospace', pointerEvents: 'none', display: 'none',
});
document.body.appendChild(endEl);

function openRoom(): void {
  if (roomOpen || !isHost) return;
  roomOpen = true;
  void showRoomSetup(currentConfig, endShown ? 'ROOM SETUP' : 'CREATE ROOM').then((cfg) => {
    roomOpen = false;
    currentConfig = cfg;
    net.send(encode({ t: MSG.ConfigureMatch, config: cfg }));
  });
}

let bundle = createScene(gameMap);
let scene = bundle.scene;
let thrower = new ThrowablesView(scene);
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
let effects = new EffectsSystem(scene);

function rebuildMap(mapId: string): void {
  if (gameMap.id === mapId) return;
  for (const view of views.values()) view.dispose(scene);
  views.clear();
  interp.clear();
  ent.clear();
  entityWasDead.clear();
  entityLastPos.clear();
  entitySpeeds.clear();
  clientPhysics.dispose();
  gameMap = getMap(mapId);
  clientPhysics = new CollisionWorld(gameMap);
  bundle = createScene(gameMap);
  scene = bundle.scene;
  thrower = new ThrowablesView(scene);
  effects = new EffectsSystem(scene);
  bundle.controlGroup.visible = myMode === 'domination';
  bundle.bombGroup.visible = myMode === 'bomb';
  doorMask = 0;
}

const viteEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
const wsPort = new URLSearchParams(location.search).get('port')
  ?? viteEnv?.['VITE_WS_PORT']
  ?? '5175';
const raw = new WsClient(`ws://${location.hostname}:${wsPort}`);
const net = new LatencySim(raw, 0);
net.send(encode({ t: MSG.Join, name: playerName, room: requestedRoom }));

new SettingsPanel(document.body, {
  initialVolume: 0.8,
  initialMusic: 0.5,
  initialLatency: 0,
  initialName: getSavedName(),
  onVolumeChange: (v) => audio.setVolume(v),
  onMusicChange: (v) => audio.setMusicVolume(v),
  onLatencyChange: (ms) => net.setLatency(ms),
  onNameChange: (name) => { playerName = name; net.send(encode({ t: MSG.SetName, name })); },
});

const bootAudio = (): void => { audio.init(); audio.startMusic(); };
document.addEventListener('mousedown', bootAudio, { once: true });
document.addEventListener('keydown', bootAudio, { once: true });

let classPickerOpen = false;
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyC' && !classPickerOpen) {
    classPickerOpen = true;
    void showClassSelect(getSavedClass()).then((cid) => {
      classPickerOpen = false;
      myClassId = cid;
      // takes effect on next spawn — the server decides, speed follows the snapshot
      net.send(encode({ t: MSG.SetClass, classId: cid }));
    });
  }
});

let myNetId = -1;
let myMode: GameMode = 'ffa';
let myTeam = 0;
let myEffectiveClass: ClassId = myClassId;
let currentMoveSpeed = MOVE_SPEED * CLASSES[myClassId].speedMul;
let predicted: PredictedEntity | null = null;
let myLoadout: WeaponPair = [WEAPONS[CLASSES[myClassId].primary], WEAPONS[CLASSES[myClassId].secondary]];
let grenades = { frag: 0, molotov: 0, smoke: 0 };
let localWeapon: WeaponSimState = initialWeaponState(myLoadout);
let localTick = 0;

const views = new Map<number, EntityView>();
const interp = new Map<number, InterpolationBuffer>();
const ent = new Map<number, EntitySnapshot>();
const entityWasDead = new Map<number, boolean>();
const entityLastPos = new Map<number, { x: number; z: number }>();
const entitySpeeds = new Map<number, number>();
let myKills = 0;
let myDeaths = 0;
let myScore = 0;
let teamScores: [number, number] = [0, 0];
let modeState: ModeState = emptyModeState();
let doorMask = 0;
let serverTimeMs = 0;
let seq = 0;

function emptyModeState(): ModeState {
  return {
    gameMode: 'ffa', mapId: '', matchPhase: 'live', winner: '',
    phase: 'live', banner: '', timeLeftTicks: -1, scoreA: 0, scoreB: 0,
    pointOwners: [], pointProgress: [], bombSite: -1, bombProgress: 0,
    wave: 0, enemiesLeft: 0, targetScore: 0, ladder: [],
    bombCarrier: -1, bombDropped: false, bombDropX: 0, bombDropZ: 0,
    chosen: -1, chosenLeftTicks: 0,
  };
}

function loadoutForMe(): WeaponPair {
  if (myMode === 'gungame') {
    // the server shuffles the ladder per match and shares it in ModeState
    const ladder = modeState.ladder.length > 0 ? modeState.ladder.map((i) => weaponFromIndex(i).id) : GUNGAME_LADDER;
    const level = Math.min(myKills, ladder.length - 1);
    return [WEAPONS[ladder[level]!], WEAPONS.pistol];
  }
  const cd = CLASSES[myEffectiveClass];
  return [WEAPONS[cd.primary], WEAPONS[cd.secondary]];
}

function isEnemy(team: number, netId: number): boolean {
  if (netId === myNetId) return false;
  if (FFA_LIKE_MODES.includes(myMode)) return true;
  return team !== myTeam;
}

function entityColor(netId: number, team: number, isBot: boolean): number {
  if (netId === myNetId) return 0xe6b800;
  if (isEnemy(team, netId)) return isBot ? 0xcc5533 : 0xe55555;
  return isBot ? 0x6699cc : 0x4a90d9;
}

function labelColor(netId: number, team: number): string {
  if (netId === myNetId) return '#ffd700';
  return isEnemy(team, netId) ? '#ee8b8b' : '#7fb3ee';
}

function labelFor(netId: number): string {
  const e = ent.get(netId);
  if (e) return e.name;
  return '#' + netId;
}

function escapeText(s: string): string {
  return s.replace(/[<>&"']/g, '');
}

function applyMode(newMode: GameMode): void {
  myMode = newMode;
  fogMode = FOG_MODES.includes(newMode);
  vision.setActive(fogMode);
  bundle.controlGroup.visible = newMode === 'domination';
  bundle.bombGroup.visible = newMode === 'bomb';
  for (const [netId, view] of views) {
    if (netId !== myNetId) view.dispose(scene);
  }
  const myView = views.get(myNetId);
  views.clear();
  if (myView) views.set(myNetId, myView);
  interp.clear();
  ent.clear();
  entityWasDead.clear();
  entityLastPos.clear();
  entitySpeeds.clear();
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

  if (msg.t === MSG.Ping) {
    net.send(encode({ t: MSG.Pong, ts: msg.ts }));
    return;
  }

  if (msg.t === MSG.RoomError) {
    window.alert(msg.reason + ' — creating a new room instead.');
    requestedRoom = '';
    net.send(encode({ t: MSG.Join, name: playerName, room: '' }));
    return;
  }

  if (msg.t === MSG.Welcome) {
    myNetId = msg.netId;
    myMode = msg.mode;
    myTeam = msg.team;
    isHost = msg.isHost;
    currentConfig = msg.config;
    roomBtn.textContent = 'ROOM ' + msg.roomCode + (isHost ? ' ⚙' : '');
    roomBtn.style.display = 'block';
    roomBtn.style.cursor = isHost ? 'pointer' : 'default';
    const url = new URL(location.href);
    url.searchParams.set('room', msg.roomCode);
    history.replaceState(null, '', url);
    bundle.controlGroup.visible = myMode === 'domination';
    bundle.bombGroup.visible = myMode === 'bomb';
    fogMode = FOG_MODES.includes(myMode);
    vision.setActive(fogMode);
    if (msg.mapId !== gameMap.id) rebuildMap(msg.mapId);
    clientPhysics.addCharacter(myNetId, 0, 0, 0);
    myLoadout = loadoutForMe();
    localWeapon = initialWeaponState(myLoadout);
    localTick = 0;
    predicted = new PredictedEntity(
      { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, vy: 0 },
      (state: MoveState, cmd: InputCommand) =>
        integrateWithCollision(state, cmd, myNetId, clientPhysics, currentMoveSpeed),
    );
    net.send(encode({ t: MSG.SetName, name: playerName }));
    net.send(encode({ t: MSG.SetClass, classId: myClassId }));
    return;
  }

  if (msg.t === MSG.Snapshot) {
    const tMs = msg.serverTick * FIXED_DT * 1000;
    if (tMs > serverTimeMs) serverTimeMs = tMs;
    teamScores = msg.teamScores;
    modeState = msg.mode;

    if (modeState.mapId && modeState.mapId !== gameMap.id) {
      rebuildMap(modeState.mapId);
      if (myNetId >= 0) clientPhysics.addCharacter(myNetId, 0, 0, 0);
    }
    if (modeState.gameMode !== myMode) applyMode(modeState.gameMode);

    if (modeState.matchPhase === 'ended') {
      if (!endShown) {
        endShown = true;
        endEl.style.display = 'block';
        endEl.innerHTML =
          '<div style="color:#e6b800;font-size:38px;font-weight:bold;letter-spacing:4px;text-shadow:0 2px 10px #000">' + escapeText(modeState.winner) + '</div>' +
          '<div style="color:#ccd;font-size:15px;letter-spacing:2px;margin-top:8px;text-shadow:0 1px 4px #000">' +
          (isHost ? 'opening room setup…' : 'waiting for host to start next match') + '</div>';
        if (isHost) window.setTimeout(() => openRoom(), 2600);
      }
    } else {
      endShown = false;
      endEl.style.display = 'none';
    }

    const prevDoorMask = doorMask;
    doorMask = msg.doors;
    for (let i = 0; i < bundle.doors.length; i++) {
      const open = (doorMask & (1 << i)) !== 0;
      clientPhysics.setDoorOpen(i, open);
      bundle.doors[i]!.target = open ? 1 : 0;
      if (((prevDoorMask >> i) & 1) !== ((doorMask >> i) & 1) && nearLocal(gameMap.doors[i]!.x, gameMap.doors[i]!.z, 14)) {
        audio.playDoor();
      }
    }

    for (const kill of (msg.recentKills as KillEvent[])) {
      hud.pushKill(labelFor(kill.killer), labelFor(kill.victim), kill.headshot, kill.streak);
    }

    grenades = msg.grenades;
    thrower.syncProjectiles(msg.projectiles);
    thrower.syncZones(msg.zones);
    smokeZones = msg.zones.filter((z) => z.type === 3);

    for (const b of msg.blasts) {
      effects.explosion(new THREE.Vector3(b.x, 0.2, b.z));
      if (nearLocal(b.x, b.z, 40)) audio.playExplosion();
    }

    for (const h of msg.hits) {
      const pos = new THREE.Vector3(h.x, 1.0, h.z);
      if (h.crit) effects.critSpark(pos); else effects.hitSpark(pos);
      effects.damageNumber(new THREE.Vector3(h.x, 1.7, h.z), h.dmg, h.crit);
      if (nearLocal(h.x, h.z, 26)) { audio.playHit(); if (h.crit) audio.playBeep(true); }
    }

    const mine = msg.entities.find((e) => e.netId === myNetId);
    if (mine) myTeam = mine.team;

    const seen = new Set<number>();
    for (const e of msg.entities) {
      seen.add(e.netId);
      const prev = ent.get(e.netId);
      const prevHealth = prev ? prev.health : e.health;
      ent.set(e.netId, e);

      const wasDeadPrev = entityWasDead.get(e.netId) ?? false;
      entityWasDead.set(e.netId, e.isDead);

      const view = getOrCreateView(e.netId, e.team, e.isBot);
      view.setLabel(e.name, labelColor(e.netId, e.team));
      view.setColor(entityColor(e.netId, e.team, e.isBot));
      view.setWeapon(e.weaponId);

      if (e.netId === myNetId) {
        myKills = e.kills;
        myDeaths = e.deaths;
        myScore = e.score;
        myTeam = e.team;
        // the server owns my class (pending changes apply on respawn)
        const eff = CLASS_IDS[e.classId] ?? 'assault';
        myEffectiveClass = eff;
        currentMoveSpeed = myMode === 'gungame' ? MOVE_SPEED : MOVE_SPEED * CLASSES[eff].speedMul;
        myLoadout = loadoutForMe();
        const slot = localWeapon.activeSlot;
        if (slot === 0) {
          localWeapon.ammo0 = e.ammo; localWeapon.reserve0 = e.reserveMags;
          localWeapon.ammo1 = e.ammoB; localWeapon.reserve1 = e.reserveB;
        } else {
          localWeapon.ammo1 = e.ammo; localWeapon.reserve1 = e.reserveMags;
          localWeapon.ammo0 = e.ammoB; localWeapon.reserve0 = e.reserveB;
        }
        // Reload reconciliation: if the server is mid-reload and we aren't (or
        // our end tick drifted, e.g. packet loss), adopt the server's remaining
        // time. Tolerance absorbs normal snapshot latency.
        if (e.reloadLeft > 0 && !e.isDead) {
          const expectedEnd = localTick + e.reloadLeft;
          if (localWeapon.reloadEndTick === 0 || Math.abs(localWeapon.reloadEndTick - expectedEnd) > 10) {
            localWeapon.reloadEndTick = expectedEnd;
          }
        }
        predicted?.reconcile({ x: e.x, y: e.y, z: e.z, yaw: e.yaw, pitch: e.pitch, vy: e.vy }, msg.ackSeq);
        view.setState(e.x, e.y, e.z, e.yaw);
        if (!e.isDead && wasDeadPrev) { view.respawn(); }
        else if (e.isDead && !wasDeadPrev) { view.triggerDeath(); audio.playDeath(); }
        else if (!e.isDead && e.health < prevHealth) view.hitFlash();
      } else {
        const respawned = !e.isDead && wasDeadPrev;
        let b = interp.get(e.netId);
        if (!b || respawned) { b = new InterpolationBuffer(); interp.set(e.netId, b); entityLastPos.delete(e.netId); }
        b.push(tMs, { x: e.x, y: e.y, z: e.z, yaw: e.yaw, pitch: e.pitch, vy: e.vy });

        if (respawned) { view.respawn(); view.setState(e.x, e.y, e.z, e.yaw); }
        else if (e.isDead && !wasDeadPrev) view.triggerDeath();
        if (!e.isDead && !wasDeadPrev && e.health < prevHealth) view.hitFlash();

        if (e.reloading && prev && !prev.reloading && !e.isDead) {
          view.triggerReload(weaponFromIndex(e.weaponId).reloadTicks / 30);
          if (nearLocal(e.x, e.z, 22)) audio.playReload();
        }

        if (e.shotFired && !e.isDead) {
          view.triggerShoot();
          const def = weaponFromIndex(e.weaponId);
          if (def.melee) {
            if (nearLocal(e.x, e.z, 20)) audio.playMelee();
          } else {
            const mPos = CharacterModel.muzzleWorldPos(e.x, e.z, e.yaw);
            mPos.y += e.y;
            effects.muzzleFlash(mPos);
            drawShots(mPos, e.x, e.y, e.z, e.yaw, e.pitch, def, e.netId, def.spread);
            effects.shell(new THREE.Vector3(e.x, e.y + 1.05, e.z), e.yaw);
            if (nearLocal(e.x, e.z, 34)) audio.playShot(def.id);
          }
        }

        if (!fogMode && !e.isDead && !view.isDead) view.setVisible(true);
      }
    }

    for (const [netId, view] of views) {
      if (!seen.has(netId)) {
        view.dispose(scene);
        views.delete(netId);
        interp.delete(netId);
        ent.delete(netId);
        entityWasDead.delete(netId);
        entityLastPos.delete(netId);
        entitySpeeds.delete(netId);
      }
    }
  }
});

function nearestBodyHit(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, range: number, shooterNetId: number): number {
  let best = Infinity;
  const shooter = ent.get(shooterNetId);
  for (const [nid, e] of ent) {
    if (nid === shooterNetId || e.isDead) continue;
    // mirror the server: with friendly fire off, shots pass through teammates
    if (shooter && !currentConfig.friendlyFire && !isTeamlessMode() && e.team === shooter.team) continue;
    const vp = views.get(nid)?.mesh.position;
    const px = vp ? vp.x : e.x;
    const py = vp ? vp.y : e.y;
    const pz = vp ? vp.z : e.z;
    const t = rayCapsuleDistance(ox, oy, oz, dx, dy, dz, px, py, pz);
    if (t !== null && t < best) best = t;
  }
  return Math.min(best, range);
}

function isTeamlessMode(): boolean {
  return FFA_LIKE_MODES.includes(myMode) || myMode === 'practice';
}

function shootTracer(from: THREE.Vector3, x: number, y: number, z: number, yaw: number, pitch: number, range: number, shooterNetId: number): void {
  const cosPitch = Math.cos(pitch);
  const dirX = Math.sin(yaw) * cosPitch;
  const dirY = Math.sin(pitch);
  const dirZ = Math.cos(yaw) * cosPitch;
  const oy = y + MUZZLE_HEIGHT;
  const wallDist = clientPhysics.raycastDistance(x, oy, z, dirX, dirY, dirZ, range, shooterNetId);
  const bodyDist = nearestBodyHit(x, oy, z, dirX, dirY, dirZ, range, shooterNetId);
  const dist = Math.min(wallDist, bodyDist);
  const end = new THREE.Vector3(x + dirX * dist, oy + dirY * dist, z + dirZ * dist);
  effects.bulletTracer(from, end);
  if (dist < range - 0.2 && wallDist <= bodyDist) effects.wallSpark(end);
}

function drawShots(from: THREE.Vector3, x: number, y: number, z: number, yaw: number, pitch: number, def: { range: number; pellets: number; spread: number }, shooterNetId: number, bloomSpread: number): void {
  const pellets = Math.max(1, def.pellets);
  if (pellets > 1) {
    for (let i = 0; i < pellets; i++) {
      shootTracer(from, x, y, z, yaw + (Math.random() - 0.5) * def.spread * 2, pitch, def.range, shooterNetId);
    }
  } else {
    shootTracer(from, x, y, z, yaw + (Math.random() - 0.5) * bloomSpread * 2, pitch, def.range, shooterNetId);
  }
}

function smokeBlocksClient(x0: number, z0: number, x1: number, z1: number): boolean {
  for (const z of smokeZones) {
    const dx = x1 - x0, dz = z1 - z0;
    const len2 = dx * dx + dz * dz || 1;
    let t = ((z.x - x0) * dx + (z.z - z0) * dz) / len2;
    t = Math.max(0, Math.min(1, t));
    const px = x0 + dx * t, pz = z0 + dz * t;
    if (Math.hypot(z.x - px, z.z - pz) < z.radius * 0.85) return true;
  }
  return false;
}

function enemyVisible(ex: number, ez: number): boolean {
  if (!predicted) return true;
  const mx = predicted.state.x, mz = predicted.state.z;
  const dx = ex - mx, dz = ez - mz;
  const dist = Math.hypot(dx, dz);
  if (dist > VISION_RADIUS) return false;
  if (smokeBlocksClient(mx, mz, ex, ez)) return false;
  if (dist < 0.01) return true;
  const clear = clientPhysics.raycastDistance(mx, PLAYER_HEIGHT * 0.5, mz, dx / dist, 0, dz / dist, dist, myNetId);
  return clear >= dist - 0.6;
}

function applyFogVisibility(): void {
  for (const [netId, e] of ent) {
    if (netId === myNetId) continue;
    const view = views.get(netId);
    if (!view || view.isDead) continue;
    const isAlly = !isEnemy(e.team, netId);
    view.setVisible(isAlly || enemyVisible(e.x, e.z));
  }
}

function nearLocal(x: number, z: number, radius: number): boolean {
  if (!predicted) return false;
  const dx = x - predicted.state.x;
  const dz = z - predicted.state.z;
  return dx * dx + dz * dz < radius * radius;
}

function interactHint(): string {
  if (!predicted) return '';
  if (myMode === 'bomb') {
    if (myTeam === 1 && modeState.phase === 'live') {
      if (modeState.bombCarrier === myNetId) {
        for (const s of gameMap.bombSites) {
          if (nearZone(s.x, s.z, s.radius)) return 'Hold E to PLANT at ' + s.label;
        }
      } else if (modeState.bombDropped && nearZone(modeState.bombDropX, modeState.bombDropZ, 4)) {
        return 'Walk over the bomb to pick it up';
      }
    }
    if (myTeam === 2 && modeState.phase === 'planted' && modeState.bombSite >= 0) {
      const s = gameMap.bombSites[modeState.bombSite];
      if (s && nearZone(s.x, s.z, s.radius)) return 'Hold E to DEFUSE';
    }
  }
  return '';
}

function nearZone(x: number, z: number, radius: number): boolean {
  if (!predicted) return false;
  const dx = x - predicted.state.x;
  const dz = z - predicted.state.z;
  return dx * dx + dz * dz <= radius * radius;
}

let last = performance.now();
let inputAcc = 0;
let bombBeepAcc = 0;
let spotTimer = 0;
const spotted = new Set<number>();

// CS-style radar: an enemy shows on the minimap only while my team has eyes
// on them (LOS from me or any living ally within spotting range)
function recomputeSpotted(): void {
  spotted.clear();
  const allies: { x: number; z: number }[] = [];
  for (const [nid, e] of ent) {
    if (e.isDead || isEnemy(e.team, nid)) continue;
    allies.push(nid === myNetId && predicted ? { x: predicted.state.x, z: predicted.state.z } : { x: e.x, z: e.z });
  }
  for (const [nid, e] of ent) {
    if (!isEnemy(e.team, nid) || e.isDead) continue;
    for (const a of allies) {
      const dx = e.x - a.x, dz = e.z - a.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 26) continue;
      if (smokeBlocksClient(a.x, a.z, e.x, e.z)) continue;
      if (dist < 0.01) { spotted.add(nid); break; }
      const clear = clientPhysics.raycastDistance(a.x, PLAYER_HEIGHT * 0.5, a.z, dx / dist, 0, dz / dist, dist, myNetId);
      if (clear >= dist - 0.6) { spotted.add(nid); break; }
    }
  }
}
let prevPredX = 0;
let prevPredZ = 0;
let recoilKickX = 0;
let recoilKickZ = 0;
let camFollowY = 0;
const CAM_Y_GAIN = 0.55;
const CAM_Y_SMOOTH_RATE = 6;

function isTeamMode(): boolean {
  return myMode === 'tdm' || myMode === 'domination' || myMode === 'bomb';
}

function frame(now: number): void {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  serverTimeMs += dt * 1000;

  if (input.consumeTeamSwitch() && isTeamMode() && (myTeam === 1 || myTeam === 2)) {
    net.send(encode({ t: MSG.SetTeam, team: myTeam === 1 ? 2 : 1 }));
  }
  inputAcc += dt;

  if (predicted) {
    prevPredX = predicted.state.x;
    prevPredZ = predicted.state.z;

    while (inputAcc >= FIXED_DT) {
      inputAcc -= FIXED_DT;
      localTick++;

      // Predict door state locally: the server opens doors by proximity, but the
      // snapshot mask arrives a round-trip late — without this the predicted body
      // slams into a door that is already open on the server.
      for (let i = 0; i < gameMap.doors.length; i++) {
        const d = gameMap.doors[i]!;
        const ddx = predicted.state.x - d.x;
        const ddz = predicted.state.z - d.z;
        const near = ddx * ddx + ddz * ddz < DOOR_OPEN_RADIUS * DOOR_OPEN_RADIUS;
        clientPhysics.setDoorOpen(i, near || (doorMask & (1 << i)) !== 0);
      }

      const iAmDead = ent.get(myNetId)?.isDead ?? false;
      const { forward, strafe } = input.axis();
      const basis = cameraGroundBasis(camera);
      const wx = iAmDead ? 0 : basis.forward.x * forward + basis.right.x * strafe;
      const wz = iAmDead ? 0 : basis.forward.z * forward + basis.right.z * strafe;

      const muzzleX = predicted.state.x;
      const muzzleY = predicted.state.y + MUZZLE_HEIGHT;
      const muzzleZ = predicted.state.z;
      let yaw = predicted.state.yaw;
      let pitch = 0;

      // Crosshair sets direction only: shots fly flat at muzzle height for the
      // weapon's full range. Hovering the cursor over an enemy aims at that
      // body point instead, so vertical precision (head/leg) stays possible.
      const aimRay = screenToWorldRay(camera, input.mouseX, input.mouseY, window.innerWidth, window.innerHeight);
      let hoverT: number | null = null;
      for (const [nid, e] of ent) {
        if (nid === myNetId || e.isDead || !isEnemy(e.team, nid)) continue;
        const vp = views.get(nid)?.mesh.position;
        const px = vp ? vp.x : e.x;
        const py = vp ? vp.y : e.y;
        const pz = vp ? vp.z : e.z;
        const t = rayCapsuleDistance(
          aimRay.origin.x, aimRay.origin.y, aimRay.origin.z,
          aimRay.dir.x, aimRay.dir.y, aimRay.dir.z,
          px, py, pz,
        );
        if (t !== null && (hoverT === null || t < hoverT)) hoverT = t;
      }

      let aimPoint: THREE.Vector3 | null = null;
      if (hoverT !== null) {
        const blocked = clientPhysics.raycastDistance(
          aimRay.origin.x, aimRay.origin.y, aimRay.origin.z,
          aimRay.dir.x, aimRay.dir.y, aimRay.dir.z,
          hoverT, myNetId,
        );
        if (blocked >= hoverT - 0.05) {
          aimPoint = aimRay.origin.clone().addScaledVector(aimRay.dir, hoverT);
        }
      }
      if (aimPoint) {
        const adx = aimPoint.x - muzzleX;
        const ady = aimPoint.y - muzzleY;
        const adz = aimPoint.z - muzzleZ;
        const horiz = Math.hypot(adx, adz);
        if (horiz > 0.3) {
          yaw = Math.atan2(adx, adz);
          pitch = clampPitch(Math.atan2(ady, horiz));
        }
      } else {
        const g = screenToGround(camera, input.mouseX, input.mouseY, window.innerWidth, window.innerHeight, muzzleY);
        if (g) {
          const adx = g.x - muzzleX;
          const adz = g.z - muzzleZ;
          if (Math.hypot(adx, adz) > 0.3) yaw = Math.atan2(adx, adz);
        }
      }

      const fireNow = iAmDead ? false : input.fire;
      const reloadNow = iAmDead ? false : input.consumeReload();
      const switchTo = iAmDead ? -1 : input.consumeSwitch(localWeapon.activeSlot);
      const interactNow = iAmDead ? false : input.interact;
      const throwType = iAmDead ? 0 : input.consumeThrow();
      let throwX = 0, throwZ = 0;
      if (throwType !== 0) {
        const g = screenToGround(camera, input.mouseX, input.mouseY, window.innerWidth, window.innerHeight, 0);
        if (g) { throwX = g.x; throwZ = g.z; }
        audio.init();
        audio.playThrow();
        views.get(myNetId)?.triggerShoot();
      }
      const prevWeapon = localWeapon;
      const { next, didFire, firedWith, spread } = tickWeapon(localWeapon, { fire: fireNow, reload: reloadNow, switchTo }, localTick, myLoadout);
      localWeapon = next;

      if (next.activeSlot !== prevWeapon.activeSlot) {
        audio.init(); audio.playSwitch();
        views.get(myNetId)?.setWeapon(weaponIdToIndex(myLoadout[next.activeSlot]!.id));
      }

      if (didFire && firedWith) {
        audio.init();
        views.get(myNetId)?.triggerShoot();
        if (firedWith.melee) {
          audio.playMelee();
        } else {
          audio.playShot(firedWith.id);
          const mPos = CharacterModel.muzzleWorldPos(predicted.state.x, predicted.state.z, yaw);
          mPos.y += predicted.state.y;
          effects.muzzleFlash(mPos);
          drawShots(mPos, predicted.state.x, predicted.state.y, predicted.state.z, yaw, pitch, firedWith, myNetId, spread);
          effects.shell(new THREE.Vector3(predicted.state.x, predicted.state.y + 1.05, predicted.state.z), yaw);
          recoilKickX -= Math.sin(yaw) * firedWith.recoil * 0.85;
          recoilKickZ -= Math.cos(yaw) * firedWith.recoil * 0.85;
        }
      }

      if (next.reloadEndTick !== 0 && prevWeapon.reloadEndTick === 0) {
        audio.init();
        audio.playReload();
        views.get(myNetId)?.triggerReload(activeDef(next, myLoadout).reloadTicks / 30);
      }

      const jumpNow = iAmDead ? false : input.jump;
      const cmd: InputCommand = { seq: ++seq, moveX: wx, moveZ: wz, aimYaw: yaw, aimPitch: pitch, dt: FIXED_DT, jump: jumpNow, fire: fireNow, reload: reloadNow, switchTo, interact: interactNow, throwType, throwX, throwZ };
      predicted.predict(cmd);
      net.send(encode({ t: MSG.Input, cmd }));
    }

    const s = predicted.state;
    const localSpeed = Math.hypot(s.x - prevPredX, s.z - prevPredZ) / Math.max(dt, 0.001);
    entitySpeeds.set(myNetId, localSpeed);

    views.get(myNetId)?.setState(s.x, s.y, s.z, s.yaw);

    const decay = Math.exp(-dt * 13);
    recoilKickX *= decay;
    recoilKickZ *= decay;

    const cx = Math.max(-ARENA_HALF_X, Math.min(ARENA_HALF_X, s.x));
    const cz = Math.max(-ARENA_HALF_Z, Math.min(ARENA_HALF_Z, s.z));
    camFollowY += (s.y * CAM_Y_GAIN - camFollowY) * (1 - Math.exp(-dt * CAM_Y_SMOOTH_RATE));
    moveCameraTarget(camera, cx + recoilKickX, camFollowY, cz + recoilKickZ);
  }

  const renderTime = serverTimeMs - INTERP_DELAY_MS;
  for (const [netId, buf] of interp) {
    const sp = buf.sample(renderTime);
    if (sp) {
      const lp = entityLastPos.get(netId);
      const speed = lp ? Math.hypot(sp.x - lp.x, sp.z - lp.z) / Math.max(dt, 0.001) : 0;
      entityLastPos.set(netId, { x: sp.x, z: sp.z });
      entitySpeeds.set(netId, speed);
      views.get(netId)?.setState(sp.x, sp.y, sp.z, sp.yaw);
    }
  }

  if (myMode === 'bomb' && modeState.phase === 'planted') {
    // armed-bomb beeper, faster as the fuse runs down
    const frac = modeState.timeLeftTicks > 0 ? modeState.timeLeftTicks / (30 * 38) : 0;
    const interval = 0.28 + frac * 1.1;
    bombBeepAcc += dt;
    if (bombBeepAcc >= interval) {
      bombBeepAcc = 0;
      const s = gameMap.bombSites[modeState.bombSite];
      if (s && nearLocal(s.x, s.z, 34)) audio.playBeep(frac < 0.25);
    }
  }

  effects.update(dt);
  thrower.update(dt);
  for (const d of bundle.doors) d.update(dt);
  updateControlPointColors();
  if (fogMode) applyFogVisibility();

  const nowMs = performance.now();
  for (const [netId, view] of views) {
    view.setChosen(netId === modeState.chosen);
    view.tick(nowMs, dt, entitySpeeds.get(netId) ?? 0);
  }

  const def = activeDef(localWeapon, myLoadout);
  const me = ent.get(myNetId);
  const isReloading = localWeapon.reloadEndTick !== 0 && localTick < localWeapon.reloadEndTick;
  const pendingSuffix = myClassId !== myEffectiveClass ? ' → ' + CLASSES[myClassId].name + ' (next spawn)' : '';
  hud.update({
    health: me ? me.health : CLASSES[myEffectiveClass].maxHealth,
    maxHealth: me ? me.maxHealth : CLASSES[myEffectiveClass].maxHealth,
    ammo: activeAmmo(localWeapon),
    reserveMags: activeReserve(localWeapon),
    isReloading,
    weaponName: def.name,
    melee: def.melee,
    className: (myMode === 'gungame' ? 'Gun Game' : CLASSES[myEffectiveClass].name) + pendingSuffix,
    myNetId,
    myKills, myDeaths, myScore,
    mode: myMode,
    modeState,
    myTeam,
    interactHint: interactHint(),
    dead: me ? me.isDead : false,
    grenades,
  }, nowMs);

  spotTimer += dt;
  if (spotTimer >= 0.15) { spotTimer = 0; recomputeSpotted(); }

  const blips: MinimapBlip[] = [];
  for (const [netId, e] of ent) {
    const isMe = netId === myNetId;
    const enemy = isEnemy(e.team, netId);
    const pos = isMe && predicted ? predicted.state : (views.get(netId)?.mesh.position ?? e);
    blips.push({
      x: pos.x, z: pos.z, isMe, ally: !enemy, dead: e.isDead,
      visible: isMe || !enemy || spotted.has(netId),
    });
  }
  let bombMark: { x: number; z: number } | null = null;
  if (myMode === 'bomb' && myTeam === 1 && modeState.phase === 'live') {
    if (modeState.bombDropped) bombMark = { x: modeState.bombDropX, z: modeState.bombDropZ };
    else if (modeState.bombCarrier >= 0) {
      const ce = ent.get(modeState.bombCarrier);
      if (ce) bombMark = { x: ce.x, z: ce.z };
    }
  }
  minimap.update(gameMap, myMode, modeState, doorMask, blips, bombMark);

  hud.setScoreboard(scoreRows(), input.scoreboardHeld, myMode);
  hud.setDebug(`netId:${myNetId === -1 ? '-' : myNetId} ents:${views.size} pending:${predicted?.pendingCount() ?? 0}`);

  const dead = me ? me.isDead : false;
  const sprd = def.pellets > 1 ? def.spread : localWeapon.heat;
  const gapPx = 4 + sprd * 560;
  crosshair.update(input.mouseX, input.mouseY, gapPx);
  crosshair.setColor(dead ? 'rgba(244,67,54,0.9)' : 'rgba(230,255,250,0.9)');

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

function updateControlPointColors(): void {
  if (!bundle.controlGroup.visible) return;
  for (let i = 0; i < bundle.pointFills.length; i++) {
    const owner = modeState.pointOwners[i] ?? 0;
    const col = owner === 1 ? 0x4a90d9 : owner === 2 ? 0xe05555 : 0x888888;
    (bundle.pointFills[i]!.material as THREE.MeshBasicMaterial).color.setHex(col);
    (bundle.pointRings[i]!.material as THREE.MeshBasicMaterial).color.setHex(col);
  }
}

function scoreRows(): ScoreRow[] {
  const rows: ScoreRow[] = [];
  for (const e of ent.values()) {
    rows.push({
      name: e.name, kills: e.kills, deaths: e.deaths, score: e.score,
      team: e.team, isMe: e.netId === myNetId, isBot: e.isBot,
    });
  }
  return rows;
}

requestAnimationFrame(frame);
