import { FOG_CELL_SIZE, FOG_CELLS_PER_TILE, MAP_TILES } from "../config/game-config";
import type { SavedFogExploration } from "../core/save-state";

export const FOG_WIDTH_CELLS = MAP_TILES * FOG_CELLS_PER_TILE;
export const FOG_TOTAL_CELLS = FOG_WIDTH_CELLS * FOG_WIDTH_CELLS;
export const LEGACY_FOG_WIDTH_CELLS = FOG_WIDTH_CELLS / 2;
const LEGACY_FOG_TOTAL_CELLS = LEGACY_FOG_WIDTH_CELLS * LEGACY_FOG_WIDTH_CELLS;

export function emptyFogExploration(): SavedFogExploration {
  return { cellSize: FOG_CELL_SIZE, encoding: "rle-v1", runs: [] };
}

export function encodeExploredFog(explored: Uint8Array, cellSize = FOG_CELL_SIZE): SavedFogExploration {
  const runs: number[] = [];
  let index = 0;
  while (index < explored.length) {
    if (explored[index] === 0) {
      index += 1;
      continue;
    }
    const start = index;
    do index += 1;
    while (index < explored.length && explored[index] !== 0);
    runs.push(start, index - start);
  }
  return { cellSize, encoding: "rle-v1", runs };
}

export function decodeExploredFog(value: SavedFogExploration, target: Uint8Array): boolean {
  if (!isValidExploredFog(value, target.length)) return false;
  target.fill(0);
  for (let index = 0; index < value.runs.length; index += 2) {
    const start = value.runs[index] as number;
    const length = value.runs[index + 1] as number;
    target.fill(1, start, start + length);
  }
  return true;
}

export function isValidExploredFog(value: unknown, totalCells = FOG_TOTAL_CELLS): value is SavedFogExploration {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<SavedFogExploration>;
  if (candidate.cellSize !== FOG_CELL_SIZE || candidate.encoding !== "rle-v1" || !Array.isArray(candidate.runs) || candidate.runs.length % 2 !== 0) return false;
  let previousEnd = -1;
  for (let index = 0; index < candidate.runs.length; index += 2) {
    const start = candidate.runs[index];
    const length = candidate.runs[index + 1];
    if (!Number.isInteger(start) || !Number.isInteger(length) || (start as number) < 0 || (length as number) <= 0) return false;
    const end = (start as number) + (length as number);
    if ((start as number) <= previousEnd || end > totalCells) return false;
    previousEnd = end - 1;
  }
  return true;
}

export function migrateLegacyExploredFog(value: unknown): SavedFogExploration | null {
  if (!Array.isArray(value)) return null;
  const explored = new Uint8Array(FOG_TOTAL_CELLS);
  for (const legacyIndex of value) {
    if (!Number.isInteger(legacyIndex) || legacyIndex < 0 || legacyIndex >= LEGACY_FOG_TOTAL_CELLS) return null;
    const oldX = legacyIndex % LEGACY_FOG_WIDTH_CELLS;
    const oldY = Math.floor(legacyIndex / LEGACY_FOG_WIDTH_CELLS);
    const newX = oldX * 2;
    const newY = oldY * 2;
    const topLeft = newY * FOG_WIDTH_CELLS + newX;
    explored[topLeft] = 1;
    explored[topLeft + 1] = 1;
    explored[topLeft + FOG_WIDTH_CELLS] = 1;
    explored[topLeft + FOG_WIDTH_CELLS + 1] = 1;
  }
  return encodeExploredFog(explored);
}
