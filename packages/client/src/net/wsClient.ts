import type { Transport } from '@iso/shared';

export class WsClient implements Transport {
  private ws: WebSocket;
  private pending: string[] = [];

  constructor(url: string) {
    this.ws = new WebSocket(url);
    this.ws.addEventListener('open', () => {
      for (const d of this.pending) this.ws.send(d);
      this.pending.length = 0;
    });
  }
  send(data: string): void {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(data);
    else if (this.ws.readyState === WebSocket.CONNECTING) this.pending.push(data);
  }
  onMessage(handler: (d: string) => void): void {
    this.ws.addEventListener('message', (e) => handler(String(e.data)));
  }
  onOpen(handler: () => void): void {
    this.ws.addEventListener('open', handler);
  }
  onClose(handler: () => void): void {
    this.ws.addEventListener('close', handler);
  }
  close(): void {
    this.ws.close();
  }
}
