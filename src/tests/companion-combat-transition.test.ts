import { describe, expect, it } from "vitest";
import { COMPANION_MOTION_PROFILE, createActorMotionSmoothingState, updateActorMotionSmoothing } from "../systems/actor-motion-smoothing";
import { COMPANION_COMBAT_MOVEMENT_HOLD_MS, COMPANION_RANGED_AIM_TOLERANCE, createCompanionNavigationState, isCompanionAimAligned, updateCompanionCombatMovement } from "../systems/companion-navigation";
import { WEAPON_DEFINITIONS } from "../data/weapon-definitions";

describe("companion combat transition", () => {
  it("smooths new aim and only allows firing after alignment", () => {
    const motion = createActorMotionSmoothingState(0); motion.desiredHeadAngle = Math.PI;
    expect(isCompanionAimAligned(motion.headAngle, motion.desiredHeadAngle, WEAPON_DEFINITIONS.pistol)).toBe(false);
    updateActorMotionSmoothing(motion, COMPANION_MOTION_PROFILE, 0.05);
    expect(Math.abs(motion.headAngle)).toBeLessThan(Math.PI);
    for (let index = 0; index < 20; index += 1) updateActorMotionSmoothing(motion, COMPANION_MOTION_PROFILE, 0.05);
    expect(isCompanionAimAligned(motion.headAngle, motion.desiredHeadAngle, WEAPON_DEFINITIONS.pistol)).toBe(true);
    expect(COMPANION_RANGED_AIM_TOLERANCE).toBe(0.13);
  });

  it("keeps approach/hold/retreat modes across overlapping distance bands", () => {
    const state = createCompanionNavigationState({ x: 0, y: 0 }); const pistol = WEAPON_DEFINITIONS.pistol;
    expect(updateCompanionCombatMovement(state, pistol, pistol.range * 0.9, "follow", true, 0)).toBe("approach");
    expect(state.combatMovementLockedUntil).toBe(COMPANION_COMBAT_MOVEMENT_HOLD_MS);
    expect(updateCompanionCombatMovement(state, pistol, pistol.range * 0.7, "follow", true, 100)).toBe("approach");
    expect(updateCompanionCombatMovement(state, pistol, pistol.range * 0.7, "follow", true, 500)).toBe("hold");
    expect(updateCompanionCombatMovement(state, pistol, pistol.range * 0.57, "follow", true, 1_000)).toBe("retreat");
    expect(updateCompanionCombatMovement(state, pistol, pistol.range * 0.63, "follow", true, 1_500)).toBe("retreat");
    expect(updateCompanionCombatMovement(state, pistol, pistol.range * 0.68, "follow", true, 2_000)).toBe("hold");
  });

  it("preserves hold and melee command meanings", () => {
    const hold = createCompanionNavigationState({ x: 0, y: 0 });
    expect(updateCompanionCombatMovement(hold, WEAPON_DEFINITIONS.pistol, 500, "hold", true, 0)).toBe("hold");
    expect(updateCompanionCombatMovement(hold, WEAPON_DEFINITIONS.knife, 40, "follow", true, 0)).toBe("approach");
  });
});
