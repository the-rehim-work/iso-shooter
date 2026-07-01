const ARM = 7;

function arm(): HTMLElement {
  const e = document.createElement('div');
  Object.assign(e.style, {
    position: 'fixed', background: 'rgba(230,255,250,0.9)',
    boxShadow: '0 0 2px rgba(0,0,0,0.9)', pointerEvents: 'none', zIndex: '300',
  });
  return e;
}

export class Crosshair {
  private top = arm();
  private bottom = arm();
  private left = arm();
  private right = arm();
  private dot = arm();

  constructor(container: HTMLElement) {
    this.dot.style.width = '2px';
    this.dot.style.height = '2px';
    this.dot.style.borderRadius = '50%';
    for (const e of [this.top, this.bottom, this.left, this.right, this.dot]) container.appendChild(e);
  }

  update(x: number, y: number, gap: number): void {
    const g = Math.max(3, gap);
    this.top.style.width = '2px'; this.top.style.height = ARM + 'px';
    this.top.style.left = (x - 1) + 'px'; this.top.style.top = (y - g - ARM) + 'px';

    this.bottom.style.width = '2px'; this.bottom.style.height = ARM + 'px';
    this.bottom.style.left = (x - 1) + 'px'; this.bottom.style.top = (y + g) + 'px';

    this.left.style.width = ARM + 'px'; this.left.style.height = '2px';
    this.left.style.left = (x - g - ARM) + 'px'; this.left.style.top = (y - 1) + 'px';

    this.right.style.width = ARM + 'px'; this.right.style.height = '2px';
    this.right.style.left = (x + g) + 'px'; this.right.style.top = (y - 1) + 'px';

    this.dot.style.left = (x - 1) + 'px'; this.dot.style.top = (y - 1) + 'px';
  }

  setColor(color: string): void {
    for (const e of [this.top, this.bottom, this.left, this.right, this.dot]) e.style.background = color;
  }

  setVisible(v: boolean): void {
    const d = v ? 'block' : 'none';
    for (const e of [this.top, this.bottom, this.left, this.right, this.dot]) e.style.display = d;
  }
}
