// The warden skiff the player flies: movement with a dash, mouse aim, three weapon
// states (standard, rapid cell, tri-blaster), an aegis shield and the overdrive mode
// that ember shards charge. Firing writes bullets into the game's bullet list.

import { PLAYER, WEAPONS, OVERDRIVE, VIEW, COLORS } from './config.js';

export class PlayerShip {
  constructor() {
    this.reset();
  }

  reset() {
    this.x = VIEW.width / 2;
    this.y = VIEW.height / 2 + 120;
    this.vx = 0;
    this.vy = 0;
    this.angle = -Math.PI / 2;
    this.radius = PLAYER.radius;
    this.lives = PLAYER.startLives;
    this.invulnerable = 0;
    this.fireTimer = 0;
    this.weapon = null; // { kind: 'rapid' | 'tri', until: seconds }
    this.shieldUntil = -1;
    this.dashTimer = 0;
    this.dashCooldown = 0;
    this.dashDir = { x: 0, y: -1 };
    this.dead = false;
  }

  get shielded() {
    return this.shieldUntil > 0;
  }

  weaponAt(time) {
    if (this.weapon && time < this.weapon.until) return this.weapon.kind;
    return null;
  }

  grantWeapon(kind, time) {
    if (kind === 'shield') {
      this.shieldUntil = time + WEAPONS.shieldTime;
    } else {
      const span = kind === 'rapid' ? WEAPONS.rapidTime : WEAPONS.triTime;
      this.weapon = { kind, until: time + span };
    }
  }

  tryDash(input, game) {
    if (this.dashCooldown > 0 || this.dead) return;
    const move = input.moveVector();
    const dir = move.x !== 0 || move.y !== 0 ? move : { x: Math.cos(this.angle), y: Math.sin(this.angle) };
    this.dashDir = dir;
    this.dashTimer = PLAYER.dashTime;
    this.dashCooldown = PLAYER.dashCooldown;
    this.invulnerable = Math.max(this.invulnerable, PLAYER.dashTime + 0.08);
    game.sound.dash();
    game.effects.burst(this.x, this.y, COLORS.player, 8, 140, 2.5, 0.3);
  }

  update(dt, input, game) {
    if (this.dead) return;
    const time = game.time;
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    if (this.shieldUntil > 0 && time > this.shieldUntil) this.shieldUntil = -1;
    if (this.weapon && time > this.weapon.until) this.weapon = null;

    const move = input.moveVector();
    if (this.dashTimer > 0) {
      this.dashTimer -= dt;
      this.vx = this.dashDir.x * PLAYER.dashSpeed;
      this.vy = this.dashDir.y * PLAYER.dashSpeed;
      game.effects.trail(this.x, this.y, COLORS.player, 5);
    } else {
      const accel = 2600;
      this.vx += move.x * accel * dt;
      this.vy += move.y * accel * dt;
      const damp = Math.pow(0.0018, dt);
      this.vx *= damp;
      this.vy *= damp;
      const speed = Math.hypot(this.vx, this.vy);
      if (speed > PLAYER.speed) {
        this.vx = (this.vx / speed) * PLAYER.speed;
        this.vy = (this.vy / speed) * PLAYER.speed;
      }
      if (move.x !== 0 || move.y !== 0) {
        game.effects.trail(
          this.x - move.x * this.radius,
          this.y - move.y * this.radius,
          'rgba(87, 247, 255, 0.7)',
          3,
        );
      }
    }
    this.x = Math.min(VIEW.width - this.radius, Math.max(this.radius, this.x + this.vx * dt));
    this.y = Math.min(VIEW.height - this.radius, Math.max(this.radius, this.y + this.vy * dt));
    this.angle = Math.atan2(input.mouse.y - this.y, input.mouse.x - this.x);

    this.fireTimer -= dt;
    if (input.firing() && this.fireTimer <= 0) {
      this.shoot(game);
      const kind = this.weaponAt(time);
      let interval = kind === 'rapid' ? WEAPONS.rapidInterval : PLAYER.fireInterval;
      if (game.overdrive.active) interval *= OVERDRIVE.fireScale;
      this.fireTimer = interval;
    }
  }

  shoot(game) {
    const kind = this.weaponAt(game.time);
    const angles = [this.angle];
    if (kind === 'tri') angles.push(this.angle - WEAPONS.triSpread, this.angle + WEAPONS.triSpread);
    const offsets = game.overdrive.active ? [-6, 6] : [0];
    for (const a of angles) {
      for (const off of offsets) {
        const px = this.x + Math.cos(this.angle) * (this.radius + 4) - Math.sin(this.angle) * off;
        const py = this.y + Math.sin(this.angle) * (this.radius + 4) + Math.cos(this.angle) * off;
        game.bullets.push({
          x: px,
          y: py,
          vx: Math.cos(a) * PLAYER.bulletSpeed,
          vy: Math.sin(a) * PLAYER.bulletSpeed,
          r: PLAYER.bulletRadius,
          life: 0.9,
        });
      }
    }
    game.effects.trail(
      this.x + Math.cos(this.angle) * (this.radius + 8),
      this.y + Math.sin(this.angle) * (this.radius + 8),
      COLORS.bullet,
      4,
    );
    game.sound.shoot();
  }

  // Returns 'shield' when the aegis eats the hit, 'hit' when a life is lost,
  // 'ignored' while invulnerable, and 'dead' when the last life is gone.
  takeHit(game) {
    if (this.invulnerable > 0 || this.dead) return 'ignored';
    if (this.shielded) {
      this.shieldUntil = -1;
      this.invulnerable = 1.2;
      game.effects.shockwave(this.x, this.y, COLORS.player, 70);
      game.effects.floatText(this.x, this.y - 26, 'AEGIS DOWN', COLORS.player, 16);
      return 'shield';
    }
    this.lives -= 1;
    this.invulnerable = PLAYER.invulnerableTime;
    game.effects.burst(this.x, this.y, COLORS.danger, 30, 320, 3.5, 0.7);
    game.effects.shockwave(this.x, this.y, COLORS.danger, 110);
    game.effects.addShake(13);
    game.sound.playerHit();
    if (this.lives <= 0) {
      this.dead = true;
      game.effects.burst(this.x, this.y, COLORS.player, 60, 420, 4, 1);
      game.effects.burst(this.x, this.y, COLORS.accent, 30, 300, 3, 0.9);
      return 'dead';
    }
    return 'hit';
  }
}
