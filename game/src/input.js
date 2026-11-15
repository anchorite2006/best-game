// Keyboard and pointer input for the game. Held state is read every frame by the
// simulation; one-shot presses (start, restart, pause, dash, overdrive, mute) are
// queued as named actions and drained once per frame by the orchestrator.

const KEY_ACTIONS = {
  Enter: 'confirm',
  Space: 'confirm',
  KeyR: 'restart',
  KeyP: 'pause',
  Escape: 'pause',
  ShiftLeft: 'dash',
  ShiftRight: 'dash',
  KeyE: 'overdrive',
  KeyC: 'continue',
  KeyM: 'mute',
};

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.actions = [];
    this.mouse = { x: 640, y: 360, down: false };
    this.clicked = false;

    window.addEventListener('keydown', (event) => {
      if (event.code === 'Space' || event.code.startsWith('Arrow')) event.preventDefault();
      if (!event.repeat) {
        this.keys.add(event.code);
        const action = KEY_ACTIONS[event.code];
        if (action) this.actions.push(action);
        if (event.code === 'Space') this.keys.add('SpaceHeld');
      }
    });
    window.addEventListener('keyup', (event) => {
      this.keys.delete(event.code);
      if (event.code === 'Space') this.keys.delete('SpaceHeld');
    });
    canvas.addEventListener('pointermove', (event) => {
      const point = this.toGamePoint(event);
      this.mouse.x = point.x;
      this.mouse.y = point.y;
    });
    canvas.addEventListener('pointerdown', (event) => {
      const point = this.toGamePoint(event);
      this.mouse.x = point.x;
      this.mouse.y = point.y;
      this.mouse.down = true;
      this.clicked = true;
      this.actions.push('confirm');
    });
    window.addEventListener('pointerup', () => {
      this.mouse.down = false;
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouse.down = false;
    });
  }

  // Pointer positions arrive in page pixels; the canvas is scaled by CSS, so map
  // them back into the game's fixed 1280x720 field.
  toGamePoint(event) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * this.canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * this.canvas.height,
    };
  }

  moveVector() {
    let x = 0;
    let y = 0;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y += 1;
    if (x !== 0 && y !== 0) {
      const inv = Math.SQRT1_2;
      x *= inv;
      y *= inv;
    }
    return { x, y };
  }

  firing() {
    return this.mouse.down || this.keys.has('SpaceHeld');
  }

  takeActions() {
    const drained = this.actions;
    this.actions = [];
    return drained;
  }

  takeClick() {
    const was = this.clicked;
    this.clicked = false;
    return was;
  }
}
