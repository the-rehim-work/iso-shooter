---
name: whats-next
description: "Unfinished work, known gaps, and the logical next features for iso-shooter"
metadata: 
  node_type: memory
  type: project
  originSessionId: c6445066-096b-4e1f-ad74-ec923fa6f1eb
---

## Resolved in Combat Feel + Scoring + Maps pass (2026-07-02)
- **Aim model**: crosshair sets direction only; shots fly flat at MUZZLE_HEIGHT (1.15) for full weapon range. Hovering an enemy aims at that body point; weapon spread now jitters pitch too (RNG chance on crits). Sniper range 130.
- **Throwables**: real ballistic sim with wall/closed-door bounces (GRENADE_GRAVITY/BOUNCE in constants); frag+molotov AoE is LOS-checked.
- **Team colors**: EntityView.setColor refreshes body color every snapshot (team switches repaint everyone).
- **Movement/doors**: character controller offset 0.03 + autostep (corner sticking); client predicts door-open state locally; server never closes a door on a body in its frame.
- **Balance**: shotgun/DMR nerfed, class kits reworked (Heavy/Ronin lost strong secondaries, Demolition trimmed).
- **Scoring**: points system — kill 100, +50 headshot, assist 50 (150-tick damage window), capture 150, plant/defuse 300, survival wave bonus; kill streak banners (3/5/8/12) + 🔥 in kill feed. Kills.count still drives FFA/gungame wins.
- **Maps**: GameMap has `theme` + per-cover `kind`; client renders themed visuals (desks, partitions, sofas, server racks, planters, carpet, window bands). New `office` map (Headquarters). Map picker in room setup (MatchConfig.map), live map switch rebuilds physics server-side and scene client-side (ModeState.mapId), GAME_MAP env for boot.

## Resolved in Full 3D Simulation Migration (2026-07-02)
rapier2d-compat replaced by rapier3d-compat 0.12. Transform/MoveState carry {x,y,z,yaw,pitch,vy}. Capsule characters (PLAYER_HEIGHT 1.8, radius 0.4), gravity 24, jump (Space; interact is now E only). Real 3D aim: client camera-ray picks into rapier world, server hitscan from eye height (1.6) with pitch. Crit/graze from capsule hit zone (top 18% crit, bottom 22% graze) — CRIT_RADIUS/GRAZE_RADIUS perp-band hack deleted. Cover/walls/doors have real heights matching visuals. Lag compensation: 20-tick {tick,x,y,z} ring buffer per netId, server-measured RTT via Ping/Pong (client echo only, never trusted), rewind = RTT + INTERP_DELAY, analytic ray-capsule test against buffered positions (live Rapier state never mutated). headlessProof now has 10 scenarios incl. jump convergence, interpolation smoothness, and adversarial lag-comp (rewind hits, no-rewind misses).

## Resolved in Combat & Modes Expansion (2026-06-30)
Player names shared (SetName + names in EntitySnapshot + tags + scoreboard). Victim hit sparks broadcast via `hits[]`. Classes, 7 weapons, two-slot loadouts, weapon switching. Auto-doors (proximity bitmask). Smart combat bots. Modes: ffa/tdm/gungame/domination/bomb/survival/practice. Per-weapon audio. PORT env. Client production-builds.

## Known gaps in the current implementation

### Bomb mode needs human attackers
Bots do not plant or defuse (no objective AI), so bot-only bomb rounds always time out to the defenders. Fix: give bots an objective drive — path to the active site, hold `interact` when inside. Same accessor pattern as `enemyTargetFor`.

### No in-client mode selection
Mode is chosen by the server's `GAME_MODE` env var; the client just joins whatever is running. Fix: room/lobby system — `GameServer` per room code, mode chosen at room creation, entered in the auth/class flow.

### Weapon slot reconciliation is light
Client overwrites only the active slot's ammo/reserve from the snapshot; the inactive slot trusts local prediction until next equipped. Diverges only under packet loss mid-swap; resyncs on next equip.

### Reload state not reconciled
`cooldownTick` and `reloadEndTick` are intentionally NOT overwritten from server snapshot on client (to avoid reloading jumps). But if server and client diverge (e.g., packet loss during reload), the client's predicted reload state stays wrong until the next mag-change. Fix: include server's `reloadEndTick` and `cooldownTick` in EntitySnapshot and reconcile them with a smooth correction rather than a hard overwrite.

### Remote shot sounds only trigger on snapshot-tick boundary
`shotFired: true` in EntitySnapshot is set per-step (30Hz). Shots fired between broadcast ticks are not missed (server step IS broadcast tick), but the 33ms audio delay is noticeable if the server runs slower. Fine for now.

### No hit sparks for remote incoming shots
Sparks only appear at the shooter's tracer endpoint, not at the victim's body. To show sparks on the victim: add a `hitPosition` field to `EntitySnapshot` (x,z of where they were hit), or broadcast a separate `HitEvent` message. [[architecture]]

### Player names not shared between clients
`playerName` is stored locally only. Kill feed for remote players shows `#N`. To fix: send name in a `PlayerInfo` message after Welcome; server stores in `ClientState.name`; include in EntitySnapshot or a separate `PlayersInfo` broadcast.

## Resolved in Rooms + Minimap + Reconciliation pass (2026-07-02)
- **Room system**: `IsoWsServer` is a room manager — 4-char codes (ambiguity-free alphabet), `MSG.Join` handshake ('' = create private, 'LOBBY' = quick play, code = join), `Welcome.roomCode`, `MSG.RoomError` on bad codes (client falls back to creating). One `GameServer`+`CollisionWorld` per room, stepped by a single loop (`stepAll`/`broadcastAll`); empty rooms are disposed (rapier world freed via `GameServer.dispose`). Client: PLAY dialog (ui/joinRoom.ts), URL `?room=CODE` auto-join + shareable link via history.replaceState, room badge shows the code. WsClient queues sends made before the socket opens.
- **Minimap**: ui/minimap.ts canvas radar (top-left) — cached static layer per map, doors green/orange by state, domination/bomb objectives, ally/enemy blips (fog-of-war aware), gold self marker.
- **Reload/slot reconciliation**: EntitySnapshot carries `reloadLeft` (ticks remaining) + `ammoB`/`reserveB` (inactive slot); client adopts server reload timing when drifted >10 ticks and syncs both slots every snapshot.
- **Per-map spawns**: `GameMap.spawns` ({any, team1, team2}); compound + office define them, gameLoop falls back to the legacy ring for maps without (e.g. empty).

## Resolved: GLTF character models (2026-07-02)
`packages/client/public/models/Soldier.glb` (three.js examples, MIT — see models/README.md) rendered via `render/gltfCharacter.ts`: GLTFLoader preload at boot (`preloadSoldier()` in main.ts), SkeletonUtils.clone per entity, AnimationMixer blending Idle/Walk/Run by speed with pace-scaled timeScale, team tint via cloned body material (white→team lerp 0.7), chest-mounted gun rig (clips are unarmed; bone mount would swing), procedural death fall (no death clip). `EntityView` picks SoldierModel when the asset loaded, procedural `CharacterModel` as fallback — same API (bodyMat hit flash, triggerShoot/Reload/Death, isDying/isFullyDead). Verified in headless Chrome: upright, animated, tinted, gun visible.

## Resolved in Modes + Weapons + Audio polish (2026-07-02)
- **Weapons**: +Magnum (revolver), Carbine, Machine Pistol (WEAPON_ORDER appended to keep indexes stable; gun visuals in both character models; per-weapon shot audio). Knife buffed (62 dmg / 6-tick / 3.0m).
- **Classes**: new Marksman class (dmr+mp, 95hp, 1.05); Ronin buffed (knife+Magnum, 110hp, 1.38); Demolition lost the DMR (shotgun+pistol).
- **Gungame**: 11-rung ladder (all guns shuffled per match, knife always last) — server-authoritative, shared via ModeState.ladder for client prediction.
- **Bomb mode complete**: warmup/roundEnd/planted phase HUD text with role, plant/defuse hints (E), banners (PLANTED/DEFUSED/DETONATED/TIME UP/ELIMINATED + reason), real detonation blast with AoE (killer name "THE BOMB"), accelerating beeper near the armed site. Human plant AND defuse verified headless end-to-end.
- **Netcode honesty**: LatencySim default 0 (was 60ms artificial!); friendly-fire-off shots pass through teammates server-side; client tracers clip at the first enemy body (no more bullets visually flying through people).
- **Server-authoritative setup**: SetDifficulty message removed entirely — difficulty/bots/mode/map only via host-gated ConfigureMatch.
- **UI**: controls legend lives in the Tab scoreboard only; settings panel slimmed (SFX/Music/latency/name).
- **Audio**: procedural dark orchestral score (D-minor, 72bpm, 8-bar loop: sub drone, detuned low-string ostinato, pad chords Dm–Bb–Gm–A, timpani, sparse melody) synthesized in Web Audio — no asset files; independent Music volume slider.

## Next logical features (in priority order)

1. **Lobby polish** — pre-game waiting room listing connected players before the host starts; today the host's room-setup dialog fills this role.

2. **Production deployment** — Vite build (`npm run build -w packages/client`) produces static files in `packages/client/dist/`. Server is plain Node.js. Could deploy to any VPS: serve client dist via nginx, run server as a process.

3. **Mid-swap slot mapping** — snapshot ammo is keyed to the server's active slot; during the few ticks a swap is in flight the client can briefly write values to the wrong slot (self-corrects). Sending slot-indexed ammo would close it.

4. **Death animation clip** — the soldier falls via a procedural tumble; a real death clip (Mixamo export merged into Soldier.glb) would look better.

## Run commands

```powershell
# Server — FFA default
node packages/server/dist/main.js

# Server — TDM with 4 bots
$env:GAME_MODE='tdm'; $env:GAME_BOTS='4'; node packages/server/dist/main.js

# Client dev
npm run dev -w packages/client

# Build shared+server (required before test)
npm run build

# Type check all packages
npm run typecheck

# Netcode proof (must stay PASS)
npm run test:netcode
```
