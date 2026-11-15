// Visual feedback: the parallax starfield, explosion particles, shockwaves, floating
// score text and screen shake. Every hit, kill and pickup in the game speaks through
// this module, which is what makes the action read as juicy rather than silent.

import { VIEW } from './config.js';

export class Effects {
  constructor(rng) {
    this.particles = [];
    this.waves = [];
    this.texts = [];
    this.shake = 0;
    this.stars = [];
    const layers = [
      { count: 70, speed: 6, size: 1, alpha: 0.5 },
      { count: 46, speed: 14, size: 1.6, alpha: 0.75 },
      { count: 22, speed: 26, size: 2.4, alpha: 1 },
    ];
    for (const layer of layers) {
      for (let i = 0; i < layer.count; i += 1) {
        this.stars.push({
          x: rng.range(0, VIEW.width),
          y: rng.range(0, VIEW.height),
          speed: layer.speed,
          size: layer.size,
          alpha: layer.alpha,
          twinkle: rng.range(0, Math.PI * 2),
        });
      }
    }
  }

  addShake(amount) {
    this.shake = Math.min(22, this.shake + amount);
  }

  burst(x, y, color, count, speed = 260, size = 3, life = 0.55) {
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const v = (0.25 + Math.random() * 0.75) * speed;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v,
        life: life * (0.5 + Math.random() * 0.8),
        maxLife: life,
        size: size * (0.6 + Math.random() * 0.9),
        color,
        drag: 2.6,
      });
    }
  }

  trail(x, y, color, size = 4) {
    this.particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 30,
      vy: (Math.random() - 0.5) * 30,
      life: 0.3,
      maxLife: 0.3,
      size,
      color,
      drag: 1,
    });
  }

  shockwave(x, y, color, maxR = 90) {
    this.waves.push({ x, y, r: 6, maxR, life: 0.32, maxLife: 0.32, color });
  }

  floatText(x, y, text, color, size = 17) {
    this.texts.push({ x, y, vy: -56, life: 0.9, maxLife: 0.9, text, color, size });
  }

  update(dt) {
    for (const star of this.stars) {
      star.y += star.speed * dt;
      star.twinkle += dt * 2;
      if (star.y > VIEW.height + 2) {
        star.y = -2;
        star.x = Math.random() * VIEW.width;
      }
    }
    this.particles = this.particles.filter((p) => {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const dragK = Math.max(0, 1 - p.drag * dt);
      p.vx *= dragK;
      p.vy *= dragK;
      return p.life > 0;
    });
    this.waves = this.waves.filter((w) => {
      w.life -= dt;
      w.r = w.maxR * (1 - w.life / w.maxLife);
      return w.life > 0;
    });
    this.texts = this.texts.filter((t) => {
      t.life -= dt;
      t.y += t.vy * dt;
      return t.life > 0;
    });
    this.shake = Math.max(0, this.shake - dt * 46);
  }

  drawBackground(ctx) {
    const grad = ctx.createLinearGradient(0, 0, 0, VIEW.height);
    grad.addColorStop(0, '#070b1d');
    grad.addColorStop(1, '#0d1030');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.fillStyle = 'rgba(64, 42, 128, 0.20)';
    ctx.beginPath();
    ctx.ellipse(300, 150, 340, 150, 0.4, 0, Math.PI * 2);
    ctx.ellipse(1020, 560, 380, 170, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(14, 92, 110, 0.16)';
    ctx.beginPath();
    ctx.ellipse(880, 130, 260, 110, 0.2, 0, Math.PI * 2);
    ctx.ellipse(180, 600, 300, 130, 0, 0, Math.PI * 2);
    ctx.fill();
    for (const star of this.stars) {
      const tw = 0.7 + 0.3 * Math.sin(star.twinkle);
      ctx.globalAlpha = star.alpha * tw;
      ctx.fillStyle = '#cfe9ff';
      ctx.fillRect(star.x, star.y, star.size, star.size);
    }
    ctx.globalAlpha = 1;
  }

  drawBursts(ctx) {
    for (const w of this.waves) {
      ctx.globalAlpha = Math.max(0, (w.life / w.maxLife) * 0.8);
      ctx.strokeStyle = w.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(w.x, w.y, w.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    for (const t of this.texts) {
      ctx.globalAlpha = Math.max(0, t.life / t.maxLife);
      ctx.fillStyle = t.color;
      ctx.font = `700 ${t.size}px "Segoe UI", system-ui, sans-serif`;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }

  shakeOffset() {
    if (this.shake <= 0.1) return { x: 0, y: 0 };
    return {
      x: (Math.random() * 2 - 1) * this.shake,
      y: (Math.random() * 2 - 1) * this.shake,
    };
  }
}
