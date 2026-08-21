import type Phaser from "phaser";
import { describe, expect, it } from "vitest";
import { createActiveMeleeTrail, getMeleeTrailLifecycle, getMeleeTrailTiming, MAX_ACTIVE_MELEE_TRAILS, MeleeTrailSystem } from "../effects/melee-trail-system";
import type { AttackEffectEvent } from "../effects/pixel-effect-definitions";

class FakeGraphics {
  clearCount = 0; polygons = 0; pixels = 0; destroyed = false;
  setDepth(): this { return this; }
  clear(): this { this.clearCount += 1; return this; }
  fillStyle(): this { return this; }
  fillPoints(): this { this.polygons += 1; return this; }
  fillRect(): this { this.pixels += 1; return this; }
  destroy(): void { this.destroyed = true; }
}

function event(sequence = 1, weapon: "knife" | "bat" = "knife", mode: "stab" | "swing" | "heavy" = "swing", impacts: AttackEffectEvent["impacts"] = []): AttackEffectEvent {
  return { sequence, weapon, meleeMode: mode, originX: 10, originY: 20, angle: 0, startedAt: 100, impacts, meleeRange: 35, meleeArcRadians: 1.5 };
}

describe("melee trail lifecycle and batching", () => {
  it("reveals, holds, fades, and expires after active start", () => {
    const trail = createActiveMeleeTrail(event())!;
    expect(getMeleeTrailLifecycle(trail, 99).phase).toBe("before");
    const reveal = getMeleeTrailLifecycle(trail, 120);
    expect(reveal.phase).toBe("reveal"); expect(reveal.revealProgress).toBeGreaterThan(0); expect(reveal.revealProgress).toBeLessThan(1);
    expect(getMeleeTrailLifecycle(trail, trail.revealEndsAt + 1)).toMatchObject({ phase: "hold", revealProgress: 1, alpha: 1 });
    const fade = getMeleeTrailLifecycle(trail, trail.holdEndsAt + 10);
    expect(fade.phase).toBe("fade"); expect(fade.alpha).toBeLessThan(1);
    expect(getMeleeTrailLifecycle(trail, trail.expiresAt).phase).toBe("expired");
  });

  it("keeps stab shorter than swing and heavy longer than normal", () => {
    const lifetime = (weapon: "knife" | "bat", mode: "stab" | "swing" | "heavy") => { const value = getMeleeTrailTiming(weapon, mode); return value.revealMs + value.holdMs + value.fadeMs; };
    expect(lifetime("knife", "stab")).toBeLessThan(lifetime("knife", "swing"));
    expect(lifetime("bat", "heavy")).toBeGreaterThan(lifetime("bat", "swing"));
  });

  it("creates one trail per sequence for misses or multi-target hits and enforces its cap", () => {
    const graphics = new FakeGraphics();
    const scene = { add: { graphics: () => graphics } } as unknown as Phaser.Scene;
    const system = new MeleeTrailSystem(scene, () => true);
    expect(system.activeCount).toBe(0);
    expect(system.play(event(1, "knife", "swing", []))).toBe(true);
    expect(system.play(event(1, "knife", "swing", [{ x: 1, y: 2, kind: "zombie" }, { x: 2, y: 3, kind: "zombie" }]))).toBe(false);
    for (let sequence = 2; sequence <= 20; sequence += 1) system.play(event(sequence, "bat", "swing"));
    expect(system.activeCount).toBe(MAX_ACTIVE_MELEE_TRAILS);
    system.update(120); expect(graphics.clearCount).toBe(1); expect(graphics.polygons).toBeGreaterThan(0);
    system.clear(); expect(system.activeCount).toBe(0);
    system.destroy(); expect(graphics.destroyed).toBe(true);
  });

  it("does not create a melee trail for a blocked/no-event ranged call and respects fog visibility", () => {
    const graphics = new FakeGraphics();
    const scene = { add: { graphics: () => graphics } } as unknown as Phaser.Scene;
    const system = new MeleeTrailSystem(scene, () => false);
    expect(system.play({ ...event(), weapon: "pistol" })).toBe(false);
    system.play(event()); system.update(140);
    expect(graphics.polygons).toBe(0); expect(graphics.pixels).toBe(0);
  });
});
