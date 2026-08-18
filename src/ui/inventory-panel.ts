import { getItemDefinition, type InventoryRotation, type StorageSlot } from "../data/item-definitions";
import type { AudioCue } from "../data/audio-definitions";
import type { RecipeDefinition } from "../data/recipe-definitions";
import type { WeaponId } from "../data/weapon-definitions";
import type { CraftAvailability } from "../systems/crafting-system";
import type { InventoryContainerKind, InventoryContainerView, InventoryItemInstance, InventoryMoveTarget, InventorySlot } from "../systems/inventory-system";
import { bindItemIconFallbacks, createItemIconMarkup } from "./item-icon";

export interface InventoryPanelState {
  containers: ReadonlyArray<InventoryContainerView>; items: ReadonlyArray<InventoryItemInstance>;
  equipment: Readonly<Partial<Record<StorageSlot, string>>>; quickslots: Array<string | null>;
  recipes: readonly RecipeDefinition[]; craftAvailability: Readonly<Record<string, CraftAvailability>>;
  itemCounts: Readonly<Record<string, number>>; unlockedWeapons: WeaponId[]; equippedWeapon: WeaponId;
  weaponNames: Record<WeaponId, string>; developerMode: boolean; inventoryRevision: number;
}

export interface InventoryPanelCallbacks {
  onClose(): void; onCraft(recipeId: string): void; onUseItem(instanceId: string): void;
  onDropItem(instanceId: string): void; onAssignQuickslot(instanceId: string, quickslot: number): void;
  onMoveItem(instanceId: string, target: InventoryMoveTarget): boolean; onRotateItem(instanceId: string): boolean;
  canPlaceItem(instanceId: string, target: InventoryMoveTarget): boolean;
  onEquipItem(instanceId: string): void; onUnequipItem(slot: StorageSlot): void; onEquipWeapon(weaponId: WeaponId): void;
  onAudio(cue: AudioCue): void;
}

interface DragState {
  instanceId: string; startX: number; startY: number; dragging: boolean; rotation: InventoryRotation;
  width: number; height: number; grabX: number; grabY: number; source: HTMLElement; cell: number; currentX: number; currentY: number;
}
export const STORAGE_ROW_ORDER: readonly InventoryContainerKind[] = ["pockets", "shirt", "pants", "belt", "vest", "backpack"];
const CONTAINER_LABELS: Record<InventoryContainerKind, string> = { pockets: "주머니", shirt: "상의", pants: "바지", belt: "벨트", vest: "조끼", backpack: "가방" };

export interface RectLike { left: number; right: number; top: number; width: number; height: number }
export interface DragPlacement { x: number; y: number; cell: number }
export function getItemGridStyle(item: Pick<InventoryItemInstance, "x" | "y" | "width" | "height">): string { return `--item-x:${item.x};--item-y:${item.y};--item-w:${item.width};--item-h:${item.height}`; }
export function getGridCellSize(rect: Pick<RectLike, "width">, columns: number): number { return columns > 0 ? rect.width / columns : 0; }
export function getFootprintPixelSize(width: number, height: number, cellSize: number, cellGap = 0, inset = 4): { width: number; height: number } { return { width: width * cellSize + (width - 1) * cellGap - inset, height: height * cellSize + (height - 1) * cellGap - inset }; }
export function getDragPlacement(clientX: number, clientY: number, rect: Pick<RectLike, "left" | "top" | "width">, columns: number, grabX: number, grabY: number): DragPlacement { const cell = getGridCellSize(rect, columns); return { x: Math.floor((clientX - rect.left) / cell) - grabX, y: Math.floor((clientY - rect.top) / cell) - grabY, cell }; }
export function rotateGrabOffset(grabX: number, grabY: number, width: number, height: number): { grabX: number; grabY: number } { return { grabX: Math.max(0, Math.min(height - 1, height - 1 - grabY)), grabY: Math.max(0, Math.min(width - 1, grabX)) }; }
export function getStorageRows(containers: ReadonlyArray<InventoryContainerView>): ReadonlyArray<{ kind: InventoryContainerKind; container?: InventoryContainerView }> { return STORAGE_ROW_ORDER.map((kind) => ({ kind, container: containers.find((candidate) => candidate.kind === kind) })); }
export function getPopoverPosition(anchor: RectLike, popover: Pick<RectLike, "width" | "height">, viewportWidth: number, viewportHeight: number): { left: number; top: number } { let left = anchor.right + 8; if (left + popover.width > viewportWidth - 8) left = anchor.left - popover.width - 8; return { left: Math.max(8, Math.min(left, viewportWidth - popover.width - 8)), top: Math.max(8, Math.min(anchor.top, viewportHeight - popover.height - 8)) }; }
export function getItemContextActions(itemId: string): ReadonlyArray<"use" | "equip" | "rotate" | "drop" | "quick"> { const definition = getItemDefinition(itemId); const actions: Array<"use" | "equip" | "rotate" | "drop" | "quick"> = definition.storageEquipment ? ["equip"] : ["use"]; if (definition.inventoryFootprint.width !== definition.inventoryFootprint.height) actions.push("rotate"); actions.push("drop"); if (!definition.storageEquipment) actions.push("quick"); return actions; }
export function createInventorySlotIconMarkup(slot: InventorySlot | null): string { if (!slot) return ""; const item = getItemDefinition(slot.itemId); return createItemIconMarkup({ id: item.id, name: item.name, color: item.iconColor, className: "inventory-icon" }); }

export class InventoryPanel {
  readonly root: HTMLDivElement;
  private readonly inventoryView: HTMLDivElement; private readonly craftingView: HTMLDivElement;
  private readonly dragGhost: HTMLDivElement; private readonly placementPreview: HTMLDivElement; private readonly popover: HTMLDivElement;
  private state?: InventoryPanelState; private drag?: DragState; private popoverInstanceId?: string;
  private activeTab: "inventory" | "crafting" = "inventory"; private previewKey = "";

  constructor(parent: HTMLElement, private readonly callbacks: InventoryPanelCallbacks) {
    this.root = document.createElement("div"); this.root.className = "modal-layer"; this.root.hidden = true;
    this.root.innerHTML = `<section class="inventory-panel pixel-panel"><header><h2>생존 가방</h2><nav class="inventory-tabs"><button data-action="tab" data-tab="inventory">인벤토리</button><button data-action="tab" data-tab="crafting">제작</button></nav><button data-action="close">닫기 [Tab]</button></header><div class="inventory-panel__view" data-view="inventory"></div><div class="inventory-panel__view" data-view="crafting" hidden></div></section>`;
    const inventoryView = this.root.querySelector<HTMLDivElement>('[data-view="inventory"]'); const craftingView = this.root.querySelector<HTMLDivElement>('[data-view="crafting"]');
    if (!inventoryView || !craftingView) throw new Error("Inventory panel views missing"); this.inventoryView = inventoryView; this.craftingView = craftingView;
    this.dragGhost = document.createElement("div"); this.dragGhost.className = "inventory-drag-ghost"; this.dragGhost.hidden = true;
    this.placementPreview = document.createElement("div"); this.placementPreview.className = "inventory-placement-preview"; this.placementPreview.hidden = true;
    this.popover = document.createElement("div"); this.popover.className = "item-context-popover pixel-panel"; this.popover.hidden = true;
    this.root.append(this.dragGhost, this.placementPreview, this.popover);
    this.root.addEventListener("click", (event) => this.handleClick(event)); this.root.addEventListener("pointerdown", (event) => this.handlePointerDown(event)); this.root.addEventListener("scroll", () => this.closePopover(), true);
    window.addEventListener("pointermove", this.handlePointerMove); window.addEventListener("pointerup", this.handlePointerUp); document.addEventListener("keydown", this.handleKeyDown); parent.append(this.root);
  }
  show(state: InventoryPanelState): void { this.state = state; this.root.hidden = false; this.render(); this.switchTab(this.activeTab, false); }
  hide(): void { this.closePopover(); this.cancelDrag(); this.root.hidden = true; }
  isOpen(): boolean { return !this.root.hidden; }
  update(state: InventoryPanelState): void { this.state = state; if (this.popoverInstanceId && !state.items.some((item) => item.instanceId === this.popoverInstanceId)) this.closePopover(); if (!this.root.hidden) this.render(); }
  destroy(): void { window.removeEventListener("pointermove", this.handlePointerMove); window.removeEventListener("pointerup", this.handlePointerUp); document.removeEventListener("keydown", this.handleKeyDown); this.root.remove(); }

  private render(): void { if (!this.state) return; this.renderInventory(); this.renderCrafting(); this.switchTab(this.activeTab, false); bindItemIconFallbacks(this.root); }
  private renderInventory(): void {
    if (!this.state) return; const itemsById = new Map(this.state.items.map((item) => [item.instanceId, item]));
    const rows = getStorageRows(this.state.containers).map(({ kind, container }) => {
      const source = container?.sourceItemInstanceId ? itemsById.get(container.sourceItemInstanceId) : undefined;
      const equipment = kind === "pockets" ? `<div class="storage-row__equipment is-built-in"><b>기본 수납</b><small>항상 사용 가능</small></div>` : source ? `<div class="storage-row__equipment">${this.icon(source)}<b>${getItemDefinition(source.itemId).name}</b><button data-action="unequip-item" data-slot="${kind}">해제</button></div>` : `<div class="storage-row__equipment is-empty"><b>${CONTAINER_LABELS[kind]} 미장착</b><small>장비 장착 시 활성화</small></div>`;
      if (!container) return `<section class="storage-row" data-kind="${kind}"><h3>${CONTAINER_LABELS[kind]}</h3><div class="storage-row__body">${equipment}<div class="storage-row__unavailable">수납공간 없음</div></div></section>`;
      const stored = this.state!.items.filter((item) => item.containerId === container.id).map((item) => {
        const definition = getItemDefinition(item.itemId); const quick = this.state!.quickslots.map((id, index) => id === item.itemId ? index + 1 : null).filter(Boolean).join(",");
        return `<button class="grid-inventory__item" data-instance-id="${item.instanceId}" style="${getItemGridStyle(item)}" title="${definition.name}">${this.icon(item, "grid-item-icon")}<span class="grid-inventory__quantity">${item.quantity > 1 ? item.quantity : ""}</span>${quick ? `<em>Q${quick}</em>` : ""}</button>`;
      }).join("");
      return `<section class="storage-row" data-kind="${kind}"><h3>${CONTAINER_LABELS[kind]} <small>${container.width}×${container.height}</small></h3><div class="storage-row__body">${equipment}<div class="grid-inventory__surface" data-container-id="${container.id}" style="--grid-w:${container.width};--grid-h:${container.height}">${stored}</div></div></section>`;
    }).join("");
    const weapons = this.state.unlockedWeapons.map((id) => `<button data-action="equip-weapon" data-weapon="${id}" class="weapon-button ${this.state!.equippedWeapon === id ? "is-active" : ""}">${createItemIconMarkup({ id, name: this.state!.weaponNames[id], color: 0x879395, className: "weapon-icon" })}<span>${this.state!.weaponNames[id]}</span></button>`).join("");
    this.inventoryView.innerHTML = `<div class="inventory-panel__content"><div class="grid-inventory">${rows}</div><aside><h3>무기</h3><div class="weapon-list">${weapons}</div><p class="panel-note">드래그 중 R: 회전 · 클릭: 행동 메뉴</p></aside></div>`;
  }
  private renderCrafting(): void {
    if (!this.state) return; const recipes = this.state.recipes.map((recipe) => {
      const availability = this.state!.craftAvailability[recipe.id] ?? "missing-materials";
      const ingredients = Object.entries(recipe.ingredients).map(([id, required]) => { const definition = getItemDefinition(id); const owned = this.state!.itemCounts[id] ?? 0; return `<span class="craft-ingredient ${owned < required ? "is-missing" : ""}">${createItemIconMarkup({ id, name: definition.name, color: definition.iconColor, className: "craft-icon" })}<b>${definition.name}</b><small>${owned}/${required}</small></span>`; }).join("");
      const result = getItemDefinition(recipe.resultItemId); const footprint = result.inventoryFootprint; const reason = availability === "missing-materials" ? "재료 부족" : availability === "inventory-full" ? "수납 공간 부족" : "제작";
      return `<article class="craft-card ${availability !== "ready" ? "is-disabled" : ""}"><div class="craft-card__ingredients">${ingredients}</div><span class="craft-card__arrow">→</span><div class="craft-card__result">${createItemIconMarkup({ id: result.id, name: result.name, color: result.iconColor, className: "craft-result-icon" })}<b>${recipe.name} ×${recipe.resultQuantity}</b><small>${footprint.width}×${footprint.height}</small></div><button data-action="craft" data-recipe="${recipe.id}" ${availability !== "ready" ? "disabled" : ""}>${reason}</button></article>`;
    }).join(""); this.craftingView.innerHTML = `${this.state.developerMode ? '<p class="developer-mode-note">개발자 모드 · 제작 재료 무시</p>' : ""}<div class="crafting-list">${recipes}</div>`;
  }
  private icon(item: Pick<InventoryItemInstance, "itemId" | "rotation">, className = "equipment-icon"): string { const definition = getItemDefinition(item.itemId); return createItemIconMarkup({ id: definition.id, name: definition.name, color: definition.iconColor, className, rotation: item.rotation }); }

  private handleClick(event: Event): void {
    const target = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-action]"); if (!target) { if (!(event.target as HTMLElement).closest(".item-context-popover,.grid-inventory__item")) this.closePopover(); return; }
    const action = target.dataset.action; if (action === "tab" && target.dataset.tab) { this.switchTab(target.dataset.tab as "inventory" | "crafting", true); return; }
    if (action === "close") { this.callbacks.onAudio("ui-click"); this.callbacks.onClose(); return; }
    if (action === "craft" && target.dataset.recipe) this.callbacks.onCraft(target.dataset.recipe);
    if (action === "equip-weapon" && target.dataset.weapon) { this.callbacks.onAudio("ui-click"); this.callbacks.onEquipWeapon(target.dataset.weapon as WeaponId); }
    if (action === "unequip-item" && target.dataset.slot) this.callbacks.onUnequipItem(target.dataset.slot as StorageSlot);
    const instanceId = target.dataset.instanceId; if (!instanceId) return;
    if (action === "use-item") this.callbacks.onUseItem(instanceId); if (action === "drop-item") this.callbacks.onDropItem(instanceId); if (action === "equip-item") this.callbacks.onEquipItem(instanceId);
    if (action === "rotate-item") { const success = this.callbacks.onRotateItem(instanceId); this.callbacks.onAudio(success ? "item-rotate" : "inventory-invalid"); }
    if (action === "assign-item") { this.callbacks.onAudio("ui-click"); this.callbacks.onAssignQuickslot(instanceId, Number(target.dataset.quickslot)); } this.closePopover();
  }
  private switchTab(tab: "inventory" | "crafting", playSound: boolean): void { const changed = this.activeTab !== tab; this.activeTab = tab; this.inventoryView.hidden = tab !== "inventory"; this.craftingView.hidden = tab !== "crafting"; for (const button of this.root.querySelectorAll<HTMLButtonElement>('[data-action="tab"]')) button.classList.toggle("is-active", button.dataset.tab === tab); if (playSound && changed) this.callbacks.onAudio("ui-tab"); if (changed) { this.closePopover(); this.cancelDrag(); } }
  private handlePointerDown(event: PointerEvent): void {
    if (event.button !== 0) return; const source = (event.target as HTMLElement).closest<HTMLElement>(".grid-inventory__item"); const instanceId = source?.dataset.instanceId; const item = this.state?.items.find((candidate) => candidate.instanceId === instanceId); const surface = source?.closest<HTMLElement>(".grid-inventory__surface"); if (!source || !item || !surface) return;
    this.closePopover(); const surfaceRect = surface.getBoundingClientRect(); const columns = Number(surface.style.getPropertyValue("--grid-w")); const cell = getGridCellSize(surfaceRect, columns); const sourceRect = source.getBoundingClientRect();
    const grabX = Math.max(0, Math.min(item.width - 1, Math.floor((event.clientX - sourceRect.left) / cell))); const grabY = Math.max(0, Math.min(item.height - 1, Math.floor((event.clientY - sourceRect.top) / cell)));
    this.drag = { instanceId: item.instanceId, startX: event.clientX, startY: event.clientY, dragging: false, rotation: item.rotation, width: item.width, height: item.height, grabX, grabY, source, cell, currentX: event.clientX, currentY: event.clientY }; this.renderGhost(item);
  }
  private readonly handlePointerMove = (event: PointerEvent): void => { if (!this.drag) return; this.drag.currentX = event.clientX; this.drag.currentY = event.clientY; if (!this.drag.dragging && Math.hypot(event.clientX - this.drag.startX, event.clientY - this.drag.startY) >= 5) { this.drag.dragging = true; this.drag.source.classList.add("is-dragging"); this.callbacks.onAudio("inventory-pickup"); } if (!this.drag.dragging) return; this.positionGhost(event.clientX, event.clientY); this.updatePlacementPreview(event.clientX, event.clientY); };
  private readonly handlePointerUp = (event: PointerEvent): void => { const drag = this.drag; if (!drag) return; if (!drag.dragging) { this.drag = undefined; this.dragGhost.hidden = true; this.openPopover(drag.source, drag.instanceId); return; } const target = this.getDropTarget(event.clientX, event.clientY); const success = target ? this.callbacks.onMoveItem(drag.instanceId, target) : false; this.callbacks.onAudio(success ? "inventory-drop" : "inventory-invalid"); this.cancelDrag(); };
  private getDropTarget(clientX: number, clientY: number): InventoryMoveTarget | null { if (!this.drag) return null; const surface = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>(".grid-inventory__surface"); if (!surface?.dataset.containerId) return null; const columns = Number(surface.style.getPropertyValue("--grid-w")); const placement = getDragPlacement(clientX, clientY, surface.getBoundingClientRect(), columns, this.drag.grabX, this.drag.grabY); return { containerId: surface.dataset.containerId, x: placement.x, y: placement.y, rotation: this.drag.rotation }; }
  private updatePlacementPreview(clientX: number, clientY: number): void { if (!this.drag || !this.state) return; const surface = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>(".grid-inventory__surface"); const target = this.getDropTarget(clientX, clientY); if (!surface || !target) { this.placementPreview.hidden = true; this.previewKey = ""; return; } const valid = this.callbacks.canPlaceItem(this.drag.instanceId, target); const key = `${target.containerId}:${target.x}:${target.y}:${target.rotation}:${this.state.inventoryRevision}:${valid}`; if (key === this.previewKey) return; this.previewKey = key; surface.append(this.placementPreview); this.placementPreview.hidden = false; this.placementPreview.classList.toggle("is-valid", valid); this.placementPreview.classList.toggle("is-invalid", !valid); this.placementPreview.style.cssText = `--item-x:${target.x};--item-y:${target.y};--item-w:${this.drag.width};--item-h:${this.drag.height}`; }
  private renderGhost(item: InventoryItemInstance): void { if (!this.drag) return; const definition = getItemDefinition(item.itemId); const size = getFootprintPixelSize(this.drag.width, this.drag.height, this.drag.cell); this.dragGhost.innerHTML = `${createItemIconMarkup({ id: definition.id, name: definition.name, color: definition.iconColor, className: "grid-item-icon", rotation: this.drag.rotation })}<span class="grid-inventory__quantity">${item.quantity > 1 ? item.quantity : ""}</span>`; this.dragGhost.style.width = `${size.width}px`; this.dragGhost.style.height = `${size.height}px`; bindItemIconFallbacks(this.dragGhost); }
  private positionGhost(clientX: number, clientY: number): void { if (!this.drag) return; this.dragGhost.hidden = false; this.dragGhost.style.left = `${clientX - this.drag.grabX * this.drag.cell - this.drag.cell / 2}px`; this.dragGhost.style.top = `${clientY - this.drag.grabY * this.drag.cell - this.drag.cell / 2}px`; }
  private rotateDrag(): void { if (!this.drag || !this.drag.dragging) return; const item = this.state?.items.find((candidate) => candidate.instanceId === this.drag!.instanceId); if (!item || item.width === item.height) return; const grab = rotateGrabOffset(this.drag.grabX, this.drag.grabY, this.drag.width, this.drag.height); [this.drag.width, this.drag.height] = [this.drag.height, this.drag.width]; this.drag.rotation = this.drag.rotation === 0 ? 1 : 0; this.drag.grabX = grab.grabX; this.drag.grabY = grab.grabY; this.previewKey = ""; this.renderGhost(item); this.positionGhost(this.drag.currentX, this.drag.currentY); this.updatePlacementPreview(this.drag.currentX, this.drag.currentY); this.callbacks.onAudio("item-rotate"); }
  private openPopover(anchor: HTMLElement, instanceId: string): void { const item = this.state?.items.find((candidate) => candidate.instanceId === instanceId); if (!item) return; const definition = getItemDefinition(item.itemId); const actions = getItemContextActions(item.itemId); this.popoverInstanceId = instanceId; this.popover.innerHTML = `<b>${definition.name}</b><small>${definition.description}</small><div>${actions.includes("use") ? `<button data-action="use-item" data-instance-id="${instanceId}">사용</button>` : ""}${actions.includes("equip") ? `<button data-action="equip-item" data-instance-id="${instanceId}">장착</button>` : ""}${actions.includes("rotate") ? `<button data-action="rotate-item" data-instance-id="${instanceId}">회전 [R]</button>` : ""}<button data-action="drop-item" data-instance-id="${instanceId}">버리기</button>${actions.includes("quick") ? [0, 1, 2, 3, 4].map((quickslot) => `<button data-action="assign-item" data-instance-id="${instanceId}" data-quickslot="${quickslot}">${quickslot + 1}</button>`).join("") : ""}</div>`; this.popover.hidden = false; const position = getPopoverPosition(anchor.getBoundingClientRect(), this.popover.getBoundingClientRect(), window.innerWidth, window.innerHeight); this.popover.style.left = `${position.left}px`; this.popover.style.top = `${position.top}px`; }
  private closePopover(): void { this.popover.hidden = true; this.popoverInstanceId = undefined; }
  private cancelDrag(): void { this.drag?.source.classList.remove("is-dragging"); this.drag = undefined; this.dragGhost.hidden = true; this.placementPreview.hidden = true; this.previewKey = ""; }
  private readonly handleKeyDown = (event: KeyboardEvent): void => { if (this.root.hidden) return; if (event.key.toLowerCase() === "r" && this.drag?.dragging) { event.preventDefault(); this.rotateDrag(); return; } if (event.key === "Escape") { event.preventDefault(); this.callbacks.onClose(); } };
}
