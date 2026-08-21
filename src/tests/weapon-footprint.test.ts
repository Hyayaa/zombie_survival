import { describe, expect, it } from "vitest";
import { WEAPON_DEFINITIONS } from "../data/weapon-definitions";
import { getEffectiveFootprint } from "../data/item-definitions";

describe("weapon inventory footprints", () => {
  it("uses the revised pistol, knife, shotgun, and bat footprints", () => {
    expect(WEAPON_DEFINITIONS.pistol.inventoryFootprint).toEqual({ width: 2, height: 2 });
    expect(WEAPON_DEFINITIONS.knife.inventoryFootprint).toEqual({ width: 2, height: 2 });
    expect(WEAPON_DEFINITIONS.shotgun.inventoryFootprint).toEqual({ width: 2, height: 4 });
    expect(WEAPON_DEFINITIONS.bat.inventoryFootprint).toEqual({ width: 2, height: 4 });
    expect(getEffectiveFootprint(WEAPON_DEFINITIONS.shotgun, 1)).toEqual({ width: 4, height: 2 });
    expect(getEffectiveFootprint(WEAPON_DEFINITIONS.bat, 1)).toEqual({ width: 4, height: 2 });
  });
});
