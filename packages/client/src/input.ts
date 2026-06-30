export class InputSampler {
  private keys = new Set<string>();
  mouseX = 0;
  mouseY = 0;
  private fireHeld = false;
  private reloadPressed = false;

  constructor(target: HTMLElement) {
    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      this.keys.add(k);
      if (k === 'r') this.reloadPressed = true;
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
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

  consumeReload(): boolean {
    if (this.reloadPressed) {
      this.reloadPressed = false;
      return true;
    }
    return false;
  }
}
