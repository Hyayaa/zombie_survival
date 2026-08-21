import { getInventoryObjectDefinition } from "../data/inventory-object-definitions";

export interface ReadonlyGridItem {
  key: string;
  itemId: string;
  quantity: number;
}

export interface ReadonlyGridPlacement extends ReadonlyGridItem {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ReadonlyGridLayout {
  columns: number;
  rows: number;
  placements: ReadonlyGridPlacement[];
}

export function packReadonlyGrid(items: readonly ReadonlyGridItem[], columns = 8): ReadonlyGridLayout {
  if (!Number.isInteger(columns) || columns < 1) throw new Error("Grid columns must be a positive integer");
  const placements: ReadonlyGridPlacement[] = [];
  const occupied: boolean[][] = [];
  for (const item of items) {
    const footprint = getInventoryObjectDefinition(item.itemId).inventoryFootprint;
    if (footprint.width > columns) throw new Error(`Readonly grid is too narrow for ${item.itemId}`);
    let placed = false;
    for (let y = 0; !placed; y += 1) {
      while (occupied.length < y + footprint.height) occupied.push(Array(columns).fill(false));
      for (let x = 0; x <= columns - footprint.width; x += 1) {
        if (!areaIsFree(occupied, x, y, footprint.width, footprint.height)) continue;
        markArea(occupied, x, y, footprint.width, footprint.height);
        placements.push({ ...item, x, y, width: footprint.width, height: footprint.height });
        placed = true;
        break;
      }
    }
  }
  return { columns, rows: Math.max(1, occupied.length), placements };
}

export function createItemGridRowMarkup(options: { className?: string; attributes?: string; header: string; left: string; right: string }): string {
  return `<section class="item-grid-row ${options.className ?? ""}" ${options.attributes ?? ""}><header class="item-grid-row__header">${options.header}</header><div class="item-grid-row__body"><div class="item-grid-row__left">${options.left}</div><div class="item-grid-row__right">${options.right}</div></div></section>`;
}

function areaIsFree(grid: readonly boolean[][], x: number, y: number, width: number, height: number): boolean {
  for (let row = y; row < y + height; row += 1) for (let column = x; column < x + width; column += 1) if (grid[row]?.[column]) return false;
  return true;
}

function markArea(grid: boolean[][], x: number, y: number, width: number, height: number): void {
  for (let row = y; row < y + height; row += 1) for (let column = x; column < x + width; column += 1) grid[row]![column] = true;
}
