// The wave director: turns the recipe for each wave into a shuffled spawn queue,
// feeds enemies in at a quickening pace, watches for the wave to be cleared, and
// calls the run won when the victory wave falls (unless endless play is on).

import { waveRecipe, WAVES } from './config.js';
import { spawnEnemy } from './enemies.js';

export class WaveDirector {
  constructor() {
    this.reset();
  }

  reset() {
    this.wave = 0;
    this.state = 'intermission'; // intermission | spawning | active | done
    this.timer = 1.4;
    this.queue = [];
    this.spawnTimer = 0;
  }

  get remainingToSpawn() {
    return this.queue.length;
  }

  startWave(game, n) {
    this.wave = n;
    const recipe = waveRecipe(n);
    this.queue = [];
    for (const kind of Object.keys(recipe)) {
      for (let i = 0; i < recipe[kind]; i += 1) this.queue.push(kind);
    }
    for (let i = this.queue.length - 1; i > 0; i -= 1) {
      const j = Math.floor(game.rng.next() * (i + 1));
      const tmp = this.queue[i];
      this.queue[i] = this.queue[j];
      this.queue[j] = tmp;
    }
    this.state = 'spawning';
    this.spawnTimer = 0.1;
    game.onWaveStart(n);
  }

  update(dt, game) {
    if (this.state === 'intermission') {
      this.timer -= dt;
      if (this.timer <= 0) this.startWave(game, this.wave + 1);
      return;
    }
    if (this.state === 'spawning' || this.state === 'active') {
      if (this.queue.length > 0) {
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
          this.spawnTimer = game.spawnInterval;
          const kind = this.queue.shift();
          game.enemies.push(spawnEnemy(kind, game.rng, game.player));
          if (this.queue.length === 0) this.state = 'active';
        }
      } else if (game.enemies.length === 0 && this.state === 'active') {
        game.onWaveCleared(this.wave);
        if (this.wave >= WAVES.victoryWave && !game.endless) {
          this.state = 'done';
          game.onVictory();
        } else {
          this.state = 'intermission';
          this.timer = WAVES.intermission;
        }
      }
    }
  }
}
