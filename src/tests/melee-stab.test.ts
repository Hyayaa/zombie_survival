import { describe, expect, it } from "vitest";
import { MELEE_ATTACK_DEFINITIONS } from "../data/melee-attack-definitions";
import { collectMeleeTargets } from "../systems/melee-combat-system";

describe("melee stab", () => {
  it("uses a narrow forward capsule and hits only the closest target", () => {
    const hits = collectMeleeTargets({ x: 0, y: 0 }, 0, MELEE_ATTACK_DEFINITIONS.knife.stab, [
      { id: "side", position: { x: 20, y: 15 }, alive: true },
      { id: "far", position: { x: 30, y: 0 }, alive: true },
      { id: "near", position: { x: 12, y: 1 }, alive: true },
    ], () => true, []);
    expect(hits.map((hit) => hit.target.id)).toEqual(["near"]);
  });
});
