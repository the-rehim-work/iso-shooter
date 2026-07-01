import * as THREE from 'three';
import { THROW_FRAG, THROW_MOLOTOV, THROW_SMOKE, type ProjectileSnapshot, type ZoneSnapshot } from '@iso/shared';

function radialSprite(inner: string, outer: string): THREE.SpriteMaterial {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false });
}

const FRAG_GEO = new THREE.SphereGeometry(0.17, 8, 6);
const CANISTER_GEO = new THREE.CylinderGeometry(0.13, 0.13, 0.34, 8);
const FRAG_MAT = new THREE.MeshStandardMaterial({ color: 0x2f3a25, roughness: 0.5, metalness: 0.4 });
const MOLO_MAT = new THREE.MeshStandardMaterial({ color: 0xcc6a1a, roughness: 0.4, emissive: 0x3a1500 });
const SMOKE_CAN_MAT = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.6, metalness: 0.3 });

function projMesh(type: number): THREE.Mesh {
  if (type === THROW_FRAG) return new THREE.Mesh(FRAG_GEO, FRAG_MAT);
  if (type === THROW_MOLOTOV) return new THREE.Mesh(CANISTER_GEO, MOLO_MAT);
  return new THREE.Mesh(CANISTER_GEO, SMOKE_CAN_MAT);
}

class FireZone {
  readonly group = new THREE.Group();
  private light: THREE.PointLight;
  private flames: THREE.Sprite[] = [];
  private t = 0;

  constructor(scene: THREE.Scene, x: number, z: number, radius: number, flameMat: THREE.SpriteMaterial) {
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(radius, 28),
      new THREE.MeshBasicMaterial({ color: 0xff5510, transparent: true, opacity: 0.28, depthWrite: false }),
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 0.05;
    this.group.add(disc);

    this.light = new THREE.PointLight(0xff6a20, 6, radius * 4);
    this.light.position.y = 1;
    this.group.add(this.light);

    for (let i = 0; i < 10; i++) {
      const s = new THREE.Sprite(flameMat);
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * radius * 0.85;
      s.position.set(Math.cos(a) * r, 0.4, Math.sin(a) * r);
      s.scale.setScalar(0.8 + Math.random() * 0.7);
      this.group.add(s);
      this.flames.push(s);
    }
    this.group.position.set(x, 0, z);
    scene.add(this.group);
  }

  update(dt: number): void {
    this.t += dt;
    this.light.intensity = 5 + Math.sin(this.t * 18) * 2;
    for (let i = 0; i < this.flames.length; i++) {
      const f = this.flames[i]!;
      const base = 0.9 + Math.sin(this.t * 12 + i) * 0.25;
      f.scale.setScalar(base);
      f.position.y = 0.4 + Math.abs(Math.sin(this.t * 9 + i)) * 0.3;
    }
  }

  dispose(scene: THREE.Scene): void {
    scene.remove(this.group);
  }
}

class SmokeZone {
  readonly group = new THREE.Group();
  private puffs: THREE.Sprite[] = [];
  private t = 0;

  constructor(scene: THREE.Scene, x: number, z: number, radius: number, smokeMat: THREE.SpriteMaterial) {
    for (let i = 0; i < 22; i++) {
      const s = new THREE.Sprite(smokeMat.clone());
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * radius;
      s.position.set(Math.cos(a) * r, 0.6 + Math.random() * radius * 0.7, Math.sin(a) * r);
      s.scale.setScalar(radius * (0.7 + Math.random() * 0.6));
      this.group.add(s);
      this.puffs.push(s);
    }
    this.group.position.set(x, 0, z);
    scene.add(this.group);
  }

  update(dt: number): void {
    this.t += dt;
    const fade = Math.min(1, this.t * 1.5);
    for (let i = 0; i < this.puffs.length; i++) {
      const p = this.puffs[i]!;
      (p.material as THREE.SpriteMaterial).opacity = 0.75 * fade;
      p.position.y += Math.sin(this.t + i) * dt * 0.05;
      p.material.rotation += dt * 0.1 * (i % 2 ? 1 : -1);
    }
  }

  dispose(scene: THREE.Scene): void {
    scene.remove(this.group);
  }
}

export class ThrowablesView {
  private scene: THREE.Scene;
  private projMeshes = new Map<number, THREE.Mesh>();
  private fireZones = new Map<number, FireZone>();
  private smokeZones = new Map<number, SmokeZone>();
  private flameMat = radialSprite('rgba(255,220,120,1)', 'rgba(255,80,0,0)');
  private smokeMat = radialSprite('rgba(150,150,155,0.9)', 'rgba(120,120,125,0)');

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  syncProjectiles(list: ProjectileSnapshot[]): void {
    const seen = new Set<number>();
    for (const p of list) {
      seen.add(p.id);
      let m = this.projMeshes.get(p.id);
      if (!m) { m = projMesh(p.type); m.castShadow = true; this.scene.add(m); this.projMeshes.set(p.id, m); }
      m.position.set(p.x, p.h + 0.3, p.z);
      m.rotation.x += 0.3; m.rotation.y += 0.2;
    }
    for (const [id, m] of this.projMeshes) {
      if (!seen.has(id)) { this.scene.remove(m); this.projMeshes.delete(id); }
    }
  }

  syncZones(list: ZoneSnapshot[]): void {
    const seenFire = new Set<number>();
    const seenSmoke = new Set<number>();
    for (const z of list) {
      if (z.type === THROW_MOLOTOV) {
        seenFire.add(z.id);
        if (!this.fireZones.has(z.id)) this.fireZones.set(z.id, new FireZone(this.scene, z.x, z.z, z.radius, this.flameMat));
      } else if (z.type === THROW_SMOKE) {
        seenSmoke.add(z.id);
        if (!this.smokeZones.has(z.id)) this.smokeZones.set(z.id, new SmokeZone(this.scene, z.x, z.z, z.radius, this.smokeMat));
      }
    }
    for (const [id, z] of this.fireZones) if (!seenFire.has(id)) { z.dispose(this.scene); this.fireZones.delete(id); }
    for (const [id, z] of this.smokeZones) if (!seenSmoke.has(id)) { z.dispose(this.scene); this.smokeZones.delete(id); }
  }

  update(dt: number): void {
    for (const z of this.fireZones.values()) z.update(dt);
    for (const z of this.smokeZones.values()) z.update(dt);
  }
}
