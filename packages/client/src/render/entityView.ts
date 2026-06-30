import * as THREE from 'three';
import { CharacterModel } from './characterModel.js';

export class EntityView {
  readonly mesh: THREE.Group;
  private character: CharacterModel;
  private hitFlashUntilMs = 0;
  private wasDead = false;

  constructor(scene: THREE.Scene, color: number) {
    this.character = new CharacterModel(color);
    this.mesh = this.character.root;
    scene.add(this.mesh);
  }

  setState(x: number, z: number, yaw: number): void {
    this.mesh.position.set(x, 0, z);
    this.mesh.rotation.y = yaw;
  }

  setVisible(visible: boolean): void {
    if (!this.character.isDying) this.mesh.visible = visible;
  }

  hitFlash(): void {
    this.hitFlashUntilMs = performance.now() + 140;
    this.character.triggerHit();
  }

  triggerShoot(): void {
    this.character.triggerShoot();
  }

  triggerDeath(): void {
    this.mesh.visible = true;
    this.character.triggerDeath();
    this.wasDead = true;
  }

  respawn(): void {
    this.character.respawn();
    this.mesh.visible = true;
    this.wasDead = false;
  }

  get isDead(): boolean { return this.wasDead; }

  tick(nowMs: number, dt: number, speed: number): void {
    this.character.update(dt, speed);

    if (nowMs < this.hitFlashUntilMs) {
      this.character.bodyMat.emissive.setRGB(0.9, 0.1, 0.05);
      this.character.bodyMat.emissiveIntensity = 0.7;
    } else {
      this.character.bodyMat.emissiveIntensity = 0;
    }

    if (this.character.isFullyDead) {
      this.mesh.visible = false;
    }
  }

  dispose(scene: THREE.Scene): void {
    scene.remove(this.mesh);
    this.character.dispose();
  }
}
