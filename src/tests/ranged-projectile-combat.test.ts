import { describe, expect, it } from "vitest";
import { FIREARM_IDS, WEAPON_DEFINITIONS } from "../data/weapon-definitions";
import { ProjectileSystem } from "../systems/projectile-system";

describe("ranged projectile combat profiles", () => {
  it("provides real projectile data for every firearm and one projectile per pellet", () => {
    for (const id of FIREARM_IDS) {
      const weapon = WEAPON_DEFINITIONS[id];
      expect(weapon.projectileSpeed).toBeGreaterThan(800);
      expect(weapon.projectileVisualLength).toBeGreaterThan(0);
      const system = new ProjectileSystem(undefined, undefined, 32);
      for (let pellet = 0; pellet < (weapon.pelletCount ?? 1); pellet += 1) system.spawn({ shotSequence: 1, pelletIndex: pellet, ownerId: "player", team: "player", weaponId: id, x: 0, y: 0, angle: 0, speed: weapon.projectileSpeed!, maximumDistance: weapon.range, damage: weapon.damage, postureDamage: 1, knockback: weapon.knockback, collisionRadius: weapon.projectileRadius!, visualLength: weapon.projectileVisualLength!, visualWidth: weapon.projectileVisualWidth!, now: 0 });
      expect(system.activeCount).toBe(weapon.pelletCount ?? 1);
    }
  });
  it("accepts player, ally, and turret ownership in the same pool", () => {
    const system = new ProjectileSystem(undefined, undefined, 8);
    for (const [index, team] of (["player", "ally", "turret"] as const).entries()) system.spawn({ shotSequence: index, pelletIndex: 0, ownerId: team, team, weaponId: team === "turret" ? "turret" : "pistol", x: 0, y: 0, angle: 0, speed: 100, maximumDistance: 20, damage: 1, postureDamage: 1, knockback: 0, collisionRadius: 1, visualLength: 2, visualWidth: 1, now: 0 });
    expect(system.activeCount).toBe(3);
  });
});
