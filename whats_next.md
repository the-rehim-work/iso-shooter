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

## Resolved in Fairness + Bots + CS-bomb pass (2026-07-03)
- **Bots**: per-bot skill with exactly one "ace" per roster (others 0.35–0.75 band, difficulty scales the band); targets acquired only with LOS inside a 26u sight radius (fog clamps to VISION_RADIUS) with 3s last-seen memory + investigate; target stickiness + weighted pick among two nearest spreads aggro off the leader; aim error grows with distance; two-whisker wall avoidance (`GameServer.wallClearance`); survival waves still omnisciently hunt.
- **Gungame fairness**: classes are cosmetic-only — base 100hp, base speed, zero grenades (`applyClass`/`grenadeKitFor` gate on mode).
- **Class-switch abuse**: SetClass only sets `pendingClass`; applied in `respawnEntity`. No mid-fight heal/teleport. Client shows "→ X (next spawn)" and derives speed/loadout from the snapshot's classId.
- **Bomb, CS-ified**: random attacker carries the bomb (only carrier plants), death/leave drops it (pickup by walk-over, 1.6u), halftime side swap at `limit-1` rounds played (teams + roundsWon flip, HALFTIME banner), plant/defuse progress resets on release (was decay). ModeState carries bombCarrier/bombDropped/bombDropX/Z; HUD shows carrier/escort/recover roles; bomb marker on minimap for attackers only; bots: carrier pushes site, squad escorts, defenders hold sites, post-plant attackers protect.
- **Minimap honesty**: enemies appear only while spotted (LOS from you or any living ally within 26u, smoke-aware, 6.7Hz recompute) — CS-radar rules.
- **Jump has a purpose**: JUMP_SPEED 9.2 (apex ~1.78) — crates (1.6) and desks (1.5) are mountable, walls (2.4) are not; verified landing on a crate. Jump poses: procedural model tucks legs, GLTF soldier leans back with anims faded.
- **Music v2**: 16-bar arrangement with sectional dynamics (sparse → build → climax → recede), generated-IR hall reverb, 3-osc vibrato string ensemble instead of raw saws, formant "ah" choir layer, varied percussion, two alternating melody phrases (octave lift at the climax), 66bpm.

## Resolved in Knife/Input/Corpse/Warrens pass (2026-07-04)
- **Knife**: semi-auto (click per swing), 14-tick cadence, melee never crits (flat 62 — two hits vs 105hp); both character models play a windup→slash→recover swing (0.42s) instead of a recoil pop.
- **Input**: all keybinds use `e.code` (physical positions) — WASD/R/Q/E/C/T/digits/Space/Tab work on any keyboard layout; arrow keys also move.
- **Corpse collision bug**: dead bodies kept their physics capsule server-side (client predicted through, server pushed back → rubber-band). `killEntity` now drops the capsule; respawn re-adds it. Verified: walking through a fresh corpse is perfectly smooth.
- **New map "Warrens"**: corridor maze — ring corridor at ±18 with N/S doors, pinwheel core making spiral hallways, corner fights everywhere; 3 control points, 2 bomb sites (center + NE ring corner), per-map spawns in the outer corridor. Verified: door gaps clean, spawns clear, 600-tick bot match with nobody wall-stuck.

## Resolved in Chosen mode + Ronin identity + LMG nerf + Stats (2026-07-04)
- **New mode "The Chosen"** (FFA-like): every 20s a weighted-random living player becomes immortal for 10s. Past picks decay hard (weight 0.18^timesChosen) so the crown rotates — verified all 4 players anointed within 8 picks. Golden emissive pulse on the chosen model, server banner, HUD countdown ("⚡ YOU ARE THE CHOSEN"). Immunity lives in `damageEntity` (covers bullets, blasts, molotov).
- **Ronin is an assassin now** (TF2-Spy pattern): melee **backstab** — knife strike from behind the victim (facing·direction > 0.45) deals ×2.4 (148, lethal to everyone); frontal stays flat 62. Kit: 105hp, 1.42 speed, 3 smokes to close distance, revolver sidearm. Not spammable: semi-auto 14-tick swings + positioning requirement.
- **LMG nerfed per archetype research** (mobility-for-sustain tradeoff): 19dmg/5-tick (114 DPS), spread 0.06, reload 96, range 50; Heavy speed 0.84→0.80. Identity = 75-round suppression, not a laser hose.
- **Match statistics**: `GameServer.getMatchSummary()` (mode/map/winner/duration/config/teamScores/rounds/per-player kills-deaths-score-damage-class-bot/weaponKills incl. 'explosive'); wsServer writes `stats/match-<ts>-<room>.json` once per ended match (+ abandoned matches with >30s of play on room close; `STATS_DIR` env, gitignored). Damage tracked in `damageEntity`, weapon kills at hitscan/AoE resolution — the data to balance from.
- Fixed HUD fallthrough: firefight/blackout no longer show "Free practice".

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
