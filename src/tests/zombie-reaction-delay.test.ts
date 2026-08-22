import { describe, expect, it } from "vitest";
import type { HeardNoise, NoiseCategory } from "../systems/noise-system";
import { beginNoiseReaction, beginVisualReaction, consumeReadyZombieReaction, createZombieOrganicBehaviorState, ZOMBIE_NOISE_REACTION_RANGE_MS, ZOMBIE_VISUAL_REACTION_RANGE_MS } from "../systems/zombie-organic-behavior";

function heard(category: NoiseCategory, perceivedIntensity = 70, distance = 20): HeardNoise {
  return { x: 40, y: 0, category, perceivedIntensity, distance, intensity: 90, radius: 200, createdAt: 100 };
}

describe("zombie reaction delay", () => {
  it("delays first visual acquisition within kind-specific ranges", () => {
    const walkerState = createZombieOrganicBehaviorState("walker-1"); const runnerState = createZombieOrganicBehaviorState("runner-1");
    const walker = beginVisualReaction(walkerState, "actor-1", "walker", 1_000, "player", 80, 0, 80, 17);
    const runner = beginVisualReaction(runnerState, "actor-1", "runner", 1_000, "player", 80, 0, 80, 17);
    expect(walker.readyAt - 1_000).toBeGreaterThanOrEqual(ZOMBIE_VISUAL_REACTION_RANGE_MS.walker.minimum);
    expect(walker.readyAt - 1_000).toBeLessThanOrEqual(ZOMBIE_VISUAL_REACTION_RANGE_MS.walker.maximum);
    expect(runner.readyAt).toBeLessThan(walker.readyAt);
    expect(consumeReadyZombieReaction(walkerState, walker.readyAt - 1)).toBeUndefined();
    expect(consumeReadyZombieReaction(walkerState, walker.readyAt)?.kind).toBe("visual");
  });

  it("caps close-threat visual delay and does not redraw it per update", () => {
    const state = createZombieOrganicBehaviorState("walker-close");
    const first = beginVisualReaction(state, "walker-close", "walker", 0, "player", 10, 0, 10, 17);
    const repeated = beginVisualReaction(state, "walker-close", "walker", 20, "player", 10, 0, 10, 17);
    expect(first.readyAt).toBeLessThanOrEqual(90); expect(repeated).toBe(first);
  });

  it("makes footsteps slower than gunshots and strong nearby sound more urgent", () => {
    const gunState = createZombieOrganicBehaviorState("z-1"); const walkState = createZombieOrganicBehaviorState("z-1");
    const gun = beginNoiseReaction(gunState, "z-1", 0, heard("gunshot"))!;
    const walk = beginNoiseReaction(walkState, "z-1", 0, heard("walk"))!;
    expect(gun.readyAt).toBeGreaterThanOrEqual(ZOMBIE_NOISE_REACTION_RANGE_MS.gunshot.minimum);
    expect(gun.readyAt).toBeLessThan(walk.readyAt);
    const near = beginNoiseReaction(createZombieOrganicBehaviorState("z-2"), "same", 0, heard("gunshot", 85, 5))!;
    const far = beginNoiseReaction(createZombieOrganicBehaviorState("z-3"), "same", 0, heard("gunshot", 10, 170))!;
    expect(near.readyAt).toBeLessThan(far.readyAt);
  });

  it("does not let repeated sound postpone readiness and lets vision override noise", () => {
    const state = createZombieOrganicBehaviorState("z-repeat");
    const first = beginNoiseReaction(state, "z-repeat", 0, heard("gunshot"));
    const repeat = beginNoiseReaction(state, "z-repeat", 50, heard("gunshot"));
    expect(repeat?.readyAt).toBe(first?.readyAt);
    consumeReadyZombieReaction(state, first!.readyAt);
    expect(beginNoiseReaction(state, "z-repeat", first!.readyAt + 1, heard("gunshot"))).toBeUndefined();
    const visual = beginVisualReaction(state, "z-repeat", "walker", first!.readyAt + 2, "player", 20, 0, 20, 17);
    expect(visual.kind).toBe("visual"); expect(state.reaction?.kind).toBe("visual");
  });

  it("is deterministic for the same entity and event sequence", () => {
    const first = beginVisualReaction(createZombieOrganicBehaviorState("same"), "same", "walker", 500, "player", 100, 0, 100, 17);
    const second = beginVisualReaction(createZombieOrganicBehaviorState("same"), "same", "walker", 500, "player", 100, 0, 100, 17);
    expect(second).toEqual(first);
  });
});
