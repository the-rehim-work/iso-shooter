interface BotState {
  moveX: number;
  moveZ: number;
  nextChangeTick: number;
}

export class BotController {
  private bots = new Map<number, BotState>();

  register(netId: number): void {
    this.bots.set(netId, { moveX: 0, moveZ: 0, nextChangeTick: 0 });
  }

  unregister(netId: number): void {
    this.bots.delete(netId);
  }

  generateInput(netId: number, currentTick: number): { moveX: number; moveZ: number; aimYaw: number } {
    const b = this.bots.get(netId);
    if (!b) return { moveX: 0, moveZ: 0, aimYaw: 0 };

    if (currentTick >= b.nextChangeTick) {
      if (Math.random() < 0.2) {
        b.moveX = 0;
        b.moveZ = 0;
      } else {
        const angle = Math.random() * 2 * Math.PI;
        b.moveX = Math.cos(angle);
        b.moveZ = Math.sin(angle);
      }
      b.nextChangeTick = currentTick + 30 + Math.floor(Math.random() * 60);
    }

    const aimYaw = Math.atan2(b.moveX, b.moveZ);
    return { moveX: b.moveX, moveZ: b.moveZ, aimYaw };
  }
}
