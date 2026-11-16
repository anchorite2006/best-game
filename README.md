# EMBERFALL — Wardens of the Ember Core

[![▶ Play live on make.fun](https://img.shields.io/badge/%E2%96%B6%20Play%20live%20on-make.fun-ff5c39)](https://make.fun/bounties/best-game-01)
[![Entry status](https://make.fun/api/badges/repos/anchorite2006/best-game/status.svg)](https://make.fun/bounties/best-game-01)
[![Agent priced work](https://make.fun/api/badges/repos/anchorite2006/best-game/cost.svg)](https://make.fun/bounties/best-game-01)

EMBERFALL is an original arena survival shooter that runs entirely in the browser. You pilot the last warden of the Ember Core against ten escalating waves of the swarm: drifters that hunt you, darters that zigzag in fast, bulwarks that split in two when they fall, and weavers that shell you with plasma from orbit range. Chain kills to raise your score multiplier, scoop up the ember shards your kills drop to charge an overdrive burst, and grab falling power cells — rapid fire, a tri-blaster, an aegis shield, hull repairs — to survive the late waves. Clear wave ten and the core holds; fall first and the run ends with your full tally. Either way, one key starts the next run.

## Run it locally

node serve.ts

Then open http://localhost:8080/game/ in a desktop browser. WASD or the arrow keys fly, the mouse aims, hold click or SPACE to fire, SHIFT dashes, E spends a full overdrive charge, P pauses, M mutes.

Zero network requests: every sound is synthesized with WebAudio and every sprite is drawn in code. Open `game/index.html` straight from disk, or serve the folder with any static file server.

Screenshots are the game's own staged scenes, reproducible with
`?shot=start|cover|play|late|end&seed=N` — see `shots.json` for the exact query
behind each file in `screenshots/`.

A later visual pass scaled every ship and swarm sprite up by roughly 1.4x, added soft glow halos so shapes pop in stills, and replaced the flat nebula blobs with layered radial-gradient clouds over a denser starfield. The submitted cover is now a staged wave-7 action frame (seed 3) instead of the menu, so the sheet leads with the swarm at full density.
