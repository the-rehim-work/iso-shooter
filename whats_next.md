---
name: whats-next
description: "Unfinished work, known gaps, and the logical next features for iso-shooter"
metadata: 
  node_type: memory
  type: project
  originSessionId: c6445066-096b-4e1f-ad74-ec923fa6f1eb
---

## Resolved in Combat & Modes Expansion (2026-06-30)
Player names shared (SetName + names in EntitySnapshot + tags + scoreboard). Victim hit sparks broadcast via `hits[]`. Classes, 7 weapons, two-slot loadouts, weapon switching. Auto-doors (proximity bitmask). Smart combat bots. Modes: ffa/tdm/gungame/domination/bomb/survival/practice. Per-weapon audio. PORT env. Client production-builds.

## Known gaps in the current implementation

### Bomb mode needs human attackers
Bots do not plant or defuse (no objective AI), so bot-only bomb rounds always time out to the defenders. Fix: give bots an objective drive — path to the active site, hold `interact` when inside. Same accessor pattern as `enemyTargetFor`.

### No in-client mode selection
Mode is chosen by the server's `GAME_MODE` env var; the client just joins whatever is running. Fix: room/lobby system — `GameServer` per room code, mode chosen at room creation, entered in the auth/class flow.

### Weapon slot reconciliation is light
Client overwrites only the active slot's ammo/reserve from the snapshot; the inactive slot trusts local prediction until next equipped. Diverges only under packet loss mid-swap; resyncs on next equip.

### Lag compensation for hitscan
Server fires the ray at the CURRENT position of all entities, not their rewound position. In a 150ms RTT game this means the shooter is always aiming at where the target WAS, so hits feel slightly off at high latency. Fix: store a ring buffer of entity positions (one per server tick, last ~10 ticks) in `GameServer`, then in `resolveHitscan` rewind to the tick corresponding to `shooter.sendTime`.

### Reload state not reconciled
`cooldownTick` and `reloadEndTick` are intentionally NOT overwritten from server snapshot on client (to avoid reloading jumps). But if server and client diverge (e.g., packet loss during reload), the client's predicted reload state stays wrong until the next mag-change. Fix: include server's `reloadEndTick` and `cooldownTick` in EntitySnapshot and reconcile them with a smooth correction rather than a hard overwrite.

### Remote shot sounds only trigger on snapshot-tick boundary
`shotFired: true` in EntitySnapshot is set per-step (30Hz). Shots fired between broadcast ticks are not missed (server step IS broadcast tick), but the 33ms audio delay is noticeable if the server runs slower. Fine for now.

### No hit sparks for remote incoming shots
Sparks only appear at the shooter's tracer endpoint, not at the victim's body. To show sparks on the victim: add a `hitPosition` field to `EntitySnapshot` (x,z of where they were hit), or broadcast a separate `HitEvent` message. [[architecture]]

### Player names not shared between clients
`playerName` is stored locally only. Kill feed for remote players shows `#N`. To fix: send name in a `PlayerInfo` message after Welcome; server stores in `ClientState.name`; include in EntitySnapshot or a separate `PlayersInfo` broadcast.

## Next logical features (in priority order)

1. **GLTF character models** — replace procedural CharacterModel with a `.glb` file loaded via `THREE.GLTFLoader`. Currently no asset pipeline; would need Vite's asset handling and a models directory. Three.js AnimationMixer for skeletal animations.

2. **Lag compensation** — see above. Most impactful feel improvement at real network latencies.

3. **Room/session system** — server supports one game room only. Add room codes (4-char alphanumeric) so players can join the same room by entering the code in auth dialog. Server spawns a `GameServer` per room.

4. **Matchmaking lobby** — waiting room UI before game starts, shows connected player list, host can start when ready.

5. **Map editor / multiple maps** — STATIC_COVER is hardcoded in constants. Extract to a map format, load from server config.

6. **Kill streak / announcements** — track consecutive kills, announce "DOUBLE KILL" etc. in HUD.

7. **Production deployment** — Vite build (`npm run build -w packages/client`) produces static files in `packages/client/dist/`. Server is plain Node.js. Could deploy to any VPS: serve client dist via nginx, run server as a process.

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
