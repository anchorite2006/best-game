// Visual feedback: the parallax starfield, explosion particles, shockwaves, floating
// score text and screen shake. Every hit, kill and pickup in the game speaks through
// this module, which is what makes the action read as juicy rather than silent.

import { VIEW, COLORS } from './config.js';

export class Effects {
  constructor(rng) {
    this.particles = [];
    this.waves = [];
    this.texts = [];
    this.shake = 0;
    this.stars = [];
    const layers = [
      { count: 120, speed: 6, size: 1, alpha: 0.5 },
      { count: 84, speed: 14, size: 1.6, alpha: 0.75 },
      { count: 40, speed: 26, size: 2.4, alpha: 1 },
      { count: 10, speed: 18, size: 3.4, alpha: 1 },
    ];
    for (const layer of layers) {
      for (let i = 0; i < layer.count; i += 1) {
        this.stars.push({
          x: rng.range(0, VIEW.width),
          y: rng.range(0, VIEW.height),
          speed: layer.speed,
          size: layer.size * rng.range(0.7, 1.35),
          alpha: layer.alpha * rng.range(0.7, 1),
          twinkle: rng.range(0, Math.PI * 2),
          bright: layer.size >= 3,
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
    grad.addColorStop(0, COLORS.spaceTop);
    grad.addColorStop(1, COLORS.spaceBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    // Layered radial nebula clouds: large soft washes first, then smaller
    // brighter cores, all in the palette so sprites still sit on top.
    const clouds = [
      { x: 280, y: 140, r: 420, color: COLORS.nebulaA },
      { x: 1040, y: 560, r: 470, color: COLORS.nebulaA },
      { x: 900, y: 120, r: 330, color: COLORS.nebulaB },
      { x: 170, y: 610, r: 360, color: COLORS.nebulaB },
      { x: 640, y: 380, r: 520, color: COLORS.nebulaC },
      { x: 430, y: 300, r: 190, color: 'rgba(86, 64, 180, 0.16)' },
      { x: 980, y: 300, r: 170, color: 'rgba(20, 140, 160, 0.14)' },
      { x: 180, y: 380, r: 150, color: 'rgba(112, 44, 138, 0.12)' },
    ];
    for (const cloud of clouds) {
      const rg = ctx.createRadialGradient(cloud.x, cloud.y, 0, cloud.x, cloud.y, cloud.r);
      rg.addColorStop(0, cloud.color);
      rg.addColorStop(0.55, cloud.color.replace(/[\d.]+\)$/, '0.05)'));
      rg.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = rg;
      ctx.fillRect(cloud.x - cloud.r, cloud.y - cloud.r, cloud.r * 2, cloud.r * 2);
    }
    // Faint distant dust band for depth across the middle: a squashed radial
    // gradient, so it fades out with no hard ellipse edge.
    ctx.save();
    ctx.translate(640, 360);
    ctx.rotate(-0.18);
    ctx.scale(1, 0.22);
    const dust = ctx.createRadialGradient(0, 0, 0, 0, 0, 700);
    dust.addColorStop(0, 'rgba(143, 184, 255, 0.055)');
    dust.addColorStop(0.7, 'rgba(143, 184, 255, 0.025)');
    dust.addColorStop(1, 'rgba(143, 184, 255, 0)');
    ctx.fillStyle = dust;
    ctx.beginPath();
    ctx.arc(0, 0, 700, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    for (const star of this.stars) {
      const tw = 0.7 + 0.3 * Math.sin(star.twinkle);
      ctx.globalAlpha = star.alpha * tw;
      ctx.fillStyle = star.bright ? '#ffffff' : '#cfe9ff';
      if (star.bright) {
        ctx.shadowColor = '#cfe9ff';
        ctx.shadowBlur = 8;
      }
      ctx.fillRect(star.x, star.y, star.size, star.size);
      ctx.shadowBlur = 0;
      if (star.bright) {
        ctx.globalAlpha = star.alpha * tw * 0.55;
        ctx.fillRect(star.x - star.size * 1.6, star.y + star.size * 0.35, star.size * 4.2, 1);
        ctx.fillRect(star.x + star.size * 0.35, star.y - star.size * 1.6, 1, star.size * 4.2);
      }
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
