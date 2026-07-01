import * as THREE from 'three';

function mkMesh(geo: THREE.BufferGeometry, mat: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

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
  private hitTime = 0;
  private reloadTime = 0;
  private reloadDur = 1;
  private deadProgress = 0;
  private dying = false;
  private deathRoll = 1;

  constructor(bodyColor: number) {
    this.root = new THREE.Group();

    const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.78 });
    this.bodyMat = bodyMat;
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xffcc99, roughness: 0.9 });
    const helmetMat = new THREE.MeshStandardMaterial({ color: 0x243040, roughness: 0.65 });
    const visorMat = new THREE.MeshStandardMaterial({ color: 0x55aaff, roughness: 0.05, metalness: 0.9 });
    const gunMat = new THREE.MeshStandardMaterial({ color: 0x383838, roughness: 0.35, metalness: 0.55 });
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0x282828, roughness: 0.25, metalness: 0.8 });

    // Legs
    const legGeo = new THREE.CylinderGeometry(0.1, 0.085, 0.86, 8);
    this.lLeg = new THREE.Group();
    this.lLeg.position.set(0.13, 0.88, 0);
    const lLegM = mkMesh(legGeo, bodyMat);
    lLegM.position.y = -0.43;
    this.lLeg.add(lLegM);

    this.rLeg = new THREE.Group();
    this.rLeg.position.set(-0.13, 0.88, 0);
    const rLegM = mkMesh(legGeo, bodyMat);
    rLegM.position.y = -0.43;
    this.rLeg.add(rLegM);

    // Torso
    this.torsoGrp = new THREE.Group();
    this.torsoGrp.position.set(0, 1.12, 0);
    const torsoM = mkMesh(new THREE.BoxGeometry(0.44, 0.48, 0.24), bodyMat);
    this.torsoGrp.add(torsoM);

    // Tactical vest detail
    const vestM = mkMesh(new THREE.BoxGeometry(0.3, 0.28, 0.26), new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.9 }));
    vestM.position.set(0, 0.04, 0.001);
    this.torsoGrp.add(vestM);

    // Head
    this.headGrp = new THREE.Group();
    this.headGrp.position.set(0, 0.33, 0);
    const headM = mkMesh(new THREE.SphereGeometry(0.185, 8, 6), skinMat);
    this.headGrp.add(headM);
    const helmetM = mkMesh(new THREE.SphereGeometry(0.205, 8, 4, 0, Math.PI * 2, 0, Math.PI * 0.54), helmetMat);
    helmetM.position.y = 0.02;
    this.headGrp.add(helmetM);
    const visorM = mkMesh(new THREE.BoxGeometry(0.19, 0.05, 0.035), visorMat);
    visorM.position.set(0, 0.01, 0.17);
    this.headGrp.add(visorM);
    this.torsoGrp.add(this.headGrp);

    // Arms
    const armGeo = new THREE.CylinderGeometry(0.07, 0.062, 0.46, 8);
    this.lArm = new THREE.Group();
    this.lArm.position.set(0.26, 0.14, 0.04);
    this.lArm.rotation.x = -0.2;
    const lArmM = mkMesh(armGeo, bodyMat);
    lArmM.position.y = -0.23;
    this.lArm.add(lArmM);
    this.torsoGrp.add(this.lArm);

    this.rArm = new THREE.Group();
    this.rArm.position.set(-0.26, 0.14, 0.04);
    this.rArm.rotation.x = -0.38;
    const rArmM = mkMesh(armGeo, bodyMat);
    rArmM.position.y = -0.23;
    this.rArm.add(rArmM);

    // Gun
    this.gunPivot = new THREE.Group();
    this.gunPivot.position.set(0.13, -0.1, 0.16);

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
    this.gunPivot.rotation.z = 0;
    this.walkPhase = 0;
    this.root.rotation.set(0, this.root.rotation.y, 0);
    this.root.position.y = 0;
    this.torsoGrp.position.y = 1.12;
    this.torsoGrp.position.x = 0;
    this.torsoGrp.rotation.x = 0;
    this.headGrp.position.x = 0;
    this.headGrp.rotation.x = 0;
    this.lLeg.rotation.x = 0;
    this.rLeg.rotation.x = 0;
  }

  update(dt: number, speed: number): void {
    if (this.dying) {
      this.deadProgress = Math.min(1, this.deadProgress + dt * 2.2);
      const p = 1 - (1 - this.deadProgress) * (1 - this.deadProgress);
      this.root.rotation.x = p * Math.PI * 0.5;
      this.root.rotation.z = this.deathRoll * p * 0.45;
      this.root.position.y = -Math.sin(p * Math.PI * 0.5) * 0.5;
      this.lArm.rotation.x = -0.2 + p * 1.0;
      this.rArm.rotation.x = -0.38 + p * 0.8;
      this.lLeg.rotation.x = p * 0.5;
      this.rLeg.rotation.x = -p * 0.35;
      this.headGrp.rotation.x = p * 0.55;
      this.torsoGrp.position.y = 1.12 - p * 0.2;
      return;
    }
    this.root.rotation.x = 0;
    this.root.rotation.z = 0;
    this.root.position.y = 0;

    const moving = speed > 0.08;
    if (moving) this.walkPhase += dt * Math.max(speed, 0.8) * 3.0;

    const sw = Math.sin(this.walkPhase) * (moving ? 0.3 : 0);
    this.lLeg.rotation.x = sw;
    this.rLeg.rotation.x = -sw;
    this.lArm.rotation.x = -0.2 - sw * 0.38;

    const bob = moving ? Math.abs(Math.sin(this.walkPhase)) * 0.032 : 0;
    this.torsoGrp.position.y = 1.12 + bob;

    this.recoil = Math.max(0, this.recoil - dt * 9);
    this.gunPivot.position.z = 0.16 - this.recoil * 0.1;
    this.rArm.rotation.x = -0.38 + this.recoil * 0.25;

    if (this.reloadTime > 0) {
      this.reloadTime -= dt;
      const p = 1 - Math.max(0, this.reloadTime) / this.reloadDur;
      const tilt = Math.sin(p * Math.PI);
      this.rArm.rotation.x = -0.38 - tilt * 0.55;
      this.lArm.rotation.x = -0.2 - tilt * 0.35;
      const magOut = Math.sin(Math.min(1, p * 1.6) * Math.PI);
      this.gunMag.position.y = -0.097 - magOut * 0.16;
      this.gunPivot.rotation.z = tilt * 0.25;
    } else {
      this.gunMag.position.y = -0.097;
      this.gunPivot.rotation.z = 0;
    }

    if (this.hitTime > 0) {
      this.hitTime -= dt;
      const s = this.hitTime / 0.3;
      const r = Math.random() - 0.5;
      this.torsoGrp.rotation.x = -0.28 * s;
      this.torsoGrp.position.x = r * 0.07 * s;
      this.headGrp.position.x = r * 0.1 * s;
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
