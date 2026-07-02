import { WebSocketServer, WebSocket } from 'ws';
import { MSG, encode, decode, getMap, CollisionWorld, type ClientToServer, type MatchConfig } from '@iso/shared';
import { GameServer } from '../gameLoop.js';

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const LOBBY_CODE = 'LOBBY';

interface Room {
  code: string;
  game: GameServer;
  sockets: Map<number, WebSocket>;
}

export class IsoWsServer {
  private wss: WebSocketServer;
  private rooms = new Map<string, Room>();
  private defaultConfig: MatchConfig;
  private nextClientId = 1;

  constructor(port: number, defaultConfig: MatchConfig) {
    this.defaultConfig = defaultConfig;
    this.wss = new WebSocketServer({ port });
    this.wss.on('connection', (ws) => this.onConnection(ws));
    this.wss.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`[ws] port ${port} already in use — is another server running?`);
        process.exit(1);
      }
      console.error('[ws] server error:', err.message);
    });
    console.log(`[ws] listening on ws://localhost:${port}`);
  }

  private newCode(): string {
    for (;;) {
      let code = '';
      for (let i = 0; i < 4; i++) code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
      if (!this.rooms.has(code)) return code;
    }
  }

  private createRoom(code: string, config: MatchConfig): Room {
    const game = new GameServer(config.mode);
    game.setPhysics(new CollisionWorld(getMap(config.map)));
    game.applyConfig(config);
    const room: Room = { code, game, sockets: new Map() };
    this.rooms.set(code, room);
    console.log(`[room ${code}] created (${config.mode} on ${config.map})`);
    return room;
  }

  private resolveRoom(requested: string): Room | null {
    const code = requested.trim().toUpperCase();
    if (code === '') return this.createRoom(this.newCode(), { ...this.defaultConfig });
    if (code === LOBBY_CODE) {
      return this.rooms.get(LOBBY_CODE) ?? this.createRoom(LOBBY_CODE, { ...this.defaultConfig });
    }
    return this.rooms.get(code) ?? null;
  }

  private onConnection(ws: WebSocket): void {
    const clientId = this.nextClientId++;
    let room: Room | null = null;
    let smoothedRtt = -1;

    const pingTimer = setInterval(() => {
      if (ws.readyState === ws.OPEN) ws.send(encode({ t: MSG.Ping, ts: Date.now() }));
    }, 1000);

    ws.on('message', (raw) => {
      const msg = decode<ClientToServer>(raw.toString());

      if (!room) {
        if (msg.t !== MSG.Join) return;
        const target = this.resolveRoom(msg.room);
        if (!target) {
          ws.send(encode({ t: MSG.RoomError, reason: 'Room ' + msg.room.trim().toUpperCase() + ' not found' }));
          return;
        }
        room = target;
        const { netId, team, classId } = room.game.addClient(clientId);
        room.game.setClientName(clientId, msg.name);
        room.sockets.set(clientId, ws);
        ws.send(encode({
          t: MSG.Welcome, clientId, netId, mode: room.game.mode, team, classId,
          mapId: room.game.mapId, isHost: room.game.isHost(clientId),
          config: room.game.getConfig(), roomCode: room.code,
        }));
        console.log(`[room ${room.code}] client ${clientId} joined (netId ${netId} team ${team})`);
        return;
      }

      if (msg.t === MSG.Input) room.game.enqueueInput(clientId, msg.cmd);
      else if (msg.t === MSG.SetClass) room.game.setClientClass(clientId, msg.classId);
      else if (msg.t === MSG.SetName) room.game.setClientName(clientId, msg.name);
      else if (msg.t === MSG.ConfigureMatch) room.game.configureMatch(clientId, msg.config);
      else if (msg.t === MSG.SetTeam) room.game.setClientTeam(clientId, msg.team);
      else if (msg.t === MSG.Pong) {
        const sample = Math.max(0, Date.now() - msg.ts);
        smoothedRtt = smoothedRtt < 0 ? sample : smoothedRtt * 0.7 + sample * 0.3;
        room.game.setClientRtt(clientId, smoothedRtt);
      }
    });

    ws.on('close', () => {
      clearInterval(pingTimer);
      if (!room) return;
      room.game.removeClient(clientId);
      room.sockets.delete(clientId);
      console.log(`[room ${room.code}] client ${clientId} disconnected`);
      if (room.sockets.size === 0) {
        room.game.dispose();
        this.rooms.delete(room.code);
        console.log(`[room ${room.code}] empty — closed`);
      }
    });
  }

  stepAll(): void {
    for (const room of this.rooms.values()) room.game.step();
  }

  broadcastAll(): void {
    for (const room of this.rooms.values()) this.broadcastRoom(room);
  }

  private broadcastRoom(room: Room): void {
    const game = room.game;
    const entities = game.snapshotEntities();
    const serverTick = game.world.tick;
    const recentKills = game.consumeKills();
    const teamScores = game.getTeamScores();
    const hits = game.consumeHits();
    const doors = game.getDoorMask();
    const mode = game.getModeState();
    const projectiles = game.getProjectiles();
    const zones = game.getZones();
    const blasts = game.consumeBlasts();
    for (const [clientId, ws] of room.sockets) {
      if (ws.readyState !== ws.OPEN) continue;
      ws.send(
        encode({
          t: MSG.Snapshot,
          serverTick,
          ackSeq: game.ackFor(clientId),
          entities,
          teamScores,
          recentKills,
          hits,
          doors,
          mode,
          projectiles,
          zones,
          blasts,
          grenades: game.grenadesFor(clientId),
        }),
      );
    }
  }
}
