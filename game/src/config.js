// Mini GTA: Blox City 3D — every tuning number, colour and the city layout in one place.
// The view is a fixed 1280x720 logical area; the canvases scale to the window.
// The world is a tilemap of 20 x 14 tiles of 80 world units: a full building border,
// building blocks inside, wide road corridors on rows 3, 6, 9 and columns 4, 9, 14.
// World axes: +x east (columns), +z south (rows), +y up. Angles are degrees, 0 = east.

export const VIEW = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const TILE = 80;
export const COLS = 20;
export const ROWS = 14;
export const WORLD_W = COLS * TILE;
export const WORLD_H = ROWS * TILE;

// 1 = building block, 0 = road.
export const MAP = [
  '11111111111111111111',
  '11110111101111011111',
  '11110111101111011111',
  '10000000000000000001',
  '11110111101111011111',
  '11110111101111011111',
  '10000000000000000001',
  '11110111101111011111',
  '11110111101111011111',
  '10000000000000000001',
  '11110111101111011111',
  '11110111101111011111',
  '11110111101111011111',
  '11111111111111111111',
];

/** Where the player's car starts and returns after a bust: the row-3 / column-4 crossing. */
export const SPAWN = { x: 4.5 * TILE, z: 3.5 * TILE };

/** The three driveable cars, cycled with the C key. Speeds are units per frame at 60 Hz. */
export const CARS = [
  { name: 'Sedan', max: 8, accel: 0.25, turn: 3.0, color: [235, 60, 60], length: 46, width: 23, bodyH: 11, cabinH: 10, wheelR: 9 },
  { name: 'Sport', max: 11, accel: 0.35, turn: 3.4, color: [255, 200, 40], length: 48, width: 25, bodyH: 8, cabinH: 8, wheelR: 9 },
  { name: 'Truk', max: 6, accel: 0.15, turn: 2.0, color: [70, 190, 90], length: 54, width: 25, bodyH: 15, cabinH: 13, wheelR: 11 },
];

export const POLICE_SPEED = 3.6;
export const POLICE_COLOR = [35, 75, 190];
export const NUM_PEDESTRIANS = 25;

/** Bright brick colours for the building blocks; each gets its own facade texture. */
export const BRICK_PALETTE = [
  [235, 85, 85],
  [75, 150, 255],
  [255, 190, 50],
  [170, 105, 235],
  [70, 205, 190],
  [245, 245, 250],
];

export const SKIN_COLORS = [
  [255, 205, 60],
  [234, 184, 146],
  [160, 100, 60],
];
export const SHIRT_COLORS = [
  [255, 80, 80],
  [80, 170, 255],
  [255, 230, 90],
  [150, 90, 230],
  [90, 220, 130],
];

/** Sunset sky and fog. */
export const SKY_TOP = [0.30, 0.24, 0.50];
export const SKY_HORIZON = [1.0, 0.60, 0.36];
export const FOG_COLOR = [0.94, 0.55, 0.43];
export const FOG_NEAR = 550;
export const FOG_FAR = 2300;
/** Direction toward the low sun (normalised in the renderer). */
export const SUN_DIR = [-0.55, 0.30, -0.72];

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
