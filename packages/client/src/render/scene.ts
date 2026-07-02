import * as THREE from 'three';
import { ARENA_HALF_X, ARENA_HALF_Z, WALL_HEIGHT, type GameMap, type ThemedCover } from '@iso/shared';
import {
  groundTexture, concreteTexture, metalTexture, carpetTexture, woodTexture,
  plasterTexture, fabricTexture, serverRackTexture, whiteboardWallTexture,
} from './textures.js';

export class DoorView {
  readonly mesh: THREE.Mesh;
  private closedPos: THREE.Vector3;
  private openOffset: THREE.Vector3;
  private openAmount = 0;
  target = 0;

  constructor(scene: THREE.Scene, x: number, z: number, halfW: number, halfD: number, halfH: number, axis: 'x' | 'z', material?: THREE.Material) {
    const mat = material ?? new THREE.MeshStandardMaterial({ map: metalTexture('#8a5a2b'), roughness: 0.5, metalness: 0.35, emissive: 0x140a00 });
    this.mesh = new THREE.Mesh(new THREE.BoxGeometry(halfW * 2, halfH * 2, halfD * 2), mat);
    this.mesh.position.set(x, halfH, z);
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

interface ThemeMats {
  ground: THREE.Material;
  perimeter: THREE.Material;
  wall: THREE.Material;
  crate: THREE.Material;
  desk: THREE.Material;
  deskPanel: THREE.Material;
  cabinet: THREE.Material;
  partition: THREE.Material;
  partitionTrim: THREE.Material;
  table: THREE.Material;
  sofa: THREE.Material;
  server: THREE.Material;
  pot: THREE.Material;
  foliage: THREE.Material;
  screen: THREE.Material;
}

function themeMaterials(theme: GameMap['theme']): ThemeMats {
  const office = theme === 'office';
  return {
    ground: office
      ? new THREE.MeshStandardMaterial({ map: carpetTexture(ARENA_HALF_X / 2), roughness: 1 })
      : new THREE.MeshStandardMaterial({ map: groundTexture(ARENA_HALF_X), roughness: 1 }),
    perimeter: office
      ? new THREE.MeshStandardMaterial({ map: plasterTexture('#b8bcc4'), roughness: 0.9 })
      : new THREE.MeshStandardMaterial({ map: concreteTexture('#3a3f4b'), roughness: 0.9 }),
    wall: office
      ? new THREE.MeshStandardMaterial({ map: whiteboardWallTexture(), roughness: 0.7 })
      : new THREE.MeshStandardMaterial({ map: concreteTexture('#4a5568'), roughness: 0.85 }),
    crate: new THREE.MeshStandardMaterial({ map: metalTexture('#5a4a34'), roughness: 0.7, metalness: 0.2 }),
    desk: new THREE.MeshStandardMaterial({ map: woodTexture('#8a6238'), roughness: 0.55 }),
    deskPanel: new THREE.MeshStandardMaterial({ color: 0x3a4048, roughness: 0.85 }),
    cabinet: new THREE.MeshStandardMaterial({ map: metalTexture('#6a7078'), roughness: 0.5, metalness: 0.4 }),
    partition: new THREE.MeshStandardMaterial({ map: fabricTexture('#5f6f8f'), roughness: 0.95 }),
    partitionTrim: new THREE.MeshStandardMaterial({ color: 0x9aa2ad, roughness: 0.4, metalness: 0.5 }),
    table: new THREE.MeshStandardMaterial({ map: woodTexture('#5f4426'), roughness: 0.45 }),
    sofa: new THREE.MeshStandardMaterial({ map: fabricTexture('#7a4a4a'), roughness: 1 }),
    server: new THREE.MeshStandardMaterial({ map: serverRackTexture(), roughness: 0.4, metalness: 0.3, emissive: 0x0a1408, emissiveIntensity: 0.6 }),
    pot: new THREE.MeshStandardMaterial({ color: 0x4a3628, roughness: 0.9 }),
    foliage: new THREE.MeshStandardMaterial({ color: 0x3f7a3a, roughness: 1 }),
    screen: new THREE.MeshStandardMaterial({ color: 0x0c1016, roughness: 0.2, emissive: 0x1a3a55, emissiveIntensity: 0.9 }),
  };
}

function shadowed(mesh: THREE.Mesh): THREE.Mesh {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function box(hw: number, hh: number, hd: number, mat: THREE.Material): THREE.Mesh {
  return shadowed(new THREE.Mesh(new THREE.BoxGeometry(hw * 2, hh * 2, hd * 2), mat));
}

// Visual decoration per cover kind. The physics box is always c's exact bounds;
// decorations above c.halfH*2 are cosmetic only.
function buildCover(scene: THREE.Scene, c: ThemedCover, mats: ThemeMats): void {
  const kind = c.kind ?? 'wall';
  const grp = new THREE.Group();
  grp.position.set(c.x, 0, c.z);
  const h = c.halfH * 2;

  switch (kind) {
    case 'crate': {
      const m = box(c.halfW, c.halfH, c.halfD, mats.crate);
      m.position.y = c.halfH;
      grp.add(m);
      break;
    }
    case 'desk': {
      const top = box(c.halfW, 0.04, c.halfD, mats.desk);
      top.position.y = h - 0.04;
      grp.add(top);
      const panel = box(c.halfW * 0.9, c.halfH - 0.06, c.halfD * 0.55, mats.deskPanel);
      panel.position.y = c.halfH - 0.04;
      grp.add(panel);
      const screen = box(Math.min(0.5, c.halfW * 0.35), 0.18, 0.03, mats.screen);
      screen.position.set(c.halfW * 0.3, h + 0.2, 0);
      grp.add(screen);
      break;
    }
    case 'table': {
      const top = box(c.halfW, 0.05, c.halfD, mats.table);
      top.position.y = h - 0.05;
      grp.add(top);
      const base = box(c.halfW * 0.35, c.halfH - 0.08, c.halfD * 0.35, mats.deskPanel);
      base.position.y = c.halfH - 0.05;
      grp.add(base);
      break;
    }
    case 'cabinet': {
      const m = box(c.halfW, c.halfH, c.halfD, mats.cabinet);
      m.position.y = c.halfH;
      grp.add(m);
      break;
    }
    case 'partition': {
      const m = box(c.halfW, c.halfH, Math.max(0.06, c.halfD - 0.04), mats.partition);
      m.position.y = c.halfH;
      grp.add(m);
      const trim = box(c.halfW, 0.03, c.halfD, mats.partitionTrim);
      trim.position.y = h - 0.03;
      grp.add(trim);
      break;
    }
    case 'sofa': {
      const seat = box(c.halfW, c.halfH * 0.6, c.halfD, mats.sofa);
      seat.position.y = c.halfH * 0.6;
      grp.add(seat);
      const back = box(c.halfW, c.halfH, c.halfD * 0.3, mats.sofa);
      back.position.set(0, c.halfH, -c.halfD * 0.7);
      grp.add(back);
      break;
    }
    case 'planter': {
      const pot = box(c.halfW, c.halfH * 0.55, c.halfD, mats.pot);
      pot.position.y = c.halfH * 0.55;
      grp.add(pot);
      const bush = shadowed(new THREE.Mesh(new THREE.SphereGeometry(Math.max(c.halfW, c.halfD) * 1.15, 8, 6), mats.foliage));
      bush.position.y = h + 0.25;
      bush.scale.y = 1.25;
      grp.add(bush);
      break;
    }
    case 'server': {
      const m = box(c.halfW, c.halfH, c.halfD, mats.server);
      m.position.y = c.halfH;
      grp.add(m);
      break;
    }
    default: {
      const m = box(c.halfW, c.halfH, c.halfD, mats.wall);
      m.position.y = c.halfH;
      grp.add(m);
    }
  }
  scene.add(grp);
}

export function createScene(map: GameMap): SceneBundle {
  const scene = new THREE.Scene();
  const office = map.theme === 'office';
  scene.background = new THREE.Color(office ? 0x1a1d24 : 0x15171c);

  const mats = themeMaterials(map.theme);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(ARENA_HALF_X * 2, ARENA_HALF_Z * 2),
    mats.ground,
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const wallH = WALL_HEIGHT;
  const wt = 0.6;
  const walls: [number, number, number, number][] = [
    [0, ARENA_HALF_Z + wt / 2, ARENA_HALF_X + wt, wt],
    [0, -(ARENA_HALF_Z + wt / 2), ARENA_HALF_X + wt, wt],
    [ARENA_HALF_X + wt / 2, 0, wt, ARENA_HALF_Z],
    [-(ARENA_HALF_X + wt / 2), 0, wt, ARENA_HALF_Z],
  ];
  for (const [x, z, hw, hd] of walls) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(hw * 2, wallH, hd * 2), mats.perimeter);
    m.position.set(x, wallH / 2, z);
    m.castShadow = true; m.receiveShadow = true;
    scene.add(m);
    if (office) {
      // window band along the top of the outer walls
      const band = new THREE.Mesh(
        new THREE.BoxGeometry(hw * 2 * 0.96, wallH * 0.3, hd * 2 + 0.04),
        new THREE.MeshStandardMaterial({ color: 0x2a3c52, roughness: 0.1, metalness: 0.6, emissive: 0x24445f, emissiveIntensity: 0.5 }),
      );
      band.position.set(x, wallH * 0.72, z);
      scene.add(band);
    }
  }

  for (const c of map.cover) buildCover(scene, c, mats);

  const doors: DoorView[] = [];
  const doorMat = office
    ? new THREE.MeshStandardMaterial({ map: woodTexture('#9a7040'), roughness: 0.5 })
    : undefined;
  for (const d of map.doors) doors.push(new DoorView(scene, d.x, d.z, d.halfW, d.halfD, d.halfH, d.axis, doorMat));

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

  const hemi = new THREE.HemisphereLight(office ? 0xf2ecdd : 0xddeeff, office ? 0x2a2f38 : 0x202830, office ? 0.9 : 0.7);
  scene.add(hemi);

  const dir = new THREE.DirectionalLight(office ? 0xfff9ec : 0xfff4e0, office ? 1.0 : 1.2);
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
