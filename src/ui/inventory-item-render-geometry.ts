import type { InventoryFootprint, InventoryRotation } from "../data/item-definitions";

export interface InventoryItemRenderGeometry {
  effectiveWidthCells: number; effectiveHeightCells: number;
  frameWidthPx: number; frameHeightPx: number;
  imageWidthPx: number; imageHeightPx: number;
  rotatedImageWidthPx: number; rotatedImageHeightPx: number;
  rotationDegrees: 0 | 90;
  innerPaddingPx: number;
  cellSizePx: number; cellGapPx: number;
}

export interface InventoryGridMetrics { cellSize: number; cellGap: number; innerPadding: number }
export const INVENTORY_GRID_METRICS: Readonly<InventoryGridMetrics> = Object.freeze({ cellSize: 40, cellGap: 0, innerPadding: 4 });

export function getGridSpanPixels(cells: number, cellSize: number, cellGap: number): number {
  return cells * cellSize + Math.max(0, cells - 1) * cellGap;
}

export function getInventoryItemRenderGeometry(
  footprint: InventoryFootprint, rotation: InventoryRotation, cellSize: number, cellGap = 0, innerPadding = 3,
): InventoryItemRenderGeometry {
  const effectiveWidthCells = rotation === 0 ? footprint.width : footprint.height;
  const effectiveHeightCells = rotation === 0 ? footprint.height : footprint.width;
  const frameWidthPx = getGridSpanPixels(effectiveWidthCells, cellSize, cellGap);
  const frameHeightPx = getGridSpanPixels(effectiveHeightCells, cellSize, cellGap);
  const sourceWidth = Math.max(1, footprint.width * 64); const sourceHeight = Math.max(1, footprint.height * 64);
  const availableWidth = Math.max(1, frameWidthPx - innerPadding * 2 - 1); const availableHeight = Math.max(1, frameHeightPx - innerPadding * 2 - 1);
  const rotatedNaturalWidth = rotation === 0 ? sourceWidth : sourceHeight; const rotatedNaturalHeight = rotation === 0 ? sourceHeight : sourceWidth;
  const scale = Math.max(0.0001, Math.min(availableWidth / rotatedNaturalWidth, availableHeight / rotatedNaturalHeight));
  const imageWidthPx = Math.max(1, Math.floor(sourceWidth * scale)); const imageHeightPx = Math.max(1, Math.floor(sourceHeight * scale));
  return {
    effectiveWidthCells, effectiveHeightCells, frameWidthPx, frameHeightPx, imageWidthPx, imageHeightPx,
    rotatedImageWidthPx: rotation === 0 ? imageWidthPx : imageHeightPx,
    rotatedImageHeightPx: rotation === 0 ? imageHeightPx : imageWidthPx,
    rotationDegrees: rotation === 0 ? 0 : 90, innerPaddingPx: innerPadding, cellSizePx: cellSize, cellGapPx: cellGap,
  };
}

export function getInventoryRenderStyle(geometry: InventoryItemRenderGeometry): string {
  return `--render-frame-w:${geometry.frameWidthPx}px;--render-frame-h:${geometry.frameHeightPx}px;--render-image-w:${geometry.imageWidthPx}px;--render-image-h:${geometry.imageHeightPx}px;--item-inner-padding:${geometry.innerPaddingPx}px;--inventory-cell-size:${geometry.cellSizePx}px;--inventory-cell-gap:${geometry.cellGapPx}px;--item-grid-columns:${geometry.effectiveWidthCells};--item-grid-rows:${geometry.effectiveHeightCells};--icon-rotation:${geometry.rotationDegrees}deg`;
}
