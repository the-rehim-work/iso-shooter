---
name: key-files
description: Where to find what in iso-shooter — authoritative file map for every major system
metadata: 
  node_type: memory
  type: reference
  originSessionId: c6445066-096b-4e1f-ad74-ec923fa6f1eb
---

## Shared (packages/shared/src/)

| File | What it owns |
|---|---|
| `constants.ts` | All game constants: MOVE_SPEED, WEAPON_*, PLAYER_*, SPAWN_POINTS, TEAM_SPAWN_POINTS, MAX_VIEWPORT_ASPECT, GameMode type |
| `ecs/components.ts` | All bitECS components: Transform, Velocity, NetId, Owner, ColliderHandle, Health, WeaponState, Team, Kills, Dead; tags: Player, Bot, LocalPlayer, RemotePlayer |
| `ecs/queries.ts` | All ECS queries: transformNetQuery, botQuery, deadQuery |
| `sim/movement.ts` | InputCommand interface, integrate(), integrateWithCollision(), applyInputToEntity(), readTransform/writeTransform |
| `sim/weapon.ts` | WeaponSimState interface, initialWeaponState(), tickWeapon() — returns { next, didFire } |
| `sim/collision.ts` | CollisionWorld class — addCharacter/removeCharacter, resolveMovement, castRayForHit, step(); colliderHandleToNetId reverse map for hitscan |
| `net/protocol.ts` | MSG constants, WelcomeMessage, InputMessage, SnapshotMessage, EntitySnapshot (includes shotFired), KillEvent, encode/decode |
| `net/interpolation.ts` | InterpolationBuffer — push(timestampMs, state), sample(timeMs) |
| `net/prediction.ts` | PredictedEntity — predict(cmd), reconcile(state, ackSeq), pendingCount() |

## Server (packages/server/src/)

| File | What it owns |
|---|---|
| `gameLoop.ts` | GameServer class — addClient, addBot, removeClient, enqueueInput, step, snapshotEntities, consumeKills, getTeamScores, ackFor; firedThisTick Set; netIdToEid Map |
| `bots.ts` | BotController — register(netId), generateInput(netId, tick) → { moveX, moveZ, aimYaw } |
| `net/wsServer.ts` | WsServer class — WebSocket accept, broadcast snapshots at 30Hz, forward inputs to GameServer |
| `main.ts` | Entry point; reads GAME_MODE and GAME_BOTS env vars |
| `headlessProof.ts` | `npm run test:netcode` — three scenarios: lossless, perturbed reconcile, wall collision |

## Client (packages/client/src/)

| File | What it owns |
|---|---|
| `main.ts` | Frame loop wiring: prediction, interpolation, input → cmd, effects trigger, HUD update, audio trigger |
| `input.ts` | InputSampler — WASD axes, mouseX/Y, fire (held), consumeReload() (one-shot) |
| `render/scene.ts` | createScene() — ground plane, grid, cover boxes, hemisphere + directional lights w/ shadows |
| `render/isoCamera.ts` | createIsoCamera, resizeIsoCamera, moveCameraTarget, screenToGround, cameraGroundBasis, applyViewportCap |
| `render/characterModel.ts` | CharacterModel — multi-part 3D character, walking/shoot/hit/death animations; muzzleWorldPos(x,z,yaw) static method |
| `render/entityView.ts` | EntityView — wraps CharacterModel, manages hit flash, death animation lifecycle, respawn |
| `render/effects.ts` | EffectsSystem — muzzleFlash(pos), bulletTracer(from,to), hitSpark(pos), update(dt) |
| `render/hud.ts` | Hud — DOM health bar, ammo counter, mode/score, kill feed (5s TTL), debug line |
| `audio/audioSystem.ts` | AudioSystem — lazy Web Audio init, playGunshot/Hit/Reload/Death, setVolume |
| `ui/settings.ts` | SettingsPanel — ⚙ button (bottom-right), slide-in panel, volume/latency/callsign controls |
| `ui/auth.ts` | showAuthDialog() → Promise<string>; getSavedName(); localStorage key `iso_player_name` |
| `net/wsClient.ts` | WsClient implements Transport |
| `net/latencySim.ts` | LatencySim implements Transport — artificial one-way latency, setLatency(ms) |

## Key constants (packages/shared/src/constants.ts)

```
MOVE_SPEED = 6          PLAYER_RADIUS = 0.5      FIXED_DT = 1/30
PLAYER_MAX_HEALTH = 100  PLAYER_RESPAWN_TICKS = 90
WEAPON_MAG_SIZE = 30    WEAPON_NUM_MAGS = 4      WEAPON_DAMAGE = 25
WEAPON_RANGE = 60       WEAPON_FIRE_INTERVAL_TICKS = 3 (600rpm)
WEAPON_RELOAD_TICKS = 45 (1.5s)
INTERP_DELAY_MS = 100
MAX_VIEWPORT_ASPECT = 16/9
```
