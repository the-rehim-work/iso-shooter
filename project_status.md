---
name: project-status
description: Current slice completion status and key architectural decisions for iso-shooter
metadata: 
  node_type: memory
  type: project
  originSessionId: c6445066-096b-4e1f-ad74-ec923fa6f1eb
---

Slice 0 (netcode spine) — COMPLETE.
Slice 1 (Rapier collision) — COMPLETE as of 2026-06-30.
Playable Demo — COMPLETE as of 2026-06-30.
Production Polish — COMPLETE as of 2026-06-30.

**Why:** headlessProof has 3 passing cases. Full game now has 3D character models, animations, audio, muzzle flash, settings panel, and auth dialog.

**How to apply:** Next work could be lag compensation for hitscan, server-side hit effects broadcast, GLTF model loading, or matchmaking.

## Production Polish features (all complete)
- `CharacterModel` in `packages/client/src/render/characterModel.ts` — procedural multi-part 3D character (torso, head w/ helmet+visor, arms w/ gun, legs), walking/shooting/hit/death animations
- `EffectsSystem` in `packages/client/src/render/effects.ts` — MuzzleFlash (PointLight + Sprite, 60ms), BulletTracer (Line, 80ms), HitSpark (7 particles w/ gravity, 350ms)
- `AudioSystem` in `packages/client/src/audio/audioSystem.ts` — Web Audio API procedural synthesis: gunshot (crack + thump), hit, reload (2 clicks), death; lazy init on first user interaction
- `SettingsPanel` in `packages/client/src/ui/settings.ts` — ⚙ button (bottom-right), slide-in panel with volume slider, latency slider, callsign field, controls reference
- `showAuthDialog` in `packages/client/src/ui/auth.ts` — name entry dialog on load, stores to localStorage `iso_player_name`, optional (can skip)
- EntityView rewritten to use CharacterModel — death animation plays before hiding entity
- Shadows: renderer.shadowMap.enabled, PCFSoftShadow, dir light casts shadows, ground/cover receive
- `shotFired: boolean` added to EntitySnapshot — server tracks `firedThisTick: Set<number>` cleared at start of each step()
- Remote entity shots trigger muzzle flash + tracer + triggerShoot() animation on client
- `#lat` div removed from HTML; latency slider lives in settings panel

## Run commands
- FFA with 3 bots: `node packages/server/dist/main.js` (defaults: GAME_MODE=ffa GAME_BOTS=3)
- TDM with 4 bots: PowerShell: `$env:GAME_MODE='tdm'; $env:GAME_BOTS='4'; node packages/server/dist/main.js`
- Client: `npm run dev -w packages/client`

## Playable Demo features (all still intact)
- `Health`, `WeaponState`, `Team`, `Kills`, `Dead` ECS components
- `tickWeapon(state, fire, reload, tick)` in `packages/shared/src/sim/weapon.ts`
- Hitscan via `CollisionWorld.castRayForHit()`
- FFA and TDM modes via `GAME_MODE=ffa|tdm` env var; `GAME_BOTS=N` controls bot count
- Non-reacting bots: `BotController` in `packages/server/src/bots.ts`
- Health/death: 4 shots (25dmg each) to kill; respawn after 90 ticks (3s)
- Kill feed and score in `Hud` class
- Viewport cap: screens wider than 16:9 are pillarboxed
- Entity colors: local=gold, ally=blue, enemy=red, bot=muted variant

## Coordinate mapping
- Game x → Rapier x, Game z → Rapier y (Rapier2D has no z axis)
