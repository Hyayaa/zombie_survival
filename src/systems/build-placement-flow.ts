import { BUILDABLE_DEFINITIONS, type BuildableKind } from "../data/buildable-definitions";
import { getItemDefinition } from "../data/item-definitions";

export type BuildRotation = 0 | 1 | 2 | 3;
export type BuildPlacementSource =
  | { kind: "item"; instanceId: string; itemId: string }
  | { kind: "materials" }
  | { kind: "developer" };
export type BuildPlacementMode = "grid" | "free";

export interface PendingBuildPlacement {
  buildableId: BuildableKind;
  source: BuildPlacementSource;
  rotation: BuildRotation;
  placementMode: BuildPlacementMode;
  x: number;
  y: number;
  angle: number;
  hingeSide?: -1 | 1;
  snappedX: number;
  snappedY: number;
  valid: boolean;
  invalidReason?: string;
  previewRevision: number;
  validatedStructureRevision:number;
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
  const furniture=BUILDABLE_DEFINITIONS[buildableId].placementClass==="furniture";
  return { buildableId, source, rotation: 0, placementMode:furniture?"free":"grid",x:Number.NaN,y:Number.NaN,angle:0,hingeSide: buildableId === "wood-door" ? 1 : undefined, snappedX: Number.NaN, snappedY: Number.NaN, valid: false, invalidReason: "not-positioned", previewRevision: 0,validatedStructureRevision:-1 };
}

export function getFurniturePlacement(pointer:{x:number;y:number},player:{x:number;y:number},mode:BuildPlacementMode,lastAngle=0,tileSize=24):{x:number;y:number;angle:number}{
  const x=mode==="grid"?(Math.floor(pointer.x/tileSize)+.5)*tileSize:Math.round(pointer.x),y=mode==="grid"?(Math.floor(pointer.y/tileSize)+.5)*tileSize:Math.round(pointer.y),dx=player.x-x,dy=player.y-y;
  const raw=dx*dx+dy*dy>1e-6?Math.atan2(dy,dx):lastAngle,angle=mode==="grid"?Math.round(raw/(Math.PI/2))*Math.PI/2:raw;return{x,y,angle:Object.is(angle,-0)?0:angle};
}

export function toggleFurniturePlacementMode(pending:PendingBuildPlacement):boolean{if(BUILDABLE_DEFINITIONS[pending.buildableId].placementClass!=="furniture")return false;pending.placementMode=pending.placementMode==="free"?"grid":"free";pending.snappedX=Number.NaN;pending.snappedY=Number.NaN;pending.previewRevision+=1;return true;}

export function furniturePreviewCacheKey(pending:Pick<PendingBuildPlacement,"buildableId"|"placementMode"|"x"|"y"|"angle">,structureRevision:number):string{return`${pending.buildableId}:${pending.placementMode}:${Math.round(pending.x)}:${Math.round(pending.y)}:${Math.round(pending.angle*180/Math.PI)}:${structureRevision}`;}

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
