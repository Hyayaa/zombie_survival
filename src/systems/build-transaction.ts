import { BUILDABLE_DEFINITIONS, getBuildCostItems, type BuildableKind } from "../data/buildable-definitions";
import type { BuildPlacementSource } from "./build-placement-flow";
import type { StructureSegment } from "./structure-segment-placement";

export interface BuildInventory { count(itemId: string): number; remove(itemId: string, quantity: number): boolean; add(itemId: string, quantity: number): number }
export interface BuildTransactionOptions { kind: BuildableKind; quantity?: number; inventory: BuildInventory; validate(): boolean; create(): void; rollbackCreate?(): void }

export function performBuildTransaction(options: BuildTransactionOptions): boolean {
  const quantity = Math.max(1, Math.floor(options.quantity ?? 1)); const costs = getBuildCostItems(BUILDABLE_DEFINITIONS[options.kind]).map((cost) => ({ ...cost, quantity: cost.quantity * quantity }));
  if (!options.validate() || costs.some((cost) => options.inventory.count(cost.itemId) < cost.quantity)) return false;
  const removed: typeof costs = [];
  try {
    for (const cost of costs) { if (!options.inventory.remove(cost.itemId, cost.quantity)) throw new Error("cost removal failed"); removed.push(cost); }
    options.create(); return true;
  } catch {
    options.rollbackCreate?.();
    for (const cost of removed) options.inventory.add(cost.itemId, cost.quantity);
    return false;
  }
}

export interface StructureSegmentChainTransactionOptions {
  buildableId: Extract<BuildableKind, "wood-wall" | "metal-wall" | "wood-door">;
  source: BuildPlacementSource;
  segments: readonly Readonly<StructureSegment>[];
  dragSequence: number;
  validateSegment(segment: Readonly<StructureSegment>, index: number, all: readonly Readonly<StructureSegment>[]): boolean;
  validateSource(quantity: number): boolean;
  reserveIds(quantity: number): readonly string[];
  consumeSource(quantity: number): boolean;
  restoreSource(): void;
  createAndRegister(segment: Readonly<StructureSegment>, id: string, index: number): void;
  rollbackCreated(id: string): void;
}

export interface BuildTransactionResult {
  success: boolean;
  dragSequence: number;
  requestedCount: number;
  installedCount: number;
  createdIds: readonly string[];
  reason?: "empty-chain" | "invalid-chain" | "missing-source" | "reservation-failed" | "creation-failed";
}

/** Commits the frozen preview geometry as one all-or-nothing transaction. */
export function commitStructureSegmentChain(options: StructureSegmentChainTransactionOptions): BuildTransactionResult {
  const quantity = options.segments.length;
  const failure = (reason: BuildTransactionResult["reason"]): BuildTransactionResult => ({ success: false, dragSequence: options.dragSequence, requestedCount: quantity, installedCount: 0, createdIds: Object.freeze([]), reason });
  if (quantity === 0) return failure("empty-chain");
  for (let index = 0; index < quantity; index += 1) if (!options.validateSegment(options.segments[index]!, index, options.segments)) return failure("invalid-chain");
  if (!options.validateSource(quantity)) return failure("missing-source");
  let reservedIds: readonly string[];
  try {
    reservedIds = Object.freeze([...options.reserveIds(quantity)]);
    if (reservedIds.length !== quantity || new Set(reservedIds).size !== quantity) return failure("reservation-failed");
  } catch {
    return failure("reservation-failed");
  }
  if (!options.consumeSource(quantity)) return failure("missing-source");
  const createdIds: string[] = [];
  try {
    for (let index = 0; index < quantity; index += 1) {
      const id = reservedIds[index]!;
      options.createAndRegister(options.segments[index]!, id, index);
      createdIds.push(id);
    }
    return { success: true, dragSequence: options.dragSequence, requestedCount: quantity, installedCount: quantity, createdIds: Object.freeze([...createdIds]) };
  } catch {
    for (let index = createdIds.length - 1; index >= 0; index -= 1) options.rollbackCreated(createdIds[index]!);
    options.restoreSource();
    return failure("creation-failed");
  }
}
