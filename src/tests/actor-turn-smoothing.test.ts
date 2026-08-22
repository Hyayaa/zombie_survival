import { describe, expect, it } from "vitest";
import { angleDifference, approachAngle, createActorMotionSmoothingState, updateActorMotionSmoothing, WALKER_MOTION_PROFILE } from "../systems/actor-motion-smoothing";

describe("actor turn smoothing", () => {
  it("approaches without snapping or exceeding the configured angular speed", () => {
    const state = createActorMotionSmoothingState(0);
    state.desiredMoveAngle = Math.PI / 2; state.desiredHeadAngle = Math.PI / 2; state.desiredSpeed = 100;
    updateActorMotionSmoothing(state, WALKER_MOTION_PROFILE, 0.1);
    expect(state.currentMoveAngle).toBeCloseTo(WALKER_MOTION_PROFILE.moveTurnRate * 0.1);
    expect(state.currentMoveAngle).toBeLessThan(Math.PI / 2);
    expect(state.currentSpeed).toBeCloseTo(WALKER_MOTION_PROFILE.acceleration * 0.1);
  });

  it("uses the shortest direction across the pi boundary", () => {
    const current = 179 * Math.PI / 180; const target = -179 * Math.PI / 180;
    expect(angleDifference(target, current)).toBeCloseTo(2 * Math.PI / 180);
    expect(Math.abs(approachAngle(current, target, Math.PI / 180))).toBeCloseTo(Math.PI);
  });

  it("turns the head faster than the body while limiting head lead", () => {
    const state = createActorMotionSmoothingState(0); state.desiredHeadAngle = Math.PI / 2;
    updateActorMotionSmoothing(state, WALKER_MOTION_PROFILE, 0.1);
    expect(Math.abs(state.headAngle)).toBeGreaterThan(Math.abs(state.bodyAngle));
    expect(Math.abs(angleDifference(state.headAngle, state.bodyAngle))).toBeLessThanOrEqual(WALKER_MOTION_PROFILE.maximumHeadLead);
  });

  it("does not overshoot with a large delta and remains finite", () => {
    expect(approachAngle(0, 0.2, 10)).toBeCloseTo(0.2);
    const state = createActorMotionSmoothingState(Number.NaN); state.desiredMoveAngle = Number.NaN; state.desiredHeadAngle = Number.NaN;
    updateActorMotionSmoothing(state, WALKER_MOTION_PROFILE, 1);
    expect(Object.values(state).every(Number.isFinite)).toBe(true);
  });

  it("supports a stuck turn-rate boost and is nearly frame-rate independent", () => {
    const normal = createActorMotionSmoothingState(); const boosted = createActorMotionSmoothingState();
    normal.desiredMoveAngle = boosted.desiredMoveAngle = Math.PI;
    updateActorMotionSmoothing(normal, WALKER_MOTION_PROFILE, 0.05);
    updateActorMotionSmoothing(boosted, WALKER_MOTION_PROFILE, 0.05, 1.75);
    expect(Math.abs(boosted.currentMoveAngle)).toBeGreaterThan(Math.abs(normal.currentMoveAngle));
    const sixty = createActorMotionSmoothingState(); const thirty = createActorMotionSmoothingState();
    sixty.desiredMoveAngle = thirty.desiredMoveAngle = 1; sixty.desiredSpeed = thirty.desiredSpeed = 90;
    for (let index = 0; index < 60; index += 1) updateActorMotionSmoothing(sixty, WALKER_MOTION_PROFILE, 1 / 60);
    for (let index = 0; index < 30; index += 1) updateActorMotionSmoothing(thirty, WALKER_MOTION_PROFILE, 1 / 30);
    expect(sixty.currentMoveAngle).toBeCloseTo(thirty.currentMoveAngle, 5);
    expect(sixty.currentSpeed).toBeCloseTo(thirty.currentSpeed, 5);
  });
});
