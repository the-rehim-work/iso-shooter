export class VisionOverlay {
  private el: HTMLElement;
  private active = false;

  constructor(container: HTMLElement) {
    this.el = document.createElement('div');
    Object.assign(this.el.style, {
      position: 'fixed', inset: '0', pointerEvents: 'none', zIndex: '2',
      display: 'none',
      background: 'radial-gradient(ellipse 46% 50% at 50% 47%, rgba(0,0,0,0) 52%, rgba(3,5,9,0.5) 72%, rgba(1,2,4,0.92) 100%)',
    });
    container.appendChild(this.el);
  }

  setActive(active: boolean): void {
    if (active === this.active) return;
    this.active = active;
    this.el.style.display = active ? 'block' : 'none';
  }

  get isActive(): boolean {
    return this.active;
  }
}
