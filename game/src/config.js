// EMBERFALL tuning: every balance number and the whole colour palette live here, so the
// rest of the game reads them instead of scattering magic values through the code.

export const VIEW = { width: 1280, height: 720 };

export const COLORS = {
  spaceTop: '#070b1d',
  spaceBottom: '#0d1030',
  nebulaA: 'rgba(64, 42, 128, 0.20)',
  nebulaB: 'rgba(14, 92, 110, 0.16)',
  player: '#57f7ff',
  playerCore: '#eaffff',
  bullet: '#aefcff',
  drifter: '#ff9a3d',
  darter: '#ff4d7e',
  bulwark: '#b78cff',
  weaver: '#3ddc97',
  plasma: '#7dffce',
  shard: '#ffd94d',
  danger: '#ff5252',
  hud: '#d9f6ff',
  hudDim: '#7fa8bf',
  accent: '#ffd94d',
};

export const PLAYER = {
  radius: 13,
  speed: 335,
  dashSpeed: 980,
  dashTime: 0.16,
  dashCooldown: 1.6,
  fireInterval: 0.16,
  bulletSpeed: 760,
  bulletRadius: 4,
  startLives: 3,
  maxLives: 5,
  invulnerableTime: 2.0,
};

export const WEAPONS = {
  rapidTime: 12,
  rapidInterval: 0.085,
  triTime: 12,
  triSpread: 0.16,
  shieldTime: 20,
};

export const OVERDRIVE = {
  max: 100,
  perShard: 9,
  duration: 6,
  fireScale: 0.55,
};

export const COMBO = { window: 2.5, maxMultiplier: 5 };

export const ENEMIES = {
  drifter: { radius: 15, hp: 2, speed: 96, score: 50, contact: 1 },
  darter: { radius: 11, hp: 1, speed: 218, score: 80, contact: 1 },
  bulwark: { radius: 30, hp: 11, speed: 42, score: 250, contact: 1 },
  weaver: { radius: 16, hp: 4, speed: 120, score: 150, contact: 1 },
};

export const PLASMA = { radius: 6, speed: 205, life: 4.5 };

export const DROPS = {
  shardChance: 0.55,
  powerChance: 0.16,
  repairChanceFromBulwark: 0.35,
  powerKinds: ['rapid', 'tri', 'shield'],
};

export const WAVES = {
  intermission: 2.6,
  spawnIntervalStart: 0.95,
  spawnIntervalMin: 0.34,
  victoryWave: 10,
};

// The wave director's recipe: how many of each kind a wave sends, by wave number.
// Past the table the last row keeps growing, so endless play keeps tightening.
export function waveRecipe(wave) {
  const drifters = 5 + wave * 2;
  const darters = wave < 2 ? 0 : 2 + wave;
  const bulwarks = wave < 3 ? 0 : Math.floor((wave - 1) / 2);
  const weavers = wave < 4 ? 0 : Math.floor(wave / 2);
  return { drifter: drifters, darter: darters, bulwark: bulwarks, weaver: weavers };
}
