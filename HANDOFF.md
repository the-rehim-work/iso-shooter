# iso-shooter — Engineering Handoff

Single source of truth for continuing development. Read fully before touching code.

---

## 1. Mission and non-negotiables

Browser-based fixed-angle isometric 3D shooter. Server-authoritative multiplayer. Supports human players and bots. Three game modes share ONE entity/system architecture:
- FFA Deathmatch (live, implemented)
- Team Deathmatch (live, implemented)
- Bomb Defusal / Survival — future slices

**Rules that must never be violated:**
1. No code comments — ever. Self-documenting names only.
2. The server is authoritative. Clients send intent, never state.
3. Simulation logic lives in `packages/shared`, imported by both server and client.
4. TypeScript strict mode: `noUncheckedIndexedAccess` is ON. Never weaken tsconfig.
5. Transport stays abstract. Game code talks to the `Transport` interface only.
6. `npm run test:netcode` must always PASS. Extend it when new predicted state is added.

---

## 2. Tech stack (locked)

| Layer | Choice |
|---|---|
| Language | TypeScript strict |
| Rendering | Three.js orthographic isometric |
| Physics | Rapier2D WASM (`@dimforge/rapier2d-compat@0.12.0`) |
| ECS | bitECS (SoA typed arrays) |
| Server | Node.js |
| Transport | WebSocket behind `Transport` interface |
| Build | Vite (client), tsc (shared + server), npm workspaces |

---

## 3. Completed slices

### Slice 0 — Netcode spine ✓
Fixed-timestep (30Hz) authoritative server loop. Client-side prediction via shared `integrate()`. Server reconciliation on snapshot. Remote entity interpolation (100ms buffer). Proven by `headlessProof.ts`.

### Slice 1 — Rapier2D collision ✓
Kinematic character controllers. Static colliders for arena walls + cover. `ColliderHandle` ECS component. `CollisionWorld` shared between server and client. Hitscan via `castRay` + `colliderHandleToNetId` reverse map. Hitscan fires AFTER `physics.step()` — this is required because `world.step()` is the only thing that updates the `QueryPipeline`.

### Playable Demo ✓
Full FFA + TDM. Weapon (30-round mag, 4 mags, reload, 600rpm, 60-unit range, 25dmg/shot). Health/death/respawn (100hp, 3s respawn). Non-reacting wander bots. Kill feed. HUD (health bar, ammo counter, mode/score). Viewport cap (wider than 16:9 = pillarbox, world view never grows).

### Production Polish ✓
Procedural 3D character models (head/helmet/visor/torso/vest/arms/gun/legs). Walking, shoot recoil, hit shake, death topple animations. Muzzle flash (PointLight + sprite, 60ms). Bullet tracer (line, 80ms). Hit sparks (7 particles + gravity, 350ms). Web Audio gunshot/hit/reload/death sounds (procedural synthesis, no asset files). Settings panel (⚙ button, slide-in: volume, latency sim, callsign). Auth dialog on load (callsign entry, stored to localStorage, optional). Shadows (PCFSoft, all cover + ground). `shotFired: boolean` in EntitySnapshot so remote shots trigger visual/audio on client.

---

## 4. File map

### packages/shared/src/

| File | Owns |
|---|---|
| `constants.ts` | All game constants (see section 6) |
| `ecs/components.ts` | All bitECS components and tags |
| `ecs/queries.ts` | All ECS queries |
| `sim/movement.ts` | `InputCommand`, `integrate()`, `integrateWithCollision()`, `readTransform/writeTransform` |
| `sim/weapon.ts` | `WeaponSimState`, `initialWeaponState()`, `tickWeapon()` → `{ next, didFire }` |
| `sim/collision.ts` | `CollisionWorld` — addCharacter, removeCharacter, resolveMovement, castRayForHit, step |
| `net/protocol.ts` | `MSG`, `WelcomeMessage`, `InputMessage`, `SnapshotMessage`, `EntitySnapshot`, `KillEvent`, encode/decode |
| `net/interpolation.ts` | `InterpolationBuffer` — push(tsMs, state), sample(tsMs) |
| `net/prediction.ts` | `PredictedEntity` — predict(cmd), reconcile(state, ackSeq), pendingCount() |

### packages/server/src/

| File | Owns |
|---|---|
| `gameLoop.ts` | `GameServer` — addClient, addBot, removeClient, enqueueInput, step(), snapshotEntities(), consumeKills(), getTeamScores(), ackFor() |
| `bots.ts` | `BotController` — register(netId), generateInput(netId, tick) → `{ moveX, moveZ, aimYaw }` |
| `net/wsServer.ts` | `WsServer` — WebSocket accept, 30Hz broadcast loop |
| `main.ts` | Entry point; reads `GAME_MODE` and `GAME_BOTS` env vars |
| `headlessProof.ts` | Netcode convergence test (no browser, no sockets) |

### packages/client/src/

| File | Owns |
|---|---|
| `main.ts` | Frame loop wiring: prediction, interpolation, input→cmd, effects, HUD, audio |
| `input.ts` | `InputSampler` — WASD axes, mouseX/Y, `fire` (held), `consumeReload()` (one-shot R key) |
| `render/scene.ts` | `createScene()` — ground, grid, cover, hemisphere + directional lights, shadows |
| `render/isoCamera.ts` | createIsoCamera, resizeIsoCamera, moveCameraTarget, screenToGround, cameraGroundBasis, applyViewportCap |
| `render/characterModel.ts` | `CharacterModel` — procedural multi-part 3D character, animations; `static muzzleWorldPos(x,z,yaw)` |
| `render/entityView.ts` | `EntityView` — wraps CharacterModel, hit flash (red emissive), death animation lifecycle, respawn |
| `render/effects.ts` | `EffectsSystem` — muzzleFlash(pos), bulletTracer(from,to), hitSpark(pos), update(dt) |
| `render/hud.ts` | `Hud` — DOM health bar, ammo counter, mode/score top-left, kill feed top-right, debug |
| `audio/audioSystem.ts` | `AudioSystem` — lazy Web Audio init, playGunshot/Hit/Reload/Death(), setVolume() |
| `ui/settings.ts` | `SettingsPanel` — ⚙ button bottom-right, slide-in panel (volume, latency, callsign, controls) |
| `ui/auth.ts` | `showAuthDialog()` → `Promise<string>`; localStorage key `iso_player_name` |
| `net/wsClient.ts` | `WsClient` implements `Transport` |
| `net/latencySim.ts` | `LatencySim` implements `Transport` — artificial one-way latency, setLatency(ms) |

---

## 5. ECS components

```ts
// Transform: position + aim direction
Transform { x, z, yaw }

// Identity / ownership
NetId { value }
Owner { clientId }
ColliderHandle { rapier }   // Rapier collider handle (ui32)

// Game state
Health { current, max }
WeaponState { ammo, reserveMags, cooldownTick, reloadEndTick }
Team { id }                 // 0=FFA, 1=team1, 2=team2
Kills { count }
Dead { respawnTick }        // present = dead; value = tick to respawn at

// Tags (no data, presence = true)
Player, Bot, LocalPlayer, RemotePlayer
```

---

## 6. Key constants

```
TICK_RATE = 30 Hz           FIXED_DT = 1/30 s
MOVE_SPEED = 6              PLAYER_RADIUS = 0.5
PLAYER_MAX_HEALTH = 100     PLAYER_RESPAWN_TICKS = 90 (3 s)
WEAPON_MAG_SIZE = 30        WEAPON_NUM_MAGS = 4
WEAPON_DAMAGE = 25          WEAPON_RANGE = 60
WEAPON_FIRE_INTERVAL_TICKS = 3 (600 rpm)
WEAPON_RELOAD_TICKS = 45 (1.5 s)
INTERP_DELAY_MS = 100
ARENA_HALF_X = 20           ARENA_HALF_Z = 20
MAX_VIEWPORT_ASPECT = 16/9
```

---

## 7. Netcode model

- **Server step (30Hz):** at start clear `firedThisTick`. Process respawns. Drain each client's input queue in seq order, apply movement + aggregate fire/reload. Bot movement. `physics.step()`. Resolve hitscans (must be after physics.step). tick++.
- **Snapshot:** sent after step(). Contains all entities with `{ netId, x, z, yaw, health, ammo, reserveMags, team, kills, isDead, isBot, shotFired }` plus `teamScores` and `recentKills`.
- **Client prediction:** InputCommand built each fixed tick, applied immediately via shared sim, stored pending, sent to server.
- **Reconciliation:** snapshot arrives → overwrite `ammo` + `reserveMags` from server, keep `cooldownTick`/`reloadEndTick` as local prediction → `reconcile(serverState, ackSeq)` replays unacked inputs.
- **Interpolation:** remote entities buffered by server time, sampled at `serverTimeMs - 100ms`.
- **Death animation:** `EntityView.triggerDeath()` plays animation for ~400ms then hides. Do NOT call `setVisible(false)` immediately on death.

---

## 8. Server-authoritative hitscan — critical ordering

```
step():
  firedThisTick.clear()        ← must be FIRST
  processRespawns()
  [client inputs → weaponTick() → if didFire: pendingHitscans.push() + firedThisTick.add()]
  [bot movement]
  physics.step()               ← commits positions to QueryPipeline
  resolveHitscan() for each    ← AFTER physics.step, not before
  world.tick++
```

`world.step()` is the only call that updates Rapier's `QueryPipeline`. `KinematicCharacterController.computeColliderMovement` silently finds no colliders without it.

---

## 9. Run commands

```powershell
npm install
npm run build               # compile shared + server
npm run typecheck           # strict type check all 3 packages
npm run test:netcode        # headless netcode proof — must always PASS

# Server
node packages/server/dist/main.js                    # FFA, 3 bots
$env:GAME_MODE='tdm'; $env:GAME_BOTS='4'; node packages/server/dist/main.js

# Client dev server
npm run dev -w packages/client                        # http://localhost:5173
```

Controls: WASD move, mouse aim, left-click fire, R reload. ⚙ (bottom-right) opens settings.

---

## 10. Known gaps / what's next

### Lag compensation for hitscan (highest priority feel improvement)
Server fires rays at current entity positions. At real latency the shooter always aims at where the target *was*. Fix: ring buffer of entity positions (one per tick, ~10 ticks) in `GameServer`. In `resolveHitscan`, look up the position at the tick that corresponds to `shooterSendTime`.

### Reload state reconciliation
`cooldownTick` and `reloadEndTick` are intentionally not overwritten from server snapshots (to avoid jump cuts). If they diverge under packet loss the client stays wrong until the next mag change. Fix: include these in EntitySnapshot and apply a smooth correction instead of a hard overwrite.

### Player names not shared between clients
`playerName` is local only. Kill feed shows `#N` for remote players. Fix: send name in a post-Welcome `PlayerInfo` message; server stores in `ClientState.name`; include in EntitySnapshot.

### Remote hit sparks
Sparks only fire at the shooter's muzzle/tracer. Victim gets no impact spark. Fix: add `hitPosition: { x, z } | null` to EntitySnapshot, or broadcast a separate `HitEvent` message.

### Next features (in rough priority order)
1. Lag compensation (netcode correctness)
2. GLTF character models (replace procedural with `.glb` + THREE.AnimationMixer)
3. Room/session codes (server spawns a `GameServer` per 4-char code, entered in auth dialog)
4. Matchmaking lobby (waiting room, host starts game)
5. Map format + loader (STATIC_COVER out of constants, into data files)
6. Modes as system configs (manifest-driven TDM → Bomb → Survival)
7. Binary wire protocol (typed arrays behind `protocol.ts`, delta compression)
8. Containerized deploy (nginx for client dist, Node.js process for server)

---

## 11. Technical debt

1. JSON protocol won't scale past ~50 entities. Switch to binary behind `protocol.ts`.
2. Snapshots are full per-tick. Need delta compression and interest management.
3. Client-stamped input `dt` is a cheat vector. Server should clamp and validate.
4. No reconnection or session identity. Dropped socket = entity gone.
5. Transport is TCP (WebSocket). WebRTC DataChannel (unreliable/unordered) is correct for a twitch shooter.
6. No anti-cheat beyond authority. Input rate limiting and action validation needed before real players.
