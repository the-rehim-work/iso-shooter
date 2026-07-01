import * as THREE from 'three';

const SPARK_GEO = new THREE.SphereGeometry(0.048, 4, 3);
const SHELL_GEO = new THREE.BoxGeometry(0.03, 0.03, 0.075);
const SHELL_MAT = new THREE.MeshStandardMaterial({ color: 0xcaa23a, roughness: 0.35, metalness: 0.85 });
const TRACER_MAT = new THREE.LineBasicMaterial({ color: 0xffee66, transparent: true });

function flashMaterial(): THREE.SpriteMaterial {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 1, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,230,160,0.8)');
  g.addColorStop(1, 'rgba(255,180,80,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
}

const FLASH_MAT = flashMaterial();

class ImpactFlash implements Effect {
  private sprite: THREE.Sprite;
  private life = 0.12;
  private size: number;

  constructor(scene: THREE.Scene, pos: THREE.Vector3, size: number) {
    this.size = size;
    this.sprite = new THREE.Sprite(FLASH_MAT);
    this.sprite.position.copy(pos);
    this.sprite.scale.setScalar(size);
    scene.add(this.sprite);
  }

  update(dt: number): boolean {
    this.life -= dt;
    const t = Math.max(0, this.life / 0.12);
    this.sprite.scale.setScalar(this.size * (1.4 - t * 0.4));
    this.sprite.material.opacity = t;
    return this.life > 0;
  }

  dispose(): void {
    this.sprite.parent?.remove(this.sprite);
  }
}

class Shell implements Effect {
  private mesh: THREE.Mesh;
  private vel: THREE.Vector3;
  private spin: THREE.Vector3;
  private life = 0.7;

  constructor(scene: THREE.Scene, pos: THREE.Vector3, yaw: number) {
    this.mesh = new THREE.Mesh(SHELL_GEO, SHELL_MAT);
    this.mesh.position.copy(pos);
    scene.add(this.mesh);
    const side = yaw + Math.PI / 2;
    const sp = 1.5 + Math.random() * 1.5;
    this.vel = new THREE.Vector3(Math.sin(side) * sp, 2 + Math.random() * 1.5, Math.cos(side) * sp);
    this.spin = new THREE.Vector3(Math.random() * 20, Math.random() * 20, Math.random() * 20);
  }

  update(dt: number): boolean {
    this.life -= dt;
    this.vel.y -= 12 * dt;
    this.mesh.position.addScaledVector(this.vel, dt);
    if (this.mesh.position.y < 0.03) { this.mesh.position.y = 0.03; this.vel.set(this.vel.x * 0.3, Math.abs(this.vel.y) * 0.3, this.vel.z * 0.3); }
    this.mesh.rotation.x += this.spin.x * dt;
    this.mesh.rotation.y += this.spin.y * dt;
    return this.life > 0;
  }

  dispose(): void {
    this.mesh.parent?.remove(this.mesh);
  }
}

interface Effect {
  update(dt: number): boolean;
  dispose(): void;
}

class MuzzleFlash implements Effect {
  private light: THREE.PointLight;
  private sprite: THREE.Sprite;
  private life = 0.06;

  constructor(scene: THREE.Scene, pos: THREE.Vector3) {
    this.light = new THREE.PointLight(0xffaa33, 14, 5);
    this.light.position.copy(pos);
    scene.add(this.light);

    const mat = new THREE.SpriteMaterial({ color: 0xfffaaa, transparent: true, opacity: 1, depthWrite: false });
    this.sprite = new THREE.Sprite(mat);
    this.sprite.position.copy(pos);
    this.sprite.scale.setScalar(0.6);
    scene.add(this.sprite);
  }

  update(dt: number): boolean {
    this.life -= dt;
    const t = Math.max(0, this.life / 0.06);
    this.light.intensity = 14 * t;
    this.sprite.scale.setScalar(0.6 * t);
    this.sprite.material.opacity = t;
    return this.life > 0;
  }

  dispose(): void {
    this.light.parent?.remove(this.light);
    this.sprite.parent?.remove(this.sprite);
    this.sprite.material.dispose();
  }
}

class BulletTracer implements Effect {
  private line: THREE.Line;
  private life = 0.08;

  constructor(scene: THREE.Scene, from: THREE.Vector3, to: THREE.Vector3) {
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    this.line = new THREE.Line(geo, TRACER_MAT.clone());
    scene.add(this.line);
  }

  update(dt: number): boolean {
    this.life -= dt;
    const mat = this.line.material as THREE.LineBasicMaterial;
    mat.opacity = Math.max(0, (this.life / 0.08) * 0.85);
    return this.life > 0;
  }

  dispose(): void {
    this.line.parent?.remove(this.line);
    this.line.geometry.dispose();
    (this.line.material as THREE.LineBasicMaterial).dispose();
  }
}

class HitSpark implements Effect {
  private meshes: THREE.Mesh[] = [];
  private velocities: THREE.Vector3[] = [];
  private mat: THREE.MeshBasicMaterial;
  private life: number;
  private ttl: number;

  constructor(scene: THREE.Scene, pos: THREE.Vector3, color: number, count: number, spread: number) {
    this.mat = new THREE.MeshBasicMaterial({ color });
    this.ttl = 0.35;
    this.life = this.ttl;
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(SPARK_GEO, this.mat);
      m.position.copy(pos);
      scene.add(m);
      this.meshes.push(m);
      const a = Math.random() * Math.PI * 2;
      const sp = 2 + Math.random() * spread;
      this.velocities.push(new THREE.Vector3(Math.cos(a) * sp * 0.7, 1.2 + Math.random() * 3.5, Math.sin(a) * sp * 0.7));
    }
  }

  update(dt: number): boolean {
    this.life -= dt;
    const t = Math.max(0, this.life / this.ttl);
    for (let i = 0; i < this.meshes.length; i++) {
      const m = this.meshes[i]!;
      const v = this.velocities[i]!;
      m.position.addScaledVector(v, dt);
      v.y -= 14 * dt;
      m.scale.setScalar(t * 0.9 + 0.1);
    }
    return this.life > 0;
  }

  dispose(): void {
    for (const m of this.meshes) m.parent?.remove(m);
    this.mat.dispose();
  }
}

class Explosion implements Effect {
  private light: THREE.PointLight;
  private ring: THREE.Mesh;
  private core: THREE.Mesh;
  private meshes: THREE.Mesh[] = [];
  private velocities: THREE.Vector3[] = [];
  private mat: THREE.MeshBasicMaterial;
  private life = 0.5;

  constructor(scene: THREE.Scene, pos: THREE.Vector3) {
    this.light = new THREE.PointLight(0xffaa33, 40, 18);
    this.light.position.copy(pos).setY(1.2);
    scene.add(this.light);

    this.core = new THREE.Mesh(
      new THREE.SphereGeometry(0.8, 12, 10),
      new THREE.MeshBasicMaterial({ color: 0xffdd88, transparent: true, opacity: 1, depthWrite: false }),
    );
    this.core.position.copy(pos).setY(1);
    scene.add(this.core);

    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(0.3, 0.6, 28),
      new THREE.MeshBasicMaterial({ color: 0xff7722, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }),
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.copy(pos).setY(0.15);
    scene.add(this.ring);

    this.mat = new THREE.MeshBasicMaterial({ color: 0xff8822 });
    for (let i = 0; i < 16; i++) {
      const m = new THREE.Mesh(SPARK_GEO, this.mat);
      m.position.copy(pos).setY(1);
      scene.add(m);
      this.meshes.push(m);
      const a = Math.random() * Math.PI * 2;
      const sp = 5 + Math.random() * 9;
      this.velocities.push(new THREE.Vector3(Math.cos(a) * sp, 2 + Math.random() * 6, Math.sin(a) * sp));
    }
  }

  update(dt: number): boolean {
    this.life -= dt;
    const t = Math.max(0, this.life / 0.5);
    this.light.intensity = 40 * t;
    this.core.scale.setScalar(1 + (1 - t) * 2.2);
    (this.core.material as THREE.MeshBasicMaterial).opacity = t;
    const rs = 1 + (1 - t) * 9;
    this.ring.scale.setScalar(rs);
    (this.ring.material as THREE.MeshBasicMaterial).opacity = t * 0.9;
    for (let i = 0; i < this.meshes.length; i++) {
      const m = this.meshes[i]!;
      const v = this.velocities[i]!;
      m.position.addScaledVector(v, dt);
      v.y -= 16 * dt;
      m.scale.setScalar(t + 0.15);
    }
    return this.life > 0;
  }

  dispose(): void {
    this.light.parent?.remove(this.light);
    this.core.parent?.remove(this.core);
    (this.core.material as THREE.Material).dispose();
    this.ring.parent?.remove(this.ring);
    (this.ring.material as THREE.Material).dispose();
    for (const m of this.meshes) m.parent?.remove(m);
    this.mat.dispose();
  }
}

class DamageNumber implements Effect {
  private sprite: THREE.Sprite;
  private life: number;
  private ttl = 0.9;
  private vy = 2.2;

  constructor(scene: THREE.Scene, pos: THREE.Vector3, dmg: number, crit: boolean) {
    this.life = this.ttl;
    const c = document.createElement('canvas');
    c.width = 128; c.height = 64;
    const ctx = c.getContext('2d')!;
    ctx.font = 'bold ' + (crit ? 40 : 30) + 'px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.strokeText(String(dmg), 64, 32);
    ctx.fillStyle = crit ? '#ffdd33' : '#ffffff';
    ctx.fillText(String(dmg), 64, 32);
    const mat = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false, depthWrite: false });
    this.sprite = new THREE.Sprite(mat);
    this.sprite.position.copy(pos);
    this.sprite.scale.set(crit ? 1.9 : 1.4, crit ? 0.95 : 0.7, 1);
    scene.add(this.sprite);
  }

  update(dt: number): boolean {
    this.life -= dt;
    this.sprite.position.y += this.vy * dt;
    this.vy = Math.max(0, this.vy - dt * 2);
    (this.sprite.material as THREE.SpriteMaterial).opacity = Math.max(0, this.life / this.ttl);
    return this.life > 0;
  }

  dispose(): void {
    this.sprite.parent?.remove(this.sprite);
    (this.sprite.material as THREE.SpriteMaterial).map?.dispose();
    (this.sprite.material as THREE.Material).dispose();
  }
}

export class EffectsSystem {
  private scene: THREE.Scene;
  private active: Effect[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  explosion(pos: THREE.Vector3): void {
    this.active.push(new Explosion(this.scene, pos));
  }

  damageNumber(pos: THREE.Vector3, dmg: number, crit: boolean): void {
    this.active.push(new DamageNumber(this.scene, pos, dmg, crit));
  }

  muzzleFlash(pos: THREE.Vector3): void {
    this.active.push(new MuzzleFlash(this.scene, pos));
  }

  bulletTracer(from: THREE.Vector3, to: THREE.Vector3): void {
    this.active.push(new BulletTracer(this.scene, from, to));
  }

  hitSpark(pos: THREE.Vector3): void {
    this.active.push(new HitSpark(this.scene, pos, 0xd52020, 11, 5));
    this.active.push(new ImpactFlash(this.scene, pos, 0.7));
  }

  wallSpark(pos: THREE.Vector3): void {
    this.active.push(new HitSpark(this.scene, pos, 0xb8b0a0, 6, 3));
    this.active.push(new ImpactFlash(this.scene, pos, 0.4));
  }

  critSpark(pos: THREE.Vector3): void {
    this.active.push(new HitSpark(this.scene, pos, 0xffdd00, 16, 7));
    this.active.push(new ImpactFlash(this.scene, pos, 1.1));
  }

  shell(pos: THREE.Vector3, yaw: number): void {
    this.active.push(new Shell(this.scene, pos, yaw));
  }

  update(dt: number): void {
    for (let i = this.active.length - 1; i >= 0; i--) {
      if (!this.active[i]!.update(dt)) {
        this.active[i]!.dispose();
        this.active.splice(i, 1);
      }
    }
  }
}
