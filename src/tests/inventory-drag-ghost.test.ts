import { describe, expect, it } from "vitest";
import { getDragPlacement, getFootprintPixelSize, rotateGrabOffset } from "../ui/inventory-panel";

describe("inventory drag ghost geometry", () => {
  it("preserves the grabbed cell and rotates its offset clockwise", () => {
    expect(getDragPlacement(145, 85, { left: 25, top: 5, width: 240 }, 6, 1, 1)).toEqual({ x: 2, y: 1, cell: 40 });
    expect(rotateGrabOffset(0, 1, 1, 2)).toEqual({ grabX: 0, grabY: 0 });
  });
  it("uses the same cell and gap formula for representative footprints", () => {
    expect(getFootprintPixelSize(1, 1, 40, 0)).toEqual({ width: 36, height: 36 });
    expect(getFootprintPixelSize(1, 2, 40, 0)).toEqual({ width: 36, height: 76 });
    expect(getFootprintPixelSize(2, 2, 40, 0)).toEqual({ width: 76, height: 76 });
    expect(getFootprintPixelSize(4, 1, 40, 0)).toEqual({ width: 156, height: 36 });
  });
});
