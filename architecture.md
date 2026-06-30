---
name: architecture
description: "Non-negotiable design rules, package structure, and key invariants for iso-shooter"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: c6445066-096b-4e1f-ad74-ec923fa6f1eb
---

## Non-negotiables (all must hold at all times)

1. No code comments — ever. Self-documenting names only. [[feedback-code-style]]
2. Server is authoritative. Clients send *intent* (InputCommand), never state. Server state is the source of truth.
3. All simulation logic lives in `packages/shared` and is imported by both server and client. No duplicating physics, weapon, or movement logic.
4. TypeScript strict mode: `noUncheckedIndexedAccess` is ON. Never weaken tsconfig. Array accesses use `!` when existence is proven, or proper guards.
5. Transport is always abstract: `Transport` interface only. Never touch raw WebSocket. `WsClient` and `LatencySim` are the two implementations.
6. `npm run test:netcode` must always PASS. When new predicted state is added, extend `headlessProof.ts` to cover it.

**Why:** Owner stated these explicitly across multiple sessions and they are load-bearing for the architecture.

**How to apply:** Check all six before committing any change. Adding a new predicted client state without updating headlessProof is a known failure mode.

## Package structure

```
packages/
  shared/        (@iso/shared) — sim, ECS, protocol, constants; used by BOTH sides
  server/        — game loop, bots, WebSocket server; Node.js only
  client/        — Three.js rendering, input, HUD, audio, UI; browser only
```

## Server game loop (30Hz fixed timestep)

Each `step()` call in `GameServer`:
1. `firedThisTick.clear()` (must be FIRST — before weapon processing)
2. `processRespawns(tick)` — removes Dead component, resets health/weapon/position
3. Client inputs: sort by seq → apply movement → aggregate fire/reload flags → `weaponTick()`
4. Bot movement: `BotController.generateInput()` → `applyMovement()`
5. `physics.step()` — commits all kinematic body positions to Rapier QueryPipeline
6. `resolveHitscan()` for each pendingHitscan (AFTER step — positions are committed) [[feedback-rapier-lesson]]
7. `world.tick++`

`snapshotEntities()` is called by the WS server AFTER `step()` returns. The `firedThisTick` Set is still populated at that point (cleared at start of next step). This is intentional.

## Client prediction

- `PredictedEntity` rolls forward with `integrateWithCollision` (same fn as server)
- On snapshot: `reconcile(serverState, ackSeq)` replays unacked inputs from that point
- Weapon state: `tickWeapon` runs client-side every fixed tick for immediate HUD feedback
  - On snapshot: `ammo` and `reserveMags` are overwritten with server values
  - `cooldownTick` and `reloadEndTick` stay as local predictions (never overwritten)
- `localTick` drives cooldown comparisons; reset to 0 on Welcome

## Remote entity interpolation

- `InterpolationBuffer` stores timestamped snapshots
- Sampled at `serverTimeMs - INTERP_DELAY_MS (100ms)` — always behind by one round-trip buffer
- `serverTimeMs` is advanced both by snapshots and by frame dt accumulation

## Death animation rule

`EntityView.triggerDeath()` makes the entity VISIBLE and starts the animation. Do not call `setVisible(false)` on death — `EntityView.tick()` hides the entity automatically when `CharacterModel.isFullyDead` (after ~400ms). Respawn calls `respawn()` which resets the animation state and shows the entity.

## ECS component convention

All components use TypedArrays (bitECS SoA). Access via `Component.field[eid]!`. The `!` is safe because we only read components that we know are present (checked via query or explicit addComponent). Never call removeComponent inside a query loop — spread the eids first: `[...query(world)]`.
