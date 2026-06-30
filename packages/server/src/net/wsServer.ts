import { WebSocketServer, WebSocket } from 'ws';
import { MSG, encode, decode, type InputMessage } from '@iso/shared';
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
    console.log(`[ws] listening on ws://localhost:${port}`);
  }

  private onConnection(ws: WebSocket): void {
    const clientId = this.nextClientId++;
    const { netId, team } = this.game.addClient(clientId);
    this.sockets.set(clientId, ws);

    ws.send(encode({ t: MSG.Welcome, clientId, netId, mode: this.game.mode, team }));
    console.log(`[ws] client ${clientId} connected (netId ${netId} team ${team})`);

    ws.on('message', (raw) => {
      const msg = decode<InputMessage>(raw.toString());
      if (msg.t === MSG.Input) this.game.enqueueInput(clientId, msg.cmd);
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
        }),
      );
    }
  }
}
