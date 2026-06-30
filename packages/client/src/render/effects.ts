import * as THREE from 'three';

const SPARK_GEO = new THREE.SphereGeometry(0.048, 4, 3);
const TRACER_MAT = new THREE.LineBasicMaterial({ color: 0xffee66, transparent: true });

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
  private life = 0.35;

  constructor(scene: THREE.Scene, pos: THREE.Vector3) {
    this.mat = new THREE.MeshBasicMaterial({ color: 0xff4400 });
    for (let i = 0; i < 7; i++) {
      const m = new THREE.Mesh(SPARK_GEO, this.mat);
      m.position.copy(pos);
      scene.add(m);
      this.meshes.push(m);
      const a = Math.random() * Math.PI * 2;
      const sp = 2 + Math.random() * 4.5;
      this.velocities.push(new THREE.Vector3(Math.cos(a) * sp * 0.7, 1.5 + Math.random() * 3.5, Math.sin(a) * sp * 0.7));
    }
  }

  update(dt: number): boolean {
    this.life -= dt;
    const t = Math.max(0, this.life / 0.35);
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

export class EffectsSystem {
  private scene: THREE.Scene;
  private active: Effect[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  muzzleFlash(pos: THREE.Vector3): void {
    this.active.push(new MuzzleFlash(this.scene, pos));
  }

  bulletTracer(from: THREE.Vector3, to: THREE.Vector3): void {
    this.active.push(new BulletTracer(this.scene, from, to));
  }

  hitSpark(pos: THREE.Vector3): void {
    this.active.push(new HitSpark(this.scene, pos));
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
