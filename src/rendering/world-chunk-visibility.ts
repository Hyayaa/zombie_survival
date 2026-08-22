export interface WorldViewRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WorldChunkGrid {
  worldWidthTiles: number;
  worldHeightTiles: number;
  chunkTiles: number;
  tileSize: number;
  marginChunks: number;
}

/** Reuses the provided output buffer and returns its identity. */
export function collectVisibleChunkIndices(
  view: WorldViewRect,
  grid: WorldChunkGrid,
  output: number[],
): number[] {
  output.length = 0;
  const chunkSize = grid.chunkTiles * grid.tileSize;
  const columns = Math.ceil(grid.worldWidthTiles / grid.chunkTiles);
  const rows = Math.ceil(grid.worldHeightTiles / grid.chunkTiles);
  const minX = clamp(Math.floor(view.x / chunkSize) - grid.marginChunks, 0, columns - 1);
  const minY = clamp(Math.floor(view.y / chunkSize) - grid.marginChunks, 0, rows - 1);
  const maxX = clamp(Math.floor((view.x + Math.max(0, view.width - 1)) / chunkSize) + grid.marginChunks, 0, columns - 1);
  const maxY = clamp(Math.floor((view.y + Math.max(0, view.height - 1)) / chunkSize) + grid.marginChunks, 0, rows - 1);
  for (let y = minY; y <= maxY; y += 1) {
    const row = y * columns;
    for (let x = minX; x <= maxX; x += 1) output.push(row + x);
  }
  return output;
}

export function getCameraChunkKey(view: WorldViewRect, chunkTiles: number, tileSize: number): number {
  const chunkSize = chunkTiles * tileSize;
  const minX = Math.floor(view.x / chunkSize);
  const minY = Math.floor(view.y / chunkSize);
  const maxX = Math.floor((view.x + Math.max(0, view.width - 1)) / chunkSize);
  const maxY = Math.floor((view.y + Math.max(0, view.height - 1)) / chunkSize);
  return (((minY * 64 + minX) * 64 + maxY) * 64 + maxX);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
