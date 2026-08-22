import { describe, expect, it } from "vitest";
import { getEquipmentItemPreviewGeometry } from "../ui/inventory-panel";
import { getInventoryItemViewGeometry } from "../ui/inventory-item-view";

describe("equipment item preview", () => {
  it("preserves a definition's footprint ratio instead of forcing a square", () => {
    const shotgun = getEquipmentItemPreviewGeometry("shotgun");
    expect(shotgun.frameWidthPx / shotgun.frameHeightPx).toBe(2);
    const rotated = getEquipmentItemPreviewGeometry("shotgun", 1);
    expect(rotated.frameHeightPx / rotated.frameWidthPx).toBe(2);
    expect(getEquipmentItemPreviewGeometry("basic_tshirt").frameWidthPx).toBe(getEquipmentItemPreviewGeometry("basic_tshirt").frameHeightPx);
    expect(getEquipmentItemPreviewGeometry("utility_vest").frameWidthPx / getEquipmentItemPreviewGeometry("utility_vest").frameHeightPx).toBe(1.5);
    expect(getEquipmentItemPreviewGeometry("military_backpack").frameWidthPx / getEquipmentItemPreviewGeometry("military_backpack").frameHeightPx).toBeCloseTo(4 / 3);
  });
  it("uses exactly the same footprint pixels as every inventory item surface", () => {
    for (const itemId of ["basic_tshirt", "shotgun", "utility_vest"]) {
      const equipped = getEquipmentItemPreviewGeometry(itemId);
      const inventory = getInventoryItemViewGeometry({ itemId, rotation: 0 });
      expect([equipped.frameWidthPx, equipped.frameHeightPx]).toEqual([inventory.frameWidthPx, inventory.frameHeightPx]);
    }
    expect(getEquipmentItemPreviewGeometry("basic_tshirt")).toMatchObject({ frameWidthPx: 80, frameHeightPx: 80 });
    expect(getEquipmentItemPreviewGeometry("shotgun")).toMatchObject({ frameWidthPx: 160, frameHeightPx: 80 });
  });
});
