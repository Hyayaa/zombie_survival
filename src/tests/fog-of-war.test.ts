import { describe, expect, it } from "vitest";
import { CollisionSystem } from "../systems/collision-system";
import { FogOfWarSystem, VisibilityState, type VisionGrid, type VisionSource } from "../systems/fog-of-war-system";

function source(overrides: Partial<VisionSource> = {}): VisionSource {
  return { x: 51, y: 63, radius: 42, intensity: 1, sourceType: "player", ...overrides };
}

function grid(blocked: (x: number, y: number) => boolean = () => false): VisionGrid {
  return { blocksVision: blocked, additionalCost: () => 0 };
}

describe("FogOfWarSystem", () => {
  it("marks nearby cells visible and leaves distant cells unknown", () => {
    const fog = new FogOfWarSystem(120, 120, 6, 123);
    fog.recompute([source()], grid());
    expect(fog.getStateAtWorld(51, 63)).toBe(VisibilityState.Visible);
    expect(fog.getStateAtWorld(114, 6)).toBe(VisibilityState.Unknown);
  });

  it("keeps previously seen cells explored after the source moves", () => {
    const fog = new FogOfWarSystem(180, 120, 6, 123);
    fog.recompute([source({ x: 30, y: 60, radius: 30 })], grid());
    expect(fog.getStateAtWorld(30, 60)).toBe(VisibilityState.Visible);
    fog.recompute([source({ x: 150, y: 60, radius: 24 })], grid());
    expect(fog.getStateAtWorld(30, 60)).toBe(VisibilityState.Explored);
  });

  it("blocks visibility behind a wall and opens it through a door", () => {
    let doorOpen = false;
    const fog = new FogOfWarSystem(150, 150, 6, 42);
    const wallGrid = grid((x, y) => x === 10 && !(doorOpen && y === 10));
    fog.recompute([source({ x: 8 * 6 + 3, y: 10 * 6 + 3, radius: 48 })], wallGrid);
    expect(fog.getStateAtCell(12, 10)).not.toBe(VisibilityState.Visible);
    doorOpen = true;
    fog.recompute([source({ x: 8 * 6 + 3, y: 10 * 6 + 3, radius: 48 })], wallGrid);
    expect(fog.getStateAtCell(12, 10)).toBe(VisibilityState.Visible);
  });

  it("produces the same irregular edge for the same seed", () => {
    const first = new FogOfWarSystem(180, 180, 6, 777);
    const second = new FogOfWarSystem(180, 180, 6, 777);
    first.recompute([source({ x: 90, y: 90, radius: 66 })], grid());
    second.recompute([source({ x: 90, y: 90, radius: 66 })], grid());
    const firstStates = Array.from({ length: first.widthCells * first.heightCells }, (_, index) => first.getStateAtCell(index % first.widthCells, Math.floor(index / first.widthCells)));
    const secondStates = Array.from({ length: second.widthCells * second.heightCells }, (_, index) => second.getStateAtCell(index % second.widthCells, Math.floor(index / second.widthCells)));
    expect(firstStates).toEqual(secondStates);
  });

  it("keeps cells outside the flashlight cone hidden", () => {
    const fog = new FogOfWarSystem(180, 180, 6, 99);
    fog.recompute([source({ x: 90, y: 90, radius: 72, sourceType: "flashlight", direction: 0, coneAngle: Math.PI / 3 })], grid());
    expect(fog.getStateAtWorld(126, 90)).toBe(VisibilityState.Visible);
    expect(fog.getStateAtWorld(90, 144)).not.toBe(VisibilityState.Visible);
  });

  it("does not leak visibility through a sealed diagonal corner", () => {
    const fog = new FogOfWarSystem(150, 150, 6, 314);
    const cornerGrid = grid((x, y) => x === 11 && y === 10 || x === 10 && y === 11);
    fog.recompute([source({ x: 10 * 6 + 3, y: 10 * 6 + 3, radius: 54 })], cornerGrid);
    expect(fog.getStateAtCell(12, 12)).not.toBe(VisibilityState.Visible);
  });

  it("reports only cells whose visible state changed", () => {
    const fog = new FogOfWarSystem(180, 180, 6, 101);
    const visionSource = source({ x: 90, y: 90, radius: 48 });
    expect(fog.recompute([visionSource], grid())).toBeGreaterThan(0);
    expect(fog.recompute([visionSource], grid())).toBe(0);
    expect(fog.getChangedIndices()).toHaveLength(0);
  });

  it("updates only the cached vision cells covered by a door tile", () => {
    const collision = new CollisionSystem([], [{ id: "door", tileX: 5, tileY: 7, open: false }]);
    const revision = collision.visionRevision;
    expect(collision.blocksVision(20, 28)).toBe(true);
    expect(collision.blocksVision(23, 31)).toBe(true);
    expect(collision.blocksVision(24, 28)).toBe(false);
    collision.setDoorOpen("door", true);
    expect(collision.blocksVision(20, 28)).toBe(false);
    expect(collision.visionRevision).toBeGreaterThan(revision);
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
    expect(collision.blocksVision(12, 16)).toBe(false);
    expect(collision.additionalCost(15, 19)).toBe(0.65);
  });
});
