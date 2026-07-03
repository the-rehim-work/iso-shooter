import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';

// Soldier.glb (three.js examples, Mixamo "vanguard" rig): 1.83m tall, feet at
// y=0, faces -Z, clips Idle / Walk / Run / TPose.

let template: GLTF | null = null;

export async function preloadSoldier(): Promise<boolean> {
  if (template) return true;
  try {
    template = await new GLTFLoader().loadAsync('/models/Soldier.glb');
    return true;
  } catch (err) {
    console.warn('[gltf] Soldier.glb unavailable, using procedural characters', err);
    return false;
  }
}

export function soldierReady(): boolean {
  return template !== null;
}

// same silhouette table as the procedural CharacterModel guns
const GUN_PROFILES: Record<number, { bodyZ: number; barrelLen: number; barrelZ: number; scale: number; color: number }> = {
  0: { bodyZ: 0.6, barrelLen: 0.5, barrelZ: 0.85, scale: 0.78, color: 0x444444 },
  1: { bodyZ: 0.9, barrelLen: 0.7, barrelZ: 1.0, scale: 0.9, color: 0x35506a },
  2: { bodyZ: 1.0, barrelLen: 1.0, barrelZ: 1.05, scale: 1.0, color: 0x3a3a3a },
  3: { bodyZ: 1.1, barrelLen: 0.55, barrelZ: 0.78, scale: 1.15, color: 0x5a3a22 },
  4: { bodyZ: 1.25, barrelLen: 1.7, barrelZ: 1.35, scale: 1.05, color: 0x25402a },
  5: { bodyZ: 1.2, barrelLen: 1.2, barrelZ: 1.1, scale: 1.15, color: 0x2a2a2a },
  6: { bodyZ: 1.15, barrelLen: 1.5, barrelZ: 1.25, scale: 1.0, color: 0x4a4030 },
  7: { bodyZ: 0.35, barrelLen: 1.4, barrelZ: 0.55, scale: 0.45, color: 0xbfc6cf },
  8: { bodyZ: 0.55, barrelLen: 0.8, barrelZ: 0.9, scale: 0.85, color: 0x5a5a60 },
  9: { bodyZ: 0.95, barrelLen: 0.9, barrelZ: 1.0, scale: 0.95, color: 0x3f4a3a },
  10: { bodyZ: 0.55, barrelLen: 0.45, barrelZ: 0.8, scale: 0.75, color: 0x30343c },
};

class GunRig {
  readonly pivot = new THREE.Group();
  private body: THREE.Mesh;
  private barrel: THREE.Mesh;
  private bodyMat: THREE.MeshStandardMaterial;

  constructor() {
    this.bodyMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.35, metalness: 0.55 });
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0x282828, roughness: 0.25, metalness: 0.8 });
    this.body = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1, 0.42), this.bodyMat);
    this.body.castShadow = true;
    this.barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.3, 8), barrelMat);
    this.barrel.rotation.x = Math.PI / 2;
    this.barrel.castShadow = true;
    this.pivot.add(this.body);
    this.pivot.add(this.barrel);
    this.setWeapon(2);
  }

  setWeapon(weaponId: number): void {
    const p = GUN_PROFILES[weaponId] ?? GUN_PROFILES[2]!;
    this.body.scale.set(p.scale, p.scale, p.bodyZ);
    this.body.position.z = 0.1 * p.bodyZ;
    this.barrel.scale.set(p.scale, p.barrelLen, p.scale);
    this.barrel.position.z = 0.31 * p.barrelZ;
    this.bodyMat.color.setHex(weaponId === 7 ? 0x2a2320 : p.color);
  }

  dispose(): void {
    this.bodyMat.dispose();
    (this.barrel.material as THREE.Material).dispose();
  }
}

export class SoldierModel {
  readonly root: THREE.Group;
  readonly bodyMat: THREE.MeshStandardMaterial;

  private mixer: THREE.AnimationMixer;
  private idle: THREE.AnimationAction;
  private walk: THREE.AnimationAction;
  private run: THREE.AnimationAction;
  private gun: GunRig;
  private materials: THREE.Material[] = [];

  private recoil = 0;
  private hitTime = 0;
  private reloadTime = 0;
  private reloadDur = 1;
  private deadProgress = 0;
  private dying = false;
  private deathRoll = 1;

  constructor(bodyColor: number) {
    const src = template!;
    this.root = new THREE.Group();
    const inner = new THREE.Group();
    inner.rotation.y = Math.PI; // model faces -Z; game convention is +Z forward
    this.root.add(inner);

    const model = skeletonClone(src.scene);
    let body: THREE.MeshStandardMaterial | null = null;
    model.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
        const mat = (obj.material as THREE.MeshStandardMaterial).clone();
        obj.material = mat;
        this.materials.push(mat);
        if (mat.name === 'VanguardBodyMat' || !body) body = mat;
      }
    });
    this.bodyMat = body ?? new THREE.MeshStandardMaterial();
    this.setBodyColor(bodyColor);
    inner.add(model);

    this.mixer = new THREE.AnimationMixer(model);
    const clip = (name: string): THREE.AnimationClip =>
      THREE.AnimationClip.findByName(src.animations, name) ?? src.animations[0]!;
    this.idle = this.mixer.clipAction(clip('Idle'));
    this.walk = this.mixer.clipAction(clip('Walk'));
    this.run = this.mixer.clipAction(clip('Run'));
    for (const a of [this.idle, this.walk, this.run]) { a.play(); a.setEffectiveWeight(0); }
    this.idle.setEffectiveWeight(1);
    this.mixer.update(Math.random()); // desync instances

    // Fixed chest mount (the clips are unarmed — a bone mount would swing with
    // the arms). Matches CharacterModel.muzzleWorldPos used for muzzle flashes.
    this.gun = new GunRig();
    this.gun.pivot.position.set(0.24, 1.12, 0.16);
    this.root.add(this.gun.pivot);
  }

  setBodyColor(color: number): void {
    this.bodyMat.color.set(0xffffff).lerp(new THREE.Color(color), 0.7);
  }

  setWeapon(weaponId: number): void {
    this.gun.setWeapon(weaponId);
  }

  triggerShoot(): void { this.recoil = 1; }
  triggerHit(): void { this.hitTime = 0.3; }
  triggerReload(durationSec: number): void { this.reloadTime = Math.max(0.3, durationSec); this.reloadDur = this.reloadTime; }

  triggerDeath(): void {
    if (!this.dying) { this.dying = true; this.deadProgress = 0; this.deathRoll = Math.random() < 0.5 ? 1 : -1; }
  }

  get isDying(): boolean { return this.dying; }
  get isFullyDead(): boolean { return this.dying && this.deadProgress >= 1; }

  respawn(): void {
    this.dying = false;
    this.deadProgress = 0;
    this.recoil = 0;
    this.hitTime = 0;
    this.reloadTime = 0;
    this.root.rotation.set(0, this.root.rotation.y, 0);
    this.root.position.y = 0;
    this.idle.setEffectiveWeight(1);
    this.walk.setEffectiveWeight(0);
    this.run.setEffectiveWeight(0);
  }

  update(dt: number, speed: number, airborne = false): void {
    if (this.dying) {
      this.deadProgress = Math.min(1, this.deadProgress + dt * 2.2);
      const p = 1 - (1 - this.deadProgress) * (1 - this.deadProgress);
      this.root.rotation.x = p * Math.PI * 0.5;
      this.root.rotation.z = this.deathRoll * p * 0.45;
      this.root.position.y = -Math.sin(p * Math.PI * 0.5) * 0.45;
      return;
    }
    // slight backward lean mid-air reads as a jump (the rig has no jump clip)
    this.root.rotation.x = airborne ? -0.14 : 0;
    this.root.rotation.z = 0;
    this.root.position.y = 0;

    const moveW = airborne ? 0 : Math.min(1, Math.max(0, speed / 1.6));
    const runW = Math.min(1, Math.max(0, (speed - 3.2) / 2.6));
    const targets: [THREE.AnimationAction, number][] = [
      [this.idle, 1 - moveW],
      [this.walk, moveW * (1 - runW)],
      [this.run, moveW * runW],
    ];
    const blend = 1 - Math.exp(-dt * 11);
    for (const [action, target] of targets) {
      action.setEffectiveWeight(action.getEffectiveWeight() + (target - action.getEffectiveWeight()) * blend);
    }
    const paceScale = Math.min(1.7, Math.max(0.85, speed / 4.2));
    this.walk.setEffectiveTimeScale(paceScale);
    this.run.setEffectiveTimeScale(paceScale);
    this.mixer.update(dt);

    this.recoil = Math.max(0, this.recoil - dt * 9);
    this.gun.pivot.position.z = 0.16 - this.recoil * 0.1;

    if (this.reloadTime > 0) {
      this.reloadTime -= dt;
      const p = 1 - Math.max(0, this.reloadTime) / this.reloadDur;
      this.gun.pivot.rotation.z = Math.sin(p * Math.PI) * 0.3;
    } else {
      this.gun.pivot.rotation.z = 0;
    }

    if (this.hitTime > 0) {
      this.hitTime -= dt;
      const s = this.hitTime / 0.3;
      this.root.position.y = Math.abs(Math.sin(s * 14)) * 0.008;
    }
  }

  dispose(): void {
    // geometry is shared with the template — dispose only per-instance materials
    for (const m of this.materials) m.dispose();
    this.gun.dispose();
  }
}
