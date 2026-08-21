import { describe, expect, it } from "vitest";
import { MELEE_ATTACK_DEFINITIONS } from "../data/melee-attack-definitions";
import { collectMeleeTargets, MeleeHitTracker } from "../systems/melee-combat-system";

describe("melee swing", () => {
  it("hits a bounded arc in distance order with multi-target attenuation", () => {
    const hits = collectMeleeTargets({ x: 0, y: 0 }, 0, MELEE_ATTACK_DEFINITIONS.bat.swing, [
      { id: "b", position: { x: 28, y: 10 }, alive: true },
      { id: "a", position: { x: 15, y: -4 }, alive: true },
      { id: "c", position: { x: 38, y: -12 }, alive: true },
      { id: "behind", position: { x: -10, y: 0 }, alive: true },
    ], () => true, []);
    expect(hits.map((hit) => hit.target.id)).toEqual(["a", "b", "c"]);
    expect(hits.map((hit) => hit.multiplier)).toEqual([1, 0.75, 0.55]);
  });

  it("registers a target once per attack sequence", () => {
    const tracker = new MeleeHitTracker(); tracker.begin(1);
    expect(tracker.tryHit("z")).toBe(true); expect(tracker.tryHit("z")).toBe(false);
    tracker.begin(2); expect(tracker.tryHit("z")).toBe(true);
  });
});
