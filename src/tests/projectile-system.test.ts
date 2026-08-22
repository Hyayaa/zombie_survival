import { describe, expect, it, vi } from "vitest";
import { ProjectileSystem, segmentCircleFirstAmount, type ProjectileSpawn } from "../systems/projectile-system";

const spawn: ProjectileSpawn = { shotSequence: 1, pelletIndex: 0, ownerId: "player", team: "player", weaponId: "pistol", x: 0, y: 0, angle: 0, speed: 100, maximumDistance: 100, damage: 10, postureDamage: 2, knockback: 1, collisionRadius: 1, visualLength: 5, visualWidth: 2, now: 0 };

describe("ProjectileSystem", () => {
  it("moves first and damages only on swept target arrival", () => {
    const system = new ProjectileSystem(undefined, undefined, 4);
    const onImpact = vi.fn();
    system.spawn(spawn);
    expect(onImpact).not.toHaveBeenCalled();
    const query = { targets: [{ id: "z", position: { x: 18, y: 0 }, radius: 5, alive: true, team: "zombie" as const }], firstWorldHit: () => null, onImpact };
    system.update(0.05, query);
    expect(onImpact).not.toHaveBeenCalled();
    system.update(0.05, query);
    system.update(0.05, query);
    expect(onImpact).toHaveBeenCalledOnce();
    expect(system.activeCount).toBe(0);
  });

  it("chooses an earlier wall and ignores friendly or dead targets", () => {
    const system = new ProjectileSystem(undefined, undefined, 2); const onImpact = vi.fn(); system.spawn(spawn);
    system.update(0.2, { targets: [{ id: "ally", position: { x: 5, y: 0 }, radius: 5, alive: true, team: "ally" }, { id: "dead", position: { x: 7, y: 0 }, radius: 5, alive: false, team: "zombie" }, { id: "z", position: { x: 15, y: 0 }, radius: 3, alive: true, team: "zombie" }], firstWorldHit: () => ({ point: { x: 6, y: 0 }, amount: 0.3 }), onImpact });
    expect(onImpact.mock.calls[0]![0].type).toBe("world");
  });

  it("expires at range, reuses a bounded pool, and solves segment-circle intersections", () => {
    const system = new ProjectileSystem(undefined, undefined, 2);
    for (let index = 0; index < 5; index += 1) system.spawn({ ...spawn, shotSequence: index });
    expect(system.activeCount).toBe(2);
    for (let step = 0; step < 20; step += 1) system.update(0.05, { targets: [], firstWorldHit: () => null, onImpact: () => undefined });
    expect(system.activeCount).toBe(0);
    expect(segmentCircleFirstAmount({ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 10, y: 0 }, 2)).toBeCloseTo(0.4);
  });
});
