// The screenshot scenes behind ?shot=cover|chase|mission|action (with &seed=N). Each one
// sets up a fresh world and plays the real rules forward for a fixed number of steps, so
// the frame is what a real moment of play looks like and the same seed always gives the
// same frame: the cover is the title over the sunset city, the chase is a wanted driver
// fleeing down a palm road, the mission scene idles beside the glowing package marker,
// and the action scene charges a Sport car through a crowd of blocky pedestrians.
import { SPAWN } from './config.js';

const IDLE = { up: false, down: false, left: false, right: false };
const GAS = { up: true, down: false, left: false, right: false };

function run(world, steps, control) {
  for (let i = 0; i < steps; i += 1) world.step(control);
}

/**
 * Set `world` to the named scene and return the screen to draw over it
 * ('title' for the cover, 'play' for everything else).
 */
export function stageShot(name, world) {
  const state = world.state;
  world.reset();

  if (name === 'chase') {
    // Start on the long east-west road (row 6), wanted level 3, and drive: police cars
    // spawn and converge; for the cover of the chase, two of them cut the driver off
    // ahead while the rest close in behind, lightbars flashing in the sunset.
    state.carX = 300;
    state.carZ = 6.5 * 80;
    state.angle = 0;
    state.wanted = 3;
    state.wantedTimer = 8 * 60;
    run(world, 70, GAS);
    if (state.police.length >= 2) {
      state.police[0].x = state.carX + 185;
      state.police[0].z = state.carZ - 24;
      state.police[1].x = state.carX + 235;
      state.police[1].z = state.carZ + 26;
    }
    run(world, 7, GAS);
    state.health = 72;
    state.wanted = 3;
    state.wantedTimer = 8 * 60;
    return 'play';
  }

  if (name === 'mission') {
    // Idle at spawn with the package marker a short way east on the same road.
    state.mission.stage = 0;
    state.mission.pickup = { x: SPAWN.x + 330, z: SPAWN.z };
    state.mission.drop = { x: 14.5 * 80, z: 9.5 * 80 };
    run(world, 20, IDLE);
    return 'play';
  }

  if (name === 'action') {
    // A Sport car at speed on the row-3 road, pedestrians scattered in its path.
    world.switchCar();
    state.toast.timer = 0;
    state.carX = 300;
    state.carZ = SPAWN.z;
    state.angle = 0;
    const spots = [
      [470, SPAWN.z - 26], [560, SPAWN.z + 20], [660, SPAWN.z - 12],
      [760, SPAWN.z + 28], [880, SPAWN.z - 30], [980, SPAWN.z + 10],
    ];
    state.peds.forEach((ped, i) => {
      if (i < spots.length) {
        ped.x = spots[i][0];
        ped.z = spots[i][1];
        ped.alive = true;
      }
    });
    run(world, 34, GAS);
    return 'play';
  }

  // 'cover' and anything else: a fresh world under the title screen.
  run(world, 2, IDLE);
  return 'title';
}
