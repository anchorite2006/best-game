// The simulation core: owns every entity list and the run's score state, and steps
// the whole world forward one fixed tick at a time — player, waves, enemies, bullets,
// plasma, pickups, then every collision between them. It knows nothing about pages
// or menus; the orchestrator feeds it input and asks the renderer to draw it.

import { PlayerShip } from './player.js';
import { WaveDirector } from './waves.js';
import { Effects } from './effects.js';
import { updateEnemy, splitBulwark } from './enemies.js';
import { rollDrops, updatePickup, touchesPlayer, powerStyle } from './pickups.js';
import { ENEMIES, OVERDRIVE, COMBO, WAVES, VIEW, COLORS } from './config.js';

export class Game {
  constructor(rng, sound) {
    this.rng = rng;
    this.sound = sound;
    this.effects = new Effects(rng);
    this.player = new PlayerShip();
    this.waves = new WaveDirector();
    this.reset();
  }

  reset() {
    this.time = 0;
    this.enemies = [];
    this.bullets = [];
    this.hostiles = [];
    this.pickups = [];
    this.player.reset();
    this.waves.reset();
    this.effects.particles = [];
    this.effects.waves = [];
    this.effects.texts = [];
    this.score = 0;
    this.kills = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.bestCombo = 0;
    this.overdrive = { charge: 0, active: false, until: 0 };
    this.endless = false;
    this.phase = 'playing'; // playing | won | over
    this.hitStop = 0;
    this.deathTimer = 0;
    this.banner = null;
  }

  get spawnInterval() {
    return Math.max(WAVES.spawnIntervalMin, WAVES.spawnIntervalStart - this.waves.wave * 0.055);
  }

  get waveSpeedScale() {
    return 1 + Math.min(0.5, this.waves.wave * 0.032);
  }

  multiplier() {
    return 1 + Math.min(COMBO.maxMultiplier - 1, Math.floor(this.combo / 4));
  }

  onWaveStart(n) {
    this.banner = {
      text: `WAVE ${n}`,
      sub: n === 1 ? 'The swarm is coming' : n === WAVES.victoryWave ? 'Final wave — hold the line' : '',
      until: this.time + 1.9,
    };
    this.sound.waveHorn();
  }

  onWaveCleared(n) {
    const bonus = 100 * n;
    this.score += bonus;
    this.effects.floatText(VIEW.width / 2, 210, `WAVE ${n} CLEAR  +${bonus}`, COLORS.accent, 24);
  }

  onVictory() {
    if (this.phase === 'playing') {
      this.phase = 'won';
      this.sound.victory();
    }
  }

  tryOverdrive() {
    if (this.overdrive.active || this.overdrive.charge < OVERDRIVE.max || this.player.dead) return;
    this.overdrive.active = true;
    this.overdrive.until = this.time + OVERDRIVE.duration;
    this.overdrive.charge = 0;
    this.effects.shockwave(this.player.x, this.player.y, COLORS.accent, 150);
    this.effects.floatText(this.player.x, this.player.y - 34, 'OVERDRIVE', COLORS.accent, 22);
    this.sound.overdrive();
  }

  addKillScore(enemy) {
    const base = ENEMIES[enemy.kind].score;
    const total = base * this.multiplier();
    this.score += total;
    this.effects.floatText(enemy.x, enemy.y - 10, `+${total}`, COLORS.hud, 15);
  }

  killEnemy(enemy) {
    enemy.dead = true;
    this.kills += 1;
    this.combo += 1;
    this.comboTimer = COMBO.window;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.addKillScore(enemy);
    const color = COLORS[enemy.kind];
    const big = enemy.kind === 'bulwark';
    this.effects.burst(enemy.x, enemy.y, color, big ? 42 : 18, big ? 380 : 300, big ? 4 : 3, 0.6);
    if (big) {
      this.effects.shockwave(enemy.x, enemy.y, color, 130);
      this.effects.addShake(7);
      this.hitStop = Math.max(this.hitStop, 0.045);
      splitBulwark(enemy, this);
    } else {
      this.effects.addShake(1.2);
    }
    this.sound.enemyDown(big);
    for (const drop of rollDrops(this, enemy)) this.pickups.push(drop);
  }

  collectPickup(pickup) {
    const player = this.player;
    if (pickup.kind === 'shard') {
      this.score += 25;
      this.overdrive.charge = Math.min(OVERDRIVE.max, this.overdrive.charge + OVERDRIVE.perShard);
      this.effects.floatText(pickup.x, pickup.y - 8, '+25', COLORS.shard, 13);
      this.sound.shard();
      return;
    }
    if (pickup.kind === 'repair') {
      player.lives = Math.min(5, player.lives + 1);
      this.effects.floatText(player.x, player.y - 28, '+1 HULL', '#ff7d9c', 18);
      this.sound.powerup();
      return;
    }
    player.grantWeapon(pickup.kind, this.time);
    this.effects.floatText(player.x, player.y - 28, powerStyle(pickup.kind).name, powerStyle(pickup.kind).color, 18);
    this.effects.burst(player.x, player.y, powerStyle(pickup.kind).color, 12, 160, 2.5, 0.4);
    this.sound.powerup();
  }

  step(dt, input) {
    if (this.hitStop > 0) {
      this.hitStop -= dt;
      this.effects.update(dt * 0.25);
      return;
    }
    this.time += dt;
    this.effects.update(dt);

    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }
    if (this.overdrive.active && this.time > this.overdrive.until) this.overdrive.active = false;

    if (this.phase === 'playing' || this.phase === 'won') {
      this.player.update(dt, input, this);
      if (this.phase === 'playing') this.waves.update(dt, this);
    }

    for (const enemy of this.enemies) updateEnemy(enemy, dt, this);
    this.bullets = this.bullets.filter((b) => {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      return b.life > 0 && b.x > -20 && b.x < VIEW.width + 20 && b.y > -20 && b.y < VIEW.height + 20;
    });
    this.hostiles = this.hostiles.filter((h) => {
      h.x += h.vx * dt;
      h.y += h.vy * dt;
      h.life -= dt;
      return h.life > 0;
    });
    this.pickups = this.pickups.filter((p) => updatePickup(p, dt, this));

    this.collide();

    this.enemies = this.enemies.filter((e) => !e.dead);
    if (this.player.dead && this.phase === 'playing') {
      this.deathTimer += dt;
      if (this.deathTimer > 1.15) {
        this.phase = 'over';
        this.sound.gameOver();
      }
    }
  }

  collide() {
    const player = this.player;
    // Bullets against enemies, then against plasma orbs (which can be shot down).
    for (const bullet of this.bullets) {
      if (bullet.dead) continue;
      for (const enemy of this.enemies) {
        if (enemy.dead || enemy.warp > 0.1) continue;
        const rr = enemy.radius + bullet.r;
        if (Math.abs(enemy.x - bullet.x) < rr && Math.abs(enemy.y - bullet.y) < rr
          && Math.hypot(enemy.x - bullet.x, enemy.y - bullet.y) < rr) {
          bullet.dead = true;
          enemy.hp -= 1;
          enemy.flash = 0.09;
          this.effects.burst(bullet.x, bullet.y, COLORS[enemy.kind], 3, 160, 2, 0.3);
          if (enemy.hp <= 0) this.killEnemy(enemy);
          else this.sound.enemyHit();
          break;
        }
      }
      if (bullet.dead) continue;
      for (const orb of this.hostiles) {
        if (orb.dead) continue;
        if (Math.hypot(orb.x - bullet.x, orb.y - bullet.y) < orb.r + bullet.r + 2) {
          bullet.dead = true;
          orb.dead = true;
          this.score += 10;
          this.effects.burst(orb.x, orb.y, COLORS.plasma, 8, 200, 2.5, 0.4);
          break;
        }
      }
    }
    this.bullets = this.bullets.filter((b) => !b.dead);
    this.hostiles = this.hostiles.filter((h) => !h.dead);

    if (player.dead) return;
    // Enemies and orbs against the warden.
    for (const enemy of this.enemies) {
      if (enemy.dead || enemy.warp > 0) continue;
      const rr = enemy.radius + player.radius - 3;
      if (Math.hypot(enemy.x - player.x, enemy.y - player.y) < rr) {
        const result = player.takeHit(this);
        if (result !== 'ignored') {
          enemy.dead = true;
          this.effects.burst(enemy.x, enemy.y, COLORS[enemy.kind], 16, 280, 3, 0.5);
          if (result === 'dead') return;
        }
      }
    }
    for (const orb of this.hostiles) {
      if (Math.hypot(orb.x - player.x, orb.y - player.y) < orb.r + player.radius - 2) {
        const result = player.takeHit(this);
        if (result !== 'ignored') {
          orb.dead = true;
          if (result === 'dead') return;
        }
      }
    }
    this.hostiles = this.hostiles.filter((h) => !h.dead);
    // Pickups against the warden.
    this.pickups = this.pickups.filter((p) => {
      if (touchesPlayer(p, player)) {
        this.collectPickup(p);
        return false;
      }
      return true;
    });
  }
}
