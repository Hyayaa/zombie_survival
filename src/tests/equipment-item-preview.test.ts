import { describe, expect, it } from "vitest";
import { getEquipmentItemPreviewGeometry } from "../ui/inventory-panel";

describe("equipment item preview", () => {
  it("preserves a definition's footprint ratio instead of forcing a square", () => {
    const shotgun = getEquipmentItemPreviewGeometry("shotgun");
    expect(shotgun.frameHeightPx / shotgun.frameWidthPx).toBe(2);
    const rotated = getEquipmentItemPreviewGeometry("shotgun", 1);
    expect(rotated.frameWidthPx / rotated.frameHeightPx).toBe(2);
    expect(getEquipmentItemPreviewGeometry("basic_tshirt").frameWidthPx).toBe(getEquipmentItemPreviewGeometry("basic_tshirt").frameHeightPx);
    expect(getEquipmentItemPreviewGeometry("utility_vest").frameHeightPx / getEquipmentItemPreviewGeometry("utility_vest").frameWidthPx).toBe(1.5);
    expect(getEquipmentItemPreviewGeometry("military_backpack").frameHeightPx / getEquipmentItemPreviewGeometry("military_backpack").frameWidthPx).toBeCloseTo(4 / 3);
  });
});
