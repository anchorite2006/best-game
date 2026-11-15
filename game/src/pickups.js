// What the swarm leaves behind: ember shards (score and overdrive charge, drawn to
// the warden when close), weapon cells (rapid, tri-blaster), the aegis shield and
// the rare repair heart. Drops are decided here; the game applies their effects.

import { DROPS } from './config.js';

const POWER_STYLE = {
  rapid: { label: 'R', color: '#57f7ff', name: 'RAPID CELL' },
  tri: { label: 'T', color: '#ffd94d', name: 'TRI-BLASTER' },
  shield: { label: 'A', color: '#7dffce', name: 'AEGIS' },
  repair: { label: '+', color: '#ff7d9c', name: 'REPAIR' },
};

export function powerStyle(kind) {
  return POWER_STYLE[kind];
}

export function rollDrops(game, enemy) {
  const drops = [];
  if (game.rng.chance(DROPS.shardChance) || enemy.kind === 'bulwark') {
    const shards = enemy.kind === 'bulwark' ? 3 : 1;
    for (let i = 0; i < shards; i += 1) {
      drops.push(makePickup('shard', enemy.x, enemy.y, game.rng));
    }
  }
  if (enemy.kind === 'bulwark' && game.rng.chance(DROPS.repairChanceFromBulwark)) {
    drops.push(makePickup('repair', enemy.x, enemy.y, game.rng));
  } else if (game.rng.chance(DROPS.powerChance)) {
    drops.push(makePickup(game.rng.pick(DROPS.powerKinds), enemy.x, enemy.y, game.rng));
  }
  return drops;
}

function makePickup(kind, x, y, rng) {
  const angle = rng.range(0, Math.PI * 2);
  const speed = rng.range(20, 80);
  return {
    kind,
    x, y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    age: 0,
    life: kind === 'shard' ? 7 : 9,
    radius: kind === 'shard' ? 7 : 13,
  };
}

export function updatePickup(pickup, dt, game) {
  pickup.age += dt;
  const player = game.player;
  const dx = player.x - pickup.x;
  const dy = player.y - pickup.y;
  const dist = Math.max(1, Math.hypot(dx, dy));
  if (pickup.kind === 'shard' && dist < 150 && !player.dead) {
    const pull = 620 * (1 - dist / 170);
    pickup.vx += (dx / dist) * pull * dt * 3;
    pickup.vy += (dy / dist) * pull * dt * 3;
  }
  const damp = Math.pow(0.05, dt);
  pickup.vx *= damp;
  pickup.vy *= damp;
  pickup.x += pickup.vx * dt;
  pickup.y += pickup.vy * dt;
  return pickup.age < pickup.life;
}

export function touchesPlayer(pickup, player) {
  const reach = player.radius + pickup.radius + 4;
  return Math.hypot(pickup.x - player.x, pickup.y - player.y) < reach;
}
