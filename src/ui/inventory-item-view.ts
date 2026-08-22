import { getItemIconPath, getItemIconSourceDimensions } from "../data/item-icons";
import { getInventoryObjectDefinition } from "../data/inventory-object-definitions";
import type { InventoryRotation } from "../data/item-definitions";
import { getInventoryItemRenderGeometry, getInventoryRenderStyle, INVENTORY_GRID_METRICS, type InventoryGridMetrics, type InventoryItemRenderGeometry } from "./inventory-item-render-geometry";

export type InventoryItemSurface = "inventory-grid" | "equipment-slot" | "weapon-slot" | "drag-ghost" | "readonly-grid" | "build-catalog";
export interface CatalogItemViewArt { src:string; name:string; widthCells:number; heightCells:number }
export interface InventoryItemViewOptions {
  instanceId: string; itemId: string; quantity: number; rotation: InventoryRotation;
  surface: InventoryItemSurface; metrics?: InventoryGridMetrics; quickLabel?: string; className?: string; catalogArt?:CatalogItemViewArt;
}

export function getInventoryItemViewGeometry(options: Pick<InventoryItemViewOptions, "itemId" | "rotation" | "metrics"|"catalogArt">): InventoryItemRenderGeometry {
  const metrics = options.metrics ?? INVENTORY_GRID_METRICS;
  const footprint=options.catalogArt?{width:options.catalogArt.widthCells,height:options.catalogArt.heightCells}:getInventoryObjectDefinition(options.itemId).inventoryFootprint;
  return getInventoryItemRenderGeometry(footprint, options.rotation, metrics.cellSize, metrics.cellGap, metrics.innerPadding);
}

export function createInventoryItemView(options: InventoryItemViewOptions): string {
  const definition=options.catalogArt?undefined:getInventoryObjectDefinition(options.itemId),geometry=getInventoryItemViewGeometry(options);
  const dimensions=options.catalogArt?{width:options.catalogArt.widthCells*64,height:options.catalogArt.heightCells*64}:getItemIconSourceDimensions(options.itemId),color=(definition?.iconColor??0x56615d).toString(16).padStart(6,"0"),src=options.catalogArt?.src??getItemIconPath(options.itemId),name=options.catalogArt?.name??definition!.name;
  return `<span class="inventory-item-frame inventory-item-frame--${options.surface} ${options.className ?? ""}" data-instance-id="${escapeAttribute(options.instanceId)}" data-item-id="${escapeAttribute(options.itemId)}" data-surface="${options.surface}" data-rotation="${options.rotation}" style="--swatch:#${color};${getInventoryRenderStyle(geometry)}"><span class="inventory-item-visual-stage"><span class="inventory-item-centerer"><img class="inventory-item-image" data-rotation="${options.rotation}" src="${src}" alt="${escapeAttribute(name)}" width="${dimensions.width}" height="${dimensions.height}"><span class="inventory-item-fallback" hidden></span></span></span>${options.quantity > 1 ? `<span class="inventory-item-badge">${options.quantity}</span>` : ""}${options.quickLabel ? `<em class="inventory-item-quick">${escapeAttribute(options.quickLabel)}</em>` : ""}</span>`;
}

export function updateInventoryItemView(view: HTMLElement, options: InventoryItemViewOptions): void {
  const geometry = getInventoryItemViewGeometry(options); view.dataset.instanceId = options.instanceId; view.dataset.itemId = options.itemId; view.dataset.surface = options.surface; view.dataset.rotation = String(options.rotation); view.style.cssText = `--swatch:#${getInventoryObjectDefinition(options.itemId).iconColor.toString(16).padStart(6, "0")};${getInventoryRenderStyle(geometry)}`;
  const image = view.querySelector<HTMLImageElement>(".inventory-item-image"); if (image) image.dataset.rotation = String(options.rotation);
}

function escapeAttribute(value: string): string { return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;"); }
