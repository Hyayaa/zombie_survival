import { describe, expect, it } from "vitest";
import { createZombieOrganicBehaviorState, updateZombieGait, ZOMBIE_GAIT_RANGES } from "../systems/zombie-organic-behavior";
import { createActorMotionSmoothingState, updateActorMotionSmoothing, WALKER_MOTION_PROFILE } from "../systems/actor-motion-smoothing";

describe("zombie gait variation", () => {
  it("selects low-frequency deterministic chase targets inside each kind range", () => {
    for (const kind of ["walker", "runner"] as const) {
      const first = createZombieOrganicBehaviorState("z-1"); const second = createZombieOrganicBehaviorState("z-1");
      first.gait.nextTargetAt = 0; second.gait.nextTargetAt = 0;
      updateZombieGait(first, "z-1", kind, "Chase", 0); updateZombieGait(second, "z-1", kind, "Chase", 0);
      expect(second.gait).toEqual(first.gait);
      expect(first.gait.targetMultiplier).toBeGreaterThanOrEqual(ZOMBIE_GAIT_RANGES.Chase[kind][0]);
      expect(first.gait.targetMultiplier).toBeLessThanOrEqual(ZOMBIE_GAIT_RANGES.Chase[kind][1]);
      expect(first.gait.nextTargetAt).toBeGreaterThanOrEqual(700); expect(first.gait.nextTargetAt).toBeLessThanOrEqual(1_600);
      expect(first.gait.transitionEndsAt).toBeGreaterThanOrEqual(250); expect(first.gait.transitionEndsAt).toBeLessThanOrEqual(520);
    }
  });

  it("changes continuously instead of drawing a value every frame", () => {
    const state = createZombieOrganicBehaviorState("z-smooth"); state.gait.nextTargetAt = 0;
    const start = updateZombieGait(state, "z-smooth", "walker", "Chase", 0);
    const quarter = updateZombieGait(state, "z-smooth", "walker", "Chase", state.gait.transitionEndsAt * 0.25);
    const nextFrame = updateZombieGait(state, "z-smooth", "walker", "Chase", state.gait.transitionEndsAt * 0.25 + 16);
    expect(Math.abs(quarter - start)).toBeLessThan(Math.abs(state.gait.targetMultiplier - start));
    expect(Math.abs(nextFrame - quarter)).toBeLessThan(0.03);
    expect(state.gait.gaitSequence).toBe(1);
  });

  it("desynchronizes stable IDs and keeps all state ranges centered around one", () => {
    expect(createZombieOrganicBehaviorState("z-a").gait.nextTargetAt).not.toBe(createZombieOrganicBehaviorState("z-b").gait.nextTargetAt);
    for (const ranges of Object.values(ZOMBIE_GAIT_RANGES)) for (const [minimum, maximum] of Object.values(ranges)) {
      expect(minimum).toBeLessThan(1); expect(maximum).toBeGreaterThan(1);
    }
  });

  it("uses acceleration and deceleration rather than speed snaps", () => {
    const motion = createActorMotionSmoothingState(); motion.desiredSpeed = 100;
    updateActorMotionSmoothing(motion, WALKER_MOTION_PROFILE, 0.1); expect(motion.currentSpeed).toBe(32);
    motion.desiredSpeed = 0; updateActorMotionSmoothing(motion, WALKER_MOTION_PROFILE, 0.05);
    expect(motion.currentSpeed).toBe(10); expect(motion.currentSpeed).toBeGreaterThan(0);
    motion.desiredSpeed = 0; updateActorMotionSmoothing(motion, WALKER_MOTION_PROFILE, 1); expect(motion.currentSpeed).toBe(0);
  });
});
