import type Phaser from "phaser";
import { describe, expect, it } from "vitest";
import { createActiveMeleeTrail, getMeleeTrailLifecycle, getMeleeTrailTiming, MAX_ACTIVE_MELEE_TRAILS, MeleeTrailSystem } from "../effects/melee-trail-system";
import type { AttackEffectEvent } from "../effects/pixel-effect-definitions";

class FakeGraphics {
  clearCount = 0;
  pixels = 0;
  destroyed = false;
  setDepth(): this { return this; }
  clear(): this { this.clearCount += 1; return this; }
  fillStyle(): this { return this; }
  fillRect(): this { this.pixels += 1; return this; }
  destroy(): void { this.destroyed = true; }
}

function event(sequence = 1, weapon: "knife" | "bat" = "knife", mode: "stab" | "swing" | "heavy" = "swing", impacts: AttackEffectEvent["impacts"] = []): AttackEffectEvent {
  return { sequence, weapon, meleeMode: mode, originX: 10, originY: 20, angle: 0, startedAt: 100, impacts, meleeRange: weapon === "knife" ? 28 : 47, meleeArcRadians: 1.5 };
}

describe("melee trail lifecycle and batching", () => {
  it("reveals, holds, fades by alpha, and expires", () => {
    const trail = createActiveMeleeTrail(event())!;
    expect(getMeleeTrailLifecycle(trail, 99).phase).toBe("before");
    const reveal = getMeleeTrailLifecycle(trail, 120);
    expect(reveal.phase).toBe("reveal");
    expect(reveal.revealProgress).toBeGreaterThan(0);
    expect(trail.geometry.revealFrames[0]!.cells.length).toBeLessThan(trail.geometry.frame.cells.length);
    expect(getMeleeTrailLifecycle(trail, trail.revealEndsAt + 1)).toMatchObject({ phase: "hold", revealProgress: 1, alpha: 1 });
    expect(getMeleeTrailLifecycle(trail, trail.holdEndsAt + 10).alpha).toBeLessThan(1);
    expect(getMeleeTrailLifecycle(trail, trail.expiresAt).phase).toBe("expired");
  });

  it("keeps knife swing shorter than bat swing and bat heavy", () => {
    const lifetime = (weapon: "knife" | "bat", mode: "swing" | "heavy") => {
      const value = getMeleeTrailTiming(weapon, mode)!;
      return value.revealMs + value.holdMs + value.fadeMs;
    };
    expect(lifetime("knife", "swing")).toBe(110);
    expect(lifetime("bat", "swing")).toBe(135);
    expect(lifetime("bat", "heavy")).toBe(160);
  });

  it("creates one crescent per sequence for misses or multi-target hits and enforces its cap", () => {
    const graphics = new FakeGraphics();
    const scene = { add: { graphics: () => graphics } } as unknown as Phaser.Scene;
    const system = new MeleeTrailSystem(scene, () => true);
    expect(system.play(event(1, "knife", "swing", []))).toBe(true);
    expect(system.play(event(1, "knife", "swing", [{ x: 1, y: 2, kind: "zombie" }, { x: 2, y: 3, kind: "zombie" }]))).toBe(false);
    for (let sequence = 2; sequence <= 20; sequence += 1) system.play(event(sequence, "bat", "swing"));
    expect(system.activeCount).toBe(MAX_ACTIVE_MELEE_TRAILS);
    system.update(120);
    expect(graphics.clearCount).toBe(1);
    expect(graphics.pixels).toBeGreaterThan(0);
  });

  it("uses no trail for stabbing or fog-hidden attacks", () => {
    expect(createActiveMeleeTrail(event(1, "knife", "stab"))).toBeUndefined();
    expect(createActiveMeleeTrail(event(2, "knife", "heavy"))).toBeUndefined();
    expect(createActiveMeleeTrail(event(3, "bat", "stab"))).toBeUndefined();
    const graphics = new FakeGraphics();
    const system = new MeleeTrailSystem({ add: { graphics: () => graphics } } as unknown as Phaser.Scene, () => false);
    system.play(event(4));
    system.update(120);
    expect(graphics.pixels).toBe(0);
  });
});
