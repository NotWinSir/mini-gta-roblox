// Mini GTA: Blox City 3D — boot and the one loop. The world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one); the WebGL renderer paints the 3D
// city and the 2D HUD canvas paints the panels over it. Two screens: title and play.
//
// ?seed=N fixes the city's random life. ?shot=cover|chase|mission|action (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot. window.__game exposes the world to playtests.
import { STEP, VIEW } from './config.js';
import { createRandom } from './rng.js';
import { createWorld } from './world.js';
import { ACTION_CONFIRM, ACTION_SWITCH, createInput } from './input.js';
import { createRenderer } from './render.js';
import { drawHud } from './hud.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const glCanvas = document.getElementById('gl');
const hudCanvas = document.getElementById('hud');
const status = document.getElementById('status');
const fallback = document.getElementById('fallback');
const hudCtx = hudCanvas.getContext('2d');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(glCanvas);

window.__game = { world, state: world.state };

function fitCanvases() {
  const scale = Math.min(window.innerWidth / VIEW.width, window.innerHeight / VIEW.height);
  for (const canvas of [glCanvas, hudCanvas]) {
    canvas.style.width = `${Math.floor(VIEW.width * scale)}px`;
    canvas.style.height = `${Math.floor(VIEW.height * scale)}px`;
  }
}
window.addEventListener('resize', fitCanvases);
fitCanvases();

function runShot(name) {
  const screen = stageShot(name, world);
  let painted = 0;
  function paint() {
    const markerInfo = renderer.draw(world.state, true);
    drawHud(hudCtx, world.state, screen, markerInfo);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(window);
  let screen = 'title';
  let accumulator = 0;
  let last = performance.now();

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;

    const actions = input.takeActions();
    if (actions & ACTION_CONFIRM && screen === 'title') {
      world.reset();
      screen = 'play';
      status.textContent = 'Playing. Deliver the package, dodge the police.';
    }
    if (actions & ACTION_SWITCH && screen === 'play' && world.state.bustedTimer === 0) {
      world.switchCar();
    }

    if (screen === 'play') {
      const control = input.control();
      while (accumulator >= STEP) {
        world.step(control);
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }

    const markerInfo = renderer.draw(world.state, false);
    drawHud(hudCtx, world.state, screen, markerInfo);
  }

  status.textContent = 'Mini GTA Blox City 3D. Press Enter to start.';
  requestAnimationFrame(frame);
}

if (!renderer) {
  // No WebGL2: say so plainly instead of leaving a black page.
  fallback.hidden = false;
  status.textContent = 'WebGL2 is not available in this browser, so the game cannot start.';
} else if (shot) {
  runShot(shot);
} else {
  runGame();
}
