export class InputSampler {
  private keys = new Set<string>();
  mouseX = 0;
  mouseY = 0;
  private fireHeld = false;
  private reloadPressed = false;
  private switchQueued = -1;
  private throwQueued = 0;
  private teamSwitchPressed = false;
  scoreboardHeld = false;

  constructor(target: HTMLElement) {
    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      this.keys.add(k);
      if (k === 'r') this.reloadPressed = true;
      if (k === '1') this.switchQueued = 0;
      if (k === '2') this.switchQueued = 1;
      if (k === 'q') this.switchQueued = 2;
      if (k === '3') this.throwQueued = 1;
      if (k === '4') this.throwQueued = 2;
      if (k === '5') this.throwQueued = 3;
      if (k === 't') this.teamSwitchPressed = true;
      if (k === 'tab') { this.scoreboardHeld = true; e.preventDefault(); }
    });
    window.addEventListener('keyup', (e) => {
      const k = e.key.toLowerCase();
      this.keys.delete(k);
      if (k === 'tab') this.scoreboardHeld = false;
    });
    target.addEventListener('mousemove', (e) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
    });
    target.addEventListener('mousedown', (e) => {
      if (e.button === 0) this.fireHeld = true;
    });
    target.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.fireHeld = false;
    });
    target.addEventListener('wheel', (e) => {
      this.switchQueued = 3;
      e.preventDefault();
    }, { passive: false });
    target.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  axis(): { forward: number; strafe: number } {
    let forward = 0;
    let strafe = 0;
    if (this.keys.has('w')) forward += 1;
    if (this.keys.has('s')) forward -= 1;
    if (this.keys.has('d')) strafe += 1;
    if (this.keys.has('a')) strafe -= 1;
    return { forward, strafe };
  }

  get fire(): boolean {
    return this.fireHeld;
  }

  get interact(): boolean {
    return this.keys.has('e');
  }

  get jump(): boolean {
    return this.keys.has(' ');
  }

  consumeReload(): boolean {
    if (this.reloadPressed) {
      this.reloadPressed = false;
      return true;
    }
    return false;
  }

  consumeThrow(): number {
    const t = this.throwQueued;
    this.throwQueued = 0;
    return t;
  }

  consumeTeamSwitch(): boolean {
    if (this.teamSwitchPressed) { this.teamSwitchPressed = false; return true; }
    return false;
  }

  consumeSwitch(activeSlot: number): number {
    const q = this.switchQueued;
    this.switchQueued = -1;
    if (q === -1) return -1;
    if (q === 3 || q === 2) return activeSlot === 0 ? 1 : 0;
    return q;
  }
}
