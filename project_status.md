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
Combat & Modes Expansion — COMPLETE as of 2026-06-30.
Feel & Fixes Pass — COMPLETE as of 2026-07-01.
Content Pass (map/loadouts/throwables) — COMPLETE as of 2026-07-01.
Vision Modes + Classes Pass — COMPLETE as of 2026-07-01.
Rooms + Fixes Pass — COMPLETE as of 2026-07-01.
Visual/Audio Polish Pass — COMPLETE as of 2026-07-01.
Balance + Teams Pass — COMPLETE as of 2026-07-01.
Bugfix + Aiming Pass — COMPLETE as of 2026-07-01.

## Bugfix + Aiming Pass (2026-07-01)
- Fog HUD: VisionOverlay zIndex 2, HUD container zIndex 10 → dark vignette sits behind the HUD (edges readable in Blackout).
- Spawn stacking (team modes stuck): clearSpawn now separates from other entities too (push-apart loop, ignoreEid for self); pickSpawn scores vs nearest of ANY entity; more spawn points per team. Verified: 24 TDM spawns no-overlap + clear of cover in headlessProof.
- Aiming feel: first shot is pinpoint — tickWeapon returns spread = heat (starts 0), bloom accumulates with sustained fire, recovers when settled. Pellet weapons keep def.spread pattern. Crosshair gap = heat (or def.spread for pellets). Rewards tapping; punishes spraying.
- Bomb bots: bombObjectiveFor() steers attacker bots to a site to plant (holds interact inside) and defenders to the planted site to defuse, while still shooting. Verified E2E: warmup→live→planted→roundEnd with bot plants.
- Favicon: inline SVG gold target/crosshair in index.html; title uppercased.

## Balance + Teams Pass (2026-07-01)
- Team switching: SetTeam message; GameServer.setClientTeam (team modes only) reassigns Team.id + respawns. Client: T key (frame loop) in tdm/domination/bomb, HUD hint.
- Damage falloff: WeaponDef.falloff; resolveHitscan scales damage from full (≤40% range) down to falloff at max range. Ranges shortened across the board (rifle 46, smg 28, sniper 85, etc.).
- Shotgun visuals: drawShots() renders def.pellets spread tracers (client) for pellet weapons; single tracer uses bloom spread.
- Recon class added (sniper + pistol, 85hp). Roster now 6 classes; stats retuned (assault 110hp etc.). Sniper recoil 1.0 + camera kick ×0.85 (kicks the view back).
- Room config is now mode-aware (ui/room.ts): win-limit label + relevance per mode, friendly-fire only for team modes, respawns hidden for bomb/survival, per-mode note text.

## Visual/Audio Polish Pass (2026-07-01)
- Spawn clearance: clearSpawn() nudges spawn points out of cover boxes (penetration-axis push, arena-clamped). Verified by headlessProof runSpawnClearance (24 spawns clear).
- Reload: EntitySnapshot.reloading flag; CharacterModel.triggerReload → gun-lower + mag-drop + tilt animation (local + remote via edge). audioSystem.playReload rebuilt into 4-stage mag-out/mag-in/chamber via click() helper.
- Weapon models: scope (sniper/dmr), drum mag (lmg), toggled in setWeapon. Brass shell ejection effect (EffectsSystem.shell) on every non-melee shot (local + remote).
- Hit impacts: ImpactFlash additive sprite added to hit/crit/wall sparks; more particles. playThrow whoosh + playExplosion already present.
- Sounds widened per weapon earlier; reload now distinct.

## Rooms + Fixes Pass (2026-07-01)
- Room system: MatchConfig (mode, winLimit, bots, difficulty, friendlyFire, respawn) in constants. GameServer._mode mutable + getConfig/isHost/configureMatch/applyConfig; host = first client (promoted on leave). ConfigureMatch message; Welcome carries isHost+config; ModeState carries gameMode/matchPhase/winner. checkWin per mode (kills/rounds/score/elimination/survival) → matchPhase 'ended'. Client: ui/room.ts setup UI, ROOM button (host), end overlay, applyMode() on gameMode change (re-teams/rebuilds views), auto-reopens setup on match end.
- Immutable class weapons: removed weapon selection; SetClass carries only classId; applyClass always uses class defaults.
- Aim precision: screenToGround takes planeY; aim uses height 1.0 (fixes crosshair-vs-hit parallax). Throw target uses ground plane.
- Throw feedback: playThrow sound + arm anim on throw (server path already worked).
- Respawn slide fixed: remote respawn resets interpolation buffer + snaps (no sliding from death to spawn).
- Bots unstuck: BotController tracks displacement; escape maneuver when blocked at edges.
- Knife visible: dedicated blade mesh toggled for weaponId 7.
- Sounds: widened per-weapon pitch/character. Asymmetric COMPOUND_MAP redesign (2 doors, offset structures).
- Win limits: defaultWinLimit(mode); GAME_WINLIMIT env.

## Vision Modes + Classes Pass (2026-07-01)
- Two vision modes: Firefight (full vis) + Blackout (fog-of-war). VisionOverlay DOM radial darkness; enemies hidden unless within VISION_RADIUS(18) + client LOS (walls + smoke). Bots also vision-limited in fog (enemyTargetFor gated). FOG_MODES in constants. Both FFA-scored (isFfaLike helper).
- 5 classes now, each a distinct built-in kit + distinct sidearm + per-class grenade kit (ClassDef.grenades): assault(rifle+pistol 2/1/1), scout(smg+dmr 1/0/1), heavy(lmg+shotgun 2/1/0), ronin(knife+smg 1/1/1, melee), demolition(shotgun+pistol 4/2/2 = bomb class). Class-select fills its built-in loadout on click, still tweakable.
- Melee: 'knife' weapon (WeaponDef.melee), tickWeapon melee path (no ammo/reload), short-range hitscan (2.8). HUD shows ∞, swing sound, no tracer/muzzle. weaponId 7.
- Precision: tighter base spreads, bloom softened (per-shot .26/max 1.5), crit core widened (CRIT_RADIUS .19). Sniper 90 body / crit one-shot.
- Safe spawns: pickSpawn picks the candidate farthest from nearest living enemy (avoids spawning into a firefight).
- LAN play: vite server.host=true; client WS uses location.hostname; PORT env.

## Content Pass (2026-07-01)
- Arena enlarged to 60×60 (ARENA_HALF 30); COMPOUND_MAP redesigned (bigger central building w/ 4 doors, flank cover, crates, perimeter walls rendered). Spawn points spread out.
- Textures: procedural canvas (render/textures.ts) — ground tiles, concrete cover, metal crates/doors. Grid helper removed.
- Free loadouts: class sets health/speed only; pick any primary+secondary weapon (ui/classSelect.ts). Loadout.w0/w1 weapon indices in ECS; SetClass carries primary/secondary. "scout with sniper" etc.
- Sniper tuned: 90 dmg (body ≈90% of assault), crit ×1.9 one-shots. Spread bloom softened (BLOOM_PER_SHOT 0.32, MAX 1.7).
- Throwables (server arrays, not ECS): frag (AoE falloff), molotov (fire DoT zone), smoke (blocks bot LOS + visual). Keys 3/4/5. InputCommand.throwType/throwX/throwZ; snapshot projectiles/zones/blasts + per-client grenades. Counts 2/1/1, refill on respawn. render/throwables.ts renders grenades + fire/smoke; effects.explosion + damageNumber.
- Damage feedback: HitEvent.dmg → floating damage numbers (white / yellow crit).
- OGAT (Of Guards And Thieves) noted for future: LOS/fog-of-war vision, footstep audio, light/dark stealth.

## Feel & Fixes Pass (2026-07-01)
- Dead players cannot move/shoot/reload; HUD shows ELIMINATED.
- Tracers clip to walls via CollisionWorld.raycastDistance; grey wall-impact sparks, red blood sparks.
- Precision-core crit: hitscan measures perpendicular distance from target center → CRIT_RADIUS(0.15)=×1.9, GRAZE_RADIUS(0.3)=×0.8. HitEvent.crit + KillEvent.headshot; yellow crit spark + ✸ in kill feed.
- Tactical feel: spread bloom (WeaponSimState.heat, decays; effective spread returned from tickWeapon), camera recoil kick (WeaponDef.recoil), slightly slower autos (rifle/lmg interval 4, smg 3).
- Bots: reaction time + aim error + aim smoothing, difficulty easy/normal/hard (DIFFICULTY table in bots.ts); no more idle-in-combat. GAME_DIFFICULTY env + in-game selector (settings panel BOTS section, SetDifficulty message).
- Better audio: layered transient/crack/body/tail per weapon + pitch jitter; fleshy hit thump.
- Animations: hit flinch (lean-back) + collapse (topple/roll, limbs limp). Guns visually distinct per weapon (scale + color).

**Why:** headlessProof now has 6 passing cases (netcode×3 + combat + doors + all-7-modes smoke). Game has classes, 7 weapons with two-slot loadouts, auto-doors, smart combat bots, shared names, scoreboard, and 7 game modes. Client + server typecheck clean; client production-builds (vite target esnext).

**How to apply:** Next: bomb-mode bot AI (bots can't plant/defuse), mode-selection / room system so players choose mode without restarting the server, lag compensation, GLTF models.

## Combat & Modes Expansion (all complete)
- `weapons.ts` — WeaponDef table (7 weapons) + CLASSES (assault/scout/heavy, primary+sidearm, maxHealth, speedMul) + GUNGAME_LADDER.
- `weapon.ts` — two-slot WeaponSimState (slot0/1, activeSlot, prevFire for semi-auto); `tickWeapon(s, {fire,reload,switchTo}, tick, loadout)` → {next, didFire, firedWith}.
- `maps.ts` — COMPOUND_MAP (central building, 4 auto-doors, 3 control points, 2 bomb sites), EMPTY_MAP (proof uses this so the wall test path stays clear). `CollisionWorld(map)`, `setDoorOpen(i,open)`.
- GameServer — mode framework: ffa/tdm/gungame/domination/bomb/survival/practice with objective state + `getModeState()`. Doors toggled by proximity → `doors` bitmask. Per-weapon hitscan (pellets/spread/range/damage).
- bots.ts — combat AI (target nearest enemy, aim error+smoothing, fire on LOS in range, strafe). Practice bots wander only.
- Client — classSelect UI, weapon swap + HUD, mode/objective HUD + scoreboard (Tab), floating name tags, door meshes that slide, victim hit sparks from `hits[]`, per-weapon gunshot SFX, gun model scales per weapon.

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
- `GAME_MODE` ∈ ffa|tdm|gungame|domination|bomb|survival|practice; `GAME_BOTS=N`; `PORT=N`
- `node packages/server/dist/main.js` (defaults FFA, 3 bots, port 8080)
- PowerShell: `$env:GAME_MODE='bomb'; node packages/server/dist/main.js`
- Client: `npm run client`
- Bomb mode needs human attackers (bots don't plant/defuse); other modes fully solo-playable.

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
