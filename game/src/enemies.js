// The four ember-swarm kinds and how each one hunts. Every enemy warps in over half
// a second (visible, harmless), then follows its own movement pattern:
//   drifter — steers straight at the warden, the swarm's bread and butter;
//   darter  — much faster, weaving side to side as it closes;
//   bulwark — a slow armoured hexagon that splits into three drifters when killed;
//   weaver  — keeps its distance, circles the warden and lobs plasma orbs.

import { ENEMIES, PLASMA, VIEW } from './config.js';

let nextId = 1;

export function spawnEnemy(kind, rng, player) {
  // Spawn on a random edge, biased away from the player's current position so a
  // fresh enemy never lands on top of the warden.
  let x = 0;
  let y = 0;
  for (let tries = 0; tries < 8; tries += 1) {
    const edge = rng.int(0, 3);
    if (edge === 0) { x = rng.range(30, VIEW.width - 30); y = -30; }
    if (edge === 1) { x = rng.range(30, VIEW.width - 30); y = VIEW.height + 30; }
    if (edge === 2) { x = -30; y = rng.range(30, VIEW.height - 30); }
    if (edge === 3) { x = VIEW.width + 30; y = rng.range(30, VIEW.height - 30); }
    if (Math.hypot(x - player.x, y - player.y) > 260) break;
  }
  const spec = ENEMIES[kind];
  return {
    id: nextId++,
    kind,
    x, y,
    vx: 0, vy: 0,
    hp: spec.hp,
    maxHp: spec.hp,
    radius: spec.radius,
    age: 0,
    warp: 0.55,
    flash: 0,
    phase: rng.range(0, Math.PI * 2),
    orbitDir: rng.sign(),
    fireTimer: rng.range(1.4, 2.8),
    rot: rng.range(0, Math.PI * 2),
  };
}

export function updateEnemy(enemy, dt, game) {
  enemy.age += dt;
  enemy.flash = Math.max(0, enemy.flash - dt);
  enemy.rot += dt * (enemy.kind === 'bulwark' ? 0.5 : 1.4);
  if (enemy.warp > 0) {
    enemy.warp -= dt;
    return;
  }
  const player = game.player;
  const dx = player.x - enemy.x;
  const dy = player.y - enemy.y;
  const dist = Math.max(1, Math.hypot(dx, dy));
  const ux = dx / dist;
  const uy = dy / dist;
  const spec = ENEMIES[enemy.kind];
  const speedScale = game.waveSpeedScale;

  if (enemy.kind === 'drifter') {
    enemy.vx = ux * spec.speed * speedScale;
    enemy.vy = uy * spec.speed * speedScale;
  } else if (enemy.kind === 'darter') {
    const weave = Math.sin(enemy.age * 6 + enemy.phase) * 0.75;
    const px = -uy * weave;
    const py = ux * weave;
    enemy.vx = (ux + px) * spec.speed * speedScale;
    enemy.vy = (uy + py) * spec.speed * speedScale;
  } else if (enemy.kind === 'bulwark') {
    enemy.vx = ux * spec.speed * speedScale;
    enemy.vy = uy * spec.speed * speedScale;
  } else if (enemy.kind === 'weaver') {
    const want = 300;
    const radial = dist > want + 30 ? 1 : dist < want - 30 ? -0.7 : 0;
    const tx = -uy * enemy.orbitDir;
    const ty = ux * enemy.orbitDir;
    enemy.vx = (ux * radial + tx * 0.8) * spec.speed * speedScale;
    enemy.vy = (uy * radial + ty * 0.8) * spec.speed * speedScale;
    enemy.fireTimer -= dt;
    if (enemy.fireTimer <= 0 && dist < 560 && !player.dead) {
      enemy.fireTimer = game.rng.range(2.1, 3.1);
      game.hostiles.push({
        x: enemy.x, y: enemy.y,
        vx: ux * PLASMA.speed, vy: uy * PLASMA.speed,
        r: PLASMA.radius, life: PLASMA.life,
      });
      game.sound.enemyHit();
    }
  }
  enemy.x += enemy.vx * dt;
  enemy.y += enemy.vy * dt;
}

export function splitBulwark(enemy, game) {
  for (let i = 0; i < 3; i += 1) {
    const child = spawnEnemy('drifter', game.rng, game.player);
    const angle = (i / 3) * Math.PI * 2 + game.rng.range(0, 1);
    child.x = enemy.x + Math.cos(angle) * 20;
    child.y = enemy.y + Math.sin(angle) * 20;
    child.warp = 0.25;
    game.enemies.push(child);
  }
}
