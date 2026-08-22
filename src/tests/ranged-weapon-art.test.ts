import { describe, expect, it } from "vitest";
// @ts-expect-error Vitest supplies Node at runtime without adding Node types to the game build.
import { readFileSync } from "node:fs";
import metadata from "../../public/assets/items/ranged-weapon-art.json";
import { WEAPON_DEFINITIONS } from "../data/weapon-definitions";

describe("ranged weapon pixel art", () => {
  const ranged = Object.values(WEAPON_DEFINITIONS).filter((weapon) => weapon.kind === "ranged");

  it("covers every ranged definition with an east-facing part manifest", () => {
    expect(metadata.weapons.map((weapon) => weapon.id)).toEqual(ranged.map((weapon) => weapon.id));
    for (const weapon of metadata.weapons) {
      expect(weapon.source).toBe("WEAPON_DEFINITIONS"); expect(weapon.direction).toBe("east"); expect(weapon.facing).toBe("east");
      expect(weapon.keypoints.stockX).toBeLessThan(weapon.keypoints.muzzleX);
      expect(weapon.parts).toContain("muzzle"); expect(weapon.parts.length).toBeGreaterThanOrEqual(9);
      expect(weapon.footprint.width).toBeGreaterThanOrEqual(weapon.footprint.height);
      expect(weapon.alphaBounds.right - weapon.alphaBounds.left).toBeGreaterThan(weapon.alphaBounds.bottom - weapon.alphaBounds.top);
      expect(weapon.alphaBounds.left).toBeGreaterThan(0); expect(weapon.alphaBounds.right).toBeLessThan(weapon.canvas.width);
    }
  });

  it("keeps distinct structural metadata for SMG, shotgun and rifle", () => {
    const parts = (id: string) => metadata.weapons.find((weapon) => weapon.id === id)?.parts ?? [];
    expect(parts("smg")).toEqual(expect.arrayContaining(["short_stock", "magazine", "polymer_body"]));
    expect(parts("shotgun")).toEqual(expect.arrayContaining(["stock", "pump", "tubular_magazine"]));
    expect(parts("hunting_rifle")).toEqual(expect.arrayContaining(["wood_stock", "bolt", "scope"]));
  });

  it("preserves each footprint-sized transparent PNG canvas", () => {
    for (const weapon of ranged) {
      const bytes = readFileSync(`public/assets/items/${weapon.id}.png`);
      expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual([weapon.inventoryFootprint.width * 64, weapon.inventoryFootprint.height * 64]);
      const entry = metadata.weapons.find((candidate) => candidate.id === weapon.id);
      expect(entry?.canvas).toEqual({ width: weapon.inventoryFootprint.width * 64, height: weapon.inventoryFootprint.height * 64 });
    }
  });
});
