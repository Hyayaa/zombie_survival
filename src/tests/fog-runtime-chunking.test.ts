import { describe, expect, it } from "vitest";
import { FOG_CELL_SIZE, TILE_SIZE } from "../config/game-config";
import { fogChunkIndexForCell, getFogChunkLayout } from "../rendering/fog-chunk-layout";
import { FogInvalidationTracker } from "../systems/fog-of-war-system";

describe("runtime fog chunking", () => {
  it("keeps each upload far below a full multi-city fog texture", () => {
    const worldPixels = 282 * TILE_SIZE;
    const fogCells = Math.ceil(worldPixels / FOG_CELL_SIZE);
    const layout = getFogChunkLayout(fogCells, fogCells, FOG_CELL_SIZE, 16, TILE_SIZE);
    expect(layout.maximumTextureDimension).toBe(128);
    expect(layout.maximumTextureDimension).toBeLessThan(fogCells);
    expect(layout.columns * layout.rows).toBeGreaterThan(1);
  });

  it("maps changed cells to stable dirty chunks", () => {
    const layout = getFogChunkLayout(2_256, 2_256, 3, 16, 24);
    expect(fogChunkIndexForCell(0, 0, layout)).toBe(0);
    expect(fogChunkIndexForCell(127, 127, layout)).toBe(0);
    expect(fogChunkIndexForCell(128, 0, layout)).toBe(1);
  });

  it("does not invalidate ambient vision for aim-only changes while the flashlight is off", () => {
    const tracker = new FogInvalidationTracker();
    const state = { playerCell: 10, flashlightAimBucket: 0, visionRevision: 2, ambientRadiusBucket: 30, flashlightActive: false, flashlightRadiusBucket: -1, torchActive: false, companionVisionSignature: 0 };
    tracker.commit(state);
    expect(tracker.shouldRecompute({ ...state, flashlightAimBucket: 7 })).toBe(false);
  });
});
