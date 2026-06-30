import { addComponent, addEntity, hasComponent, removeComponent, removeEntity } from 'bitecs';
import {
  applyInputToEntity,
  createGameWorld,
  integrateWithCollision,
  ColliderHandle,
  Dead,
  Health,
  Kills,
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
  FIXED_DT,
  PLAYER_MAX_HEALTH,
  WEAPON_DAMAGE,
  WEAPON_RANGE,
  PLAYER_RESPAWN_TICKS,
  SPAWN_POINTS,
  TEAM_SPAWN_POINTS,
  type CollisionWorld,
  type GameMode,
  type GameWorld,
  type InputCommand,
  type KillEvent,
  type EntitySnapshot,
} from '@iso/shared';
import { BotController } from './bots.js';

interface ClientState {
  clientId: number;
  eid: number;
  netId: number;
  inputQueue: InputCommand[];
  lastProcessedSeq: number;
}

interface PendingHitscan {
  shooterNetId: number;
  shooterEid: number;
  aimYaw: number;
}

export class GameServer {
  readonly world: GameWorld;
  readonly mode: GameMode;
  private clients = new Map<number, ClientState>();
  private botEntities = new Map<number, number>();
  private netIdToEid = new Map<number, number>();
  private nextNetId = 1;
  private nextTeamAssign = 1;
  private physics: CollisionWorld | null = null;
  private botController = new BotController();
  private pendingHitscans: PendingHitscan[] = [];
  private killBuffer: KillEvent[] = [];
  private teamScores: [number, number] = [0, 0];
  private firedThisTick = new Set<number>();

  constructor(mode: GameMode = 'ffa') {
    this.world = createGameWorld();
    this.mode = mode;
  }

  setPhysics(cw: CollisionWorld): void {
    this.physics = cw;
  }

  private pickSpawn(team: number): { x: number; z: number } {
    const pts = team > 0 ? (TEAM_SPAWN_POINTS[team] ?? SPAWN_POINTS) : SPAWN_POINTS;
    return pts[Math.floor(Math.random() * pts.length)]!;
  }

  private nextTeam(): number {
    if (this.mode === 'ffa') return 0;
    const t = this.nextTeamAssign;
    this.nextTeamAssign = t === 1 ? 2 : 1;
    return t;
  }

  private makeEntity(isBot: boolean, spawnOverride?: { x: number; z: number }): { eid: number; netId: number; team: number } {
    const eid = addEntity(this.world);
    const netId = this.nextNetId++;
    const team = this.nextTeam();
    const spawn = spawnOverride ?? this.pickSpawn(team);

    addComponent(this.world, Transform, eid);
    addComponent(this.world, NetId, eid);
    addComponent(this.world, Player, eid);
    addComponent(this.world, ColliderHandle, eid);
    addComponent(this.world, Health, eid);
    addComponent(this.world, WeaponState, eid);
    addComponent(this.world, Team, eid);
    addComponent(this.world, Kills, eid);
    if (isBot) addComponent(this.world, Bot, eid);

    Transform.x[eid] = spawn.x;
    Transform.z[eid] = spawn.z;
    Transform.yaw[eid] = 0;
    NetId.value[eid] = netId;
    Team.id[eid] = team;
    Health.current[eid] = PLAYER_MAX_HEALTH;
    Health.max[eid] = PLAYER_MAX_HEALTH;
    Kills.count[eid] = 0;

    const ws = initialWeaponState();
    WeaponState.ammo[eid] = ws.ammo;
    WeaponState.reserveMags[eid] = ws.reserveMags;
    WeaponState.cooldownTick[eid] = ws.cooldownTick;
    WeaponState.reloadEndTick[eid] = ws.reloadEndTick;

    if (this.physics) {
      const handle = this.physics.addCharacter(netId, spawn.x, spawn.z);
      ColliderHandle.rapier[eid] = handle;
    }

    this.netIdToEid.set(netId, eid);
    return { eid, netId, team };
  }

  addClient(clientId: number, spawnOverride?: { x: number; z: number }): { netId: number; team: number } {
    const { eid, netId, team } = this.makeEntity(false, spawnOverride);
    addComponent(this.world, Owner, eid);
    Owner.clientId[eid] = clientId;
    this.clients.set(clientId, { clientId, eid, netId, inputQueue: [], lastProcessedSeq: 0 });
    return { netId, team };
  }

  addBot(): void {
    const { eid, netId } = this.makeEntity(true);
    this.botEntities.set(netId, eid);
    this.botController.register(netId);
  }

  removeClient(clientId: number): void {
    const c = this.clients.get(clientId);
    if (!c) return;
    this.physics?.removeCharacter(c.netId);
    this.netIdToEid.delete(c.netId);
    removeEntity(this.world, c.eid);
    this.clients.delete(clientId);
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

  private applyMovement(eid: number, netId: number, cmd: InputCommand): void {
    if (this.physics) {
      writeTransform(eid, integrateWithCollision(readTransform(eid), cmd, netId, this.physics));
    } else {
      applyInputToEntity(this.world, eid, cmd);
    }
  }

  private weaponTick(eid: number, fire: boolean, reload: boolean, tick: number): void {
    const cur = {
      ammo: WeaponState.ammo[eid]!,
      reserveMags: WeaponState.reserveMags[eid]!,
      cooldownTick: WeaponState.cooldownTick[eid]!,
      reloadEndTick: WeaponState.reloadEndTick[eid]!,
    };
    const { next, didFire } = tickWeapon(cur, fire, reload, tick);
    WeaponState.ammo[eid] = next.ammo;
    WeaponState.reserveMags[eid] = next.reserveMags;
    WeaponState.cooldownTick[eid] = next.cooldownTick;
    WeaponState.reloadEndTick[eid] = next.reloadEndTick;
    if (didFire) {
      const nid = NetId.value[eid]!;
      this.pendingHitscans.push({ shooterNetId: nid, shooterEid: eid, aimYaw: Transform.yaw[eid]! });
      this.firedThisTick.add(nid);
    }
  }

  private processRespawns(tick: number): void {
    const deadEids = [...deadQuery(this.world)];
    for (const eid of deadEids) {
      if (Dead.respawnTick[eid]! > tick) continue;
      const netId = NetId.value[eid]!;
      const team = Team.id[eid]!;
      const spawn = this.pickSpawn(team);

      removeComponent(this.world, Dead, eid);
      Transform.x[eid] = spawn.x;
      Transform.z[eid] = spawn.z;
      Health.current[eid] = PLAYER_MAX_HEALTH;

      const ws = initialWeaponState();
      WeaponState.ammo[eid] = ws.ammo;
      WeaponState.reserveMags[eid] = ws.reserveMags;
      WeaponState.cooldownTick[eid] = ws.cooldownTick;
      WeaponState.reloadEndTick[eid] = ws.reloadEndTick;

      if (this.physics) {
        this.physics.removeCharacter(netId);
        const handle = this.physics.addCharacter(netId, spawn.x, spawn.z);
        ColliderHandle.rapier[eid] = handle;
      }
    }
  }

  private resolveHitscan(h: PendingHitscan): void {
    if (!this.physics) return;
    const ox = Transform.x[h.shooterEid]!;
    const oz = Transform.z[h.shooterEid]!;
    const dirX = Math.sin(h.aimYaw);
    const dirZ = Math.cos(h.aimYaw);

    const result = this.physics.castRayForHit(h.shooterNetId, ox, oz, dirX, dirZ, WEAPON_RANGE);
    if (!result || result.hitNetId === null) return;

    const targetEid = this.netIdToEid.get(result.hitNetId);
    if (targetEid === undefined || this.isDead(targetEid)) return;

    if (this.mode === 'tdm') {
      const st = Team.id[h.shooterEid]!;
      const tt = Team.id[targetEid]!;
      if (st === tt && st !== 0) return;
    }

    const prev = Health.current[targetEid]!;
    const next = Math.max(0, prev - WEAPON_DAMAGE);
    Health.current[targetEid] = next;

    if (next === 0 && prev > 0) {
      this.killEntity(targetEid, result.hitNetId, h.shooterNetId);
    }
  }

  private killEntity(eid: number, netId: number, killerNetId: number): void {
    addComponent(this.world, Dead, eid);
    Dead.respawnTick[eid] = this.world.tick + PLAYER_RESPAWN_TICKS;

    if (killerNetId !== netId) {
      const killerEid = this.netIdToEid.get(killerNetId);
      if (killerEid !== undefined) {
        Kills.count[killerEid] = (Kills.count[killerEid]! + 1);
        if (this.mode === 'tdm') {
          const kt = Team.id[killerEid]!;
          if (kt === 1) this.teamScores[0]++;
          else if (kt === 2) this.teamScores[1]++;
        }
      }
    }

    this.killBuffer.push({ killer: killerNetId, victim: netId });
  }

  step(): void {
    const tick = this.world.tick;
    this.firedThisTick.clear();

    this.processRespawns(tick);

    for (const c of this.clients.values()) {
      if (this.isDead(c.eid)) {
        c.inputQueue.length = 0;
        continue;
      }
      c.inputQueue.sort((a, b) => a.seq - b.seq);
      let fire = false;
      let reload = false;
      for (const cmd of c.inputQueue) {
        this.applyMovement(c.eid, c.netId, cmd);
        fire = fire || cmd.fire;
        reload = reload || cmd.reload;
        c.lastProcessedSeq = cmd.seq;
      }
      c.inputQueue.length = 0;
      this.weaponTick(c.eid, fire, reload, tick);
    }

    for (const [netId, eid] of this.botEntities) {
      if (this.isDead(eid)) continue;
      const bi = this.botController.generateInput(netId, tick);
      const cmd: InputCommand = {
        seq: 0,
        moveX: bi.moveX,
        moveZ: bi.moveZ,
        aimYaw: bi.aimYaw,
        dt: FIXED_DT,
        fire: false,
        reload: false,
      };
      this.applyMovement(eid, netId, cmd);
      Transform.yaw[eid] = bi.aimYaw;
    }

    this.physics?.step();

    for (const h of this.pendingHitscans) {
      this.resolveHitscan(h);
    }
    this.pendingHitscans.length = 0;

    this.world.tick++;
  }

  ackFor(clientId: number): number {
    return this.clients.get(clientId)?.lastProcessedSeq ?? 0;
  }

  consumeKills(): KillEvent[] {
    const out = this.killBuffer.slice();
    this.killBuffer.length = 0;
    return out;
  }

  getTeamScores(): [number, number] {
    return [this.teamScores[0], this.teamScores[1]];
  }

  snapshotEntities(): EntitySnapshot[] {
    const eids = transformNetQuery(this.world);
    const out: EntitySnapshot[] = [];
    for (const eid of eids) {
      out.push({
        netId: NetId.value[eid]!,
        x: Transform.x[eid]!,
        z: Transform.z[eid]!,
        yaw: Transform.yaw[eid]!,
        health: Health.current[eid] ?? PLAYER_MAX_HEALTH,
        ammo: WeaponState.ammo[eid] ?? 0,
        reserveMags: WeaponState.reserveMags[eid] ?? 0,
        team: Team.id[eid] ?? 0,
        kills: Kills.count[eid] ?? 0,
        isDead: this.isDead(eid),
        isBot: hasComponent(this.world, Bot, eid),
        shotFired: this.firedThisTick.has(NetId.value[eid]!),
      });
    }
    return out;
  }
}
