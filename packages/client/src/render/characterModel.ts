import * as THREE from 'three';

function mkMesh(geo: THREE.BufferGeometry, mat: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

const HIP_Y = 0.78;
const TORSO_H = 0.62;
const TORSO_CENTER_Y = HIP_Y + TORSO_H / 2;
const SHOULDER_LOCAL_Y = TORSO_H / 2 - 0.04;
const HEAD_LOCAL_Y = TORSO_H / 2 + 0.19;
const RIGHT_HOLD = -1.15;
const LEFT_HOLD = -1.0;
const LEFT_HOLD_Z = 0.42;

export class CharacterModel {
  readonly root: THREE.Group;
  readonly bodyMat: THREE.MeshStandardMaterial;

  private torsoGrp: THREE.Group;
  private headGrp: THREE.Group;
  private lArm: THREE.Group;
  private rArm: THREE.Group;
  private lLeg: THREE.Group;
  private rLeg: THREE.Group;
  private gunPivot: THREE.Group;
  private gunBody: THREE.Mesh;
  private barrel: THREE.Mesh;
  private gunMag: THREE.Mesh;
  private blade: THREE.Mesh;
  private scope: THREE.Group;
  private drum: THREE.Mesh;
  private weaponId = 2;

  private walkPhase = 0;
  private recoil = 0;
  private swingTime = 0;
  private hitTime = 0;
  private reloadTime = 0;
  private reloadDur = 1;
  private deadProgress = 0;
  private dying = false;
  private deathRoll = 1;

  setBodyColor(color: number): void {
    this.bodyMat.color.setHex(color);
  }

  constructor(bodyColor: number) {
    this.root = new THREE.Group();

    const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.85 });
    this.bodyMat = bodyMat;
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xffcc99, roughness: 0.9 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x2c3138, roughness: 0.9 });
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x22262c, roughness: 0.6 });
    const gunMat = new THREE.MeshStandardMaterial({ color: 0x383838, roughness: 0.35, metalness: 0.55 });
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0x282828, roughness: 0.25, metalness: 0.8 });

    const legGeo = new THREE.BoxGeometry(0.19, HIP_Y, 0.22);
    this.lLeg = new THREE.Group();
    this.lLeg.position.set(0.115, HIP_Y, 0);
    const lLegM = mkMesh(legGeo, pantsMat);
    lLegM.position.y = -HIP_Y / 2;
    this.lLeg.add(lLegM);

    this.rLeg = new THREE.Group();
    this.rLeg.position.set(-0.115, HIP_Y, 0);
    const rLegM = mkMesh(legGeo, pantsMat);
    rLegM.position.y = -HIP_Y / 2;
    this.rLeg.add(rLegM);

    this.torsoGrp = new THREE.Group();
    this.torsoGrp.position.set(0, TORSO_CENTER_Y, 0);
    const torsoM = mkMesh(new THREE.BoxGeometry(0.46, TORSO_H, 0.26), bodyMat);
    this.torsoGrp.add(torsoM);

    this.headGrp = new THREE.Group();
    this.headGrp.position.set(0, HEAD_LOCAL_Y, 0);
    const headM = mkMesh(new THREE.BoxGeometry(0.38, 0.38, 0.38), skinMat);
    this.headGrp.add(headM);
    const lEye = mkMesh(new THREE.BoxGeometry(0.07, 0.07, 0.02), eyeMat);
    lEye.position.set(0.09, 0.03, 0.19);
    this.headGrp.add(lEye);
    const rEye = mkMesh(new THREE.BoxGeometry(0.07, 0.07, 0.02), eyeMat);
    rEye.position.set(-0.09, 0.03, 0.19);
    this.headGrp.add(rEye);
    this.torsoGrp.add(this.headGrp);

    const armGeo = new THREE.BoxGeometry(0.15, 0.62, 0.17);
    this.lArm = new THREE.Group();
    this.lArm.position.set(0.305, SHOULDER_LOCAL_Y, 0);
    this.lArm.rotation.x = LEFT_HOLD;
    this.lArm.rotation.z = LEFT_HOLD_Z;
    const lArmM = mkMesh(armGeo, bodyMat);
    lArmM.position.y = -0.27;
    this.lArm.add(lArmM);
    this.torsoGrp.add(this.lArm);

    this.rArm = new THREE.Group();
    this.rArm.position.set(-0.305, SHOULDER_LOCAL_Y, 0);
    this.rArm.rotation.x = RIGHT_HOLD;
    const rArmM = mkMesh(armGeo, bodyMat);
    rArmM.position.y = -0.27;
    this.rArm.add(rArmM);

    this.gunPivot = new THREE.Group();
    this.gunPivot.position.set(0, -0.54, 0.06);
    this.gunPivot.rotation.x = -RIGHT_HOLD;

    const gunBody = mkMesh(new THREE.BoxGeometry(0.068, 0.088, 0.36), gunMat);
    this.gunPivot.add(gunBody);
    this.gunBody = gunBody;

    const barrel = mkMesh(new THREE.CylinderGeometry(0.02, 0.018, 0.26, 6), barrelMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.014, 0.31);
    this.gunPivot.add(barrel);
    this.barrel = barrel;

    const mag = mkMesh(new THREE.BoxGeometry(0.048, 0.12, 0.062), gunMat);
    mag.position.set(0, -0.097, 0.04);
    this.gunPivot.add(mag);
    this.gunMag = mag;

    const stock = mkMesh(new THREE.BoxGeometry(0.052, 0.068, 0.15), gunMat);
    stock.position.set(0, 0.008, -0.24);
    this.gunPivot.add(stock);

    const bladeMat = new THREE.MeshStandardMaterial({ color: 0xe4ecf4, roughness: 0.15, metalness: 0.9, emissive: 0x222933 });
    this.blade = mkMesh(new THREE.BoxGeometry(0.04, 0.13, 0.66), bladeMat);
    this.blade.position.set(0, 0.03, 0.5);
    this.blade.visible = false;
    this.gunPivot.add(this.blade);

    const scopeMat = new THREE.MeshStandardMaterial({ color: 0x1a1d22, roughness: 0.3, metalness: 0.6 });
    this.scope = new THREE.Group();
    const scopeTube = mkMesh(new THREE.CylinderGeometry(0.032, 0.032, 0.2, 10), scopeMat);
    scopeTube.rotation.x = Math.PI / 2;
    scopeTube.position.set(0, 0.085, 0.05);
    const scopeLens = mkMesh(new THREE.CylinderGeometry(0.028, 0.028, 0.02, 10), new THREE.MeshStandardMaterial({ color: 0x66bbff, roughness: 0.05, metalness: 0.9, emissive: 0x113355 }));
    scopeLens.rotation.x = Math.PI / 2;
    scopeLens.position.set(0, 0.085, 0.16);
    this.scope.add(scopeTube);
    this.scope.add(scopeLens);
    this.scope.visible = false;
    this.gunPivot.add(this.scope);

    this.drum = mkMesh(new THREE.CylinderGeometry(0.11, 0.11, 0.07, 14), gunMat);
    this.drum.rotation.x = Math.PI / 2;
    this.drum.position.set(0, -0.13, 0.02);
    this.drum.visible = false;
    this.gunPivot.add(this.drum);

    this.rArm.add(this.gunPivot);
    this.torsoGrp.add(this.rArm);

    this.root.add(this.lLeg);
    this.root.add(this.rLeg);
    this.root.add(this.torsoGrp);
  }

  static muzzleWorldPos(charX: number, charZ: number, yaw: number): THREE.Vector3 {
    return new THREE.Vector3(charX + Math.sin(yaw) * 0.46, 1.08, charZ + Math.cos(yaw) * 0.46);
  }

  setWeapon(weaponId: number): void {
    if (weaponId === this.weaponId) return;
    this.weaponId = weaponId;
    const profiles: Record<number, { bodyZ: number; barrelLen: number; barrelZ: number; mag: number; scale: number; color: number }> = {
      0: { bodyZ: 0.6, barrelLen: 0.5, barrelZ: 0.85, mag: 0.7, scale: 0.78, color: 0x444444 },
      1: { bodyZ: 0.9, barrelLen: 0.7, barrelZ: 1.0, mag: 1.4, scale: 0.9, color: 0x35506a },
      2: { bodyZ: 1.0, barrelLen: 1.0, barrelZ: 1.05, mag: 1.0, scale: 1.0, color: 0x3a3a3a },
      3: { bodyZ: 1.1, barrelLen: 0.55, barrelZ: 0.78, mag: 0.6, scale: 1.15, color: 0x5a3a22 },
      4: { bodyZ: 1.25, barrelLen: 1.7, barrelZ: 1.35, mag: 0.55, scale: 1.05, color: 0x25402a },
      5: { bodyZ: 1.2, barrelLen: 1.2, barrelZ: 1.1, mag: 1.6, scale: 1.15, color: 0x2a2a2a },
      6: { bodyZ: 1.15, barrelLen: 1.5, barrelZ: 1.25, mag: 0.9, scale: 1.0, color: 0x4a4030 },
      7: { bodyZ: 0.35, barrelLen: 1.4, barrelZ: 0.55, mag: 0.2, scale: 0.45, color: 0xbfc6cf },
      8: { bodyZ: 0.55, barrelLen: 0.8, barrelZ: 0.9, mag: 0.4, scale: 0.85, color: 0x5a5a60 },
      9: { bodyZ: 0.95, barrelLen: 0.9, barrelZ: 1.0, mag: 0.9, scale: 0.95, color: 0x3f4a3a },
      10: { bodyZ: 0.55, barrelLen: 0.45, barrelZ: 0.8, mag: 1.2, scale: 0.75, color: 0x30343c },
    };
    const p = profiles[weaponId] ?? profiles[2]!;
    const isKnife = weaponId === 7;
    this.blade.visible = isKnife;
    this.barrel.visible = !isKnife;
    this.scope.visible = weaponId === 4 || weaponId === 6;
    this.drum.visible = weaponId === 5;
    this.gunMag.visible = !isKnife && weaponId !== 5;
    this.gunBody.scale.set(p.scale, p.scale, p.bodyZ);
    this.barrel.scale.set(p.scale, p.barrelLen, p.scale);
    this.barrel.position.z = 0.31 * p.barrelZ;
    this.gunMag.scale.set(1, p.mag, 1);
    (this.gunBody.material as THREE.MeshStandardMaterial).color.setHex(isKnife ? 0x2a2320 : p.color);
  }

  triggerShoot(): void {
    if (this.weaponId === 7) this.swingTime = 0.42;
    else this.recoil = 1;
  }
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
    this.walkPhase = 0;
    this.root.rotation.set(0, this.root.rotation.y, 0);
    this.root.position.y = 0;
    this.torsoGrp.position.set(0, TORSO_CENTER_Y, 0);
    this.torsoGrp.rotation.set(0, 0, 0);
    this.headGrp.position.set(0, HEAD_LOCAL_Y, 0);
    this.headGrp.rotation.set(0, 0, 0);
    this.lArm.rotation.set(LEFT_HOLD, 0, LEFT_HOLD_Z);
    this.rArm.rotation.set(RIGHT_HOLD, 0, 0);
    this.lLeg.rotation.x = 0;
    this.rLeg.rotation.x = 0;
    this.gunPivot.rotation.set(-RIGHT_HOLD, 0, 0);
  }

  update(dt: number, speed: number, airborne = false): void {
    if (this.dying) {
      this.deadProgress = Math.min(1, this.deadProgress + dt * 2.4);
      const p = 1 - (1 - this.deadProgress) * (1 - this.deadProgress);
      this.root.rotation.x = p * Math.PI * 0.5;
      this.root.rotation.z = this.deathRoll * p * 0.35;
      this.root.position.y = -Math.sin(p * Math.PI * 0.5) * 0.55;
      this.lArm.rotation.x = LEFT_HOLD + p * 1.4;
      this.rArm.rotation.x = RIGHT_HOLD + p * 1.4;
      this.lLeg.rotation.x = 0;
      this.rLeg.rotation.x = 0;
      this.headGrp.rotation.x = p * 0.4;
      return;
    }
    this.root.rotation.x = 0;
    this.root.rotation.z = 0;
    this.root.position.y = 0;

    if (airborne) {
      this.lLeg.rotation.x = -0.55;
      this.rLeg.rotation.x = 0.4;
      this.torsoGrp.position.y = TORSO_CENTER_Y;
      this.torsoGrp.rotation.z = 0;
    } else {
      const moving = speed > 0.08;
      if (moving) this.walkPhase += dt * Math.max(speed, 0.8) * 2.6;

      const sw = moving ? Math.sin(this.walkPhase) * 0.72 : 0;
      this.lLeg.rotation.x = sw;
      this.rLeg.rotation.x = -sw;

      const bob = moving ? Math.abs(Math.sin(this.walkPhase)) * 0.045 : 0;
      this.torsoGrp.position.y = TORSO_CENTER_Y + bob;
      this.torsoGrp.rotation.z = moving ? Math.sin(this.walkPhase) * 0.045 : 0;
    }

    this.recoil = Math.max(0, this.recoil - dt * 9);
    this.rArm.rotation.x = RIGHT_HOLD + this.recoil * 0.3;
    this.gunPivot.position.z = 0.06 - this.recoil * 0.08;
    this.lArm.rotation.x = LEFT_HOLD + this.recoil * 0.18;

    if (this.swingTime > 0) {
      this.swingTime = Math.max(0, this.swingTime - dt);
      const p = 1 - this.swingTime / 0.42;
      let arm: number;
      if (p < 0.3) arm = RIGHT_HOLD - (p / 0.3) * 0.9;
      else if (p < 0.7) arm = RIGHT_HOLD - 0.9 + ((p - 0.3) / 0.4) * 1.6;
      else arm = RIGHT_HOLD + 0.7 - ((p - 0.7) / 0.3) * 0.7;
      this.rArm.rotation.x = arm;
    }

    if (this.reloadTime > 0) {
      this.reloadTime -= dt;
      const p = 1 - Math.max(0, this.reloadTime) / this.reloadDur;
      const tilt = Math.sin(p * Math.PI);
      this.lArm.rotation.x = LEFT_HOLD + tilt * 0.85;
      const magOut = Math.sin(Math.min(1, p * 1.6) * Math.PI);
      this.gunMag.position.y = -0.097 - magOut * 0.16;
      this.gunPivot.rotation.z = tilt * 0.3;
    } else {
      this.gunMag.position.y = -0.097;
      this.gunPivot.rotation.z = 0;
    }

    if (this.hitTime > 0) {
      this.hitTime -= dt;
      const s = this.hitTime / 0.3;
      const r = Math.random() - 0.5;
      this.torsoGrp.rotation.x = -0.22 * s;
      this.torsoGrp.position.x = r * 0.06 * s;
      this.headGrp.position.x = r * 0.09 * s;
    } else {
      this.torsoGrp.rotation.x = 0;
      this.torsoGrp.position.x = 0;
      this.headGrp.position.x = 0;
    }
  }

  dispose(): void {
    this.root.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        if (Array.isArray(obj.material)) {
          for (const m of obj.material) m.dispose();
        } else {
          obj.material.dispose();
        }
      }
    });
  }
}
