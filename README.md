# iso-shooter

Server-authoritative, browser-based isometric shooter. Slice 0 proves the netcode
core: fixed-timestep authoritative server, client-side prediction, server
reconciliation, and remote-entity interpolation — all sharing one simulation step.

## Layout

    packages/shared   ECS, the single sim step, wire protocol, prediction/interp helpers
    packages/server   authoritative 30Hz loop, WebSocket transport, snapshots
    packages/client   Three.js iso renderer, prediction, reconciliation, interpolation

The rule: movement lives in exactly one place (`shared/src/sim/movement.ts`).
Server runs it to be authoritative; client runs the same function to predict.
They cannot diverge.

## Run

    npm install
    npm run build

Prove the netcode (headless, no browser):

    npm run test:netcode

Play locally (two terminals):

    npm run server      # ws://localhost:8080, 30Hz authoritative loop
    npm run client      # http://localhost:5173

Open the client in two browser tabs to see one authoritative world with two
clients. WASD to move, mouse to aim. Top-right slider injects artificial latency
so you can watch prediction and interpolation hold up under lag.

## What is NOT here yet (by design)

No Rapier/collision, no weapons, no modes, no bots, no accounts. Slice 0 is the
netcode spine only. Everything else bolts onto this proven loop.
