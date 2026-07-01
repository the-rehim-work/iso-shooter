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
| `constants.ts` | Game constants + GameMode union (7 modes), MODE_NAMES, GAME_MODES, DOOR_OPEN_RADIUS, mode tuning (DOMINATION_SCORE_TARGET, CAPTURE_TICKS, BOMB_*, SURVIVAL_*, FFA_SCORE_TARGET) |
| `sim/weapons.ts` | WeaponDef + WEAPONS table (7), ClassDef + CLASSES (assault/scout/heavy), CLASS_IDS, GUNGAME_LADDER, WEAPON_ORDER, classIdToIndex/classFromIndex, weaponIdToIndex/weaponFromIndex |
| `sim/maps.ts` | DoorDef, ZoneDef, GameMap; COMPOUND_MAP, EMPTY_MAP, DEFAULT_MAP, MAPS registry, getMap(id) |
| `ecs/components.ts` | Transform, Velocity, NetId, Owner, ColliderHandle, Health, WeaponState (two-slot), Loadout (classId/speed), Team, Kills (count/deaths/score), Dead; tags Player/Bot/LocalPlayer/RemotePlayer |
| `ecs/queries.ts` | transformNetQuery, botQuery, deadQuery |
| `sim/movement.ts` | InputCommand (adds switchTo, interact), integrate(state,cmd,moveSpeed?), integrateWithCollision(...,moveSpeed?), applyInputToEntity, readTransform/writeTransform |
| `sim/weapon.ts` | WeaponSimState (slot0/1, activeSlot, prevFire), WeaponInput, WeaponPair, initialWeaponState(loadout), tickWeapon(s,input,tick,loadout)→{next,didFire,firedWith}, activeDef/activeAmmo/activeReserve, EQUIP_TICKS |
| `sim/collision.ts` | CollisionWorld(map) — addCharacter/removeCharacter, resolveMovement, castRayForHit, setDoorOpen(i,open), step(); .map getter |
| `net/protocol.ts` | MSG (+SetClass/SetName), Welcome (classId/mapId), Input, SetClass/SetName, Snapshot (+hits/doors/mode), EntitySnapshot (+name/classId/weaponId/deaths/score/maxHealth), ModeState, KillEvent, HitEvent |
| `net/interpolation.ts` | InterpolationBuffer — push(timestampMs, state), sample(timeMs) |
| `net/prediction.ts` | PredictedEntity — predict(cmd), reconcile(state, ackSeq), pendingCount() |

## Server (packages/server/src/)

| File | What it owns |
|---|---|
| `gameLoop.ts` | GameServer — addClient/addBot/removeClient, setClientClass/setClientName, enqueueInput, step, snapshotEntities, consumeKills/consumeHits, getTeamScores/getDoorMask/getModeState, mapId; mode state machines (updateDomination/updateBomb/updateSurvival); enemyTargetFor/posOf/weaponRangeOf/hasLineOfSight for bots; loadoutFor (gungame ladder), per-class speed/health |
| `bots.ts` | BotController — generateInput(netId, eid, tick, server) → { moveX, moveZ, aimYaw, fire, reload }; combat AI + wander fallback |
| `net/wsServer.ts` | IsoWsServer — accepts WS, handles Input/SetClass/SetName, broadcasts 30Hz snapshots, EADDRINUSE handler |
| `main.ts` | Entry; reads GAME_MODE, GAME_BOTS, PORT; survival self-manages waves |
| `headlessProof.ts` | `npm run test:netcode` — 6 scenarios: lossless, perturbed reconcile, wall collision, combat kill, door proximity, all-7-modes smoke |

## Client (packages/client/src/)

| File | What it owns |
|---|---|
| `main.ts` | Frame loop: prediction (per-class speed), interpolation, weapon swap, mode/door state, scoreboard, hit sparks, per-weapon audio; class change on C |
| `input.ts` | InputSampler — WASD, aim, fire, consumeReload, consumeSwitch (1/2/Q/wheel), interact (E), scoreboardHeld (Tab) |
| `render/scene.ts` | createScene(map) → { scene, doors: DoorView[], pointFills, pointRings }; cover/zones/bomb-site markers/lights; teamColor() |
| `ui/classSelect.ts` | showClassSelect() class cards → ClassId; getSavedClass(); localStorage iso_player_class |
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
