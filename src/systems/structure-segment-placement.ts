import { BUILDABLE_DEFINITIONS, type BuildableKind } from "../data/buildable-definitions";
import { TILE_SIZE } from "../config/game-config";
import { segmentsIntersect, type SegmentGeometry } from "./collision-geometry";
import type { Point } from "./zombie-ai-system";

export const STRUCTURE_ANCHOR_SIZE = TILE_SIZE;
export const MAX_WALL_CHAIN_SEGMENTS = 8;
export const BUILD_RANGE = 144;
export type SegmentBuildableKind = Extract<BuildableKind, "wood-wall" | "metal-wall" | "wood-door">;
export interface StructureSegment extends SegmentGeometry { kind: SegmentBuildableKind }
export interface WallAnchor { x: number; y: number }

export function wallAnchorToWorld(anchor: WallAnchor): Point {
  return { x: anchor.x * TILE_SIZE, y: anchor.y * TILE_SIZE };
}

export function createStructureSegmentGeometry(startAnchor: WallAnchor, endAnchor: WallAnchor, kind: SegmentBuildableKind = "wood-wall"): SegmentGeometry {
  const deltaX = endAnchor.x - startAnchor.x;
  const deltaY = endAnchor.y - startAnchor.y;
  if ((deltaX === 0 && deltaY === 0) || Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1) throw new Error("Structure segments require adjacent integer anchors");
  const start = wallAnchorToWorld(startAnchor);
  const end = wallAnchorToWorld(endAnchor);
  return { startX: start.x, startY: start.y, endX: end.x, endY: end.y, thickness: BUILDABLE_DEFINITIONS[kind].segment!.thickness };
}

export function snapStructureAnchor(point: Point): Point {
  return { x: Math.round(point.x / STRUCTURE_ANCHOR_SIZE) * STRUCTURE_ANCHOR_SIZE, y: Math.round(point.y / STRUCTURE_ANCHOR_SIZE) * STRUCTURE_ANCHOR_SIZE };
}

export function createSegmentChain(kind: SegmentBuildableKind, startPoint: Point, endPoint: Point, maximum = MAX_WALL_CHAIN_SEGMENTS): StructureSegment[] {
  const start = snapStructureAnchor(startPoint); const rawEnd = snapStructureAnchor(endPoint);
  const deltaX = rawEnd.x - start.x; const deltaY = rawEnd.y - start.y;
  if (deltaX === 0 && deltaY === 0) return [];
  const direction = quantizeDirection(deltaX, deltaY);
  const projected = Math.max(1, Math.round(Math.max(Math.abs(deltaX), Math.abs(deltaY)) / STRUCTURE_ANCHOR_SIZE));
  const count = Math.min(maximum, projected);
  const thickness = BUILDABLE_DEFINITIONS[kind].segment!.thickness;
  const segments: StructureSegment[] = [];
  for (let index = 0; index < count; index += 1) {
    const startX = start.x + direction.x * STRUCTURE_ANCHOR_SIZE * index;
    const startY = start.y + direction.y * STRUCTURE_ANCHOR_SIZE * index;
    segments.push({ kind, startX, startY, endX: startX + direction.x * STRUCTURE_ANCHOR_SIZE, endY: startY + direction.y * STRUCTURE_ANCHOR_SIZE, thickness });
  }
  return segments;
}

export function createOrientedSegmentChain(kind: SegmentBuildableKind, startPoint: Point, pointer: Point, rotation: number): StructureSegment[] {
  const start=snapStructureAnchor(startPoint),target=snapStructureAnchor(pointer),deltaX=target.x-start.x,deltaY=target.y-start.y;
  const directions=[{x:1,y:0},{x:1,y:1},{x:0,y:1},{x:1,y:-1}] as const,direction=directions[Math.abs(rotation)%4]!;
  const projection=deltaX*direction.x+deltaY*direction.y,sign=projection<0?-1:1;
  const count=Math.min(MAX_WALL_CHAIN_SEGMENTS,Math.max(1,Math.round(Math.max(Math.abs(deltaX),Math.abs(deltaY))/STRUCTURE_ANCHOR_SIZE)));
  return createSegmentChain(kind,start,{x:start.x+direction.x*sign*STRUCTURE_ANCHOR_SIZE*count,y:start.y+direction.y*sign*STRUCTURE_ANCHOR_SIZE*count});
}

export function segmentKey(segment: Pick<SegmentGeometry, "startX" | "startY" | "endX" | "endY">): string {
  const first = `${segment.startX},${segment.startY}`; const second = `${segment.endX},${segment.endY}`;
  return first < second ? `${first}|${second}` : `${second}|${first}`;
}

export function segmentConflicts(candidate: SegmentGeometry, existing: readonly SegmentGeometry[]): "duplicate" | "intersection" | null {
  const key = segmentKey(candidate);
  for (const other of existing) {
    if (segmentKey(other) === key) return "duplicate";
    if (sharesEndpoint(candidate, other)) continue;
    if (segmentsIntersect(candidate, other)) return "intersection";
  }
  return null;
}

export function isWithinBuildRange(player: Point, point: Point, range = BUILD_RANGE): boolean {
  return (player.x - point.x) ** 2 + (player.y - point.y) ** 2 <= range * range;
}

function quantizeDirection(deltaX: number, deltaY: number): { x: -1 | 0 | 1; y: -1 | 0 | 1 } {
  const angle = Math.round(Math.atan2(deltaY, deltaX) / (Math.PI / 4));
  const x = Math.round(Math.cos(angle * Math.PI / 4)) as -1 | 0 | 1;
  const y = Math.round(Math.sin(angle * Math.PI / 4)) as -1 | 0 | 1;
  return { x, y };
}

function sharesEndpoint(first: SegmentGeometry, second: SegmentGeometry): boolean {
  return (first.startX === second.startX && first.startY === second.startY) || (first.startX === second.endX && first.startY === second.endY)
    || (first.endX === second.startX && first.endY === second.startY) || (first.endX === second.endX && first.endY === second.endY);
}
