import { describe, expect, it } from "vitest";
import { createInventoryItemView, getInventoryItemViewGeometry, type InventoryItemSurface } from "../ui/inventory-item-view";

describe("common inventory item view", () => {
  it("uses one geometry and one centered image hierarchy on every surface", () => {
    const surfaces: InventoryItemSurface[] = ["inventory-grid", "equipment-slot", "weapon-slot", "drag-ghost"];
    const geometries = surfaces.map(() => getInventoryItemViewGeometry({ itemId: "shotgun", rotation: 1 }));
    expect(geometries.every(({ frameWidthPx, frameHeightPx }) => frameWidthPx === 160 && frameHeightPx === 80)).toBe(true);
    for (const surface of surfaces) {
      const markup = createInventoryItemView({ instanceId: "weapon-1", itemId: "shotgun", quantity: 1, rotation: 1, surface });
      expect(markup).toContain(`inventory-item-frame--${surface}`); expect(markup).toContain("inventory-item-visual-stage"); expect(markup).toContain("inventory-item-centerer");
      expect(markup.match(/inventory-item-image/g)).toHaveLength(1); expect(markup).toContain('data-rotation="1"'); expect(markup).not.toContain("item-icon-frame");
    }
  });

  it("keeps dimensions integer and reserves a one-pixel clipping safety margin", () => {
    for (const rotation of [0, 1] as const) {
      const geometry = getInventoryItemViewGeometry({ itemId: "water", rotation });
      expect(Number.isInteger(geometry.imageWidthPx)).toBe(true); expect(Number.isInteger(geometry.imageHeightPx)).toBe(true);
      expect(geometry.rotatedImageWidthPx).toBeLessThanOrEqual(geometry.frameWidthPx - geometry.innerPaddingPx * 2 - 1);
      expect(geometry.rotatedImageHeightPx).toBeLessThanOrEqual(geometry.frameHeightPx - geometry.innerPaddingPx * 2 - 1);
    }
  });
});
