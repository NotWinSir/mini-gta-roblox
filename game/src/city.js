// The city: tilemap logic shared with the physics, plus everything static the renderer
// uploads once — a painted ground texture (grass, sidewalks, asphalt, dashes), one merged
// building mesh per brick colour with its own procedural window facade texture, a merged
// roof mesh, and merged palm trees along the roads.
import { BRICK_PALETTE, COLS, MAP, ROWS, TILE, WORLD_H, WORLD_W } from './config.js';
import { GeometryBuilder } from './glx.js';

export function isWall(x, z) {
  const col = Math.floor(x / TILE);
  const row = Math.floor(z / TILE);
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return true;
  return MAP[row][col] === '1';
}

export const ROAD_CELLS = [];
for (let r = 0; r < ROWS; r += 1) {
  for (let c = 0; c < COLS; c += 1) {
    if (MAP[r][c] === '0') ROAD_CELLS.push([c, r]);
  }
}

/** A random road-tile centre, at least minDist from `from` when given; tries 100 times. */
export function randomRoadPos(rng, from = null, minDist = 0) {
  let x = 0;
  let z = 0;
  for (let i = 0; i < 100; i += 1) {
    const [c, r] = ROAD_CELLS[Math.floor(rng.next() * ROAD_CELLS.length)];
    x = c * TILE + TILE / 2;
    z = r * TILE + TILE / 2;
    if (from === null || Math.hypot(x - from.x, z - from.z) >= minDist) break;
  }
  return { x, z };
}

/** Deterministic building height per tile, so the skyline is the same on every visit. */
export function buildingHeight(c, r) {
  return 70 + ((c * 37 + r * 91) % 5) * 48;
}

export function buildingVariant(c, r) {
  return (r * 7 + c * 3) % BRICK_PALETTE.length;
}

function shade(color, amount) {
  return [
    Math.max(0, Math.min(255, color[0] + amount)),
    Math.max(0, Math.min(255, color[1] + amount)),
    Math.max(0, Math.min(255, color[2] + amount)),
  ];
}

function css(color) {
  return `rgb(${color[0]},${color[1]},${color[2]})`;
}

/** The ground painted once on a world-sized canvas: two-tone grass, sidewalks, asphalt, dashes. */
export function makeGroundCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = WORLD_W;
  canvas.height = WORLD_H;
  const ctx = canvas.getContext('2d');
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      ctx.fillStyle = (r + c) % 2 === 0 ? 'rgb(112,200,80)' : 'rgb(104,192,74)';
      ctx.fillRect(c * TILE, r * TILE, TILE, TILE);
    }
  }
  const isRoad = (c, r) => c >= 0 && c < COLS && r >= 0 && r < ROWS && MAP[r][c] === '0';
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      if (!isRoad(c, r)) continue;
      const x = c * TILE;
      const y = r * TILE;
      ctx.fillStyle = 'rgb(158,158,166)';
      ctx.fillRect(x - 5, y - 5, TILE + 10, TILE + 10);
      ctx.fillStyle = 'rgb(52,52,60)';
      ctx.fillRect(x + 3, y + 3, TILE - 6, TILE - 6);
      ctx.fillStyle = 'rgb(240,240,240)';
      const horizontal = isRoad(c - 1, r) || isRoad(c + 1, r);
      const vertical = isRoad(c, r - 1) || isRoad(c, r + 1);
      if (horizontal && !vertical) {
        for (let dx = 12; dx < TILE - 12; dx += 24) ctx.fillRect(x + dx, y + TILE / 2 - 2, 13, 4);
      }
      if (vertical && !horizontal) {
        for (let dy = 12; dy < TILE - 12; dy += 24) ctx.fillRect(x + TILE / 2 - 2, y + dy, 4, 13);
      }
    }
  }
  return canvas;
}

/** One facade texture per brick colour: bright wall, dark frame lines, a grid of windows. */
export function makeFacadeCanvas(variant, rng) {
  const base = BRICK_PALETTE[variant];
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = css(base);
  ctx.fillRect(0, 0, 128, 256);
  ctx.fillStyle = css(shade(base, 35));
  ctx.fillRect(0, 0, 128, 10);
  ctx.fillStyle = css(shade(base, -45));
  ctx.fillRect(0, 240, 128, 16);
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      const x = 10 + col * 30;
      const y = 20 + row * 28;
      const lit = rng.next() < 0.42;
      ctx.fillStyle = 'rgb(20,20,28)';
      ctx.fillRect(x - 2, y - 2, 20, 20);
      ctx.fillStyle = lit ? 'rgb(255,214,140)' : 'rgb(38,52,74)';
      ctx.fillRect(x, y, 16, 16);
    }
  }
  return canvas;
}

/** Merged building side-walls for one brick variant (textured), in world coordinates. */
export function buildBuildingsGeometry(variant) {
  const b = new GeometryBuilder();
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      if (MAP[r][c] !== '1' || buildingVariant(c, r) !== variant) continue;
      b.box(c * TILE + 3, 0, r * TILE + 3, TILE - 6, buildingHeight(c, r), TILE - 6, [255, 255, 255], 'facade');
    }
  }
  return b;
}

/** Merged flat roofs for every building, a darker shade of its brick colour. */
export function buildRoofsGeometry() {
  const b = new GeometryBuilder();
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      if (MAP[r][c] !== '1') continue;
      const color = shade(BRICK_PALETTE[buildingVariant(c, r)], -55);
      const h = buildingHeight(c, r);
      b.planeXZ(c * TILE + 3, h + 0.3, r * TILE + 3, TILE - 6, TILE - 6, color);
    }
  }
  return b;
}

/** Merged palms: a trunk and five drooping fronds, planted at deterministic road corners. */
export function buildPalmsGeometry() {
  const b = new GeometryBuilder();
  const trunk = [146, 108, 66];
  const leaf = [46, 168, 74];
  const leafDark = [34, 138, 58];
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      if (MAP[r][c] !== '0') continue;
      if ((c * 13 + r * 29) % 4 !== 0) continue;
      const x = c * TILE + ((c + r) % 2 === 0 ? 12 : TILE - 12);
      const z = r * TILE + ((c * 3 + r) % 2 === 0 ? 12 : TILE - 12);
      b.cylinder(x, 0, z, 2.4, 30, 7, trunk);
      for (let i = 0; i < 5; i += 1) {
        b.frond(x, 31, z, 24, 10, i * 72 + ((c + r) % 3) * 9, i % 2 === 0 ? leaf : leafDark);
      }
    }
  }
  return b;
}
