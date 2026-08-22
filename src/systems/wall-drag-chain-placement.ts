import type { BuildableKind } from "../data/buildable-definitions";
import type { Point } from "./zombie-ai-system";
import type { StructureSegment } from "./structure-segment-placement";

export type WallBuildableKind = Extract<BuildableKind, "wood-wall" | "metal-wall">;
export type WallDirection = 0 | 1 | 2 | 3;

export interface WallDragState {
  active: boolean;
  buildableId?: WallBuildableKind;
  startAnchor?: Point;
  currentEndAnchor?: Point;
  direction: WallDirection;
  previewSegments: readonly StructureSegment[];
  valid: boolean;
  invalidReason?: string;
  dragSequence: number;
  committed: boolean;
}

export interface WallDragSnapshot {
  readonly buildableId: WallBuildableKind;
  readonly startAnchor: Readonly<Point>;
  readonly currentEndAnchor: Readonly<Point>;
  readonly direction: WallDirection;
  readonly segments: readonly Readonly<StructureSegment>[];
  readonly valid: boolean;
  readonly invalidReason?: string;
  readonly dragSequence: number;
}

export function createWallDragState(): WallDragState {
  return { active: false, direction: 0, previewSegments: Object.freeze([]), valid: false, dragSequence: 0, committed: false };
}

export function beginWallDrag(state: WallDragState, buildableId: WallBuildableKind, anchor: Point, direction: WallDirection): number {
  state.active = true;
  state.buildableId = buildableId;
  state.startAnchor = { ...anchor };
  state.currentEndAnchor = { ...anchor };
  state.direction = direction;
  state.previewSegments = Object.freeze([]);
  state.valid = false;
  state.invalidReason = "not-positioned";
  state.dragSequence += 1;
  state.committed = false;
  return state.dragSequence;
}

export function updateWallDragPreview(state: WallDragState, endAnchor: Point, segments: readonly StructureSegment[], invalidReason?: string): boolean {
  if (!state.active || state.committed) return false;
  state.currentEndAnchor = { ...endAnchor };
  state.previewSegments = freezeSegments(segments);
  state.valid = segments.length > 0 && invalidReason === undefined;
  state.invalidReason = state.valid ? undefined : invalidReason ?? "invalid-placement";
  return true;
}

/** Freezes a detached geometry snapshot before any release handler may clear the live drag state. */
export function snapshotWallDrag(state: WallDragState): WallDragSnapshot | null {
  if (!state.active || state.committed || !state.buildableId || !state.startAnchor || !state.currentEndAnchor) return null;
  return Object.freeze({
    buildableId: state.buildableId,
    startAnchor: Object.freeze({ ...state.startAnchor }),
    currentEndAnchor: Object.freeze({ ...state.currentEndAnchor }),
    direction: state.direction,
    segments: freezeSegments(state.previewSegments),
    valid: state.valid,
    invalidReason: state.invalidReason,
    dragSequence: state.dragSequence,
  });
}

export function markWallDragCommitted(state: WallDragState, sequence: number): boolean {
  if (!state.active || state.committed || state.dragSequence !== sequence) return false;
  state.committed = true;
  return true;
}

export function clearWallDrag(state: WallDragState, sequence = state.dragSequence): boolean {
  if (!state.active || state.dragSequence !== sequence) return false;
  state.active = false;
  state.buildableId = undefined;
  state.startAnchor = undefined;
  state.currentEndAnchor = undefined;
  state.previewSegments = Object.freeze([]);
  state.valid = false;
  state.invalidReason = undefined;
  return true;
}

function freezeSegments(segments: readonly StructureSegment[]): readonly Readonly<StructureSegment>[] {
  return Object.freeze(segments.map((segment) => Object.freeze({ ...segment })));
}
