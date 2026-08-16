import { describe, expect, it } from "vitest";
import { FIREARM_IDS, WEAPON_DEFINITIONS } from "../data/weapon-definitions";
import { createPelletAngles, createWeaponMagazines, getAmmoItemId } from "../systems/weapon-system";
import { SeededRng } from "../core/seeded-rng";

describe("weapon system", () => {
  it("defines four distinct firearm roles and fire modes", () => {
    expect(FIREARM_IDS).toEqual(["pistol", "smg", "shotgun", "hunting_rifle"]);
    expect(WEAPON_DEFINITIONS.smg.fireMode).toBe("auto");
    expect(WEAPON_DEFINITIONS.pistol.fireMode).toBe("semi");
    expect(WEAPON_DEFINITIONS.shotgun.fireMode).toBe("semi");
    expect(WEAPON_DEFINITIONS.hunting_rifle.fireMode).toBe("semi");
    expect(WEAPON_DEFINITIONS.hunting_rifle.range).toBeGreaterThan(WEAPON_DEFINITIONS.pistol.range);
    expect(new Set(FIREARM_IDS.map((id) => WEAPON_DEFINITIONS[id].cooldownMs)).size).toBe(4);
  });

  it("creates all shotgun pellets with reproducible spread", () => {
    const first = new SeededRng(41); const second = new SeededRng(41);
    const angles = createPelletAngles(1, WEAPON_DEFINITIONS.shotgun, () => first.next());
    expect(angles).toHaveLength(6);
    expect(angles).toEqual(createPelletAngles(1, WEAPON_DEFINITIONS.shotgun, () => second.next()));
  });

  it("uses independent magazines and matching ammunition", () => {
    const magazines = createWeaponMagazines({ pistol: 3, smg: 12, shotgun: 2, hunting_rifle: 1 });
    magazines.smg -= 1;
    expect(magazines).toEqual({ pistol: 3, smg: 11, shotgun: 2, hunting_rifle: 1 });
    expect(FIREARM_IDS.map((id) => getAmmoItemId(WEAPON_DEFINITIONS[id]))).toEqual(["pistol_ammo", "smg_ammo", "shotgun_shell", "rifle_ammo"]);
  });
});
