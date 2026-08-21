import { describe, expect, it } from "vitest";
import { createItemGridRowMarkup, packReadonlyGrid } from "../ui/item-grid-row";

describe("crafting recipe row", () => {
  it("packs actual item footprints deterministically into a read-only grid", () => {
    const items = [
      { key: "steel", itemId: "steel_plate", quantity: 4 },
      { key: "screws", itemId: "screws", quantity: 8 },
      { key: "motor", itemId: "electric_motor", quantity: 1 },
    ];
    const first = packReadonlyGrid(items, 8); const second = packReadonlyGrid(items, 8);
    expect(first).toEqual(second);
    expect(first.placements.map(({ itemId, x, y, width, height }) => ({ itemId, x, y, width, height }))).toEqual([
      { itemId: "steel_plate", x: 0, y: 0, width: 2, height: 2 },
      { itemId: "screws", x: 2, y: 0, width: 1, height: 1 },
      { itemId: "electric_motor", x: 3, y: 0, width: 1, height: 2 },
    ]);
  });

  it("uses the same left/right row shell for storage and recipes", () => {
    const markup = createItemGridRowMarkup({ className: "craft-recipe", header: "header", left: "result", right: "materials" });
    expect(markup).toContain("item-grid-row__left\">result");
    expect(markup).toContain("item-grid-row__right\">materials");
  });
});
