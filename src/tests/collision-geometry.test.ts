import { describe, expect, it } from "vitest";
import type { DoorDefinition } from "../data/map-definitions";
import {
  circleIntersectsThickSegment,
  closestPointOnSegment,
  pointSegmentDistanceSquared,
  segmentAabb,
  segmentIntersectsThickSegment,
  segmentsIntersect,
  type SegmentGeometry,
} from "../systems/collision-geometry";
import { CollisionSystem } from "../systems/collision-system";

const diagonalDown: SegmentGeometry = { startX: 24, startY: 24, endX: 48, endY: 48, thickness: 5 };
const diagonalUp: SegmentGeometry = { startX: 24, startY: 48, endX: 48, endY: 24, thickness: 5 };

function door(segment: SegmentGeometry, orientation: DoorDefinition["orientation"]): DoorDefinition {
  return { kind: "door", id: `door-${orientation}`, tileX: 1, tileY: 1, orientation, segment, open: false, health: 48, maxHealth: 48, destroyed: false };
}

describe("segment collision geometry", () => {
  it("computes a clamped closest point and squared distance", () => {
    expect(closestPointOnSegment({ x: 40, y: 24 }, diagonalDown)).toEqual({ x: 32, y: 32 });
    expect(pointSegmentDistanceSquared({ x: 40, y: 24 }, diagonalDown)).toBe(128);
  });

  it("tests circles, crossings and broad-phase bounds without tile assumptions", () => {
    expect(circleIntersectsThickSegment(36, 36, 5, diagonalDown)).toBe(true);
    expect(circleIntersectsThickSegment(27, 45, 5, diagonalDown)).toBe(false);
    expect(segmentsIntersect(diagonalDown, diagonalUp)).toBe(true);
    expect(segmentIntersectsThickSegment({ startX: 20, startY: 36, endX: 52, endY: 36, thickness: 0 }, diagonalDown, 0)).toBe(true);
    expect(segmentAabb(diagonalDown, 2)).toEqual({ minX: 19.5, minY: 19.5, maxX: 52.5, maxY: 52.5 });
  });
});

describe("indexed diagonal colliders", () => {
  it.each([
    ["diagonal-down", diagonalDown],
    ["diagonal-up", diagonalUp],
  ] as const)("blocks the %s door line but leaves its empty tile corner open", (orientation, segment) => {
    const definition = door(segment, orientation);
    const collision = new CollisionSystem([], [definition], 4, 4, 24);
    expect(collision.isMovementBlockedWorld(36, 36, 5)).toBe(true);
    expect(collision.isMovementBlockedWorld(27, orientation === "diagonal-down" ? 45 : 27, 5)).toBe(false);
    expect(collision.hasLineOfSight({ x: 20, y: 36 }, { x: 52, y: 36 })).toBe(false);
    expect(collision.firstProjectileCollision({ x: 20, y: 36 }, { x: 52, y: 36 })).not.toBeNull();
    const revision = collision.visionRevision;
    collision.setDoorOpen(definition.id, true);
    expect(collision.isMovementBlockedWorld(36, 36, 5)).toBe(false);
    expect(collision.hasLineOfSight({ x: 20, y: 36 }, { x: 52, y: 36 })).toBe(true);
    expect(collision.firstProjectileCollision({ x: 20, y: 36 }, { x: 52, y: 36 })).toBeNull();
    expect(collision.visionRevision).toBeGreaterThan(revision);
    const openRevision = collision.visionRevision;
    collision.setDoorOpen(definition.id, true);
    expect(collision.visionRevision).toBe(openRevision);
  });

  it("keeps a diagonal wall precise for movement, sight, projectiles and path edges", () => {
    const collision = new CollisionSystem([], [], 4, 4, 24, [diagonalDown]);
    expect(collision.isMovementBlockedWorld(36, 36, 5)).toBe(true);
    expect(collision.isMovementBlockedWorld(27, 45, 5)).toBe(false);
    expect(collision.hasLineOfSight({ x: 20, y: 36 }, { x: 52, y: 36 })).toBe(false);
    expect(collision.firstProjectileCollision({ x: 20, y: 36 }, { x: 52, y: 36 })).not.toBeNull();
    expect(collision.canTraverseTileEdge(0, 1, 1, 1, 5)).toBe(false);
    expect(collision.moveCircle({ x: 20, y: 36 }, 32, 0, 5).x).toBe(20);
  });

  it("removes a destroyed door segment from every blocking mode", () => {
    const definition = door(diagonalDown, "diagonal-down");
    const collision = new CollisionSystem([], [definition], 4, 4, 24);
    collision.setDoorDestroyed(definition.id);
    expect(collision.isMovementBlockedWorld(36, 36, 5)).toBe(false);
    expect(collision.hasLineOfSight({ x: 20, y: 36 }, { x: 52, y: 36 })).toBe(true);
    expect(collision.firstProjectileCollision({ x: 20, y: 36 }, { x: 52, y: 36 })).toBeNull();
  });
});
