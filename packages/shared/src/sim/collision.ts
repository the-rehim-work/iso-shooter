import RAPIER from '@dimforge/rapier3d-compat';
import { ARENA_HALF_X, ARENA_HALF_Z, PLAYER_HEIGHT, PLAYER_RADIUS, WALL_HEIGHT } from '../constants.js';
import { DEFAULT_MAP, type GameMap } from './maps.js';

let initialized = false;

export async function initRapier(): Promise<void> {
  if (initialized) return;
  await RAPIER.init();
  initialized = true;
}

const CAPSULE_HALF_HEIGHT = (PLAYER_HEIGHT - 2 * PLAYER_RADIUS) / 2;
const CENTER_OFFSET = PLAYER_HEIGHT / 2;
const GROUND_PROBE_RANGE = CENTER_OFFSET + 0.6;

export class CollisionWorld {
  private world: RAPIER.World;
  private controller: RAPIER.KinematicCharacterController;
  private bodies = new Map<number, RAPIER.RigidBody>();
  private colliders = new Map<number, RAPIER.Collider>();
  private colliderHandleToNetId = new Map<number, number>();
  private doorColliders: RAPIER.Collider[] = [];
  readonly map: GameMap;

  constructor(map: GameMap = DEFAULT_MAP) {
    this.map = map;
    this.world = new RAPIER.World({ x: 0, y: 0, z: 0 });
    this.controller = this.world.createCharacterController(0.03);
    this.controller.setSlideEnabled(true);
    this.controller.enableSnapToGround(0.2);
    this.controller.enableAutostep(0.25, 0.1, true);
    this.buildStaticGeometry();
    this.buildDoors();
    this.world.step();
  }

  private buildStaticGeometry(): void {
    const hx = ARENA_HALF_X;
    const hz = ARENA_HALF_Z;
    const t = 1.0;
    const wallHalfH = WALL_HEIGHT / 2;
    this.addStaticBox(0, -0.5, 0, hx + t, 0.5, hz + t);
    this.addStaticBox(0, wallHalfH, hz + t * 0.5, hx + t, wallHalfH, t * 0.5);
    this.addStaticBox(0, wallHalfH, -(hz + t * 0.5), hx + t, wallHalfH, t * 0.5);
    this.addStaticBox(hx + t * 0.5, wallHalfH, 0, t * 0.5, wallHalfH, hz);
    this.addStaticBox(-(hx + t * 0.5), wallHalfH, 0, t * 0.5, wallHalfH, hz);
    for (const c of this.map.cover) {
      this.addStaticBox(c.x, c.halfH, c.z, c.halfW, c.halfH, c.halfD);
    }
  }

  private buildDoors(): void {
    for (const d of this.map.doors) {
      const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(d.x, d.halfH, d.z));
      const col = this.world.createCollider(RAPIER.ColliderDesc.cuboid(d.halfW, d.halfH, d.halfD), body);
      this.doorColliders.push(col);
    }
  }

  setDoorOpen(index: number, open: boolean): void {
    const col = this.doorColliders[index];
    if (col) col.setEnabled(!open);
  }

  private addStaticBox(cx: number, cy: number, cz: number, hw: number, hh: number, hd: number): void {
    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(cx, cy, cz));
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(hw, hh, hd), body);
  }

  addCharacter(netId: number, x: number, y: number, z: number): number {
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x, y + CENTER_OFFSET, z),
    );
    const col = this.world.createCollider(
      RAPIER.ColliderDesc.capsule(CAPSULE_HALF_HEIGHT, PLAYER_RADIUS),
      body,
    );
    this.bodies.set(netId, body);
    this.colliders.set(netId, col);
    this.colliderHandleToNetId.set(col.handle, netId);
    this.world.step();
    return body.handle;
  }

  removeCharacter(netId: number): void {
    const col = this.colliders.get(netId);
    if (col) this.colliderHandleToNetId.delete(col.handle);
    const body = this.bodies.get(netId);
    if (!body) return;
    this.world.removeRigidBody(body);
    this.bodies.delete(netId);
    this.colliders.delete(netId);
  }

  groundHeightAt(netId: number, x: number, y: number, z: number): number {
    const ray = new RAPIER.Ray({ x, y: y + CENTER_OFFSET, z }, { x: 0, y: -1, z: 0 });
    const hit = this.world.castRay(
      ray,
      GROUND_PROBE_RANGE,
      true,
      undefined,
      undefined,
      this.colliders.get(netId),
      undefined,
      (c) => !this.colliderHandleToNetId.has(c.handle),
    );
    if (!hit) return -Infinity;
    return y + CENTER_OFFSET - hit.toi;
  }

  resolveMovement(
    netId: number,
    currentX: number,
    currentY: number,
    currentZ: number,
    dx: number,
    dy: number,
    dz: number,
  ): { dx: number; dy: number; dz: number; grounded: boolean } {
    const body = this.bodies.get(netId);
    const col = this.colliders.get(netId);
    if (!body || !col) return { dx, dy, dz, grounded: currentY <= 0 };

    const centerY = currentY + CENTER_OFFSET;
    body.setNextKinematicTranslation({ x: currentX, y: centerY, z: currentZ });
    this.world.step();

    this.controller.computeColliderMovement(col, { x: dx, y: dy, z: dz });
    const m = this.controller.computedMovement();
    const grounded = this.controller.computedGrounded();

    body.setNextKinematicTranslation({ x: currentX + m.x, y: centerY + m.y, z: currentZ + m.z });

    return { dx: m.x, dy: m.y, dz: m.z, grounded };
  }

  castRayForHit(
    shooterNetId: number,
    ox: number,
    oy: number,
    oz: number,
    dirX: number,
    dirY: number,
    dirZ: number,
    maxDistance: number,
  ): { hitNetId: number | null; distance: number } | null {
    const shooterCol = this.colliders.get(shooterNetId);
    const ray = new RAPIER.Ray({ x: ox, y: oy, z: oz }, { x: dirX, y: dirY, z: dirZ });
    const hit = this.world.castRay(ray, maxDistance, true, undefined, undefined, shooterCol);
    if (!hit) return null;
    const hitNetId = this.colliderHandleToNetId.get(hit.collider.handle) ?? null;
    return { hitNetId, distance: hit.toi };
  }

  raycastStaticDistance(
    ox: number,
    oy: number,
    oz: number,
    dirX: number,
    dirY: number,
    dirZ: number,
    maxDistance: number,
  ): number {
    const ray = new RAPIER.Ray({ x: ox, y: oy, z: oz }, { x: dirX, y: dirY, z: dirZ });
    const hit = this.world.castRay(
      ray,
      maxDistance,
      true,
      undefined,
      undefined,
      undefined,
      undefined,
      (c) => !this.colliderHandleToNetId.has(c.handle),
    );
    return hit ? hit.toi : maxDistance;
  }

  raycastStaticNormal(
    ox: number,
    oy: number,
    oz: number,
    dirX: number,
    dirY: number,
    dirZ: number,
    maxDistance: number,
  ): { distance: number; nx: number; ny: number; nz: number } | null {
    const ray = new RAPIER.Ray({ x: ox, y: oy, z: oz }, { x: dirX, y: dirY, z: dirZ });
    const hit = this.world.castRayAndGetNormal(
      ray,
      maxDistance,
      true,
      undefined,
      undefined,
      undefined,
      undefined,
      (c) => !this.colliderHandleToNetId.has(c.handle),
    );
    if (!hit) return null;
    return { distance: hit.toi, nx: hit.normal.x, ny: hit.normal.y, nz: hit.normal.z };
  }

  raycastDistance(
    ox: number,
    oy: number,
    oz: number,
    dirX: number,
    dirY: number,
    dirZ: number,
    maxDistance: number,
    excludeNetId?: number,
  ): number {
    const exCol = excludeNetId !== undefined ? this.colliders.get(excludeNetId) : undefined;
    const ray = new RAPIER.Ray({ x: ox, y: oy, z: oz }, { x: dirX, y: dirY, z: dirZ });
    const hit = this.world.castRay(ray, maxDistance, true, undefined, undefined, exCol);
    return hit ? hit.toi : maxDistance;
  }

  step(): void {
    this.world.step();
  }

  dispose(): void {
    this.world.free();
  }
}
