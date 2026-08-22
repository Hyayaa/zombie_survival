import { describe, expect, it } from "vitest";
import { ITEM_DEFINITIONS, getEffectiveFootprint, normalizeInventoryFootprint } from "../data/item-definitions";
import { WEAPON_DEFINITIONS } from "../data/weapon-definitions";
import { getInventoryItemViewGeometry } from "../ui/inventory-item-view";

describe("item footprint normalization", () => {
  it.each([
    [{ width: 2, height: 4 }, { width: 4, height: 2 }],
    [{ width: 1, height: 4 }, { width: 4, height: 1 }],
    [{ width: 3, height: 2 }, { width: 3, height: 2 }],
    [{ width: 2, height: 2 }, { width: 2, height: 2 }],
  ])("normalizes %o to landscape %o", (input, expected) => expect(normalizeInventoryFootprint(input)).toEqual(expected));

  it("swaps axes exactly once when rotated", () => {
    const definition = { inventoryFootprint: normalizeInventoryFootprint({ width: 2, height: 4 }) };
    expect(getEffectiveFootprint(definition, 0)).toEqual({ width: 4, height: 2 });
    expect(getEffectiveFootprint(definition, 1)).toEqual({ width: 2, height: 4 });
  });

  it("keeps every default definition landscape and UI geometry on the same rule", () => {
    for (const definition of [...Object.values(ITEM_DEFINITIONS), ...Object.values(WEAPON_DEFINITIONS)]) expect(definition.inventoryFootprint.width).toBeGreaterThanOrEqual(definition.inventoryFootprint.height);
    expect(getInventoryItemViewGeometry({ itemId: "shotgun", rotation: 0 })).toMatchObject({ effectiveWidthCells: 4, effectiveHeightCells: 2 });
    expect(getInventoryItemViewGeometry({ itemId: "shotgun", rotation: 1 })).toMatchObject({ effectiveWidthCells: 2, effectiveHeightCells: 4 });
  });
});
