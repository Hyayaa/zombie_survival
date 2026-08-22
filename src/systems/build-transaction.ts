import { BUILDABLE_DEFINITIONS, getBuildCostItems, type BuildableKind } from "../data/buildable-definitions";

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
