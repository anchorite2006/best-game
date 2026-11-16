// The staged screenshot scenes behind ?shot=start|cover|play|late|end&seed=N. Each scene
// runs the real simulation forward from a fixed seed — the play scenes with an
// autopilot at the controls, the end scene with a pilot who stops dodging — then
// freezes on one frame and sets window.__shotReady so a screenshot tool can grab
// exactly the frame a player would see. Nothing here draws anything of its own.

import { Game } from './game.js';
import { drawScene, drawHUD, drawMenu, drawGameOver } from './render.js';
import { VIEW } from './config.js';

const TICK = 1 / 60;

// A simple, honest autopilot: aim at the nearest enemy, keep a comfortable
// distance from it, strafe around it, and veer toward ember shards when safe.
function autopilotInput(game) {
  const player = game.player;
  let target = null;
  let targetDist = Infinity;
  for (const enemy of game.enemies) {
    if (enemy.warp > 0) continue;
    const d = Math.hypot(enemy.x - player.x, enemy.y - player.y);
    if (d < targetDist) {
      targetDist = d;
      target = enemy;
    }
  }
  let moveX = 0;
  let moveY = 0;
  const mouse = { x: player.x + 100, y: player.y, down: false };
  if (target) {
    mouse.x = target.x;
    mouse.y = target.y;
    mouse.down = targetDist < 640;
    const away = Math.atan2(player.y - target.y, player.x - target.x);
    const want = 205;
    const radial = targetDist < want ? 1 : targetDist > want + 90 ? -0.55 : 0;
    moveX = Math.cos(away) * radial + Math.cos(away + Math.PI / 2) * 0.65;
    moveY = Math.sin(away) * radial + Math.sin(away + Math.PI / 2) * 0.65;
  } else {
    // Nothing close: drift back toward the middle of the arena.
    moveX = (VIEW.width / 2 - player.x) / 300;
    moveY = (VIEW.height / 2 - player.y) / 300;
  }
  let shard = null;
  let shardDist = 260;
  for (const pickup of game.pickups) {
    const d = Math.hypot(pickup.x - player.x, pickup.y - player.y);
    if (d < shardDist) {
      shardDist = d;
      shard = pickup;
    }
  }
  if (shard && targetDist > 190) {
    moveX = (shard.x - player.x) / shardDist;
    moveY = (shard.y - player.y) / shardDist;
  }
  const keys = new Set();
  if (moveX < -0.3) keys.add('KeyA');
  if (moveX > 0.3) keys.add('KeyD');
  if (moveY < -0.3) keys.add('KeyW');
  if (moveY > 0.3) keys.add('KeyS');
  return {
    mouse,
    keys,
    moveVector() {
      let x = 0;
      let y = 0;
      if (keys.has('KeyA')) x -= 1;
      if (keys.has('KeyD')) x += 1;
      if (keys.has('KeyW')) y -= 1;
      if (keys.has('KeyS')) y += 1;
      const len = Math.hypot(x, y) || 1;
      return { x: x / len, y: y / len };
    },
    firing() {
      return mouse.down;
    },
  };
}

// A pilot who holds position and never fires: the swarm reaches the warden
// quickly, which is how the end scene earns its game over honestly.
function passiveInput(game) {
  return {
    mouse: { x: game.player.x + 120, y: game.player.y - 40, down: false },
    moveVector: () => ({ x: 0, y: 0 }),
    firing: () => false,
  };
}

// A frame worth showing: enough of the swarm on screen at once and the warden
// in the thick of it rather than parked against an edge.
function frameIsLively(game, minEnemies) {
  const p = game.player;
  const margin = 120;
  return (
    game.enemies.length >= minEnemies
    && game.bullets.length >= 2
    && p.x > margin && p.x < VIEW.width - margin
    && p.y > margin && p.y < VIEW.height - margin
  );
}

function hasLiveParticles(game, min) {
  return game.effects.particles.length >= min;
}

function wellInside(enemy, inset) {
  return enemy.x > inset && enemy.x < VIEW.width - inset && enemy.y > inset && enemy.y < VIEW.height - inset;
}

function coverIsReady(game) {
  const insideCount = game.enemies.filter((e) => wellInside(e, 50)).length;
  return (
    game.waves.wave >= 7
    && frameIsLively(game, 12)
    && insideCount >= 9
    && hasLiveParticles(game, 6)
    && (game.overdrive.active || game.pickups.length > 0 || game.overdrive.charge >= 40)
  );
}

function playIsReady(game) {
  return frameIsLively(game, 8) && hasLiveParticles(game, 4);
}

function lateIsReady(game) {
  const bulwarkVisible = game.enemies.some((e) => e.kind === 'bulwark' && wellInside(e, 50));
  const weaverVisible = game.enemies.some((e) => e.kind === 'weaver' && wellInside(e, 50));
  return (
    game.waves.wave >= 5
    && frameIsLively(game, 7)
    && bulwarkVisible
    && weaverVisible
  );
}

function flyWith(game, inputFor, minTicks, maxTicks, stopWhen) {
  for (let i = 0; i < maxTicks; i += 1) {
    if (game.overdrive.charge >= 100 && !game.overdrive.active) game.tryOverdrive();
    game.step(TICK, inputFor(game));
    if (game.phase !== 'playing') return;
    if (i >= minTicks && stopWhen && stopWhen(game)) return;
  }
}

export function stageShot(name, seed, ctx, sound, rng) {
  const game = new Game(rng, sound);
  if (name === 'start') {
    // Let the starfield drift a little so the menu does not look frozen solid.
    for (let i = 0; i < 90; i += 1) game.effects.update(TICK);
    drawMenu(ctx, game, 0, 3.0);
    return;
  }
  if (name === 'cover') {
    flyWith(game, autopilotInput, 60 * 60, 60 * 300, coverIsReady);
    drawScene(ctx, game);
    drawHUD(ctx, game);
    return;
  }
  if (name === 'play') {
    flyWith(game, autopilotInput, 60 * 8, 60 * 90, playIsReady);
    drawScene(ctx, game);
    drawHUD(ctx, game);
    return;
  }
  if (name === 'late') {
    flyWith(game, autopilotInput, 60 * 30, 60 * 180, lateIsReady);
    drawScene(ctx, game);
    drawHUD(ctx, game);
    return;
  }
  // end: fight properly for a while so the tally is a real one, then stop
  // dodging and let the swarm finish the warden. The death timer runs out
  // inside the simulation, so the real game-over state is what gets drawn.
  flyWith(game, autopilotInput, 60 * 14, 60 * 14, null);
  for (let i = 0; i < 60 * 150 && game.phase !== 'over'; i += 1) {
    game.step(TICK, passiveInput(game));
  }
  drawGameOver(ctx, game, game.score, false);
}
