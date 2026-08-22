import { describe, expect, it } from "vitest";
import { CraftingStationSystem } from "../systems/crafting-station-system";

describe("CraftingStationSystem", () => {
  it("selects highest tier, then nearest, then stable id within range and line of sight", () => {
    const stations = new CraftingStationSystem();
    stations.register({ id: "makeshift", kind: "makeshift", x: 2, y: 0 });
    stations.register({ id: "plank-b", kind: "plank", x: 20, y: 0 });
    stations.register({ id: "plank-a", kind: "plank", x: 20, y: 0 });
    expect(stations.findBest({ x: 0, y: 0 }, { hasLineOfSight: () => true })?.id).toBe("plank-a");
  });

  it("rejects blocked and distant stations and prevents duplicate registration", () => {
    const stations = new CraftingStationSystem(); stations.register({ id: "bench", kind: "technical", x: 70, y: 0 });
    expect(stations.findBest({ x: 0, y: 0 }, { hasLineOfSight: () => false })).toBeUndefined();
    expect(stations.findBest({ x: -3, y: 0 }, { hasLineOfSight: () => true })).toBeUndefined();
    expect(() => stations.register({ id: "bench", kind: "makeshift", x: 0, y: 0 })).toThrow(/Duplicate/);
  });
});
