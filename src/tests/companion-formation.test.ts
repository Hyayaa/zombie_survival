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
});

