import { addComponent, addEntity, hasComponent, removeComponent, removeEntity } from 'bitecs';
import {
  applyInputToEntity,
  createGameWorld,
  integrateWithCollision,
  ColliderHandle,
  Dead,
  Health,
  Kills,
  Loadout,
  NetId,
  Owner,
  Player,
  Bot,
  Team,
  Transform,
  WeaponState,
  deadQuery,
  transformNetQuery,
  readTransform,
  writeTransform,
  initialWeaponState,
  tickWeapon,
  activeDef,
  activeAmmo,
  activeReserve,
  CLASSES,
  CLASS_IDS,
  WEAPONS,
  GUNGAME_LADDER,
  classIdToIndex,
  weaponIdToIndex,
  weaponFromIndex,
  THROW_FRAG,
  THROW_MOLOTOV,
  THROW_SMOKE,
  THROW_RANGE,
  THROW_COOLDOWN_TICKS,
  GRENADE_TRAVEL_SPEED,
  FRAG_FUSE_TICKS,
  FRAG_RADIUS,
  FRAG_MAX_DAMAGE,
  MOLOTOV_TTL_TICKS,
  MOLOTOV_RADIUS,
  MOLOTOV_DPS,
  SMOKE_TTL_TICKS,
  SMOKE_RADIUS,
  MOVE_SPEED,
  FIXED_DT,
  ARENA_HALF_X,
  PLAYER_RADIUS,
  PLAYER_RESPAWN_TICKS,
  DOOR_OPEN_RADIUS,
  CRIT_RADIUS,
  CRIT_MULTIPLIER,
  GRAZE_RADIUS,
  GRAZE_MULTIPLIER,
  DOMINATION_SCORE_TARGET,
  CAPTURE_TICKS,
  BOMB_PLANT_TICKS,
  BOMB_DEFUSE_TICKS,
  BOMB_FUSE_TICKS,
  BOMB_ROUND_TICKS,
  BOMB_ROUNDS_TO_WIN,
  ROUND_RESET_TICKS,
  SURVIVAL_BASE_ENEMIES,
  SURVIVAL_WAVE_BREAK_TICKS,
  FFA_SCORE_TARGET,
  FOG_MODES,
  VISION_RADIUS,
  defaultMatchConfig,
  defaultWinLimit,
  type ClassId,
  type MatchConfig,
  type CollisionWorld,
  type GameMode,
  type GameWorld,
  type InputCommand,
  type KillEvent,
  type HitEvent,
  type ModeState,
  type EntitySnapshot,
  type WeaponDef,
  type WeaponSimState,
  type WeaponPair,
  type ProjectileSnapshot,
  type ZoneSnapshot,
  type BlastEvent,
} from '@iso/shared';
import { BotController, type Difficulty } from './bots.js';

interface ClientState {
  clientId: number;
  eid: number;
  netId: number;
  name: string;
  classId: ClassId;
  inputQueue: InputCommand[];
  lastProcessedSeq: number;
  frag: number;
  molotov: number;
  smoke: number;
  lastThrowTick: number;
}

interface PendingHitscan {
  shooterNetId: number;
  shooterEid: number;
  aimYaw: number;
  def: WeaponDef;
  spread: number;
}

interface Projectile {
  id: number;
  type: number;
  ownerNetId: number;
  ownerTeam: number;
  x: number;
  z: number;
  sx: number;
  sz: number;
  tx: number;
  tz: number;
  dist: number;
  traveled: number;
  h: number;
  landed: boolean;
  detonateTick: number;
}

interface Zone {
  id: number;
  type: number;
  x: number;
  z: number;
  radius: number;
  ownerNetId: number;
  ownerTeam: number;
  expireTick: number;
}

const ENEMY_NAMES = ['Vex', 'Rook', 'Cinder', 'Halo', 'Drift', 'Onyx', 'Sable', 'Quill', 'Pike', 'Ash', 'Wren', 'Nyx'];

export class GameServer {
  readonly world: GameWorld;
  private _mode: GameMode;
  private config: MatchConfig;
  private matchPhase: 'live' | 'ended' = 'live';
  private hostClientId: number | null = null;
  private winnerName = '';
  private matchStartEntities = 0;
  private clients = new Map<number, ClientState>();
  private botEntities = new Map<number, number>();
  private botClass = new Map<number, ClassId>();
  private netIdToEid = new Map<number, number>();
  private names = new Map<number, string>();
  private nextNetId = 1;
  private physics: CollisionWorld | null = null;
  private botController = new BotController();
  private pendingHitscans: PendingHitscan[] = [];
  private killBuffer: KillEvent[] = [];
  private hitBuffer: HitEvent[] = [];
  private teamScores: [number, number] = [0, 0];
  private firedThisTick = new Set<number>();
  private doorMask = 0;
  private despawnQueue: { eid: number; atTick: number }[] = [];
  private projectiles: Projectile[] = [];
  private zones: Zone[] = [];
  private blasts: BlastEvent[] = [];
  private nextProjId = 1;
  private nextZoneId = 1;

  private capProgress: number[] = [];
  private capOwner: number[] = [];

  private bombPhase: 'live' | 'planted' | 'roundEnd' | 'warmup' = 'warmup';
  private bombPhaseEndTick = 0;
  private bombSiteIndex = -1;
  private bombPlantProgress = 0;
  private bombDefuseProgress = 0;
  private roundsWon: [number, number] = [0, 0];

  private wave = 0;
  private survivalPhase: 'break' | 'fighting' = 'break';
  private survivalBreakEndTick = 0;
  private survivalSpawnedThisWave = 0;

  private banner = '';

  constructor(mode: GameMode = 'ffa') {
    this.world = createGameWorld();
    this._mode = mode;
    this.config = defaultMatchConfig(mode);
  }

  get mode(): GameMode {
    return this._mode;
  }

  isHost(clientId: number): boolean {
    return this.hostClientId === clientId;
  }

  getConfig(): MatchConfig {
    return { ...this.config };
  }

  configureMatch(clientId: number, config: MatchConfig): void {
    if (!this.isHost(clientId)) return;
    this.applyConfig(config);
  }

  applyConfig(config: MatchConfig): void {
    this.config = { ...config };
    this._mode = config.mode;
    this.botController.setDifficulty(config.difficulty);

    this.teamScores = [0, 0];
    this.roundsWon = [0, 0];
    this.wave = 0;
    this.projectiles = [];
    this.zones = [];
    this.blasts = [];
    this.despawnQueue = [];
    this.killBuffer.length = 0;
    this.hitBuffer.length = 0;
    this.banner = '';
    this.winnerName = '';
    this.matchPhase = 'live';

    if (this.physics) {
      this.capProgress = this.physics.map.controlPoints.map(() => 0);
      this.capOwner = this.physics.map.controlPoints.map(() => 0);
    }
    this.bombPhase = 'warmup';
    this.bombPhaseEndTick = this.world.tick + ROUND_RESET_TICKS;
    this.bombSiteIndex = -1;
    this.bombPlantProgress = 0;
    this.bombDefuseProgress = 0;
    this.survivalPhase = 'break';
    this.survivalBreakEndTick = this.world.tick + 30 * 3;
    this.survivalSpawnedThisWave = 0;

    for (const netId of [...this.botEntities.keys()]) this.despawnBot(netId);

    for (const c of this.clients.values()) {
      Team.id[c.eid] = this.teamForNewEntity(false);
      Kills.count[c.eid] = 0;
      Kills.deaths[c.eid] = 0;
      Kills.score[c.eid] = 0;
      this.applyClass(c.eid, c.classId);
      this.respawnEntity(c.eid);
    }

    if (this._mode !== 'survival') {
      for (let i = 0; i < config.bots; i++) this.addBot();
    }

    this.matchStartEntities = [...transformNetQuery(this.world)].length;
  }

  setBotDifficulty(d: Difficulty): void {
    this.botController.setDifficulty(d);
  }

  setPhysics(cw: CollisionWorld): void {
    this.physics = cw;
    this.capProgress = cw.map.controlPoints.map(() => 0);
    this.capOwner = cw.map.controlPoints.map(() => 0);
    if (this.mode === 'bomb') {
      this.bombPhase = 'warmup';
      this.bombPhaseEndTick = ROUND_RESET_TICKS;
    }
    if (this.mode === 'survival') {
      this.survivalPhase = 'break';
      this.survivalBreakEndTick = 30 * 3;
    }
  }

  private get map() {
    return this.physics!.map;
  }

  get mapId(): string {
    return this.physics?.map.id ?? 'compound';
  }

  private countTeam(team: number): number {
    let n = 0;
    for (const eid of transformNetQuery(this.world)) if (Team.id[eid] === team) n++;
    return n;
  }

  private isFfaLike(): boolean {
    return this.mode === 'ffa' || this.mode === 'gungame' || this.mode === 'firefight' || this.mode === 'blackout';
  }

  private isFog(): boolean {
    return FOG_MODES.includes(this.mode);
  }

  private teamForNewEntity(isBot: boolean): number {
    if (this.isFfaLike()) return 0;
    switch (this.mode) {
      case 'practice':
        return isBot ? 2 : 0;
      case 'survival':
        return isBot ? 2 : 1;
      default:
        return this.countTeam(1) <= this.countTeam(2) ? 1 : 2;
    }
  }

  private classDefFor(eid: number) {
    return CLASSES[CLASS_IDS[Loadout.classId[eid]!] ?? 'assault']!;
  }

  private loadoutFor(eid: number): WeaponPair {
    if (this.mode === 'gungame') {
      const level = Math.min(Kills.count[eid]!, GUNGAME_LADDER.length - 1);
      return [WEAPONS[GUNGAME_LADDER[level]!]!, WEAPONS.pistol] as const;
    }
    return [weaponFromIndex(Loadout.w0[eid]!), weaponFromIndex(Loadout.w1[eid]!)] as const;
  }

  private resetWeapon(eid: number): void {
    const ws = initialWeaponState(this.loadoutFor(eid));
    this.writeWeapon(eid, ws);
  }

  private writeWeapon(eid: number, ws: WeaponSimState): void {
    WeaponState.ammo0[eid] = ws.ammo0;
    WeaponState.reserve0[eid] = ws.reserve0;
    WeaponState.ammo1[eid] = ws.ammo1;
    WeaponState.reserve1[eid] = ws.reserve1;
    WeaponState.activeSlot[eid] = ws.activeSlot;
    WeaponState.cooldownTick[eid] = ws.cooldownTick;
    WeaponState.reloadEndTick[eid] = ws.reloadEndTick;
    WeaponState.prevFire[eid] = ws.prevFire;
    WeaponState.heat[eid] = ws.heat;
  }

  private readWeapon(eid: number): WeaponSimState {
    return {
      ammo0: WeaponState.ammo0[eid]!,
      reserve0: WeaponState.reserve0[eid]!,
      ammo1: WeaponState.ammo1[eid]!,
      reserve1: WeaponState.reserve1[eid]!,
      activeSlot: WeaponState.activeSlot[eid]!,
      cooldownTick: WeaponState.cooldownTick[eid]!,
      reloadEndTick: WeaponState.reloadEndTick[eid]!,
      prevFire: WeaponState.prevFire[eid]!,
      heat: WeaponState.heat[eid]!,
    };
  }

  private applyClass(eid: number, classId: ClassId): void {
    Loadout.classId[eid] = classIdToIndex(classId);
    const cd = CLASSES[classId];
    Loadout.speed[eid] = MOVE_SPEED * cd.speedMul;
    Loadout.w0[eid] = weaponIdToIndex(cd.primary);
    Loadout.w1[eid] = weaponIdToIndex(cd.secondary);
    Health.max[eid] = cd.maxHealth;
    Health.current[eid] = cd.maxHealth;
    this.resetWeapon(eid);
  }

  private spawnPoints(team: number): { x: number; z: number }[] {
    if (team === 2) return [
      { x: 26, z: -24 }, { x: 27, z: -8 }, { x: 27, z: 8 }, { x: 26, z: 24 },
      { x: 18, z: -18 }, { x: 20, z: 14 }, { x: 22, z: 0 }, { x: 14, z: 24 },
    ];
    if (team === 1) return [
      { x: -26, z: -24 }, { x: -27, z: -8 }, { x: -27, z: 8 }, { x: -26, z: 24 },
      { x: -18, z: -14 }, { x: -20, z: 18 }, { x: -22, z: 0 }, { x: -14, z: -24 },
    ];
    return [
      { x: -26, z: -24 }, { x: 0, z: -27 }, { x: 26, z: -24 }, { x: -27, z: 0 },
      { x: 27, z: 0 }, { x: -26, z: 24 }, { x: 0, z: 27 }, { x: 26, z: 24 },
      { x: -14, z: 8 }, { x: 14, z: -8 }, { x: 8, z: 24 }, { x: -8, z: -24 },
    ];
  }

  private clearSpawn(x: number, z: number, ignoreEid = -1): { x: number; z: number } {
    if (!this.physics) return { x, z };
    const bound = ARENA_HALF_X - PLAYER_RADIUS - 0.3;
    const sep = PLAYER_RADIUS * 2 + 0.4;
    for (let iter = 0; iter < 14; iter++) {
      let moved = false;
      for (const c of this.map.cover) {
        const mx = c.halfW + PLAYER_RADIUS + 0.35;
        const mz = c.halfD + PLAYER_RADIUS + 0.35;
        const dx = x - c.x, dz = z - c.z;
        if (Math.abs(dx) < mx && Math.abs(dz) < mz) {
          const penX = mx - Math.abs(dx);
          const penZ = mz - Math.abs(dz);
          if (penX < penZ) x += (dx >= 0 ? 1 : -1) * penX;
          else z += (dz >= 0 ? 1 : -1) * penZ;
          moved = true;
        }
      }
      for (const eid of transformNetQuery(this.world)) {
        if (eid === ignoreEid || this.isDead(eid)) continue;
        const dx = x - Transform.x[eid]!, dz = z - Transform.z[eid]!;
        const d = Math.hypot(dx, dz);
        if (d > 0.001 && d < sep) {
          x += (dx / d) * (sep - d);
          z += (dz / d) * (sep - d);
          moved = true;
        } else if (d <= 0.001) {
          const a = Math.random() * Math.PI * 2;
          x += Math.cos(a) * sep; z += Math.sin(a) * sep;
          moved = true;
        }
      }
      x = Math.max(-bound, Math.min(bound, x));
      z = Math.max(-bound, Math.min(bound, z));
      if (!moved) break;
    }
    return { x, z };
  }

  private pickSpawn(team: number, ignoreEid = -1): { x: number; z: number } {
    const pts = this.spawnPoints(team);
    let best = this.clearSpawn(pts[0]!.x, pts[0]!.z, ignoreEid);
    let bestScore = -Infinity;
    for (const p of pts) {
      const clear = this.clearSpawn(p.x, p.z, ignoreEid);
      let nearest = Infinity;
      for (const eid of transformNetQuery(this.world)) {
        if (eid === ignoreEid || this.isDead(eid)) continue;
        const d = Math.hypot(Transform.x[eid]! - clear.x, Transform.z[eid]! - clear.z);
        if (d < nearest) nearest = d;
      }
      const score = nearest + Math.random() * 3;
      if (score > bestScore) { bestScore = score; best = clear; }
    }
    return best;
  }

  private makeEntity(isBot: boolean, classId: ClassId, teamOverride?: number, spawnOverride?: { x: number; z: number }): { eid: number; netId: number; team: number } {
    const eid = addEntity(this.world);
    const netId = this.nextNetId++;
    const team = teamOverride ?? this.teamForNewEntity(isBot);
    const spawn = spawnOverride ?? this.pickSpawn(team);

    addComponent(this.world, Transform, eid);
    addComponent(this.world, NetId, eid);
    addComponent(this.world, Player, eid);
    addComponent(this.world, ColliderHandle, eid);
    addComponent(this.world, Health, eid);
    addComponent(this.world, WeaponState, eid);
    addComponent(this.world, Loadout, eid);
    addComponent(this.world, Team, eid);
    addComponent(this.world, Kills, eid);
    if (isBot) addComponent(this.world, Bot, eid);

    Transform.x[eid] = spawn.x;
    Transform.z[eid] = spawn.z;
    Transform.yaw[eid] = 0;
    NetId.value[eid] = netId;
    Team.id[eid] = team;
    Kills.count[eid] = 0;
    Kills.deaths[eid] = 0;
    Kills.score[eid] = 0;
    this.applyClass(eid, classId);

    if (this.physics) {
      const handle = this.physics.addCharacter(netId, spawn.x, spawn.z);
      ColliderHandle.rapier[eid] = handle;
    }

    this.netIdToEid.set(netId, eid);
    return { eid, netId, team };
  }

  addClient(clientId: number, spawnOverride?: { x: number; z: number }): { netId: number; team: number; classId: ClassId } {
    const classId: ClassId = 'assault';
    const { eid, netId, team } = this.makeEntity(false, classId, undefined, spawnOverride);
    addComponent(this.world, Owner, eid);
    Owner.clientId[eid] = clientId;
    const name = 'Player ' + netId;
    this.names.set(netId, name);
    const g = CLASSES[classId].grenades;
    this.clients.set(clientId, {
      clientId, eid, netId, name, classId, inputQueue: [], lastProcessedSeq: 0,
      frag: g.frag, molotov: g.molotov, smoke: g.smoke, lastThrowTick: -999,
    });
    if (this.hostClientId === null) this.hostClientId = clientId;
    return { netId, team, classId };
  }

  setClientClass(clientId: number, classId: ClassId): void {
    const c = this.clients.get(clientId);
    if (!c) return;
    if (!CLASS_IDS.includes(classId)) return;
    c.classId = classId;
    if (this.mode === 'gungame') return;
    this.applyClass(c.eid, classId);
    if (!this.isDead(c.eid)) this.respawnEntity(c.eid);
  }

  isTeamMode(): boolean {
    return this.mode === 'tdm' || this.mode === 'domination' || this.mode === 'bomb';
  }

  setClientTeam(clientId: number, team: number): void {
    const c = this.clients.get(clientId);
    if (!c || !this.isTeamMode() || (team !== 1 && team !== 2)) return;
    if (Team.id[c.eid] === team) return;
    Team.id[c.eid] = team;
    this.respawnEntity(c.eid);
  }

  setClientName(clientId: number, name: string): void {
    const c = this.clients.get(clientId);
    if (!c) return;
    const clean = name.replace(/[<>&"']/g, '').trim().slice(0, 16) || ('Player ' + c.netId);
    c.name = clean;
    this.names.set(c.netId, clean);
  }

  addBot(classId?: ClassId): void {
    const cid = classId ?? CLASS_IDS[Math.floor(Math.random() * CLASS_IDS.length)]!;
    const { netId } = this.makeEntity(true, cid);
    const eid = this.netIdToEid.get(netId)!;
    this.botEntities.set(netId, eid);
    this.botClass.set(netId, cid);
    this.names.set(netId, ENEMY_NAMES[netId % ENEMY_NAMES.length]! + '#' + netId);
    this.botController.register(netId);
  }

  removeClient(clientId: number): void {
    const c = this.clients.get(clientId);
    if (!c) return;
    this.physics?.removeCharacter(c.netId);
    this.netIdToEid.delete(c.netId);
    this.names.delete(c.netId);
    removeEntity(this.world, c.eid);
    this.clients.delete(clientId);
    if (this.hostClientId === clientId) {
      const next = this.clients.keys().next();
      this.hostClientId = next.done ? null : next.value;
    }
  }

  private despawnBot(netId: number): void {
    const eid = this.botEntities.get(netId);
    if (eid === undefined) return;
    this.physics?.removeCharacter(netId);
    this.netIdToEid.delete(netId);
    this.names.delete(netId);
    this.botEntities.delete(netId);
    this.botClass.delete(netId);
    this.botController.unregister(netId);
    removeEntity(this.world, eid);
  }

  enqueueInput(clientId: number, cmd: InputCommand): void {
    const c = this.clients.get(clientId);
    if (!c) return;
    if (cmd.seq <= c.lastProcessedSeq) return;
    c.inputQueue.push(cmd);
  }

  private isDead(eid: number): boolean {
    return hasComponent(this.world, Dead, eid);
  }

  private speedOf(eid: number): number {
    return Loadout.speed[eid] || MOVE_SPEED;
  }

  private applyMovement(eid: number, netId: number, cmd: InputCommand): void {
    if (this.physics) {
      writeTransform(eid, integrateWithCollision(readTransform(eid), cmd, netId, this.physics, this.speedOf(eid)));
    } else {
      applyInputToEntity(this.world, eid, cmd);
    }
  }

  private weaponTick(eid: number, fire: boolean, reload: boolean, switchTo: number, tick: number): void {
    const loadout = this.loadoutFor(eid);
    const cur = this.readWeapon(eid);
    const { next, didFire, firedWith, spread } = tickWeapon(cur, { fire, reload, switchTo }, tick, loadout);
    this.writeWeapon(eid, next);
    if (didFire && firedWith) {
      const nid = NetId.value[eid]!;
      this.pendingHitscans.push({ shooterNetId: nid, shooterEid: eid, aimYaw: Transform.yaw[eid]!, def: firedWith, spread });
      this.firedThisTick.add(nid);
    }
  }

  private blocks(shooterTeam: number, targetTeam: number): boolean {
    if (this.isFfaLike() || this.mode === 'practice') return false;
    if (this.config.friendlyFire) return false;
    return shooterTeam === targetTeam;
  }

  private resolveHitscan(h: PendingHitscan): void {
    if (!this.physics) return;
    const ox = Transform.x[h.shooterEid]!;
    const oz = Transform.z[h.shooterEid]!;
    const shooterTeam = Team.id[h.shooterEid]!;
    const def = h.def;
    const pellets = Math.max(1, def.pellets);

    for (let p = 0; p < pellets; p++) {
      const pelletSpread = pellets > 1 ? def.spread + h.spread : h.spread;
      const ang = h.aimYaw + (Math.random() - 0.5) * pelletSpread * 2;
      const dirX = Math.sin(ang);
      const dirZ = Math.cos(ang);
      const result = this.physics.castRayForHit(h.shooterNetId, ox, oz, dirX, dirZ, def.range);
      if (!result || result.hitNetId === null) continue;

      const targetEid = this.netIdToEid.get(result.hitNetId);
      if (targetEid === undefined || this.isDead(targetEid)) continue;
      if (this.blocks(shooterTeam, Team.id[targetEid]!)) continue;

      const tx = Transform.x[targetEid]!;
      const tz = Transform.z[targetEid]!;
      const rx = tx - ox, rz = tz - oz;
      const proj = rx * dirX + rz * dirZ;
      const perp = Math.hypot(rx - proj * dirX, rz - proj * dirZ);
      const crit = perp < CRIT_RADIUS;
      const mult = crit ? CRIT_MULTIPLIER : perp > GRAZE_RADIUS ? GRAZE_MULTIPLIER : 1;

      const hx = ox + dirX * result.distance;
      const hz = oz + dirZ * result.distance;
      const fullTo = def.range * 0.4;
      let fo = 1;
      if (result.distance > fullTo && def.range > fullTo) {
        const t = Math.min(1, (result.distance - fullTo) / (def.range - fullTo));
        fo = 1 - t * (1 - def.falloff);
      }
      const dmg = Math.max(1, Math.round(def.damage * mult * fo));
      const fatal = this.damageEntity(targetEid, dmg, h.shooterNetId, crit);
      if (this.hitBuffer.length < 40) this.hitBuffer.push({ x: hx, z: hz, fatal, crit, dmg });
    }
  }

  private damageEntity(targetEid: number, dmg: number, shooterNetId: number, crit: boolean): boolean {
    const prev = Health.current[targetEid]!;
    if (prev <= 0) return false;
    const next = Math.max(0, prev - dmg);
    Health.current[targetEid] = next;
    if (next === 0) {
      this.killEntity(targetEid, NetId.value[targetEid]!, shooterNetId, crit);
      return true;
    }
    return false;
  }

  private killEntity(eid: number, netId: number, killerNetId: number, headshot = false): void {
    Kills.deaths[eid] = (Kills.deaths[eid]! + 1);
    addComponent(this.world, Dead, eid);
    Dead.respawnTick[eid] = this.world.tick + this.respawnTicksFor(eid);

    const isEnemyWave = this.mode === 'survival' && Team.id[eid] === 2 && hasComponent(this.world, Bot, eid);
    if (isEnemyWave) {
      this.despawnQueue.push({ eid, atTick: this.world.tick + 12 });
    }

    if (killerNetId !== netId) {
      const killerEid = this.netIdToEid.get(killerNetId);
      if (killerEid !== undefined) {
        Kills.count[killerEid] = (Kills.count[killerEid]! + 1);
        Kills.score[killerEid] = (Kills.score[killerEid]! + 1);
        const kt = Team.id[killerEid]!;
        if (kt === 1) this.teamScores[0]++;
        else if (kt === 2) this.teamScores[1]++;
        if (this.mode === 'gungame') this.applyClass(killerEid, this.classDefFor(killerEid).id);
      }
    }

    this.killBuffer.push({ killer: killerNetId, victim: netId, headshot });
  }

  private respawnTicksFor(eid: number): number {
    if (this.mode === 'survival' && Team.id[eid] === 2) return 999999;
    if (this.mode === 'practice') return 60;
    if (!this.config.respawn) return 999999;
    if (this.mode === 'bomb') return 999999;
    return PLAYER_RESPAWN_TICKS;
  }

  private clientByEid(eid: number): ClientState | undefined {
    for (const c of this.clients.values()) if (c.eid === eid) return c;
    return undefined;
  }

  private respawnEntity(eid: number): void {
    const team = Team.id[eid]!;
    const spawn = this.pickSpawn(team, eid);
    const c = this.clientByEid(eid);
    if (c) { const g = this.classDefFor(eid).grenades; c.frag = g.frag; c.molotov = g.molotov; c.smoke = g.smoke; }
    if (this.isDead(eid)) removeComponent(this.world, Dead, eid);
    Transform.x[eid] = spawn.x;
    Transform.z[eid] = spawn.z;
    Health.current[eid] = Health.max[eid]!;
    this.resetWeapon(eid);
    if (this.physics) {
      const netId = NetId.value[eid]!;
      this.physics.removeCharacter(netId);
      const handle = this.physics.addCharacter(netId, spawn.x, spawn.z);
      ColliderHandle.rapier[eid] = handle;
    }
  }

  private processRespawns(tick: number): void {
    for (const eid of [...deadQuery(this.world)]) {
      if (Dead.respawnTick[eid]! > tick) continue;
      this.respawnEntity(eid);
    }
  }

  private processDespawns(tick: number): void {
    if (this.despawnQueue.length === 0) return;
    const ready = this.despawnQueue.filter((d) => d.atTick <= tick);
    this.despawnQueue = this.despawnQueue.filter((d) => d.atTick > tick);
    for (const d of ready) {
      const netId = NetId.value[d.eid];
      if (netId !== undefined && this.botEntities.has(netId)) this.despawnBot(netId);
    }
  }

  private updateDoors(): void {
    if (!this.physics) return;
    const doors = this.map.doors;
    let mask = 0;
    for (let i = 0; i < doors.length; i++) {
      const d = doors[i]!;
      let open = false;
      for (const eid of transformNetQuery(this.world)) {
        if (this.isDead(eid)) continue;
        const dx = Transform.x[eid]! - d.x;
        const dz = Transform.z[eid]! - d.z;
        if (dx * dx + dz * dz < DOOR_OPEN_RADIUS * DOOR_OPEN_RADIUS) { open = true; break; }
      }
      this.physics.setDoorOpen(i, open);
      if (open) mask |= (1 << i);
    }
    this.doorMask = mask;
  }

  private alivePlayersOnTeam(team: number): number {
    let n = 0;
    for (const eid of transformNetQuery(this.world)) {
      if (Team.id[eid] === team && !this.isDead(eid)) n++;
    }
    return n;
  }

  private enemiesAlive(): number {
    let n = 0;
    for (const [, eid] of this.botEntities) if (Team.id[eid] === 2 && !this.isDead(eid)) n++;
    return n;
  }

  private updateDomination(): void {
    const pts = this.map.controlPoints;
    for (let i = 0; i < pts.length; i++) {
      const pt = pts[i]!;
      let t1 = 0, t2 = 0;
      for (const eid of transformNetQuery(this.world)) {
        if (this.isDead(eid)) continue;
        const dx = Transform.x[eid]! - pt.x;
        const dz = Transform.z[eid]! - pt.z;
        if (dx * dx + dz * dz <= pt.radius * pt.radius) {
          if (Team.id[eid] === 1) t1++; else if (Team.id[eid] === 2) t2++;
        }
      }
      const owner = this.capOwner[i] ?? 0;
      let prog = this.capProgress[i] ?? 0;
      const net = (t1 > t2 ? 1 : t2 > t1 ? -1 : 0);
      if (net !== 0) {
        prog += net / CAPTURE_TICKS;
        prog = Math.max(-1, Math.min(1, prog));
        if (prog >= 1 && owner !== 1) this.capOwner[i] = 1;
        if (prog <= -1 && owner !== 2) this.capOwner[i] = 2;
      }
      this.capProgress[i] = prog;
    }
    let a = 0, b = 0;
    for (const o of this.capOwner) { if (o === 1) a++; else if (o === 2) b++; }
    this.teamScores[0] += a;
    this.teamScores[1] += b;
  }

  private reviveAll(): void {
    for (const eid of [...transformNetQuery(this.world)]) this.respawnEntity(eid);
  }

  private updateBomb(tick: number): void {
    if (this.bombPhase === 'warmup') {
      if (tick >= this.bombPhaseEndTick) { this.startBombRound(tick); }
      return;
    }
    if (this.bombPhase === 'roundEnd') {
      if (tick >= this.bombPhaseEndTick) this.startBombRound(tick);
      return;
    }

    const sites = this.map.bombSites;
    if (this.bombPhase === 'live') {
      let plantingHere = -1;
      for (let i = 0; i < sites.length; i++) {
        const s = sites[i]!;
        for (const [, eid] of this.attackers()) {
          if (this.isDead(eid)) continue;
          const dx = Transform.x[eid]! - s.x, dz = Transform.z[eid]! - s.z;
          if (dx * dx + dz * dz <= s.radius * s.radius && this.interacting.has(NetId.value[eid]!)) { plantingHere = i; break; }
        }
        if (plantingHere >= 0) break;
      }
      if (plantingHere >= 0) {
        this.bombPlantProgress += 1;
        if (this.bombPlantProgress >= BOMB_PLANT_TICKS) {
          this.bombPhase = 'planted';
          this.bombSiteIndex = plantingHere;
          this.bombPhaseEndTick = tick + BOMB_FUSE_TICKS;
          this.bombDefuseProgress = 0;
        }
      } else {
        this.bombPlantProgress = Math.max(0, this.bombPlantProgress - 1);
      }

      if (this.alivePlayersOnTeam(1) === 0 && this.aliveAttackerBots() === 0) { this.endBombRound(tick, 2); return; }
      if (this.alivePlayersOnTeam(2) === 0 && this.aliveDefenderBots() === 0) { this.endBombRound(tick, 1); return; }
      if (tick >= this.bombPhaseEndTick) this.endBombRound(tick, 2);
      return;
    }

    if (this.bombPhase === 'planted') {
      const s = sites[this.bombSiteIndex]!;
      let defusing = false;
      for (const eid of transformNetQuery(this.world)) {
        if (Team.id[eid] !== 2 || this.isDead(eid)) continue;
        const dx = Transform.x[eid]! - s.x, dz = Transform.z[eid]! - s.z;
        if (dx * dx + dz * dz <= s.radius * s.radius && this.interacting.has(NetId.value[eid]!)) { defusing = true; break; }
      }
      if (defusing) {
        this.bombDefuseProgress += 1;
        if (this.bombDefuseProgress >= BOMB_DEFUSE_TICKS) { this.endBombRound(tick, 2); return; }
      } else {
        this.bombDefuseProgress = Math.max(0, this.bombDefuseProgress - 1);
      }
      if (tick >= this.bombPhaseEndTick) this.endBombRound(tick, 1);
    }
  }

  private bombObjectiveFor(eid: number): { x: number; z: number; r: number } | null {
    const team = Team.id[eid]!;
    const sites = this.map.bombSites;
    if (sites.length === 0) return null;
    if (this.bombPhase === 'live' && team === 1) {
      let best = sites[0]!;
      let bd = Infinity;
      for (const s of sites) {
        const d = Math.hypot(Transform.x[eid]! - s.x, Transform.z[eid]! - s.z);
        if (d < bd) { bd = d; best = s; }
      }
      return { x: best.x, z: best.z, r: best.radius };
    }
    if (this.bombPhase === 'planted' && team === 2 && this.bombSiteIndex >= 0) {
      const s = sites[this.bombSiteIndex]!;
      return { x: s.x, z: s.z, r: s.radius };
    }
    return null;
  }

  private attackers(): Map<number, number> {
    const m = new Map<number, number>();
    for (const eid of transformNetQuery(this.world)) if (Team.id[eid] === 1) m.set(NetId.value[eid]!, eid);
    return m;
  }
  private aliveAttackerBots(): number { return this.aliveTeamBots(1); }
  private aliveDefenderBots(): number { return this.aliveTeamBots(2); }
  private aliveTeamBots(team: number): number {
    let n = 0;
    for (const [, eid] of this.botEntities) if (Team.id[eid] === team && !this.isDead(eid)) n++;
    return n;
  }

  private startBombRound(tick: number): void {
    this.bombPhase = 'live';
    this.bombSiteIndex = -1;
    this.bombPlantProgress = 0;
    this.bombDefuseProgress = 0;
    this.bombPhaseEndTick = tick + BOMB_ROUND_TICKS;
    this.banner = 'ROUND START';
    this.reviveAll();
  }

  private endBombRound(tick: number, winner: number): void {
    if (winner === 1) this.roundsWon[0]++; else this.roundsWon[1]++;
    this.bombPhase = 'roundEnd';
    this.bombPhaseEndTick = tick + ROUND_RESET_TICKS;
    this.banner = (winner === 1 ? 'ATTACKERS' : 'DEFENDERS') + ' WIN ROUND';
  }

  private updateSurvival(tick: number): void {
    if (this.survivalPhase === 'break') {
      if (tick >= this.survivalBreakEndTick) this.startWave();
      return;
    }
    if (this.enemiesAlive() === 0 && this.survivalSpawnedThisWave > 0) {
      this.survivalPhase = 'break';
      this.survivalBreakEndTick = tick + SURVIVAL_WAVE_BREAK_TICKS;
      this.banner = 'WAVE ' + this.wave + ' CLEARED';
    }
  }

  private startWave(): void {
    this.wave++;
    this.survivalPhase = 'fighting';
    const count = SURVIVAL_BASE_ENEMIES + Math.floor(this.wave * 1.6);
    this.survivalSpawnedThisWave = count;
    for (let i = 0; i < count; i++) this.addBot();
    this.banner = 'WAVE ' + this.wave;
  }

  private interacting = new Set<number>();

  private tryThrow(c: ClientState, tick: number, type: number, tx: number, tz: number): void {
    if (this.isDead(c.eid)) return;
    if (tick - c.lastThrowTick < THROW_COOLDOWN_TICKS) return;
    const count = type === THROW_FRAG ? c.frag : type === THROW_MOLOTOV ? c.molotov : type === THROW_SMOKE ? c.smoke : 0;
    if (count <= 0) return;
    c.lastThrowTick = tick;
    if (type === THROW_FRAG) c.frag--; else if (type === THROW_MOLOTOV) c.molotov--; else c.smoke--;

    const sx = Transform.x[c.eid]!, sz = Transform.z[c.eid]!;
    const dx = tx - sx, dz = tz - sz;
    const d = Math.hypot(dx, dz) || 0.0001;
    const dist = Math.min(THROW_RANGE, d);
    const ux = dx / d, uz = dz / d;
    this.projectiles.push({
      id: this.nextProjId++, type, ownerNetId: c.netId, ownerTeam: Team.id[c.eid]!,
      x: sx, z: sz, sx, sz, tx: sx + ux * dist, tz: sz + uz * dist, dist, traveled: 0, h: 0, landed: false, detonateTick: 0,
    });
  }

  private spawnZone(type: number, x: number, z: number, radius: number, ownerNetId: number, ownerTeam: number, expireTick: number): void {
    this.zones.push({ id: this.nextZoneId++, type, x, z, radius, ownerNetId, ownerTeam, expireTick });
  }

  private applyAoe(x: number, z: number, radius: number, maxDmg: number, ownerNetId: number, ownerTeam: number, falloff: boolean, report: boolean): void {
    for (const eid of [...transformNetQuery(this.world)]) {
      if (this.isDead(eid)) continue;
      const tnet = NetId.value[eid]!;
      const isOwner = tnet === ownerNetId;
      if (!isOwner && this.blocks(ownerTeam, Team.id[eid]!)) continue;
      const ex = Transform.x[eid]!, ez = Transform.z[eid]!;
      const dd = Math.hypot(ex - x, ez - z);
      if (dd > radius) continue;
      const dmg = falloff ? Math.round(maxDmg * (1 - dd / radius)) : maxDmg;
      if (dmg <= 0) continue;
      const fatal = this.damageEntity(eid, dmg, ownerNetId, false);
      if (report && this.hitBuffer.length < 40) this.hitBuffer.push({ x: ex, z: ez, fatal, crit: false, dmg });
    }
  }

  private updateThrowables(tick: number): void {
    const kept: Projectile[] = [];
    for (const p of this.projectiles) {
      if (!p.landed) {
        p.traveled += GRENADE_TRAVEL_SPEED * FIXED_DT;
        const prog = Math.min(1, p.traveled / p.dist);
        p.x = p.sx + (p.tx - p.sx) * prog;
        p.z = p.sz + (p.tz - p.sz) * prog;
        p.h = Math.sin(prog * Math.PI) * Math.min(4, p.dist * 0.18);
        if (prog >= 1) {
          p.landed = true; p.h = 0;
          if (p.type === THROW_FRAG) { p.detonateTick = tick + FRAG_FUSE_TICKS; kept.push(p); }
          else if (p.type === THROW_MOLOTOV) { this.spawnZone(THROW_MOLOTOV, p.x, p.z, MOLOTOV_RADIUS, p.ownerNetId, p.ownerTeam, tick + MOLOTOV_TTL_TICKS); }
          else { this.spawnZone(THROW_SMOKE, p.x, p.z, SMOKE_RADIUS, p.ownerNetId, p.ownerTeam, tick + SMOKE_TTL_TICKS); }
        } else kept.push(p);
      } else if (p.type === THROW_FRAG && tick >= p.detonateTick) {
        this.blasts.push({ type: THROW_FRAG, x: p.x, z: p.z });
        this.applyAoe(p.x, p.z, FRAG_RADIUS, FRAG_MAX_DAMAGE, p.ownerNetId, p.ownerTeam, true, true);
      } else kept.push(p);
    }
    this.projectiles = kept;

    const zkept: Zone[] = [];
    for (const z of this.zones) {
      if (tick >= z.expireTick) continue;
      if (z.type === THROW_MOLOTOV) {
        this.applyAoe(z.x, z.z, z.radius, Math.max(1, Math.round(MOLOTOV_DPS * FIXED_DT)), z.ownerNetId, z.ownerTeam, false, tick % 9 === 0);
      }
      zkept.push(z);
    }
    this.zones = zkept;
  }

  private smokeBlocks(x0: number, z0: number, x1: number, z1: number): boolean {
    for (const z of this.zones) {
      if (z.type !== THROW_SMOKE) continue;
      const dx = x1 - x0, dz = z1 - z0;
      const len2 = dx * dx + dz * dz || 1;
      let t = ((z.x - x0) * dx + (z.z - z0) * dz) / len2;
      t = Math.max(0, Math.min(1, t));
      const px = x0 + dx * t, pz = z0 + dz * t;
      if (Math.hypot(z.x - px, z.z - pz) < z.radius * 0.85) return true;
    }
    return false;
  }

  step(): void {
    const tick = this.world.tick;
    this.firedThisTick.clear();
    this.hitBuffer.length = 0;
    this.interacting.clear();

    this.blasts.length = 0;
    this.processDespawns(tick);
    this.processRespawns(tick);
    this.updateDoors();

    for (const c of this.clients.values()) {
      if (this.isDead(c.eid)) { c.inputQueue.length = 0; continue; }
      c.inputQueue.sort((a, b) => a.seq - b.seq);
      let fire = false, reload = false, interact = false, switchTo = -1;
      let throwType = 0, throwX = 0, throwZ = 0;
      for (const cmd of c.inputQueue) {
        this.applyMovement(c.eid, c.netId, cmd);
        fire = fire || cmd.fire;
        reload = reload || cmd.reload;
        interact = interact || cmd.interact;
        if (cmd.switchTo >= 0) switchTo = cmd.switchTo;
        if (cmd.throwType !== 0) { throwType = cmd.throwType; throwX = cmd.throwX; throwZ = cmd.throwZ; }
        c.lastProcessedSeq = cmd.seq;
      }
      c.inputQueue.length = 0;
      if (interact) this.interacting.add(c.netId);
      this.weaponTick(c.eid, fire, reload, switchTo, tick);
      if (throwType !== 0) this.tryThrow(c, tick, throwType, throwX, throwZ);
    }

    for (const [netId, eid] of this.botEntities) {
      if (this.isDead(eid)) continue;
      const bi = this.botController.generateInput(netId, eid, tick, this);
      let mx = bi.moveX, mz = bi.moveZ, yaw = bi.aimYaw, interact = false;

      if (this.mode === 'bomb' && this.matchPhase === 'live') {
        const obj = this.bombObjectiveFor(eid);
        if (obj) {
          const dx = obj.x - Transform.x[eid]!, dz = obj.z - Transform.z[eid]!;
          const d = Math.hypot(dx, dz) || 0.001;
          if (d > obj.r * 0.55) {
            mx = dx / d; mz = dz / d;
            if (!bi.fire) yaw = Math.atan2(dx, dz);
          } else {
            interact = true;
            if (!bi.fire) { mx = 0; mz = 0; }
          }
        }
      }

      const cmd: InputCommand = {
        seq: 0, moveX: mx, moveZ: mz, aimYaw: yaw, dt: FIXED_DT,
        fire: bi.fire, reload: bi.reload, switchTo: -1, interact, throwType: 0, throwX: 0, throwZ: 0,
      };
      this.applyMovement(eid, netId, cmd);
      Transform.yaw[eid] = yaw;
      if (interact) this.interacting.add(netId);
      this.weaponTick(eid, bi.fire, bi.reload, -1, tick);
    }

    this.physics?.step();

    for (const h of this.pendingHitscans) this.resolveHitscan(h);
    this.pendingHitscans.length = 0;

    this.updateThrowables(tick);

    if (this.matchPhase === 'live') {
      if (this.mode === 'domination') this.updateDomination();
      else if (this.mode === 'bomb') this.updateBomb(tick);
      else if (this.mode === 'survival') this.updateSurvival(tick);
      this.checkWin(tick);
    }

    this.world.tick++;
  }

  private livingPlayers(): number {
    let n = 0;
    for (const c of this.clients.values()) if (!this.isDead(c.eid)) n++;
    return n;
  }

  private eliminationWinner(): string {
    const alive = [...transformNetQuery(this.world)].filter((e) => !this.isDead(e));
    if (this.matchStartEntities <= 1) return '';
    if (this.isFfaLike()) {
      if (alive.length === 1) return this.nameFor(NetId.value[alive[0]!]!);
      if (alive.length === 0) return 'Nobody';
      return '';
    }
    const t1 = alive.filter((e) => Team.id[e] === 1).length;
    const t2 = alive.filter((e) => Team.id[e] === 2).length;
    if (t1 === 0 && t2 > 0) return 'RED TEAM';
    if (t2 === 0 && t1 > 0) return 'BLUE TEAM';
    if (t1 === 0 && t2 === 0) return 'Nobody';
    return '';
  }

  private checkWin(tick: number): void {
    if (this.mode === 'practice') return;
    const limit = this.config.winLimit > 0 ? this.config.winLimit : defaultWinLimit(this.mode);
    let winner = '';

    if (!this.config.respawn && this.mode !== 'bomb' && this.mode !== 'survival') {
      winner = this.eliminationWinner();
    } else if (this.isFfaLike()) {
      let bestEid = -1, best = -1;
      for (const eid of transformNetQuery(this.world)) {
        const k = Kills.count[eid]!;
        if (k > best) { best = k; bestEid = eid; }
      }
      const need = this.mode === 'gungame' ? GUNGAME_LADDER.length : limit;
      if (bestEid >= 0 && best >= need) winner = this.nameFor(NetId.value[bestEid]!);
    } else if (this.mode === 'tdm' || this.mode === 'domination') {
      if (this.teamScores[0] >= limit) winner = 'BLUE TEAM';
      else if (this.teamScores[1] >= limit) winner = 'RED TEAM';
    } else if (this.mode === 'bomb') {
      if (this.roundsWon[0] >= limit) winner = 'ATTACKERS';
      else if (this.roundsWon[1] >= limit) winner = 'DEFENDERS';
    } else if (this.mode === 'survival') {
      if (this.wave > 0 && this.livingPlayers() === 0 && this.clients.size > 0) winner = 'Survived to Wave ' + this.wave;
    }

    if (winner) {
      this.matchPhase = 'ended';
      this.winnerName = winner;
      this.banner = winner.toUpperCase() + (winner.startsWith('Survived') ? '' : ' WINS');
    }
  }

  enemyTargetFor(eid: number): number | null {
    const myTeam = Team.id[eid]!;
    const myX = Transform.x[eid]!, myZ = Transform.z[eid]!;
    let best: number | null = null;
    let bestD = Infinity;
    const freeForAll = this.isFfaLike();
    const fog = this.isFog();
    const visSq = VISION_RADIUS * VISION_RADIUS;
    for (const t of transformNetQuery(this.world)) {
      if (t === eid || this.isDead(t)) continue;
      const tt = Team.id[t]!;
      if (!freeForAll && tt === myTeam) continue;
      const dx = Transform.x[t]! - myX, dz = Transform.z[t]! - myZ;
      const d = dx * dx + dz * dz;
      if (fog && (d > visSq || !this.hasLineOfSight(eid, t))) continue;
      if (d < bestD) { bestD = d; best = t; }
    }
    return best;
  }

  posOf(eid: number): { x: number; z: number } {
    return { x: Transform.x[eid]!, z: Transform.z[eid]! };
  }

  weaponRangeOf(eid: number): number {
    return activeDef(this.readWeapon(eid), this.loadoutFor(eid)).range;
  }

  hasLineOfSight(fromEid: number, toEid: number): boolean {
    if (!this.physics) return true;
    const ox = Transform.x[fromEid]!, oz = Transform.z[fromEid]!;
    const tx = Transform.x[toEid]!, tz = Transform.z[toEid]!;
    const dx = tx - ox, dz = tz - oz;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.001) return true;
    if (this.smokeBlocks(ox, oz, tx, tz)) return false;
    const r = this.physics.castRayForHit(NetId.value[fromEid]!, ox, oz, dx / dist, dz / dist, dist + 0.5);
    if (!r) return true;
    return r.hitNetId === NetId.value[toEid]!;
  }

  ackFor(clientId: number): number {
    return this.clients.get(clientId)?.lastProcessedSeq ?? 0;
  }

  consumeKills(): KillEvent[] {
    const out = this.killBuffer.slice();
    this.killBuffer.length = 0;
    return out;
  }

  consumeHits(): HitEvent[] {
    return this.hitBuffer.slice();
  }

  getProjectiles(): ProjectileSnapshot[] {
    return this.projectiles.map((p) => ({ id: p.id, type: p.type, x: p.x, z: p.z, h: p.h }));
  }

  getZones(): ZoneSnapshot[] {
    return this.zones.map((z) => ({ id: z.id, type: z.type, x: z.x, z: z.z, radius: z.radius }));
  }

  consumeBlasts(): BlastEvent[] {
    return this.blasts.slice();
  }

  grenadesFor(clientId: number): { frag: number; molotov: number; smoke: number } {
    const c = this.clients.get(clientId);
    return c ? { frag: c.frag, molotov: c.molotov, smoke: c.smoke } : { frag: 0, molotov: 0, smoke: 0 };
  }

  getTeamScores(): [number, number] {
    return [this.teamScores[0], this.teamScores[1]];
  }

  getDoorMask(): number {
    return this.doorMask;
  }

  nameFor(netId: number): string {
    return this.names.get(netId) ?? '#' + netId;
  }

  getModeState(): ModeState {
    const base: ModeState = {
      gameMode: this._mode, matchPhase: this.matchPhase, winner: this.winnerName,
      phase: 'live', banner: this.banner, timeLeftTicks: -1,
      scoreA: this.teamScores[0], scoreB: this.teamScores[1],
      pointOwners: this.capOwner.slice(), pointProgress: this.capProgress.slice(),
      bombSite: -1, bombProgress: 0, wave: this.wave, enemiesLeft: 0, targetScore: 0,
    };

    if (this.isFfaLike()) {
      let topKills = 0;
      for (const eid of transformNetQuery(this.world)) topKills = Math.max(topKills, Kills.count[eid]!);
      base.targetScore = this.mode === 'gungame' ? GUNGAME_LADDER.length : FFA_SCORE_TARGET;
      base.scoreA = topKills;
    } else if (this.mode === 'domination') {
      base.targetScore = DOMINATION_SCORE_TARGET;
    } else if (this.mode === 'bomb') {
      base.phase = this.bombPhase;
      base.scoreA = this.roundsWon[0];
      base.scoreB = this.roundsWon[1];
      base.targetScore = BOMB_ROUNDS_TO_WIN;
      base.bombSite = this.bombPhase === 'planted' ? this.bombSiteIndex : -1;
      base.bombProgress = this.bombPhase === 'planted'
        ? this.bombDefuseProgress / BOMB_DEFUSE_TICKS
        : this.bombPlantProgress / BOMB_PLANT_TICKS;
      base.timeLeftTicks = Math.max(0, this.bombPhaseEndTick - this.world.tick);
    } else if (this.mode === 'survival') {
      base.phase = this.survivalPhase;
      base.wave = this.wave;
      base.enemiesLeft = this.enemiesAlive();
      base.timeLeftTicks = this.survivalPhase === 'break' ? Math.max(0, this.survivalBreakEndTick - this.world.tick) : -1;
    }
    return base;
  }

  snapshotEntities(): EntitySnapshot[] {
    const eids = transformNetQuery(this.world);
    const out: EntitySnapshot[] = [];
    for (const eid of eids) {
      const ws = this.readWeapon(eid);
      const loadout = this.loadoutFor(eid);
      const def = activeDef(ws, loadout);
      const netId = NetId.value[eid]!;
      out.push({
        netId,
        x: Transform.x[eid]!,
        z: Transform.z[eid]!,
        yaw: Transform.yaw[eid]!,
        health: Health.current[eid] ?? 0,
        maxHealth: Health.max[eid] ?? 100,
        ammo: activeAmmo(ws),
        reserveMags: activeReserve(ws),
        team: Team.id[eid] ?? 0,
        kills: Kills.count[eid] ?? 0,
        deaths: Kills.deaths[eid] ?? 0,
        score: Kills.score[eid] ?? 0,
        classId: Loadout.classId[eid] ?? 0,
        weaponId: weaponIdToIndex(def.id),
        isDead: this.isDead(eid),
        isBot: hasComponent(this.world, Bot, eid),
        shotFired: this.firedThisTick.has(netId),
        reloading: ws.reloadEndTick !== 0,
        name: this.nameFor(netId),
      });
    }
    return out;
  }
}
