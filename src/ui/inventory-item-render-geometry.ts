import type { InventoryFootprint, InventoryRotation } from "../data/item-definitions";

export interface InventoryItemRenderGeometry {
  effectiveWidthCells: number; effectiveHeightCells: number;
  frameWidthPx: number; frameHeightPx: number;
  imageWidthPx: number; imageHeightPx: number;
  rotatedImageWidthPx: number; rotatedImageHeightPx: number;
  rotationDegrees: 0 | 90;
}

export function getInventoryItemRenderGeometry(
  footprint: InventoryFootprint, rotation: InventoryRotation, cellSize: number, cellGap = 0, innerPadding = 3,
): InventoryItemRenderGeometry {
  const effectiveWidthCells = rotation === 0 ? footprint.width : footprint.height;
  const effectiveHeightCells = rotation === 0 ? footprint.height : footprint.width;
  const frameWidthPx = effectiveWidthCells * cellSize + Math.max(0, effectiveWidthCells - 1) * cellGap;
  const frameHeightPx = effectiveHeightCells * cellSize + Math.max(0, effectiveHeightCells - 1) * cellGap;
  const sourceWidth = Math.max(1, footprint.width * 64); const sourceHeight = Math.max(1, footprint.height * 64);
  const availableWidth = Math.max(1, frameWidthPx - innerPadding * 2); const availableHeight = Math.max(1, frameHeightPx - innerPadding * 2);
  const rotatedNaturalWidth = rotation === 0 ? sourceWidth : sourceHeight; const rotatedNaturalHeight = rotation === 0 ? sourceHeight : sourceWidth;
  const scale = Math.max(0.0001, Math.min(availableWidth / rotatedNaturalWidth, availableHeight / rotatedNaturalHeight));
  const imageWidthPx = sourceWidth * scale; const imageHeightPx = sourceHeight * scale;
  return {
    effectiveWidthCells, effectiveHeightCells, frameWidthPx, frameHeightPx, imageWidthPx, imageHeightPx,
    rotatedImageWidthPx: rotation === 0 ? imageWidthPx : imageHeightPx,
    rotatedImageHeightPx: rotation === 0 ? imageHeightPx : imageWidthPx,
    rotationDegrees: rotation === 0 ? 0 : 90,
  };
}

export function getInventoryRenderStyle(geometry: InventoryItemRenderGeometry): string {
  return `--render-frame-w:${geometry.frameWidthPx}px;--render-frame-h:${geometry.frameHeightPx}px;--render-image-w:${geometry.imageWidthPx}px;--render-image-h:${geometry.imageHeightPx}px;--icon-rotation:${geometry.rotationDegrees}deg`;
}
