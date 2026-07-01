# iso-shooter

Server-authoritative, browser-based isometric 3D shooter. Fixed-timestep
authoritative server, client-side prediction, reconciliation, and remote-entity
interpolation — all sharing one simulation step. On top of that proven netcode
spine: Rapier collision, classes, an arsenal of weapons, auto-doors, smarter
combat bots, and seven game modes.

## Layout

    packages/shared   ECS, the single sim step, weapons/classes, maps, wire protocol, prediction/interp
    packages/server   authoritative 30Hz loop, mode framework, bots, WebSocket transport
    packages/client   Three.js iso renderer, prediction, HUD, audio, class select, doors

The rule: simulation lives in exactly one place (`packages/shared`). Server runs
it to be authoritative; client runs the same functions to predict. They cannot
diverge.

## Run

    npm install
    npm run build

Prove the netcode + combat + doors + every mode (headless, no browser):

    npm run test:netcode

Play locally (two terminals):

    npm run server      # ws://localhost:8080, 30Hz authoritative loop
    npm run client      # http://localhost:5173

### Game modes

Pick the mode with `GAME_MODE`, bot count with `GAME_BOTS`, port with `PORT`:

    GAME_MODE=ffa         node packages/server/dist/main.js   # free for all
    GAME_MODE=tdm         node packages/server/dist/main.js   # team deathmatch
    GAME_MODE=gungame     node packages/server/dist/main.js   # cycle every weapon
    GAME_MODE=domination  node packages/server/dist/main.js   # hold control points
    GAME_MODE=bomb        node packages/server/dist/main.js   # plant / defuse rounds
    GAME_MODE=survival    node packages/server/dist/main.js   # co-op enemy waves
    GAME_MODE=practice    node packages/server/dist/main.js   # sandbox vs target bots
    GAME_MODE=firefight   node packages/server/dist/main.js   # full-visibility deathmatch
    GAME_MODE=blackout    node packages/server/dist/main.js   # fog-of-war: see only your line of sight

PowerShell: `$env:GAME_MODE='tdm'; $env:GAME_BOTS='4'; node packages/server/dist/main.js`

### Controls

WASD move · mouse aim · LClick fire · R reload · 1/2 or Q/wheel swap weapon ·
E interact (plant/defuse) · C change class · Tab scoreboard · ⚙ settings.

## Classes

Assault (balanced rifle), Scout (fast SMG), Heavy (tanky LMG + shotgun). Each
carries a primary and a sidearm. Weapons: pistol, SMG, rifle, shotgun, sniper,
LMG, marksman — distinct damage, fire rate, spread, pellets, and range.
