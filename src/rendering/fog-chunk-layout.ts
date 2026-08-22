export interface FogChunkLayout {
  chunkCells: number;
  columns: number;
  rows: number;
  maximumTextureDimension: number;
}

export function getFogChunkLayout(widthCells: number, heightCells: number, cellSize: number, chunkTiles: number, tileSize: number): FogChunkLayout {
  const chunkCells = Math.max(1, Math.round(chunkTiles * tileSize / cellSize));
  return {
    chunkCells,
    columns: Math.ceil(widthCells / chunkCells),
    rows: Math.ceil(heightCells / chunkCells),
    maximumTextureDimension: chunkCells,
  };
}

export function fogChunkIndexForCell(cellX: number, cellY: number, layout: Pick<FogChunkLayout, "chunkCells" | "columns">): number {
  return Math.floor(cellY / layout.chunkCells) * layout.columns + Math.floor(cellX / layout.chunkCells);
}
