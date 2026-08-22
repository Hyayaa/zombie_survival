import { describe, expect, it } from "vitest";
import { collectVisibleChunkIndices, getCameraChunkKey } from "../rendering/world-chunk-visibility";

const grid = { worldWidthTiles: 282, worldHeightTiles: 282, chunkTiles: 16, tileSize: 24, marginChunks: 1 };

describe("static world chunk culling", () => {
  it("limits draw candidates to the viewport plus one chunk margin", () => {
    const output: number[] = [];
    expect(collectVisibleChunkIndices({ x: 3_000, y: 3_000, width: 480, height: 270 }, grid, output)).toBe(output);
    expect(output).toHaveLength(20);
    expect(output.length).toBeLessThan(Math.ceil(282 / 16) ** 2);
  });

  it("reuses the scratch buffer and keeps geometry stable inside one visibility range", () => {
    const scratch = [999];
    const first = collectVisibleChunkIndices({ x: 3_000, y: 3_000, width: 480, height: 270 }, grid, scratch);
    const firstKey = getCameraChunkKey({ x: 3_000, y: 3_000, width: 480, height: 270 }, 16, 24);
    const secondKey = getCameraChunkKey({ x: 3_001, y: 3_001, width: 480, height: 270 }, 16, 24);
    expect(collectVisibleChunkIndices({ x: 3_001, y: 3_001, width: 480, height: 270 }, grid, scratch)).toBe(first);
    expect(secondKey).toBe(firstKey);
  });

  it("changes the activation key when the viewport crosses a chunk boundary", () => {
    expect(getCameraChunkKey({ x: 3_000, y: 3_000, width: 480, height: 270 }, 16, 24))
      .not.toBe(getCameraChunkKey({ x: 3_400, y: 3_000, width: 480, height: 270 }, 16, 24));
  });
});
