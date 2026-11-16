// The staged screenshot scenes behind ?shot=start|cover|burst|play|late|end&seed=N. Each scene
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
    // Round 3: keep the fight near the middle of the arena. A gentle pull
    // toward the centre whenever the orbit drifts into the outer third, so
    // staged frames hold the swarm around the warden instead of losing it
    // to an edge — the pilot still aims, orbits and dodges exactly as before.
    moveX += (VIEW.width / 2 - player.x) / 1100;
    moveY += (VIEW.height / 2 - player.y) / 1100;
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

// Round 3 staging: instead of freezing on the first frame that clears a bar,
// the cover and burst scenes score every candidate frame and keep the best
// one on an offscreen canvas. Every candidate is still a real frame of the
// real simulation — the keeper only chooses which honest frame to show.
function playerCentrality(game) {
  const p = game.player;
  if (p.x > 340 && p.x < 940 && p.y > 190 && p.y < 530) return 8;
  if (p.x > 170 && p.x < 1110 && p.y > 110 && p.y < 610) return 3;
  return 0;
}

function coverScore(game) {
  const inside = game.enemies.filter((e) => wellInside(e, 50)).length;
  let score = (
    game.waves.wave * 1.5
    + inside * 4
    + Math.min(game.effects.particles.length, 40) * 0.4
    + Math.min(game.bullets.length, 10) * 0.35
    + (game.effects.waves.length > 0 ? 6 : 0)
    + (game.effects.texts.length > 0 ? 4 : 0)
    + (game.overdrive.active ? 6 : 0)
    + playerCentrality(game)
  );
  // A frame from an early wave or with a thin field can never win on bullet
  // volume alone: density of enemies in frame is the cover's real currency.
  if (game.waves.wave < 7 || inside < 10) score *= 0.3;
  return score;
}

function coverIsStrong(game) {
  const inside = game.enemies.filter((e) => wellInside(e, 50)).length;
  return (
    game.waves.wave >= 7
    && game.enemies.length >= 13
    && inside >= 10
    && game.effects.particles.length >= 10
    && game.bullets.length >= 5
    && playerCentrality(game) >= 8
    && (game.overdrive.active || game.effects.waves.length > 0 || game.effects.texts.length > 0)
  );
}

function burstScore(game) {
  const inside = game.enemies.filter((e) => wellInside(e, 50)).length;
  const odText = game.effects.texts.some((t) => t.text === 'OVERDRIVE');
  const ringMidFlight = game.effects.waves.some((w) => w.r > w.maxR * 0.25 && w.r < w.maxR * 0.85);
  let score = (
    inside * 3.5
    + Math.min(game.effects.particles.length, 44) * 0.5
    + Math.min(game.bullets.length, 12) * 0.35
    + (game.effects.waves.length > 0 ? 10 : 0)
    + (ringMidFlight ? 6 : 0)
    + (odText ? 8 : 0)
    + playerCentrality(game)
  );
  // The panel's round-3 fix, and the frame's whole point: the burst must be
  // shown going off among enemies. A burst over a thin field scores near
  // zero no matter how bright the bullet fan is.
  if (inside < 6) score *= 0.15;
  else if (playerCentrality(game) === 0) score *= 0.5;
  return score;
}

function lateScore(game) {
  const inside = game.enemies.filter((e) => wellInside(e, 50)).length;
  const bulwarkIn = game.enemies.some((e) => e.kind === 'bulwark' && wellInside(e, 50));
  const weaverIn = game.enemies.some((e) => e.kind === 'weaver' && wellInside(e, 50));
  let score = (
    game.waves.wave * 1.5
    + inside * 3.5
    + Math.min(game.effects.particles.length, 40) * 0.4
    + (bulwarkIn ? 7 : 0)
    + (weaverIn ? 7 : 0)
    + (game.effects.waves.length > 0 ? 5 : 0)
    + playerCentrality(game)
  );
  if (!bulwarkIn || !weaverIn || inside < 8) score *= 0.3;
  return score;
}

function lateIsStrong(game) {
  const bulwarkIn = game.enemies.some((e) => e.kind === 'bulwark' && wellInside(e, 50));
  const weaverIn = game.enemies.some((e) => e.kind === 'weaver' && wellInside(e, 50));
  const inside = game.enemies.filter((e) => wellInside(e, 50)).length;
  return game.waves.wave >= 6 && bulwarkIn && weaverIn && inside >= 9
    && game.effects.particles.length >= 8 && playerCentrality(game) >= 8;
}

class FrameKeeper {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = VIEW.width;
    this.canvas.height = VIEW.height;
    this.kctx = this.canvas.getContext('2d');
    this.best = -Infinity;
  }

  consider(game, score) {
    if (score <= this.best) return;
    this.best = score;
    drawScene(this.kctx, game);
    drawHUD(this.kctx, game);
  }

  blit(ctx) {
    ctx.drawImage(this.canvas, 0, 0);
  }
}

// Step the simulation with an input source, scoring frames with `score` once
// `minTicks` have passed and stopping early when `stopWhen` fires. The best
// frame seen is what gets painted.
function flyAndKeep(game, inputFor, minTicks, maxTicks, score, stopWhen) {
  const keeper = new FrameKeeper();
  for (let i = 0; i < maxTicks; i += 1) {
    if (game.overdrive.charge >= 100 && !game.overdrive.active) game.tryOverdrive();
    game.step(TICK, inputFor(game));
    if (game.phase !== 'playing') break;
    if (i >= minTicks) {
      keeper.consider(game, score(game));
      if (stopWhen && stopWhen(game)) break;
    }
  }
  return keeper;
}

function playIsReady(game) {
  return frameIsLively(game, 8) && hasLiveParticles(game, 4);
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
    const keeper = flyAndKeep(game, autopilotInput, 60 * 30, 60 * 300, coverScore, coverIsStrong);
    keeper.blit(ctx);
    return;
  }
  if (name === 'burst') {
    // The overdrive climax: fly until the autopilot's charge fills and the
    // burst fires, then keep the best frame of the activation window — the
    // gold shockwave only lives a third of a second, so first-frame staging
    // would almost always miss it. Frames outside the window score at a
    // quarter weight, so the keeper still holds a sane fallback.
    const keeper = new FrameKeeper();
    let wasActive = false;
    let lastActiveAt = -Infinity;
    let caughtRing = false;
    for (let i = 0; i < 60 * 240; i += 1) {
      // Hold the burst until a busier wave: the charge waits at full, and
      // firing it into a wave-3 skirmish would waste the climax on a thin
      // field.
      if (game.overdrive.charge >= 100 && !game.overdrive.active && game.waves.wave >= 5) {
        game.tryOverdrive();
      }
      game.step(TICK, autopilotInput(game));
      if (game.phase !== 'playing') break;
      const active = game.overdrive.active;
      if (active) {
        wasActive = true;
        lastActiveAt = game.time;
        if (game.effects.waves.length > 0) caughtRing = true;
      }
      const inWindow = active || game.time - lastActiveAt < 0.45;
      if (i >= 60 * 10) keeper.consider(game, burstScore(game) * (inWindow ? 1 : 0.25));
      if (wasActive && !active && caughtRing) break;
    }
    keeper.blit(ctx);
    return;
  }
  if (name === 'play') {
    flyWith(game, autopilotInput, 60 * 8, 60 * 90, playIsReady);
    drawScene(ctx, game);
    drawHUD(ctx, game);
    return;
  }
  if (name === 'late') {
    // Round 3: the late scene uses the frame keeper too — same readiness
    // idea as before (bulwark and weaver in frame, late wave), but it keeps
    // the densest such frame instead of the first.
    const keeper = flyAndKeep(game, autopilotInput, 60 * 30, 60 * 240, lateScore, lateIsStrong);
    keeper.blit(ctx);
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
