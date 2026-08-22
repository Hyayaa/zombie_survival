import { BUILDABLE_DEFINITIONS, type BuildableKind } from "../data/buildable-definitions";
import { getItemDefinition } from "../data/item-definitions";

export type BuildRotation = 0 | 1 | 2 | 3;
export type BuildPlacementSource =
  | { kind: "item"; instanceId: string; itemId: string }
  | { kind: "materials" };

export interface PendingBuildPlacement {
  buildableId: BuildableKind;
  source: BuildPlacementSource;
  rotation: BuildRotation;
  hingeSide?: -1 | 1;
  snappedX: number;
  snappedY: number;
  valid: boolean;
  invalidReason?: string;
  previewRevision: number;
}

export const BUILD_PREVIEW_ALPHA = 0.5;
export const INVALID_BUILD_PREVIEW_ALPHA = 0.4;
export const BUILD_FAILURE_MESSAGE_COOLDOWN_MS = 500;

export function getItemBuildableId(itemId: string): BuildableKind | null {
  const action = getItemDefinition(itemId).useAction;
  return action?.kind === "place-buildable" && BUILDABLE_DEFINITIONS[action.buildableId] ? action.buildableId : null;
}

export function createPendingBuildPlacement(buildableId: BuildableKind, source: BuildPlacementSource): PendingBuildPlacement {
  if (!BUILDABLE_DEFINITIONS[buildableId]) throw new Error(`Unknown buildable: ${buildableId}`);
  return { buildableId, source, rotation: 0, hingeSide: buildableId === "wood-door" ? 1 : undefined, snappedX: Number.NaN, snappedY: Number.NaN, valid: false, invalidReason: "not-positioned", previewRevision: 0 };
}

export function updatePendingBuildPlacement(pending: PendingBuildPlacement, snappedX: number, snappedY: number, validate: () => string | null, force = false): boolean {
  if (!force && pending.snappedX === snappedX && pending.snappedY === snappedY) return false;
  pending.snappedX = snappedX; pending.snappedY = snappedY;
  const failure = validate(); pending.valid = failure === null; pending.invalidReason = failure ?? undefined;
  pending.previewRevision += 1;
  return true;
}

export function rotatePendingBuildPlacement(pending: PendingBuildPlacement): void {
  pending.rotation = ((pending.rotation + 1) % 4) as BuildRotation;
  if (pending.buildableId === "wood-door") pending.hingeSide = pending.hingeSide === 1 ? -1 : 1;
  pending.previewRevision += 1;
  pending.snappedX = Number.NaN; pending.snappedY = Number.NaN;
}

export interface BuildConfirmationTransaction {
  validateSource(): boolean;
  validatePlacement(): boolean;
  consumeSource(): boolean;
  restoreSource(): void;
  create(): void;
  rollbackCreate(): void;
}

export function confirmPendingBuildPlacement(pending: PendingBuildPlacement, transaction: BuildConfirmationTransaction): boolean {
  if (!pending.valid || !transaction.validateSource() || !transaction.validatePlacement()) return false;
  if (!transaction.consumeSource()) return false;
  try {
    transaction.create();
    return true;
  } catch {
    transaction.rollbackCreate();
    transaction.restoreSource();
    return false;
  }
}

export function shouldReportBuildPlacementFailure(now: number, lastReportedAt: number, cooldown = BUILD_FAILURE_MESSAGE_COOLDOWN_MS): boolean {
  return now - lastReportedAt >= cooldown;
}

export const BUILD_PREVIEW_REGISTRATIONS = Object.freeze({ collision: false, worldObjects: false, powerGrid: false, saveSnapshot: false, fogVision: false, storage: false, craftingStation: false });
