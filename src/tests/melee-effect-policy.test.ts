import type Phaser from "phaser";
import { describe, expect, it } from "vitest";
import { createActiveMeleeTrail, MAX_ACTIVE_MELEE_TRAILS, MeleeTrailSystem } from "../effects/melee-trail-system";
import type { AttackEffectEvent } from "../effects/pixel-effect-definitions";

function event(weapon: "knife" | "bat", mode: "stab" | "swing" | "heavy", sequence = 1, impacts: AttackEffectEvent["impacts"] = []): AttackEffectEvent {
  return { sequence, weapon, meleeMode: mode, originX: 0, originY: 0, angle: 0, startedAt: 0, impacts };
}

class FakeGraphics {
  setDepth(): this { return this; }
  clear(): this { return this; }
  fillStyle(): this { return this; }
  fillRect(): this { return this; }
  destroy(): void {}
}

describe("melee world effect policy", () => {
  it("creates exactly one crescent only for arc-shaped attacks", () => {
    expect(createActiveMeleeTrail(event("knife", "swing"))?.geometry.kind).toBe("crescent");
    expect(createActiveMeleeTrail(event("bat", "swing"))?.geometry.kind).toBe("crescent");
    expect(createActiveMeleeTrail(event("bat", "heavy"))?.geometry.kind).toBe("crescent");
    expect(createActiveMeleeTrail(event("knife", "stab"))).toBeUndefined();
    expect(createActiveMeleeTrail(event("knife", "heavy"))).toBeUndefined();
    expect(createActiveMeleeTrail(event("bat", "stab"))).toBeUndefined();
  });

  it("does not attach echo or trailing fragment data", () => {
    const trail = createActiveMeleeTrail(event("bat", "heavy"))!;
    expect("echoStartsAt" in trail).toBe(false);
    expect("trailingFragments" in trail.geometry).toBe(false);
    expect(trail.geometry.kind).toBe("crescent");
  });

  it("deduplicates multi-hit and miss events by attack sequence", () => {
    const system = new MeleeTrailSystem({ add: { graphics: () => new FakeGraphics() } } as unknown as Phaser.Scene, () => true);
    expect(system.play(event("bat", "swing", 9, []))).toBe(true);
    expect(system.play(event("bat", "swing", 9, [{ x: 10, y: 0, kind: "zombie" }, { x: 12, y: 2, kind: "zombie" }]))).toBe(false);
    expect(system.activeCount).toBe(1);
    expect(system.activeCount).toBeLessThanOrEqual(MAX_ACTIVE_MELEE_TRAILS);
  });
});
