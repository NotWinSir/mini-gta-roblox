// Mini GTA: Blox City 3D — the whole simulation, one fixed 60 Hz frame per step().
// Arcade car physics on the XZ plane (per-axis building collision, sliding along walls),
// 25 wandering blocky pedestrians, a wanted level that summons police cars, health and
// busts, and the chained package-delivery mission. All randomness flows from the seeded
// rng handed in, so a seed always deals the same city life.
import { CARS, NUM_PEDESTRIANS, POLICE_SPEED, SHIRT_COLORS, SKIN_COLORS, SPAWN } from './config.js';
import { isWall, randomRoadPos } from './city.js';

const PED_HIT_RADIUS = 22;
const POLICE_HIT_RADIUS = 26;
const MISSION_RADIUS = 40;
const WANTED_DECAY_FRAMES = 8 * 60;
const BUSTED_FRAMES = 3 * 60;
const PED_RESPAWN_FRAMES = 3 * 60;

/** Move with per-axis collision; returns the new position and whether a wall was hit. */
function slideMove(x, z, dx, dz) {
  let hit = false;
  if (isWall(x + dx, z)) {
    dx = 0;
    hit = true;
  }
  if (isWall(x, z + dz)) {
    dz = 0;
    hit = true;
  }
  return { x: x + dx, z: z + dz, hit };
}

export function createWorld(rng) {
  const state = {
    frame: 0,
    carX: SPAWN.x,
    carZ: SPAWN.z,
    angle: 0,
    speed: 0,
    carType: 0,
    wheelSpin: 0,
    health: 100,
    wanted: 0,
    wantedTimer: 0,
    score: 0,
    money: 0,
    bustedTimer: 0,
    police: [],
    peds: [],
    mission: { stage: 0, pickup: { x: 0, z: 0 }, drop: { x: 0, z: 0 } },
    toast: { text: '', timer: 0 },
  };

  function showToast(text, seconds = 3) {
    state.toast.text = text;
    state.toast.timer = Math.round(seconds * 60);
  }

  function newMission() {
    const pickup = randomRoadPos(rng);
    const drop = randomRoadPos(rng, pickup, 500);
    state.mission = { stage: 0, pickup, drop };
  }

  function makePed() {
    const pos = randomRoadPos(rng);
    return {
      x: pos.x,
      z: pos.z,
      angle: rng.range(0, Math.PI * 2),
      speed: rng.range(0.6, 1.4),
      timer: rng.int(60, 180),
      alive: true,
      respawnTimer: 0,
      shirt: rng.pick(SHIRT_COLORS),
      skin: rng.pick(SKIN_COLORS),
      phase: rng.range(0, Math.PI * 2),
    };
  }

  function resetRun() {
    state.carX = SPAWN.x;
    state.carZ = SPAWN.z;
    state.angle = 0;
    state.speed = 0;
    state.health = 100;
    state.wanted = 0;
    state.wantedTimer = 0;
    state.police = [];
    newMission();
  }

  function reset() {
    state.score = 0;
    state.money = 0;
    state.carType = 0;
    state.bustedTimer = 0;
    state.toast.text = '';
    state.toast.timer = 0;
    state.peds = [];
    for (let i = 0; i < NUM_PEDESTRIANS; i += 1) state.peds.push(makePed());
    resetRun();
  }

  function addWanted() {
    state.wanted = Math.min(5, state.wanted + 1);
    state.wantedTimer = WANTED_DECAY_FRAMES;
  }

  function switchCar() {
    state.carType = (state.carType + 1) % CARS.length;
    showToast(`Mobil: ${CARS[state.carType].name}`, 2);
  }

  function step(control) {
    state.frame += 1;
    if (state.toast.timer > 0) state.toast.timer -= 1;

    if (state.bustedTimer > 0) {
      state.bustedTimer -= 1;
      if (state.bustedTimer === 0) resetRun();
      return;
    }

    const car = CARS[state.carType];

    // --- car physics ---
    if (control.up) state.speed = Math.min(state.speed + car.accel, car.max);
    else if (control.down) state.speed = Math.max(state.speed - 0.25, -3);
    else state.speed *= 0.96;

    if (Math.abs(state.speed) > 0.3) {
      const turn = car.turn * (state.speed / car.max);
      if (control.left) state.angle -= turn;
      if (control.right) state.angle += turn;
    }

    const rad = (state.angle * Math.PI) / 180;
    const moved = slideMove(
      state.carX,
      state.carZ,
      Math.cos(rad) * state.speed,
      Math.sin(rad) * state.speed,
    );
    state.carX = moved.x;
    state.carZ = moved.z;
    if (moved.hit) {
      if (Math.abs(state.speed) > 4) state.health -= Math.abs(state.speed) * 0.8;
      state.speed *= 0.3;
    }
    state.wheelSpin = (state.wheelSpin + (state.speed / car.wheelR) * (180 / Math.PI)) % 360;

    state.health = Math.min(100, state.health + 0.02);

    // --- pedestrians ---
    for (const ped of state.peds) {
      if (!ped.alive) {
        ped.respawnTimer -= 1;
        if (ped.respawnTimer <= 0) {
          const pos = randomRoadPos(rng, { x: state.carX, z: state.carZ }, 300);
          ped.x = pos.x;
          ped.z = pos.z;
          ped.alive = true;
          ped.timer = rng.int(60, 180);
        }
        continue;
      }
      ped.timer -= 1;
      if (ped.timer <= 0) {
        ped.angle = rng.range(0, Math.PI * 2);
        ped.speed = rng.range(0.6, 1.4);
        ped.timer = rng.int(60, 180);
      }
      const pm = slideMove(ped.x, ped.z, Math.cos(ped.angle) * ped.speed, Math.sin(ped.angle) * ped.speed);
      ped.x = pm.x;
      ped.z = pm.z;
      if (pm.hit) ped.angle = rng.range(0, Math.PI * 2);

      if (Math.abs(state.speed) > 2 && Math.hypot(ped.x - state.carX, ped.z - state.carZ) < PED_HIT_RADIUS) {
        ped.alive = false;
        ped.respawnTimer = PED_RESPAWN_FRAMES;
        state.score += 100;
        addWanted();
      }
    }

    // --- mission: fetch the package, then deliver it ---
    const target = state.mission.stage === 0 ? state.mission.pickup : state.mission.drop;
    if (Math.hypot(target.x - state.carX, target.z - state.carZ) < MISSION_RADIUS) {
      if (state.mission.stage === 0) {
        state.mission.stage = 1;
        showToast('Paket diambil! Antar ke titik hijau.', 3);
      } else {
        state.money += 500;
        state.score += 500;
        showToast('Paket terantar! +$500', 3);
        newMission();
      }
    }

    // --- wanted decay ---
    if (state.wanted > 0) {
      state.wantedTimer -= 1;
      if (state.wantedTimer <= 0) {
        state.wanted -= 1;
        state.wantedTimer = WANTED_DECAY_FRAMES;
      }
    }

    // --- police: two cars per star, steering straight at the player ---
    const desired = state.wanted * 2;
    while (state.police.length < desired) {
      const pos = randomRoadPos(rng, { x: state.carX, z: state.carZ }, 350);
      state.police.push({ x: pos.x, z: pos.z, angle: 0, spin: 0 });
    }
    while (state.police.length > desired) state.police.pop();

    for (const cop of state.police) {
      const dx = state.carX - cop.x;
      const dz = state.carZ - cop.z;
      const dist = Math.hypot(dx, dz) || 1;
      const mx = (dx / dist) * POLICE_SPEED;
      const mz = (dz / dist) * POLICE_SPEED;
      cop.angle = (Math.atan2(dz, dx) * 180) / Math.PI;
      const cm = slideMove(cop.x, cop.z, mx, mz);
      cop.x = cm.x;
      cop.z = cm.z;
      if (cm.hit) {
        const side = rng.next() < 0.5 ? -1 : 1;
        const sm = slideMove(cop.x, cop.z, -mz * side, mx * side);
        cop.x = sm.x;
        cop.z = sm.z;
      }
      cop.spin = (cop.spin + (POLICE_SPEED / 9) * (180 / Math.PI)) % 360;
      if (dist < POLICE_HIT_RADIUS) state.health -= 0.4;
    }

    if (state.health <= 0) {
      state.health = 0;
      state.bustedTimer = BUSTED_FRAMES;
      showToast('Kamu ditangkap! Mulai ulang...', 3);
    }
  }

  reset();

  return { state, step, reset, switchCar, showToast };
}
