import * as THREE from 'three';
import { ARENA_HALF_X, ARENA_HALF_Z, STATIC_COVER } from '@iso/shared';

const COVER_HEIGHT = 1.2;
const COVER_MATERIAL = new THREE.MeshStandardMaterial({ color: 0x4a5568, roughness: 0.8 });

export function createScene(): THREE.Scene {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x15171c);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(ARENA_HALF_X * 2, ARENA_HALF_Z * 2),
    new THREE.MeshStandardMaterial({ color: 0x23262e, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const grid = new THREE.GridHelper(ARENA_HALF_X * 2, ARENA_HALF_X * 2, 0x3a3f4b, 0x2c303a);
  scene.add(grid);

  for (const c of STATIC_COVER) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(c.halfW * 2, COVER_HEIGHT, c.halfD * 2),
      COVER_MATERIAL,
    );
    mesh.position.set(c.x, COVER_HEIGHT / 2, c.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
  }

  const hemi = new THREE.HemisphereLight(0xddeeff, 0x202830, 0.7);
  scene.add(hemi);

  const dir = new THREE.DirectionalLight(0xfff4e0, 1.2);
  dir.position.set(20, 40, 10);
  dir.castShadow = true;
  dir.shadow.mapSize.set(2048, 2048);
  dir.shadow.camera.near = 0.5;
  dir.shadow.camera.far = 120;
  dir.shadow.camera.left = -36;
  dir.shadow.camera.right = 36;
  dir.shadow.camera.top = 36;
  dir.shadow.camera.bottom = -36;
  dir.shadow.bias = -0.001;
  scene.add(dir);

  return scene;
}
