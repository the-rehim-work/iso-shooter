import { WebSocketServer, WebSocket } from 'ws';
import { MSG, encode, decode, type ClientToServer } from '@iso/shared';
import { GameServer } from '../gameLoop.js';

export class IsoWsServer {
  private wss: WebSocketServer;
  private game: GameServer;
  private sockets = new Map<number, WebSocket>();
  private nextClientId = 1;

  constructor(game: GameServer, port: number) {
    this.game = game;
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

  private onConnection(ws: WebSocket): void {
    const clientId = this.nextClientId++;
    const { netId, team, classId } = this.game.addClient(clientId);
    this.sockets.set(clientId, ws);

    ws.send(encode({
      t: MSG.Welcome, clientId, netId, mode: this.game.mode, team, classId,
      mapId: this.game.mapId, isHost: this.game.isHost(clientId), config: this.game.getConfig(),
    }));
    console.log(`[ws] client ${clientId} connected (netId ${netId} team ${team})`);

    ws.on('message', (raw) => {
      const msg = decode<ClientToServer>(raw.toString());
      if (msg.t === MSG.Input) this.game.enqueueInput(clientId, msg.cmd);
      else if (msg.t === MSG.SetClass) this.game.setClientClass(clientId, msg.classId);
      else if (msg.t === MSG.SetName) this.game.setClientName(clientId, msg.name);
      else if (msg.t === MSG.SetDifficulty) this.game.setBotDifficulty(msg.difficulty);
      else if (msg.t === MSG.ConfigureMatch) this.game.configureMatch(clientId, msg.config);
      else if (msg.t === MSG.SetTeam) this.game.setClientTeam(clientId, msg.team);
    });

    ws.on('close', () => {
      this.game.removeClient(clientId);
      this.sockets.delete(clientId);
      console.log(`[ws] client ${clientId} disconnected`);
    });
  }

  broadcastSnapshot(): void {
    const entities = this.game.snapshotEntities();
    const serverTick = this.game.world.tick;
    const recentKills = this.game.consumeKills();
    const teamScores = this.game.getTeamScores();
    const hits = this.game.consumeHits();
    const doors = this.game.getDoorMask();
    const mode = this.game.getModeState();
    const projectiles = this.game.getProjectiles();
    const zones = this.game.getZones();
    const blasts = this.game.consumeBlasts();
    for (const [clientId, ws] of this.sockets) {
      if (ws.readyState !== ws.OPEN) continue;
      ws.send(
        encode({
          t: MSG.Snapshot,
          serverTick,
          ackSeq: this.game.ackFor(clientId),
          entities,
          teamScores,
          recentKills,
          hits,
          doors,
          mode,
          projectiles,
          zones,
          blasts,
          grenades: this.game.grenadesFor(clientId),
        }),
      );
    }
  }
}
