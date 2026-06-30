import type { Transport } from '@iso/shared';

export class LatencySim implements Transport {
  private inner: Transport;
  private oneWayMs: number;
  private msgHandler: ((d: string) => void) | null = null;

  constructor(inner: Transport, oneWayMs: number) {
    this.inner = inner;
    this.oneWayMs = oneWayMs;
    this.inner.onMessage((d) => {
      const delay = this.oneWayMs;
      if (delay <= 0) this.msgHandler?.(d);
      else setTimeout(() => this.msgHandler?.(d), delay);
    });
  }

  setLatency(oneWayMs: number): void {
    this.oneWayMs = oneWayMs;
  }

  send(data: string): void {
    const delay = this.oneWayMs;
    if (delay <= 0) this.inner.send(data);
    else setTimeout(() => this.inner.send(data), delay);
  }

  onMessage(handler: (d: string) => void): void {
    this.msgHandler = handler;
  }
  onOpen(handler: () => void): void {
    this.inner.onOpen(handler);
  }
  onClose(handler: () => void): void {
    this.inner.onClose(handler);
  }
  close(): void {
    this.inner.close();
  }
}
