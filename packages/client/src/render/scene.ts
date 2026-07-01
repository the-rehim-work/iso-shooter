import * as THREE from 'three';
import { ARENA_HALF_X, ARENA_HALF_Z, type GameMap } from '@iso/shared';
import { groundTexture, concreteTexture, metalTexture } from './textures.js';

const COVER_HEIGHT = 1.6;
const DOOR_HEIGHT = 1.8;

export class DoorView {
  readonly mesh: THREE.Mesh;
  private closedPos: THREE.Vector3;
  private openOffset: THREE.Vector3;
  private openAmount = 0;
  target = 0;

  constructor(scene: THREE.Scene, x: number, z: number, halfW: number, halfD: number, axis: 'x' | 'z') {
    const mat = new THREE.MeshStandardMaterial({ map: metalTexture('#8a5a2b'), roughness: 0.5, metalness: 0.35, emissive: 0x140a00 });
    this.mesh = new THREE.Mesh(new THREE.BoxGeometry(halfW * 2, DOOR_HEIGHT, halfD * 2), mat);
    this.mesh.position.set(x, DOOR_HEIGHT / 2, z);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    scene.add(this.mesh);
    this.closedPos = this.mesh.position.clone();
    this.openOffset = axis === 'x' ? new THREE.Vector3(halfW * 1.92, 0, 0) : new THREE.Vector3(0, 0, halfD * 1.92);
  }

  update(dt: number): void {
    this.openAmount += (this.target - this.openAmount) * Math.min(1, dt * 9);
    this.mesh.position.copy(this.closedPos).addScaledVector(this.openOffset, this.openAmount);
  }
}

export interface SceneBundle {
  scene: THREE.Scene;
  doors: DoorView[];
  pointFills: THREE.Mesh[];
  pointRings: THREE.Mesh[];
  controlGroup: THREE.Group;
  bombGroup: THREE.Group;
}

const TEAM_COLORS: Record<number, number> = { 0: 0x888888, 1: 0x4a90d9, 2: 0xe05555 };

export function createScene(map: GameMap): SceneBundle {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x15171c);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(ARENA_HALF_X * 2, ARENA_HALF_Z * 2),
    new THREE.MeshStandardMaterial({ map: groundTexture(ARENA_HALF_X), roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const perimeterMat = new THREE.MeshStandardMaterial({ map: concreteTexture('#3a3f4b'), roughness: 0.9 });
  const wallH = 2.4;
  const wt = 0.6;
  const walls: [number, number, number, number][] = [
    [0, ARENA_HALF_Z + wt / 2, ARENA_HALF_X + wt, wt],
    [0, -(ARENA_HALF_Z + wt / 2), ARENA_HALF_X + wt, wt],
    [ARENA_HALF_X + wt / 2, 0, wt, ARENA_HALF_Z],
    [-(ARENA_HALF_X + wt / 2), 0, wt, ARENA_HALF_Z],
  ];
  for (const [x, z, hw, hd] of walls) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(hw * 2, wallH, hd * 2), perimeterMat);
    m.position.set(x, wallH / 2, z);
    m.castShadow = true; m.receiveShadow = true;
    scene.add(m);
  }

  const coverMat = new THREE.MeshStandardMaterial({ map: concreteTexture('#4a5568'), roughness: 0.85 });
  const crateMat = new THREE.MeshStandardMaterial({ map: metalTexture('#5a4a34'), roughness: 0.7, metalness: 0.2 });
  for (const c of map.cover) {
    const isCrate = Math.abs(c.halfW - c.halfD) < 0.5 && c.halfW < 1.5;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(c.halfW * 2, COVER_HEIGHT, c.halfD * 2), isCrate ? crateMat : coverMat);
    mesh.position.set(c.x, COVER_HEIGHT / 2, c.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
  }

  const doors: DoorView[] = [];
  for (const d of map.doors) doors.push(new DoorView(scene, d.x, d.z, d.halfW, d.halfD, d.axis));

  const pointFills: THREE.Mesh[] = [];
  const pointRings: THREE.Mesh[] = [];
  const controlGroup = new THREE.Group();
  controlGroup.visible = false;
  scene.add(controlGroup);
  for (const pt of map.controlPoints) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(pt.radius - 0.25, pt.radius, 40),
      new THREE.MeshBasicMaterial({ color: 0x888888, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(pt.x, 0.03, pt.z);
    controlGroup.add(ring);
    pointRings.push(ring);

    const fill = new THREE.Mesh(
      new THREE.CylinderGeometry(pt.radius, pt.radius, 0.04, 40),
      new THREE.MeshBasicMaterial({ color: 0x888888, transparent: true, opacity: 0.12 }),
    );
    fill.position.set(pt.x, 0.02, pt.z);
    controlGroup.add(fill);
    pointFills.push(fill);

    controlGroup.add(makeLabelSprite(pt.label, pt.x, pt.z));
  }

  const bombGroup = new THREE.Group();
  bombGroup.visible = false;
  scene.add(bombGroup);
  for (const s of map.bombSites) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(s.radius - 0.3, s.radius, 40),
      new THREE.MeshBasicMaterial({ color: 0xff8800, side: THREE.DoubleSide, transparent: true, opacity: 0.85 }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(s.x, 0.03, s.z);
    bombGroup.add(ring);
    bombGroup.add(makeLabelSprite('SITE ' + s.label, s.x, s.z));
  }

  const hemi = new THREE.HemisphereLight(0xddeeff, 0x202830, 0.7);
  scene.add(hemi);

  const dir = new THREE.DirectionalLight(0xfff4e0, 1.2);
  dir.position.set(20, 40, 10);
  dir.castShadow = true;
  dir.shadow.mapSize.set(2048, 2048);
  dir.shadow.camera.near = 0.5;
  dir.shadow.camera.far = 180;
  dir.shadow.camera.left = -50;
  dir.shadow.camera.right = 50;
  dir.shadow.camera.top = 50;
  dir.shadow.camera.bottom = -50;
  dir.shadow.bias = -0.001;
  scene.add(dir);

  return { scene, doors, pointFills, pointRings, controlGroup, bombGroup };
}

export function teamColor(team: number): number {
  return TEAM_COLORS[team] ?? 0x888888;
}

function makeLabelSprite(text: string, x: number, z: number): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = 'bold 34px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 64, 32);
  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.position.set(x, 2.6, z);
  sprite.scale.set(3, 1.5, 1);
  return sprite;
}
