// Everything the player sees: the world (ships, swarm, orbs, pickups), the HUD and
// the full-screen states — title, pause, game over and victory. Drawing is kept out
// of the simulation so game.js never touches a canvas context.

import { VIEW, COLORS, OVERDRIVE, WAVES } from './config.js';
import { powerStyle } from './pickups.js';

const FONT = '"Segoe UI", system-ui, -apple-system, sans-serif';

function text(ctx, str, x, y, size, color, align = 'center', weight = 700) {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(str, x, y);
}

export function drawScene(ctx, game, options = {}) {
  const shake = game.effects.shakeOffset();
  ctx.save();
  ctx.translate(shake.x, shake.y);
  game.effects.drawBackground(ctx);
  for (const pickup of game.pickups) drawPickup(ctx, pickup, game.time);
  for (const orb of game.hostiles) drawPlasma(ctx, orb, game.time);
  for (const enemy of game.enemies) drawEnemy(ctx, enemy);
  drawBullets(ctx, game.bullets);
  if (!game.player.dead && !options.hidePlayer) drawPlayer(ctx, game);
  game.effects.drawBursts(ctx);
  ctx.restore();
}

function drawPlayer(ctx, game) {
  const p = game.player;
  const blink = p.invulnerable > 0 && Math.floor(game.time * 14) % 2 === 0;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  ctx.globalAlpha = blink ? 0.35 : 1;
  // Engine flame, flickering with time and stronger while dashing.
  const moving = Math.hypot(p.vx, p.vy) > 30;
  if (moving) {
    const flame = 10 + Math.sin(game.time * 40) * 3 + (p.dashTimer > 0 ? 12 : 0);
    ctx.fillStyle = 'rgba(255, 170, 60, 0.85)';
    ctx.beginPath();
    ctx.moveTo(-11, -4);
    ctx.lineTo(-11 - flame, 0);
    ctx.lineTo(-11, 4);
    ctx.closePath();
    ctx.fill();
  }
  const hull = ctx.createLinearGradient(-14, 0, 18, 0);
  hull.addColorStop(0, '#1d7f8c');
  hull.addColorStop(0.6, COLORS.player);
  hull.addColorStop(1, '#c8fbff');
  ctx.fillStyle = hull;
  ctx.beginPath();
  ctx.moveTo(19, 0);
  ctx.lineTo(-6, -6);
  ctx.lineTo(-13, -13);
  ctx.lineTo(-10, -3);
  ctx.lineTo(-10, 3);
  ctx.lineTo(-13, 13);
  ctx.lineTo(-6, 6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = COLORS.playerCore;
  ctx.beginPath();
  ctx.arc(4, 0, 3.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  if (p.shielded) {
    ctx.save();
    ctx.globalAlpha = 0.55 + 0.2 * Math.sin(game.time * 5);
    ctx.strokeStyle = COLORS.plasma;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius + 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawBullets(ctx, bullets) {
  ctx.save();
  ctx.strokeStyle = COLORS.bullet;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.shadowColor = COLORS.player;
  ctx.shadowBlur = 6;
  ctx.beginPath();
  for (const b of bullets) {
    const back = 0.018;
    ctx.moveTo(b.x - b.vx * back, b.y - b.vy * back);
    ctx.lineTo(b.x, b.y);
  }
  ctx.stroke();
  ctx.restore();
}

function drawPlasma(ctx, orb, time) {
  const pulse = 1 + 0.18 * Math.sin(time * 10 + orb.x);
  ctx.save();
  ctx.fillStyle = 'rgba(125, 255, 206, 0.25)';
  ctx.beginPath();
  ctx.arc(orb.x, orb.y, orb.r * 2 * pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLORS.plasma;
  ctx.beginPath();
  ctx.arc(orb.x, orb.y, orb.r * pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawEnemy(ctx, enemy) {
  const color = COLORS[enemy.kind];
  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  if (enemy.warp > 0) {
    const k = 1 - enemy.warp / 0.55;
    ctx.globalAlpha = 0.25 + 0.75 * k;
    ctx.scale(0.5 + 0.5 * k, 0.5 + 0.5 * k);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, enemy.radius + 12 * (1 - k), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.rotate(enemy.rot);
  ctx.fillStyle = color;
  if (enemy.kind === 'drifter') {
    ctx.beginPath();
    ctx.moveTo(15, 0);
    ctx.lineTo(-11, 10);
    ctx.lineTo(-6, 0);
    ctx.lineTo(-11, -10);
    ctx.closePath();
    ctx.fill();
  } else if (enemy.kind === 'darter') {
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(-4, 4);
    ctx.lineTo(-12, 9);
    ctx.lineTo(-9, 0);
    ctx.lineTo(-12, -9);
    ctx.lineTo(-4, -4);
    ctx.closePath();
    ctx.fill();
  } else if (enemy.kind === 'bulwark') {
    polygon(ctx, 0, 0, enemy.radius, 6);
    ctx.fill();
    ctx.rotate(-enemy.rot * 1.7);
    ctx.fillStyle = 'rgba(10, 8, 30, 0.55)';
    polygon(ctx, 0, 0, enemy.radius * 0.58, 6);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fill();
  } else if (enemy.kind === 'weaver') {
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(0, 10);
    ctx.lineTo(-16, 0);
    ctx.lineTo(0, -10);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(10, 30, 24, 0.6)';
    ctx.beginPath();
    ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }
  if (enemy.flash > 0) {
    ctx.globalAlpha = Math.min(1, enemy.flash * 9);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, enemy.radius * 0.85, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  if (enemy.kind === 'bulwark' && enemy.hp < enemy.maxHp && enemy.warp <= 0) {
    const w = 52;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(enemy.x - w / 2, enemy.y - enemy.radius - 14, w, 5);
    ctx.fillStyle = COLORS.bulwark;
    ctx.fillRect(enemy.x - w / 2, enemy.y - enemy.radius - 14, (w * enemy.hp) / enemy.maxHp, 5);
  }
}

function polygon(ctx, x, y, r, sides) {
  ctx.beginPath();
  for (let i = 0; i < sides; i += 1) {
    const a = (i / sides) * Math.PI * 2;
    if (i === 0) ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    else ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath();
}

function drawPickup(ctx, pickup, time) {
  const fading = pickup.life - pickup.age < 2;
  if (fading && Math.floor(time * 8) % 2 === 0) return;
  ctx.save();
  ctx.translate(pickup.x, pickup.y + Math.sin(time * 3 + pickup.x) * 2.5);
  if (pickup.kind === 'shard') {
    ctx.rotate(time * 2.4);
    ctx.fillStyle = COLORS.shard;
    ctx.shadowColor = COLORS.shard;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(5.5, 0);
    ctx.lineTo(0, 8);
    ctx.lineTo(-5.5, 0);
    ctx.closePath();
    ctx.fill();
  } else {
    const style = powerStyle(pickup.kind);
    ctx.fillStyle = 'rgba(8, 12, 28, 0.9)';
    ctx.strokeStyle = style.color;
    ctx.lineWidth = 2;
    ctx.shadowColor = style.color;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.roundRect(-13, -13, 26, 26, 7);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    text(ctx, style.label, 0, 1, 16, style.color);
  }
  ctx.restore();
}

export function drawHUD(ctx, game) {
  const pad = 22;
  // Score and chain, top-left.
  text(ctx, `SCORE ${String(game.score).padStart(6, '0')}`, pad, 30, 22, COLORS.hud, 'left', 800);
  const mult = game.multiplier();
  if (game.combo > 1) {
    const frac = Math.max(0, game.comboTimer / 2.5);
    text(ctx, `CHAIN ${game.combo}  x${mult}`, pad, 58, 15, COLORS.accent, 'left', 700);
    ctx.fillStyle = 'rgba(255, 217, 77, 0.35)';
    ctx.fillRect(pad, 70, 110, 4);
    ctx.fillStyle = COLORS.accent;
    ctx.fillRect(pad, 70, 110 * frac, 4);
  }
  // Wave and hostiles remaining, top-centre.
  const left = game.enemies.length + game.waves.remainingToSpawn;
  const waveLabel = game.endless && game.waves.wave > WAVES.victoryWave
    ? `WAVE ${game.waves.wave} · ENDLESS`
    : `WAVE ${Math.max(1, game.waves.wave)}`;
  text(ctx, waveLabel, VIEW.width / 2, 30, 20, COLORS.hud, 'center', 800);
  text(ctx, left > 0 ? `${left} HOSTILE${left === 1 ? '' : 'S'}` : 'SECTOR CLEAR', VIEW.width / 2, 56, 13, COLORS.hudDim);
  // Hull (lives) and overdrive, top-right.
  for (let i = 0; i < game.player.lives; i += 1) {
    const x = VIEW.width - pad - 16 - i * 26;
    ctx.save();
    ctx.translate(x, 26);
    ctx.fillStyle = COLORS.player;
    ctx.beginPath();
    ctx.moveTo(9, 0);
    ctx.lineTo(-7, -7);
    ctx.lineTo(-4, 0);
    ctx.lineTo(-7, 7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  const od = game.overdrive;
  const barW = 170;
  const barX = VIEW.width - pad - barW;
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.fillRect(barX, 48, barW, 9);
  const frac = od.active ? Math.max(0, (od.until - game.time) / OVERDRIVE.duration) : od.charge / OVERDRIVE.max;
  ctx.fillStyle = od.active ? '#ffffff' : COLORS.accent;
  ctx.fillRect(barX, 48, barW * frac, 9);
  const ready = !od.active && od.charge >= OVERDRIVE.max;
  text(
    ctx,
    od.active ? 'OVERDRIVE!' : ready ? 'OVERDRIVE READY — E' : 'OVERDRIVE',
    VIEW.width - pad,
    70,
    12,
    ready ? COLORS.accent : COLORS.hudDim,
    'right',
    700,
  );
  // Active weapon chip, bottom-left.
  const kind = game.player.weaponAt(game.time);
  if (kind) {
    const remain = Math.max(0, game.player.weapon.until - game.time).toFixed(0);
    const style = powerStyle(kind);
    text(ctx, `${style.name}  ${remain}s`, pad, VIEW.height - 24, 15, style.color, 'left', 700);
  } else if (game.player.shielded) {
    text(ctx, 'AEGIS UP', pad, VIEW.height - 24, 15, powerStyle('shield').color, 'left', 700);
  }
  if (game.waves.wave <= 1 && game.time < 14 && game.phase === 'playing') {
    text(ctx, 'WASD / arrows — fly · mouse — aim · hold click or SPACE — fire · SHIFT — dash', VIEW.width / 2, VIEW.height - 24, 14, COLORS.hudDim);
  }
  // Wave banner.
  if (game.banner && game.time < game.banner.until) {
    const remain = game.banner.until - game.time;
    const alpha = Math.min(1, remain / 0.5, (1.9 - remain) * 3 + 0.4);
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    text(ctx, game.banner.text, VIEW.width / 2, 150, 54, COLORS.hud, 'center', 800);
    if (game.banner.sub) text(ctx, game.banner.sub, VIEW.width / 2, 192, 18, COLORS.accent);
    ctx.restore();
  }
  // Last hull warning.
  if (game.player.lives === 1 && !game.player.dead && game.phase === 'playing') {
    const pulse = 0.1 + 0.07 * Math.sin(game.time * 6);
    const grad = ctx.createRadialGradient(640, 360, 320, 640, 360, 720);
    grad.addColorStop(0, 'rgba(255,40,40,0)');
    grad.addColorStop(1, `rgba(255,40,40,${pulse})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  }
}

function dim(ctx, alpha) {
  ctx.fillStyle = `rgba(4, 6, 16, ${alpha})`;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
}

export function drawMenu(ctx, game, best, time) {
  drawScene(ctx, game, { hidePlayer: true });
  dim(ctx, 0.45);
  const cy = 218 + Math.sin(time * 1.4) * 5;
  ctx.save();
  ctx.shadowColor = COLORS.player;
  ctx.shadowBlur = 34;
  text(ctx, 'EMBERFALL', VIEW.width / 2, cy, 92, '#eaffff', 'center', 800);
  ctx.restore();
  text(ctx, 'W A R D E N S   O F   T H E   E M B E R   C O R E', VIEW.width / 2, cy + 66, 19, COLORS.accent);
  text(ctx, 'The swarm is eating the core worlds, one ember at a time.', VIEW.width / 2, cy + 116, 18, COLORS.hud);
  text(ctx, 'You are the last warden. Hold ten waves, chain your kills, and spend the embers on overdrive.', VIEW.width / 2, cy + 144, 18, COLORS.hud);
  const rows = [
    ['FLY', 'WASD or arrow keys'],
    ['AIM + FIRE', 'Mouse, hold click or SPACE'],
    ['DASH', 'SHIFT — a short invulnerable burst'],
    ['OVERDRIVE', 'Collect ember shards, then press E'],
    ['POWER CELLS', 'Rapid fire, tri-blaster, aegis shield, repairs'],
  ];
  rows.forEach(([k, v], i) => {
    const y = cy + 196 + i * 27;
    text(ctx, k, VIEW.width / 2 - 26, y, 15, COLORS.player, 'right', 800);
    text(ctx, v, VIEW.width / 2 - 12, y, 15, COLORS.hud, 'left', 400);
  });
  const blink = Math.floor(time * 1.6) % 2 === 0;
  if (blink) text(ctx, 'CLICK OR PRESS ENTER TO LAUNCH', VIEW.width / 2, cy + 356, 21, '#ffffff', 'center', 800);
  if (best > 0) text(ctx, `BEST SCORE ${best}`, VIEW.width / 2, cy + 392, 15, COLORS.hudDim);
}

export function drawGameOver(ctx, game, best, isNewBest) {
  drawScene(ctx, game);
  dim(ctx, 0.62);
  text(ctx, 'THE CORE HAS FALLEN', VIEW.width / 2, 218, 52, COLORS.danger, 'center', 800);
  text(ctx, `The swarm takes another world on wave ${game.waves.wave}.`, VIEW.width / 2, 264, 18, COLORS.hud);
  drawStats(ctx, game, 330);
  if (isNewBest) text(ctx, 'NEW BEST SCORE', VIEW.width / 2, 478, 19, COLORS.accent, 'center', 800);
  else if (best > 0) text(ctx, `BEST ${best}`, VIEW.width / 2, 478, 16, COLORS.hudDim);
  const blink = Math.floor(game.time * 1.6) % 2 === 0;
  if (blink) text(ctx, 'PRESS ENTER TO FLY AGAIN', VIEW.width / 2, 528, 20, '#ffffff', 'center', 800);
}

export function drawVictory(ctx, game, best) {
  drawScene(ctx, game);
  dim(ctx, 0.55);
  ctx.save();
  ctx.shadowColor = COLORS.accent;
  ctx.shadowBlur = 26;
  text(ctx, 'THE CORE HOLDS', VIEW.width / 2, 218, 56, '#fff3c4', 'center', 800);
  ctx.restore();
  text(ctx, `Ten waves broken. The ember lanes are quiet — for now.`, VIEW.width / 2, 264, 18, COLORS.hud);
  drawStats(ctx, game, 330);
  if (best > 0) text(ctx, `BEST ${best}`, VIEW.width / 2, 478, 16, COLORS.hudDim);
  text(ctx, 'PRESS C TO KEEP FLYING — ENDLESS WAVES', VIEW.width / 2, 524, 19, COLORS.accent, 'center', 800);
  text(ctx, 'or ENTER for a fresh run', VIEW.width / 2, 552, 15, COLORS.hudDim);
}

function drawStats(ctx, game, y) {
  const rows = [
    ['FINAL SCORE', String(game.score)],
    ['WAVE REACHED', String(game.waves.wave)],
    ['SWARM DOWN', String(game.kills)],
    ['BEST CHAIN', `${game.bestCombo} kills`],
  ];
  rows.forEach(([k, v], i) => {
    const yy = y + i * 34;
    text(ctx, k, VIEW.width / 2 - 30, yy, 16, COLORS.hudDim, 'right', 700);
    text(ctx, v, VIEW.width / 2 + 30, yy, 19, COLORS.hud, 'left', 800);
  });
}

export function drawPaused(ctx, game) {
  drawScene(ctx, game);
  dim(ctx, 0.55);
  text(ctx, 'PAUSED', VIEW.width / 2, 330, 44, COLORS.hud, 'center', 800);
  text(ctx, 'P or ESC to resume · M toggles sound', VIEW.width / 2, 376, 16, COLORS.hudDim);
}
