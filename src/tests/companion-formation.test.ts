import { describe, expect, it } from "vitest";
import { createFormationState, getFormationSlot, updateFormationDirection } from "../systems/companion-system";

describe("companion formation", () => {
  it("delays a direction reversal before moving the slot across the player", () => {
    const player = { x: 100, y: 100 };
    const initial = createFormationState();
    const firstReverseFrame = updateFormationDirection(initial, { x: 0, y: -1 }, 16, 260);
    expect(getFormationSlot(player, firstReverseFrame).y).toBeLessThan(100);
    const held = updateFormationDirection(firstReverseFrame, { x: 0, y: -1 }, 270, 260);
    expect(getFormationSlot(player, held).y).toBeGreaterThan(100);
  });

  it("assigns four distinct follow and move formation slots", () => {
    const center = { x: 200, y: 200 };
    const formation = createFormationState();
    const slots = [0, 1, 2, 3].map((index) => getFormationSlot(center, formation, 28, index));
    expect(new Set(slots.map((slot) => `${slot.x},${slot.y}`)).size).toBe(4);
    expect(slots[1]!.x).not.toBe(slots[2]!.x);
    expect(slots[3]!.y).toBeLessThan(slots[0]!.y);
  });
});
