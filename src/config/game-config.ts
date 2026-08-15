export const LOGICAL_WIDTH = 480;
export const LOGICAL_HEIGHT = 270;
export const TILE_SIZE = 24;
export const MAP_TILES = 48;
export const WORLD_SIZE = MAP_TILES * TILE_SIZE;
export const FOG_CELL_SIZE = 6;
export const SAVE_KEY = "last-block-save-v1";
export const SAVE_VERSION = 1;

export const DEPTH = {
  ground: 0,
  item: 50,
  propBack: 100,
  actor: 200,
  propFront: 500,
  roof: 700,
  tint: 8_000,
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
  maxActiveZombies: 40,
  inventorySlots: 20,
  daySeconds: 480,
  duskSeconds: 120,
  nightSeconds: 360,
  dawnSeconds: 120,
} as const;

