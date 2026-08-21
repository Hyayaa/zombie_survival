import { describe, expect, it } from "vitest";
import { BUILDABLE_DEFINITIONS } from "../data/buildable-definitions";
import { ITEM_DEFINITIONS } from "../data/item-definitions";
import { RECIPE_DEFINITIONS } from "../data/recipe-definitions";
import { stationSatisfies } from "../systems/crafting-system";

describe("tiered workbench buildables", () => {
  it("defines the three kits, footprints and non-vision/projectile blocking stations", () => {
    expect(BUILDABLE_DEFINITIONS.makeshift_workbench).toMatchObject({ kitItemId: "makeshift_workbench_kit", footprint: { width: 2, height: 2 }, craftingStationKind: "makeshift", blocksMovement: true, blocksVision: false, blocksProjectiles: false });
    expect(BUILDABLE_DEFINITIONS.plank_workbench.footprint).toEqual({ width: 2, height: 2 });
    expect(BUILDABLE_DEFINITIONS.technical_workbench.footprint).toEqual({ width: 3, height: 2 });
    for (const id of ["makeshift_workbench_kit", "plank_workbench_kit", "technical_workbench_kit"]) expect(ITEM_DEFINITIONS[id]).toBeDefined();
  });

  it("defines the requested upgrade recipes and higher stations satisfy lower tiers", () => {
    expect(RECIPE_DEFINITIONS.find((recipe) => recipe.id === "makeshift_workbench_kit")).toMatchObject({ requiredStation: "hand", ingredients: { wood: 4, cloth: 2, duct_tape: 1 } });
    expect(RECIPE_DEFINITIONS.find((recipe) => recipe.id === "plank_workbench_kit")).toMatchObject({ requiredStation: "makeshift", ingredients: { wood: 8, screws: 4, duct_tape: 2 } });
    expect(RECIPE_DEFINITIONS.find((recipe) => recipe.id === "technical_workbench_kit")).toMatchObject({ requiredStation: "plank", ingredients: { steel_plate: 4, screws: 8, circuit_board: 2, electric_motor: 1, duct_tape: 2 } });
    expect(stationSatisfies("technical", "makeshift")).toBe(true);
    expect(stationSatisfies("hand", "makeshift")).toBe(false);
  });
});
