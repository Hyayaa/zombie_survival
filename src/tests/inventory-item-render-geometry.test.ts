import { describe, expect, it } from "vitest";
import { getInventoryItemRenderGeometry } from "../ui/inventory-item-render-geometry";

describe("inventory item render geometry", () => {
  it("uses cells, gaps, and padding without mutating the footprint", () => {
    const footprint = { width: 1, height: 2 }; const before = { ...footprint };
    const geometry = getInventoryItemRenderGeometry(footprint, 0, 40, 2, 3);
    expect([geometry.frameWidthPx, geometry.frameHeightPx]).toEqual([40, 82]);
    expect(geometry.imageWidthPx).toBeGreaterThan(0); expect(geometry.imageHeightPx).toBeGreaterThan(0); expect(footprint).toEqual(before);
    expect(getInventoryItemRenderGeometry({ width: 1, height: 1 }, 0, 40).frameWidthPx).toBe(40);
    expect(getInventoryItemRenderGeometry({ width: 2, height: 2 }, 0, 40).frameWidthPx).toBe(80);
  });
  it("contains the unrotated and rotated image bounding boxes inside the same footprint frame", () => {
    for (const rotation of [0, 1] as const) {
      const geometry = getInventoryItemRenderGeometry({ width: 2, height: 4 }, rotation, 40, 0, 4);
      expect(geometry.rotatedImageWidthPx).toBeLessThanOrEqual(geometry.frameWidthPx - 8);
      expect(geometry.rotatedImageHeightPx).toBeLessThanOrEqual(geometry.frameHeightPx - 8);
      expect([geometry.effectiveWidthCells, geometry.effectiveHeightCells]).toEqual(rotation === 0 ? [2, 4] : [4, 2]);
    }
  });
  it("contains a rotated one-by-two image in a two-by-one frame", () => {
    const geometry = getInventoryItemRenderGeometry({ width: 1, height: 2 }, 1, 40, 0, 3);
    expect([geometry.frameWidthPx, geometry.frameHeightPx]).toEqual([80, 40]);
    expect(geometry.rotatedImageWidthPx).toBeLessThanOrEqual(74); expect(geometry.rotatedImageHeightPx).toBeLessThanOrEqual(34);
  });
});
