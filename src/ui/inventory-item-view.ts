import { getItemIconPath, getItemIconSourceDimensions } from "../data/item-icons";
import { getInventoryObjectDefinition } from "../data/inventory-object-definitions";
import type { InventoryRotation } from "../data/item-definitions";
import { getInventoryItemRenderGeometry, getInventoryRenderStyle, INVENTORY_GRID_METRICS, type InventoryGridMetrics, type InventoryItemRenderGeometry } from "./inventory-item-render-geometry";

export type InventoryItemSurface = "inventory-grid" | "equipment-slot" | "weapon-slot" | "drag-ghost";
export interface InventoryItemViewOptions {
  instanceId: string; itemId: string; quantity: number; rotation: InventoryRotation;
  surface: InventoryItemSurface; metrics?: InventoryGridMetrics; quickLabel?: string; className?: string;
}

export function getInventoryItemViewGeometry(options: Pick<InventoryItemViewOptions, "itemId" | "rotation" | "metrics">): InventoryItemRenderGeometry {
  const metrics = options.metrics ?? INVENTORY_GRID_METRICS;
  return getInventoryItemRenderGeometry(getInventoryObjectDefinition(options.itemId).inventoryFootprint, options.rotation, metrics.cellSize, metrics.cellGap, metrics.innerPadding);
}

export function createInventoryItemView(options: InventoryItemViewOptions): string {
  const definition = getInventoryObjectDefinition(options.itemId); const geometry = getInventoryItemViewGeometry(options);
  const dimensions = getItemIconSourceDimensions(options.itemId); const color = definition.iconColor.toString(16).padStart(6, "0");
  return `<span class="inventory-item-frame inventory-item-frame--${options.surface} ${options.className ?? ""}" data-instance-id="${escapeAttribute(options.instanceId)}" data-item-id="${escapeAttribute(options.itemId)}" data-surface="${options.surface}" data-rotation="${options.rotation}" style="--swatch:#${color};${getInventoryRenderStyle(geometry)}"><span class="inventory-item-visual-stage"><span class="inventory-item-centerer"><img class="inventory-item-image" data-rotation="${options.rotation}" src="${getItemIconPath(options.itemId)}" alt="${escapeAttribute(definition.name)}" width="${dimensions.width}" height="${dimensions.height}"><span class="inventory-item-fallback" hidden></span></span></span>${options.quantity > 1 ? `<span class="inventory-item-badge">${options.quantity}</span>` : ""}${options.quickLabel ? `<em class="inventory-item-quick">${escapeAttribute(options.quickLabel)}</em>` : ""}</span>`;
}

export function updateInventoryItemView(view: HTMLElement, options: InventoryItemViewOptions): void {
  const geometry = getInventoryItemViewGeometry(options); view.dataset.instanceId = options.instanceId; view.dataset.itemId = options.itemId; view.dataset.surface = options.surface; view.dataset.rotation = String(options.rotation); view.style.cssText = `--swatch:#${getInventoryObjectDefinition(options.itemId).iconColor.toString(16).padStart(6, "0")};${getInventoryRenderStyle(geometry)}`;
  const image = view.querySelector<HTMLImageElement>(".inventory-item-image"); if (image) image.dataset.rotation = String(options.rotation);
}

function escapeAttribute(value: string): string { return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;"); }
