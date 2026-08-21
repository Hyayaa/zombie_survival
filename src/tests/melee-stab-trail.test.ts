import { describe, expect, it } from "vitest";
import { createActiveMeleeTrail, getMeleeTrailLifecycle, getMeleeTrailTiming } from "../effects/melee-trail-system";

describe("melee stab pixel trail", () => {
  for (const [weapon, mode] of [["knife", "stab"], ["knife", "heavy"], ["bat", "stab"]] as const) {
    it(`creates one deterministic ${weapon} ${mode} stab trail`, () => {
      const input = { sequence: 7, weapon, meleeMode: mode, originX: 4.4, originY: 9.6, angle: 0.35, startedAt: 10, impacts: [] as const };
      const first = createActiveMeleeTrail(input)!;
      const second = createActiveMeleeTrail(input)!;
      expect(first.geometry.kind).toBe("stab");
      expect(second.geometry).toEqual(first.geometry);
      expect([...first.geometry.frame.cells, ...first.geometry.frame.edgeCells].every((cell) => Number.isInteger(cell.x) && Number.isInteger(cell.y))).toBe(true);
      expect(getMeleeTrailLifecycle(first, first.expiresAt).phase).toBe("expired");
    });
  }

  it("uses readable normal and heavy lifetimes without crescents", () => {
    const normal = getMeleeTrailTiming("knife", "stab")!;
    const heavy = getMeleeTrailTiming("knife", "heavy")!;
    expect(normal.revealMs + normal.holdMs + normal.fadeMs).toBeGreaterThanOrEqual(70);
    expect(heavy.revealMs + heavy.holdMs + heavy.fadeMs).toBeGreaterThan(normal.revealMs + normal.holdMs + normal.fadeMs);
  });
});
