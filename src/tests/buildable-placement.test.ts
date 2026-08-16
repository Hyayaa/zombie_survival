import { describe, expect, it, vi } from "vitest";
import { getBuildablePlacementFailure, placeBuildableWithInventory, type BuildablePlacementProbe } from "../systems/buildable-placement";
import { CollisionSystem } from "../systems/collision-system";

const empty: BuildablePlacementProbe = { inBounds: true, blocked: false, occupiedByStructure: false, doorway: false, objective: false, extraction: false, actorOccupied: false, indoor: false, roadLane: false };

describe("buildable placement", () => {
  it("allows outdoor solar and indoor non-solar structures", () => {
    expect(getBuildablePlacementFailure("solar-generator", empty)).toBeNull();
    expect(getBuildablePlacementFailure("solar-generator", { ...empty, indoor: true })).toBe("solar-indoors");
    for (const kind of ["turret", "fuel-generator", "battery-bank"] as const) expect(getBuildablePlacementFailure(kind, { ...empty, indoor: true })).toBeNull();
  });

  it("rejects doors, obstacles, structures, objectives, extraction and actors", () => {
    expect(getBuildablePlacementFailure("turret", { ...empty, doorway: true })).toBe("doorway");
    expect(getBuildablePlacementFailure("turret", { ...empty, blocked: true })).toBe("blocked");
    expect(getBuildablePlacementFailure("turret", { ...empty, occupiedByStructure: true })).toBe("occupied");
    expect(getBuildablePlacementFailure("turret", { ...empty, objective: true })).toBe("objective");
    expect(getBuildablePlacementFailure("turret", { ...empty, extraction: true })).toBe("extraction");
    expect(getBuildablePlacementFailure("turret", { ...empty, actorOccupied: true })).toBe("actor");
  });

  it("consumes a kit only after validation", () => {
    const consume = vi.fn(() => true); const place = vi.fn();
    expect(placeBuildableWithInventory("turret", { ...empty, blocked: true }, consume, place)).toBe(false);
    expect(consume).not.toHaveBeenCalled();
    expect(placeBuildableWithInventory("turret", empty, consume, place)).toBe(true);
    expect(consume).toHaveBeenCalledOnce(); expect(place).toHaveBeenCalledOnce();
  });

  it("becomes a dynamic collision and pathfinding obstacle after placement", () => {
    const collision = new CollisionSystem([], [], 8, 8, 24);
    collision.addDynamicObstacle({ id: "structure", tileX: 3, tileY: 4, widthTiles: 1, heightTiles: 1, blocksMovement: true, blocksVision: false, blocksProjectiles: true, coverHeight: "low", kind: "furniture" });
    expect(collision.isTileBlocked(3, 4)).toBe(true);
    expect(collision.canOccupyCircle(3.5 * 24, 4.5 * 24, 5)).toBe(false);
  });
});
