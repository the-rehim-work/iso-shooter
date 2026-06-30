import type { Transport } from '@iso/shared';

export class WsClient implements Transport {
  private ws: WebSocket;

  constructor(url: string) {
    this.ws = new WebSocket(url);
  }
  send(data: string): void {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(data);
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
