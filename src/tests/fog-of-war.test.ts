import { describe, expect, it } from "vitest";
import { FLASHLIGHT_AIM_BUCKETS, FOG_CELL_SIZE, FOG_CELLS_PER_TILE, MAP_TILES, TILE_SIZE, WORLD_SIZE } from "../config/game-config";
import { GameClock } from "../core/game-clock";
import { createCityBlockMap } from "../data/map-definitions";
import { CollisionSystem } from "../systems/collision-system";
import { FogInvalidationTracker, FogOfWarSystem, VisibilityState, type FogInvalidationInput, type VisionGrid, type VisionSource } from "../systems/fog-of-war-system";
import { buildVisionSources } from "../systems/lighting-system";

function source(overrides: Partial<VisionSource> = {}): VisionSource {
  return { x: 51, y: 63, radius: 42, intensity: 1, sourceType: "player", ...overrides };
}

function grid(blocked: (x: number, y: number) => boolean = () => false): VisionGrid {
  return { blocksVision: blocked, additionalCost: () => 0 };
}

describe("FogOfWarSystem", () => {
  it("uses eight 3px fog cells per 24px world tile", () => {
    const fog = new FogOfWarSystem(WORLD_SIZE, WORLD_SIZE, FOG_CELL_SIZE, 1);
    expect(TILE_SIZE).toBe(24);
    expect(FOG_CELLS_PER_TILE).toBe(8);
    expect(FOG_CELL_SIZE).toBe(3);
    expect(FLASHLIGHT_AIM_BUCKETS).toBe(32);
    expect(TILE_SIZE / FOG_CELL_SIZE).toBe(8);
    expect(fog.widthCells).toBe(MAP_TILES * 8);
    expect(fog.heightCells).toBe(MAP_TILES * 8);
  });

  it("does zero idle recomputes until a fog input is invalidated", () => {
    const tracker = new FogInvalidationTracker();
    const input: FogInvalidationInput = { playerCell: 10, aimBucket: -1, visionRevision: 2, radiusBucket: 50, torchActive: false };
    expect(tracker.shouldRecompute(input)).toBe(true);
    tracker.commit(input);
    let idleRecomputes = 0;
    for (let frame = 0; frame < 600; frame += 1) {
      if (tracker.shouldRecompute(input)) idleRecomputes += 1;
    }
    expect(idleRecomputes).toBe(0);
    expect(tracker.shouldRecompute({ ...input, playerCell: 11 })).toBe(true);
    tracker.invalidate();
    expect(tracker.shouldRecompute(input)).toBe(true);
  });

  it("marks nearby cells visible and leaves distant cells unknown", () => {
    const fog = new FogOfWarSystem(120, 120, FOG_CELL_SIZE, 123);
    fog.recompute([source()], grid());
    expect(fog.getStateAtWorld(51, 63)).toBe(VisibilityState.Visible);
    expect(fog.getStateAtWorld(114, 6)).toBe(VisibilityState.Unknown);
  });

  it("keeps previously seen cells explored after the source moves", () => {
    const fog = new FogOfWarSystem(180, 120, FOG_CELL_SIZE, 123);
    fog.recompute([source({ x: 30, y: 60, radius: 30 })], grid());
    expect(fog.getStateAtWorld(30, 60)).toBe(VisibilityState.Visible);
    fog.recompute([source({ x: 150, y: 60, radius: 24 })], grid());
    expect(fog.getStateAtWorld(30, 60)).toBe(VisibilityState.Explored);
  });

  it("blocks visibility behind a wall and opens it through a door", () => {
    let doorOpen = false;
    const fog = new FogOfWarSystem(150, 150, FOG_CELL_SIZE, 42);
    const wallGrid = grid((x, y) => x === 10 && !(doorOpen && y === 10));
    fog.recompute([source({ x: 8 * FOG_CELL_SIZE + 1.5, y: 10 * FOG_CELL_SIZE + 1.5, radius: 48 })], wallGrid);
    expect(fog.getStateAtCell(12, 10)).not.toBe(VisibilityState.Visible);
    doorOpen = true;
    fog.recompute([source({ x: 8 * FOG_CELL_SIZE + 1.5, y: 10 * FOG_CELL_SIZE + 1.5, radius: 48 })], wallGrid);
    expect(fog.getStateAtCell(12, 10)).toBe(VisibilityState.Visible);
  });

  it("produces the same irregular edge for the same seed", () => {
    const first = new FogOfWarSystem(180, 180, FOG_CELL_SIZE, 777);
    const second = new FogOfWarSystem(180, 180, FOG_CELL_SIZE, 777);
    first.recompute([source({ x: 90, y: 90, radius: 66 })], grid());
    second.recompute([source({ x: 90, y: 90, radius: 66 })], grid());
    const firstStates = Array.from({ length: first.widthCells * first.heightCells }, (_, index) => first.getStateAtCell(index % first.widthCells, Math.floor(index / first.widthCells)));
    const secondStates = Array.from({ length: second.widthCells * second.heightCells }, (_, index) => second.getStateAtCell(index % second.widthCells, Math.floor(index / second.widthCells)));
    expect(firstStates).toEqual(secondStates);
  });

  it("keeps cells outside the flashlight cone hidden", () => {
    const fog = new FogOfWarSystem(180, 180, FOG_CELL_SIZE, 99);
    fog.recompute([source({ x: 90, y: 90, radius: 72, sourceType: "flashlight", direction: 0, coneAngle: Math.PI / 3 })], grid());
    expect(fog.getStateAtWorld(126, 90)).toBe(VisibilityState.Visible);
    expect(fog.getStateAtWorld(90, 144)).not.toBe(VisibilityState.Visible);
  });

  it("keeps the player's base vision when the flashlight is toggled", () => {
    const fog = new FogOfWarSystem(240, 240, FOG_CELL_SIZE, 202);
    const player = source({ x: 120, y: 120, radius: 60 });
    fog.recompute([player], grid());
    expect(fog.getStateAtWorld(84, 120)).toBe(VisibilityState.Visible);
    fog.recompute([
      player,
      source({ x: 120, y: 120, radius: 108, sourceType: "flashlight", direction: 0, coneAngle: Math.PI / 3 }),
    ], grid());
    expect(fog.getStateAtWorld(84, 120)).toBe(VisibilityState.Visible);
    expect(fog.getStateAtWorld(198, 120)).toBe(VisibilityState.Visible);
  });

  it("keeps the real spawn visible across repeated flashlight updates", () => {
    const map = createCityBlockMap();
    const collision = new CollisionSystem(map.obstacles, map.doors);
    const fog = new FogOfWarSystem(WORLD_SIZE, WORLD_SIZE, FOG_CELL_SIZE, 303);
    const clock = new GameClock();
    const player = { ...map.playerSpawn, aimAngle: 0, flashlightOn: true, torchRemaining: 0 };
    for (let update = 0; update < 20; update += 1) {
      const changed = fog.recompute(buildVisionSources(player, clock, []), collision);
      expect(fog.getStateAtWorld(player.x, player.y)).toBe(VisibilityState.Visible);
      expect(fog.getStateAtWorld(player.x - 30, player.y)).toBe(VisibilityState.Visible);
      if (update > 0) expect(changed).toBe(0);
    }
  });

  it("does not leak visibility through a sealed diagonal corner", () => {
    const fog = new FogOfWarSystem(150, 150, FOG_CELL_SIZE, 314);
    const cornerGrid = grid((x, y) => x === 11 && y === 10 || x === 10 && y === 11);
    fog.recompute([source({ x: 10 * FOG_CELL_SIZE + 1.5, y: 10 * FOG_CELL_SIZE + 1.5, radius: 54 })], cornerGrid);
    expect(fog.getStateAtCell(12, 12)).not.toBe(VisibilityState.Visible);
  });

  it("reports only cells whose visible state changed", () => {
    const fog = new FogOfWarSystem(180, 180, FOG_CELL_SIZE, 101);
    const visionSource = source({ x: 90, y: 90, radius: 48 });
    expect(fog.recompute([visionSource], grid())).toBeGreaterThan(0);
    expect(fog.recompute([visionSource], grid())).toBe(0);
    expect(fog.getChangedIndices()).toHaveLength(0);
  });

  it("updates only the cached vision cells covered by a door tile", () => {
    const collision = new CollisionSystem([], [{ id: "door", tileX: 5, tileY: 7, open: false }]);
    const revision = collision.visionRevision;
    expect(collision.blocksVision(40, 56)).toBe(true);
    expect(collision.blocksVision(47, 63)).toBe(true);
    expect(collision.blocksVision(48, 56)).toBe(false);
    collision.setDoorOpen("door", true);
    expect(collision.blocksVision(40, 56)).toBe(false);
    expect(collision.visionRevision).toBeGreaterThan(revision);
    collision.setDoorOpen("door", false);
    expect(collision.blocksVision(47, 63)).toBe(true);
  });

  it("maps one blocking tile to exactly an 8x8 vision-cell area", () => {
    const collision = new CollisionSystem([{
      id: "wall", tileX: 2, tileY: 3, widthTiles: 1, heightTiles: 1,
      blocksMovement: true, blocksVision: true, blocksProjectiles: true, coverHeight: "full", kind: "wall",
    }], []);
    let blocked = 0;
    for (let y = 0; y < MAP_TILES * FOG_CELLS_PER_TILE; y += 1) {
      for (let x = 0; x < MAP_TILES * FOG_CELLS_PER_TILE; x += 1) {
        if (collision.blocksVision(x, y)) blocked += 1;
      }
    }
    expect(blocked).toBe(64);
    expect(collision.blocksVision(16, 24)).toBe(true);
    expect(collision.blocksVision(23, 31)).toBe(true);
    expect(collision.blocksVision(24, 31)).toBe(false);
  });

  it("maps multi-tile vehicles across every covered vision cell", () => {
    const collision = new CollisionSystem([{
      id: "car", tileX: 8, tileY: 9, widthTiles: 2, heightTiles: 1,
      blocksMovement: true, blocksVision: true, blocksProjectiles: true, coverHeight: "full", kind: "vehicle",
    }], []);
    expect(collision.blocksVision(64, 72)).toBe(true);
    expect(collision.blocksVision(79, 79)).toBe(true);
    expect(collision.blocksVision(80, 79)).toBe(false);
  });

  it("keeps low furniture transparent while caching its vision cost", () => {
    const collision = new CollisionSystem([{
      id: "table",
      tileX: 3,
      tileY: 4,
      widthTiles: 1,
      heightTiles: 1,
      blocksMovement: true,
      blocksVision: false,
      blocksProjectiles: false,
      coverHeight: "low",
      kind: "furniture",
    }], []);
    expect(collision.blocksVision(24, 32)).toBe(false);
    expect(collision.additionalCost(31, 39)).toBe(0.65);
  });

  it("keeps the inner field solid while clustering the deterministic fringe", () => {
    const fog = new FogOfWarSystem(180, 180, FOG_CELL_SIZE, 456);
    const center = 90;
    const radius = 60;
    fog.recompute([source({ x: center, y: center, radius })], grid());
    for (let y = 0; y < fog.heightCells; y += 1) {
      for (let x = 0; x < fog.widthCells; x += 1) {
        const worldX = (x + 0.5) * FOG_CELL_SIZE;
        const worldY = (y + 0.5) * FOG_CELL_SIZE;
        if (Math.hypot(worldX - center, worldY - center) <= radius * 0.7) {
          expect(fog.getStateAtCell(x, y)).toBe(VisibilityState.Visible);
        }
      }
    }
  });
});
