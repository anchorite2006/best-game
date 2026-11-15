// EMBERFALL's bootstrap and orchestrator: owns the canvas, the fixed-timestep loop
// and the page-level states (menu, playing, paused, game over, victory) around the
// simulation in game.js. It also routes the ?shot= staging hook the screenshots use.
//
// ?seed=N fixes the random seed for a repeatable run. ?shot=start|play|late|end
// (with &seed=N) stages that scene instead of running the loop, paints it and sets
// window.__shotReady for the screenshot tool.

import { Game } from './game.js';
import { Input } from './input.js';
import { SoundEngine } from './audio.js';
import { makeRng } from './random.js';
import { drawScene, drawHUD, drawMenu, drawGameOver, drawVictory, drawPaused } from './render.js';
import { stageShot } from './shots.js';
import { VIEW } from './config.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const params = new URLSearchParams(location.search);
const seedParam = params.get('seed');
const seed = seedParam === null ? (Date.now() % 2147483647) : Number(seedParam) >>> 0;
const rng = makeRng(seed);
const sound = new SoundEngine();
const shot = params.get('shot');

const BEST_KEY = 'emberfall-best';
function loadBest() {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}
function saveBest(value) {
  try {
    localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // A browser that refuses storage just loses the record between visits.
  }
}

if (shot) {
  stageShot(shot, seed, ctx, sound, rng);
  requestAnimationFrame(() => {
    window.__shotReady = true;
  });
} else {
  runGame();
}

function runGame() {
  const input = new Input(canvas);
  let game = new Game(rng, sound);
  let state = 'menu'; // menu | playing | paused
  let best = loadBest();
  let isNewBest = false;
  let menuTime = 0;
  let last = performance.now();
  let accumulator = 0;
  const TICK = 1 / 60;

  function startRun() {
    game = new Game(rng, sound);
    isNewBest = false;
    state = 'playing';
  }

  function settleScore() {
    if (game.score > best) {
      best = game.score;
      isNewBest = true;
      saveBest(best);
    }
  }

  function handleActions() {
    for (const action of input.takeActions()) {
      if (action === 'mute') {
        sound.setMuted(!sound.muted);
        continue;
      }
      sound.unlock();
      if (state === 'menu' && action === 'confirm') startRun();
      else if (state === 'playing' && action === 'pause') state = 'paused';
      else if (state === 'paused' && (action === 'pause' || action === 'confirm')) state = 'playing';
      else if (state === 'playing' && game.phase === 'playing' && action === 'dash') game.player.tryDash(input, game);
      else if (state === 'playing' && game.phase === 'playing' && action === 'overdrive') game.tryOverdrive();
      else if (state === 'playing' && game.phase === 'over' && (action === 'confirm' || action === 'restart')) startRun();
      else if (state === 'playing' && game.phase === 'won' && action === 'continue') {
        game.endless = true;
        game.phase = 'playing';
        game.waves.state = 'intermission';
        game.waves.timer = 1.6;
      } else if (state === 'playing' && game.phase === 'won' && (action === 'confirm' || action === 'restart')) startRun();
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    let elapsed = (now - last) / 1000;
    last = now;
    if (elapsed > 0.25) elapsed = 0.25;
    handleActions();

    if (state === 'menu') {
      menuTime += elapsed;
      game.effects.update(elapsed);
      drawMenu(ctx, game, best, menuTime);
      return;
    }
    if (state === 'paused') {
      drawPaused(ctx, game);
      return;
    }
    accumulator += elapsed;
    while (accumulator >= TICK) {
      game.step(TICK, input);
      accumulator -= TICK;
      if (game.phase === 'over' || game.phase === 'won') settleScore();
    }
    drawScene(ctx, game);
    drawHUD(ctx, game);
    if (game.phase === 'over') drawGameOver(ctx, game, best, isNewBest);
    else if (game.phase === 'won') drawVictory(ctx, game, best);
  }

  requestAnimationFrame(frame);
}

export { VIEW };
