import type { Point } from "./zombie-ai-system";

export interface SegmentGeometry {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  thickness: number;
}

export interface SegmentAabb {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function closestPointOnSegment(point: Point, segment: SegmentGeometry, out: Point = { x: 0, y: 0 }): Point {
  const deltaX = segment.endX - segment.startX;
  const deltaY = segment.endY - segment.startY;
  const lengthSquared = deltaX * deltaX + deltaY * deltaY;
  const amount = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1,
    ((point.x - segment.startX) * deltaX + (point.y - segment.startY) * deltaY) / lengthSquared,
  ));
  out.x = segment.startX + deltaX * amount;
  out.y = segment.startY + deltaY * amount;
  return out;
}

export function visibilityProbeTowardPoint(
  origin: Point,
  segment: SegmentGeometry,
  offset: number,
  out: Point = { x: 0, y: 0 },
): Point {
  closestPointOnSegment(origin, segment, out);
  const deltaX = origin.x - out.x;
  const deltaY = origin.y - out.y;
  const length = Math.hypot(deltaX, deltaY);
  if (length > 0.001) {
    out.x += deltaX / length * offset;
    out.y += deltaY / length * offset;
  }
  return out;
}

export function pointSegmentDistanceSquared(point: Point, segment: SegmentGeometry): number {
  return pointCoordinatesSegmentDistanceSquared(point.x, point.y, segment);
}

function pointCoordinatesSegmentDistanceSquared(x: number, y: number, segment: SegmentGeometry): number {
  const deltaX = segment.endX - segment.startX;
  const deltaY = segment.endY - segment.startY;
  const lengthSquared = deltaX * deltaX + deltaY * deltaY;
  const amount = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1,
    ((x - segment.startX) * deltaX + (y - segment.startY) * deltaY) / lengthSquared,
  ));
  const nearestX = segment.startX + deltaX * amount;
  const nearestY = segment.startY + deltaY * amount;
  const distanceX = x - nearestX;
  const distanceY = y - nearestY;
  return distanceX * distanceX + distanceY * distanceY;
}

export function circleIntersectsThickSegment(x: number, y: number, radius: number, segment: SegmentGeometry): boolean {
  const combinedRadius = radius + segment.thickness / 2;
  return pointCoordinatesSegmentDistanceSquared(x, y, segment) < combinedRadius * combinedRadius;
}

export function segmentsIntersect(first: SegmentGeometry, second: SegmentGeometry): boolean {
  const firstX = first.endX - first.startX;
  const firstY = first.endY - first.startY;
  const secondX = second.endX - second.startX;
  const secondY = second.endY - second.startY;
  const cross = firstX * secondY - firstY * secondX;
  const startX = second.startX - first.startX;
  const startY = second.startY - first.startY;
  if (Math.abs(cross) < 1e-8) return false;
  const firstAmount = (startX * secondY - startY * secondX) / cross;
  const secondAmount = (startX * firstY - startY * firstX) / cross;
  return firstAmount >= 0 && firstAmount <= 1 && secondAmount >= 0 && secondAmount <= 1;
}

export function segmentIntersectsThickSegment(movement: SegmentGeometry, blocker: SegmentGeometry, radius = 0): boolean {
  if (segmentsIntersect(movement, blocker)) return true;
  const combinedRadius = radius + blocker.thickness / 2;
  const limit = combinedRadius * combinedRadius;
  return pointCoordinatesSegmentDistanceSquared(movement.startX, movement.startY, blocker) < limit
    || pointCoordinatesSegmentDistanceSquared(movement.endX, movement.endY, blocker) < limit
    || pointCoordinatesSegmentDistanceSquared(blocker.startX, blocker.startY, movement) < limit
    || pointCoordinatesSegmentDistanceSquared(blocker.endX, blocker.endY, movement) < limit;
}

export function segmentAabb(segment: SegmentGeometry, padding = 0): SegmentAabb {
  const expansion = segment.thickness / 2 + padding;
  return {
    minX: Math.min(segment.startX, segment.endX) - expansion,
    minY: Math.min(segment.startY, segment.endY) - expansion,
    maxX: Math.max(segment.startX, segment.endX) + expansion,
    maxY: Math.max(segment.startY, segment.endY) + expansion,
  };
}

export function visitSegmentTiles(
  segment: SegmentGeometry,
  tileSize: number,
  widthTiles: number,
  heightTiles: number,
  visitor: (tileX: number, tileY: number) => void,
  padding = 0,
): void {
  const bounds = segmentAabb(segment, padding);
  const minTileX = Math.max(0, Math.floor(bounds.minX / tileSize));
  const minTileY = Math.max(0, Math.floor(bounds.minY / tileSize));
  const maxTileX = Math.min(widthTiles - 1, Math.floor(bounds.maxX / tileSize));
  const maxTileY = Math.min(heightTiles - 1, Math.floor(bounds.maxY / tileSize));
  for (let tileY = minTileY; tileY <= maxTileY; tileY += 1) {
    for (let tileX = minTileX; tileX <= maxTileX; tileX += 1) visitor(tileX, tileY);
  }
}
