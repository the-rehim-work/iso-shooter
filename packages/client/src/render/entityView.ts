import * as THREE from 'three';
import { CharacterModel } from './characterModel.js';
import { SoldierModel, soldierReady } from './gltfCharacter.js';

export class EntityView {
  readonly mesh: THREE.Group;
  private character: CharacterModel | SoldierModel;
  private hitFlashUntilMs = 0;
  private wasDead = false;
  private nameTag: THREE.Sprite | null = null;
  private nameText = '';
  private nameColor = '#ffffff';
  private bodyColor: number;

  constructor(scene: THREE.Scene, color: number) {
    this.character = soldierReady() ? new SoldierModel(color) : new CharacterModel(color);
    this.bodyColor = color;
    this.mesh = this.character.root;
    scene.add(this.mesh);
  }

  setColor(color: number): void {
    if (color === this.bodyColor) return;
    this.bodyColor = color;
    this.character.setBodyColor(color);
  }

  setWeapon(weaponId: number): void {
    this.character.setWeapon(weaponId);
  }

  setLabel(text: string, color: string): void {
    if (text === this.nameText && color === this.nameColor && this.nameTag) return;
    this.nameText = text;
    this.nameColor = color;
    if (this.nameTag) {
      this.mesh.remove(this.nameTag);
      this.nameTag.material.map?.dispose();
      this.nameTag.material.dispose();
    }
    if (!text) { this.nameTag = null; return; }
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.font = 'bold 30px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.strokeText(text, 128, 34);
    ctx.fillStyle = color;
    ctx.fillText(text, 128, 34);
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    sprite.position.set(0, 2.5, 0);
    sprite.scale.set(2.6, 0.65, 1);
    this.mesh.add(sprite);
    this.nameTag = sprite;
  }

  setState(x: number, y: number, z: number, yaw: number): void {
    this.mesh.position.set(x, y, z);
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

  triggerReload(durationSec: number): void {
    this.character.triggerReload(durationSec);
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
    const airborne = this.mesh.position.y > 0.09;
    this.character.update(dt, speed, airborne);

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
    if (this.nameTag) {
      this.nameTag.material.map?.dispose();
      this.nameTag.material.dispose();
    }
    scene.remove(this.mesh);
    this.character.dispose();
  }
}
