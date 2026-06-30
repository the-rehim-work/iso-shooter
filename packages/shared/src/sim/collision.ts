import RAPIER from '@dimforge/rapier2d-compat';
import { ARENA_HALF_X, ARENA_HALF_Z, STATIC_COVER, PLAYER_RADIUS } from '../constants.js';

let initialized = false;

export async function initRapier(): Promise<void> {
  if (initialized) return;
  await RAPIER.init();
  initialized = true;
}

export class CollisionWorld {
  private world: RAPIER.World;
  private controller: RAPIER.KinematicCharacterController;
  private bodies = new Map<number, RAPIER.RigidBody>();
  private colliders = new Map<number, RAPIER.Collider>();
  private colliderHandleToNetId = new Map<number, number>();

  constructor() {
    this.world = new RAPIER.World({ x: 0, y: 0 });
    this.controller = this.world.createCharacterController(0.01);
    this.controller.setSlideEnabled(true);
    this.buildStaticGeometry();
    this.world.step();
  }

  private buildStaticGeometry(): void {
    const hx = ARENA_HALF_X;
    const hz = ARENA_HALF_Z;
    const t = 1.0;
    this.addStaticBox(0,               hz + t * 0.5, hx + t, t * 0.5);
    this.addStaticBox(0,            -(hz + t * 0.5), hx + t, t * 0.5);
    this.addStaticBox( hx + t * 0.5, 0,              t * 0.5, hz);
    this.addStaticBox(-(hx + t * 0.5), 0,             t * 0.5, hz);
    for (const c of STATIC_COVER) {
      this.addStaticBox(c.x, c.z, c.halfW, c.halfD);
    }
  }

  private addStaticBox(cx: number, cz: number, hw: number, hd: number): void {
    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(cx, cz));
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(hw, hd), body);
  }

  addCharacter(netId: number, x: number, z: number): number {
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x, z),
    );
    const col = this.world.createCollider(RAPIER.ColliderDesc.ball(PLAYER_RADIUS), body);
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

  resolveMovement(
    netId: number,
    currentX: number,
    currentZ: number,
    dx: number,
    dz: number,
  ): { dx: number; dz: number } {
    const body = this.bodies.get(netId);
    const col = this.colliders.get(netId);
    if (!body || !col) return { dx, dz };

    body.setNextKinematicTranslation({ x: currentX, y: currentZ });
    this.world.step();

    this.controller.computeColliderMovement(col, { x: dx, y: dz });
    const m = this.controller.computedMovement();

    body.setNextKinematicTranslation({ x: currentX + m.x, y: currentZ + m.y });

    return { dx: m.x, dz: m.y };
  }

  castRayForHit(
    shooterNetId: number,
    ox: number,
    oz: number,
    dirX: number,
    dirZ: number,
    maxDistance: number,
  ): { hitNetId: number | null; distance: number } | null {
    const shooterCol = this.colliders.get(shooterNetId);
    const ray = new RAPIER.Ray({ x: ox, y: oz }, { x: dirX, y: dirZ });
    const hit = this.world.castRay(ray, maxDistance, true, undefined, undefined, shooterCol);
    if (!hit) return null;
    const hitNetId = this.colliderHandleToNetId.get(hit.collider.handle) ?? null;
    return { hitNetId, distance: hit.toi };
  }

  step(): void {
    this.world.step();
  }
}
