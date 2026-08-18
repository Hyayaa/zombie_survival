import { describe, expect, it } from "vitest";
// @ts-expect-error Vitest supplies Node at runtime without adding Node types to the game build.
import { readFileSync, readdirSync } from "node:fs";
import { ITEM_DEFINITIONS } from "../data/item-definitions";
import { WEAPON_DEFINITIONS } from "../data/weapon-definitions";
import { hasDedicatedItemIcon } from "../data/item-icons";

describe("footprint item art", () => {
  it("matches every PNG canvas to its base footprint without rotated duplicates", () => {
    const definitions = { ...ITEM_DEFINITIONS, ...WEAPON_DEFINITIONS };
    const encodedImages = new Set<string>();
    for (const [id, definition] of Object.entries(definitions)) {
      const bytes = readFileSync(`public/assets/items/${id}.png`);
      expect([...bytes.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
      expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual([definition.inventoryFootprint.width * 64, definition.inventoryFootprint.height * 64]);
      expect(hasDedicatedItemIcon(id)).toBe(true); encodedImages.add(bytes.toString("base64"));
    }
    expect(encodedImages.size).toBe(Object.keys(definitions).length);
    const names = readdirSync("public/assets/items");
    expect(names.filter((name: string) => /(?:_|-)(?:rot|90|vertical)(?:\.|_|-)/i.test(name))).toEqual([]);
    expect(names.filter((name: string) => /\.(?:zip|bmp|psd)$/i.test(name))).toEqual([]);
  });
});
