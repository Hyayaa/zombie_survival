export const LOGICAL_WIDTH = 480;
export const LOGICAL_HEIGHT = 270;
export const TILE_SIZE = 24;
export const MAP_WIDTH_TILES = 282;
export const MAP_HEIGHT_TILES = 282;
export const WORLD_WIDTH = MAP_WIDTH_TILES * TILE_SIZE;
export const WORLD_HEIGHT = MAP_HEIGHT_TILES * TILE_SIZE;
// Compatibility aliases for older gameplay helpers. New dimension-aware code uses the axes above.
export const MAP_TILES = MAP_WIDTH_TILES;
export const WORLD_SIZE = WORLD_WIDTH;
export const FOG_CELLS_PER_TILE = 8;
export const FOG_CELL_SIZE = TILE_SIZE / FOG_CELLS_PER_TILE;
if (!Number.isInteger(FOG_CELL_SIZE)) throw new Error("TILE_SIZE must divide evenly into FOG_CELLS_PER_TILE");
export const FLASHLIGHT_AIM_BUCKETS = 32;
export const SAVE_KEY = "last-block-save-v1";
export const SAVE_VERSION = 10;
export const MAP_ID = "expanded-city-v2";
export const MAP_VERSION = 2;

export const CAMERA = {
  zoomLevels: [0.35, 0.45, 0.55, 0.7, 0.85, 1, 1.2, 1.45, 1.7, 2] as const,
  defaultZoom: 1,
  maxCursorLead: 132,
  followLerp: 0.17,
  cursorDeadzone: 6,
} as const;

export const LOCAL_MINIMAP_ZOOM_LEVELS = [16, 24, 32, 48, 64] as const;
export const MAX_PATHFINDING_PER_FRAME = 4;

export const VISION = {
  proximityRadius: 72,
  playerDayOmniRadius: 360,
  playerNightOmniRadius: 60,
  flashlightRadius: 300,
  flashlightConeAngle: Math.PI * 0.34,
  torchRadius: 170,
  fireRadius: 76,
  fireIntensity: 0.9,
  companionOmniRadius: 192,
} as const;

export const COMPANION_MOVEMENT = {
  baseSpeed: 70,
  catchUpEnterDistance: 120,
  catchUpExitDistance: 72,
  fullCatchUpDistance: 210,
  maxCatchUpSpeed: 136,
  emergencyDistance: 260,
  immediateThreatDistance: 36,
  stuckThresholdMs: 250,
  severeStuckThresholdMs: 700,
} as const;

export const MINIMAP = {
  localTiles: 32,
  localSize: 192,
  fullSize: 512,
  fullPixelsPerTile: 4,
  updateIntervalMs: 200,
} as const;

export const ENTITY_OUTLINE = {
  normal: 0x000000,
  interactable: 0xffffff,
} as const;

export const OBSTACLE_BALANCE = {
  doorHealth: 48,
  barricadeHealth: 96,
  doorTraversalCost: 6,
  barricadeTraversalCost: 12,
  attackRange: 22,
  hitStaggerMs: 90,
} as const;

export const DEPTH = {
  ground: 0,
  item: 50,
  propBack: 100,
  actor: 200,
  propFront: 500,
  roof: 700,
  effectWorld: 7_800,
  tint: 8_000,
  effectEmissive: 8_500,
  fog: 9_000,
} as const;

export const COLORS = {
  void: 0x080b0d,
  ground: 0x242b29,
  groundAlt: 0x202624,
  road: 0x303536,
  roadLine: 0x7f795b,
  floor: 0x4a4a40,
  floorAlt: 0x44453d,
  wall: 0x686a60,
  wallTop: 0x96988a,
  lowProp: 0x51473b,
  metal: 0x545d60,
  extraction: 0x8ca86b,
  unknownFog: 0x020405,
  exploredFog: 0x0c1620,
} as const;

export const BALANCE = {
  playerWalkSpeed: 72,
  playerRunSpeed: 112,
  playerRadius: 5,
  companionRadius: 5,
  zombieRadius: 5,
  flashlightBatterySeconds: 180,
  torchSeconds: 90,
  defenseSeconds: 45,
  maxActiveZombies: 72,
  inventorySlots: 20,
  daySeconds: 480,
  duskSeconds: 120,
  nightSeconds: 360,
  dawnSeconds: 120,
} as const;
