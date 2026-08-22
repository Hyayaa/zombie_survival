import { describe, expect, it } from "vitest";
import { BUILDABLE_DEFINITIONS, getBuildCostItems } from "../data/buildable-definitions";

describe("shared buildable definitions", () => {
  it("defines new walls, door and 8x6 crate", () => {
    expect(BUILDABLE_DEFINITIONS["wood-wall"]).toMatchObject({ placementKind: "segment", maximumHealth: 240, material: "wood", segment: { length: 24, thickness: 5, supportsDiagonal: true } });
    expect(getBuildCostItems(BUILDABLE_DEFINITIONS["wood-wall"])).toEqual([{ itemId: "wood", quantity: 4 }, { itemId: "screws", quantity: 2 }]);
    expect(BUILDABLE_DEFINITIONS["metal-wall"]).toMatchObject({ placementKind: "segment", maximumHealth: 600, material: "metal" });
    expect(BUILDABLE_DEFINITIONS["wood-door"]).toMatchObject({ placementKind: "segment", maximumHealth: 190 });
    expect(BUILDABLE_DEFINITIONS["wood-crate"]).toMatchObject({ placementKind: "footprint", maximumHealth: 180, storage: { width: 8, height: 6 } });
  });
  it("keeps every existing buildable in the common registry with cost, health and geometry", () => {
    for (const kind of ["barricade", "turret", "solar-generator", "fuel-generator", "battery-bank", "makeshift_workbench", "plank_workbench", "technical_workbench"] as const) expect(BUILDABLE_DEFINITIONS[kind]).toBeDefined();
    for (const definition of Object.values(BUILDABLE_DEFINITIONS)) {
      expect(getBuildCostItems(definition).length).toBeGreaterThan(0); expect(definition.maximumHealth).toBeGreaterThan(0);
      expect(definition.placementKind === "segment" ? definition.segment : definition.footprint).toBeDefined();
    }
  });
});
