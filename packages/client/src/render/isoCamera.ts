import * as THREE from 'three';
import { CAMERA_ELEVATION_DEG, CAMERA_AZIMUTH_DEG, CAMERA_DISTANCE, MAX_VIEWPORT_ASPECT } from '@iso/shared';

const DEG = Math.PI / 180;

export function isoCameraPosition(): THREE.Vector3 {
  const el = CAMERA_ELEVATION_DEG * DEG;
  const az = CAMERA_AZIMUTH_DEG * DEG;
  const horiz = CAMERA_DISTANCE * Math.cos(el);
  return new THREE.Vector3(
    horiz * Math.cos(az),
    CAMERA_DISTANCE * Math.sin(el),
    horiz * Math.sin(az),
  );
}

export function createIsoCamera(viewSize: number, aspect: number): THREE.OrthographicCamera {
  const cam = new THREE.OrthographicCamera(
    -viewSize * aspect,
    viewSize * aspect,
    viewSize,
    -viewSize,
    0.1,
    1000,
  );
  cam.position.copy(isoCameraPosition());
  cam.lookAt(0, 0, 0);
  cam.updateMatrixWorld(true);
  return cam;
}

const _offset = new THREE.Vector3();

export function moveCameraTarget(cam: THREE.OrthographicCamera, tx: number, tz: number): void {
  _offset.copy(isoCameraPosition());
  cam.position.set(tx + _offset.x, _offset.y, tz + _offset.z);
  cam.lookAt(tx, 0, tz);
  cam.updateMatrixWorld(true);
}

export function resizeIsoCamera(cam: THREE.OrthographicCamera, viewSize: number, aspect: number): void {
  const cappedAspect = Math.min(aspect, MAX_VIEWPORT_ASPECT);
  cam.left = -viewSize * cappedAspect;
  cam.right = viewSize * cappedAspect;
  cam.top = viewSize;
  cam.bottom = -viewSize;
  cam.updateProjectionMatrix();
}

export function applyViewportCap(
  renderer: THREE.WebGLRenderer,
  viewSize: number,
): void {
  const w = renderer.domElement.clientWidth;
  const h = renderer.domElement.clientHeight;
  const aspect = w / h;
  if (aspect > MAX_VIEWPORT_ASPECT) {
    const vw = Math.round(h * MAX_VIEWPORT_ASPECT);
    const ox = Math.round((w - vw) / 2);
    renderer.setViewport(ox, 0, vw, h);
    renderer.setScissor(ox, 0, vw, h);
    renderer.setScissorTest(true);
  } else {
    renderer.setViewport(0, 0, w, h);
    renderer.setScissorTest(false);
  }
  void viewSize;
}

const _ray = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
const _plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _hit = new THREE.Vector3();

export function screenToGround(
  cam: THREE.OrthographicCamera,
  clientX: number,
  clientY: number,
  width: number,
  height: number,
  planeY = 0,
): THREE.Vector3 | null {
  _ndc.x = (clientX / width) * 2 - 1;
  _ndc.y = -(clientY / height) * 2 + 1;
  _ray.setFromCamera(_ndc, cam);
  _plane.constant = -planeY;
  const ok = _ray.ray.intersectPlane(_plane, _hit);
  return ok ? _hit.clone() : null;
}

const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();

export function cameraGroundBasis(cam: THREE.OrthographicCamera): {
  forward: THREE.Vector3;
  right: THREE.Vector3;
} {
  cam.getWorldDirection(_fwd);
  _fwd.y = 0;
  _fwd.normalize();
  _right.setFromMatrixColumn(cam.matrixWorld, 0);
  _right.y = 0;
  _right.normalize();
  return { forward: _fwd.clone(), right: _right.clone() };
}
