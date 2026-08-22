import type Phaser from "phaser";
import type { PixelCell } from "./melee-trail-geometry";

const ringCache = new Map<number, readonly PixelCell[]>();

export function getPixelRingCells(radius: number): readonly PixelCell[] {
  const integerRadius = Math.max(2, Math.round(radius));
  const cached = ringCache.get(integerRadius);
  if (cached) return cached;
  const cells: PixelCell[] = [];
  const seen = new Set<string>();
  let x = integerRadius;
  let y = 0;
  let error = 1 - integerRadius;
  while (x >= y) {
    addSymmetricCells(cells, seen, x, y);
    y += 1;
    if (error < 0) error += y * 2 + 1;
    else { x -= 1; error += (y - x) * 2 + 1; }
  }
  ringCache.set(integerRadius, cells);
  return cells;
}

export function drawPixelRing(graphics: Phaser.GameObjects.Graphics, centerX: number, centerY: number, radius: number, color: number, alpha: number, thickness = 1): void {
  const x = Math.round(centerX);
  const y = Math.round(centerY);
  graphics.fillStyle(color, alpha);
  for (let layer = 0; layer < Math.max(1, Math.round(thickness)); layer += 1) {
    for (const cell of getPixelRingCells(radius - layer)) graphics.fillRect(x + cell.x, y + cell.y, 1, 1);
  }
}

function addSymmetricCells(cells: PixelCell[], seen: Set<string>, x: number, y: number): void {
  const points = [[x, y], [y, x], [-y, x], [-x, y], [-x, -y], [-y, -x], [y, -x], [x, -y]] as const;
  for (const [pointX, pointY] of points) {
    const key = `${pointX},${pointY}`;
    if (seen.has(key)) continue;
    seen.add(key);
    cells.push({ x: pointX, y: pointY });
  }
}
