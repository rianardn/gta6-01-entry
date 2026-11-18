// NEON HARBOR — input: keyboard + mouse, with an action map the rest
// of the game reads. Also tracks the mouse in world space for aiming.

export const ACTION = {
  UP: 'up', DOWN: 'down', LEFT: 'left', RIGHT: 'right',
  SPRINT: 'sprint', ENTER: 'enter', BRAKE: 'brake',
  SHOOT: 'shoot', PAUSE: 'pause', MUTE: 'mute', CONFIRM: 'confirm',
};

const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'sprint', ShiftRight: 'sprint',
  KeyE: 'enter',
  Space: 'brake',
  Escape: 'pause', KeyP: 'pause',
  KeyM: 'mute',
  Enter: 'confirm',
};

export function createInput(canvas) {
  const held = new Set();
  const pressed = new Set();
  const mouse = { x: 0, y: 0, down: false, clicked: false, wx: 0, wy: 0 };

  function onKeyDown(e) {
    const a = KEYMAP[e.code];
    if (a) {
      if (!held.has(a)) pressed.add(a);
      held.add(a);
      if (a === 'brake' || a === 'up' || a === 'down') e.preventDefault();
    }
  }
  function onKeyUp(e) {
    const a = KEYMAP[e.code];
    if (a) held.delete(a);
  }
  function onMouseMove(e) {
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
  }
  function onMouseDown(e) {
    if (e.button === 0) { mouse.down = true; mouse.clicked = true; }
  }
  function onMouseUp(e) { if (e.button === 0) mouse.down = false; }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  return {
    held, mouse,
    is(action) { return held.has(action); },
    wasPressed(action) { return pressed.has(action); },
    // Call once per frame after the game has read input.
    endFrame() { pressed.clear(); mouse.clicked = false; },
  };
}
