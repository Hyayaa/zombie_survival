import { describe, expect, it } from "vitest";
import { AUDIO_CUES } from "../data/audio-definitions";
import { FOOTSTEP_CADENCE_MS, getFootstepEvent } from "../systems/footstep-system";

describe("footstep audio cadence", () => {
  it("emits walk and run only after actual movement", () => {
    expect(getFootstepEvent(false, false, 1_000, 0)).toBeUndefined();
    expect(getFootstepEvent(true, false, 1_000, 0)?.cue).toBe("footstep-walk");
    expect(getFootstepEvent(true, true, 1_000, 0)?.cue).toBe("footstep-run");
    expect(getFootstepEvent(true, true, 1_000, 0, true)).toBeUndefined();
  });

  it("uses faster run cadence and emits once per due step", () => {
    expect(FOOTSTEP_CADENCE_MS.run).toBeLessThan(FOOTSTEP_CADENCE_MS.walk);
    const first = getFootstepEvent(true, true, 1_000, 0)!;
    expect(getFootstepEvent(true, true, 1_100, first.nextAt)).toBeUndefined();
    expect(getFootstepEvent(true, false, first.nextAt, first.nextAt)?.cue).toBe("footstep-walk");
  });

  it("references only valid pooled footstep cues", () => {
    for (const cue of ["footstep-walk", "footstep-run"] as const) {
      expect(AUDIO_CUES[cue].assets.length).toBeGreaterThanOrEqual(2);
      expect(AUDIO_CUES[cue].maxInstances).toBeLessThanOrEqual(2);
    }
  });
});
