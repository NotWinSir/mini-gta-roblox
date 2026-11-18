// Keyboard input: held keys steer the car every frame; one-shot presses (Enter to start,
// C to change car) are queued as flags and taken once by the loop, so a press between two
// frames is never lost and never counted twice.

export const ACTION_CONFIRM = 1;
export const ACTION_SWITCH = 2;

const HELD = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space']);

export function createInput(target) {
  const keys = new Set();
  let actions = 0;

  function onKeyDown(event) {
    if (HELD.has(event.code)) event.preventDefault();
    if (event.repeat) return;
    keys.add(event.code);
    if (event.code === 'Enter') actions |= ACTION_CONFIRM;
    if (event.code === 'KeyC') actions |= ACTION_SWITCH;
  }

  function onKeyUp(event) {
    keys.delete(event.code);
  }

  function onBlur() {
    keys.clear();
  }

  target.addEventListener('keydown', onKeyDown);
  target.addEventListener('keyup', onKeyUp);
  target.addEventListener('blur', onBlur);

  return {
    /** The held driving keys as one control object for world.step(). */
    control() {
      return {
        up: keys.has('ArrowUp') || keys.has('KeyW'),
        down: keys.has('ArrowDown') || keys.has('KeyS'),
        left: keys.has('ArrowLeft') || keys.has('KeyA'),
        right: keys.has('ArrowRight') || keys.has('KeyD'),
      };
    },
    /** Queued one-shot presses since the last call; clears the queue. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** Test and staging hook: hold a key down (or release it) without a real keyboard. */
    setKey(code, down) {
      if (down) keys.add(code);
      else keys.delete(code);
    },
  };
}
