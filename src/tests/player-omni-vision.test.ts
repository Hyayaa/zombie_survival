import { describe, expect, it } from "vitest";
import { BALANCE, FOG_CELL_SIZE, VISION } from "../config/game-config";
import { GameClock } from "../core/game-clock";
import { FogInvalidationTracker, FogOfWarSystem, VisibilityState, type FogInvalidationInput, type VisionGrid } from "../systems/fog-of-war-system";
import { buildVisionSources, getVisionProfile } from "../systems/lighting-system";

const openGrid: VisionGrid = { blocksVision: () => false, additionalCost: () => 0 };
const player = { x: 450, y: 450, aimAngle: 0, flashlightOn: false, torchRemaining: 0 };

describe("player omnidirectional vision", () => {
  it("emits one aim-independent ambient circle and keeps the flashlight cone unchanged", () => {
    const clock = new GameClock();
    const daySources = buildVisionSources(player, clock, []);
    const ambient = daySources.find((source) => source.id === "player:ambient");
    expect(ambient).toMatchObject({ sourceType: "player", radius: 360 });
    expect(ambient?.direction).toBeUndefined();
    expect(ambient?.coneAngle).toBeUndefined();
    expect(daySources.some((source) => source.id?.includes("cone"))).toBe(false);

    clock.restore({ elapsedSeconds: BALANCE.daySeconds + BALANCE.duskSeconds });
    const nightSources = buildVisionSources({ ...player, aimAngle: Math.PI / 3, flashlightOn: true }, clock, []);
    expect(nightSources.find((source) => source.id === "player:ambient")).toMatchObject({ radius: 60 });
    expect(nightSources.find((source) => source.sourceType === "flashlight")).toMatchObject({
      radius: VISION.flashlightRadius, coneAngle: VISION.flashlightConeAngle, direction: Math.PI / 3,
    });
  });

  it("reveals equally ahead and behind and does not change when aim changes", () => {
    const clock = new GameClock();
    const first = new FogOfWarSystem(900, 900, FOG_CELL_SIZE, 201);
    const second = new FogOfWarSystem(900, 900, FOG_CELL_SIZE, 201);
    first.recompute(buildVisionSources(player, clock, []), openGrid);
    second.recompute(buildVisionSources({ ...player, aimAngle: Math.PI }, clock, []), openGrid);
    for (const x of [180, 720]) {
      expect(first.getStateAtWorld(x, 450)).toBe(VisibilityState.Visible);
      expect(second.getStateAtWorld(x, 450)).toBe(first.getStateAtWorld(x, 450));
    }
  });

  it("smoothly interpolates between the bounded day and night radii", () => {
    const clock = new GameClock();
    expect(getVisionProfile(clock).ambientRadius).toBe(VISION.playerDayOmniRadius);
    clock.restore({ elapsedSeconds: BALANCE.daySeconds + BALANCE.duskSeconds / 2 });
    const dusk = getVisionProfile(clock).ambientRadius;
    expect(dusk).toBeGreaterThan(VISION.playerNightOmniRadius);
    expect(dusk).toBeLessThan(VISION.playerDayOmniRadius);
    clock.restore({ elapsedSeconds: BALANCE.daySeconds + BALANCE.duskSeconds });
    expect(getVisionProfile(clock).ambientRadius).toBe(VISION.playerNightOmniRadius);
  });

  it("ignores mouse rotation while the flashlight is off", () => {
    const tracker = new FogInvalidationTracker();
    const input: FogInvalidationInput = {
      playerCell: 1, flashlightAimBucket: -1, visionRevision: 0, ambientRadiusBucket: 120,
      flashlightActive: false, flashlightRadiusBucket: -1, torchActive: false, companionVisionSignature: 0,
    };
    tracker.commit(input);
    expect(tracker.shouldRecompute({ ...input, flashlightAimBucket: -1 })).toBe(false);
    expect(tracker.shouldRecompute({ ...input, flashlightActive: true, flashlightAimBucket: 8, flashlightRadiusBucket: 100 })).toBe(true);
  });
});
