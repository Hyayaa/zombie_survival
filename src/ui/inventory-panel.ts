import { getItemDefinition, type StorageSlot } from "../data/item-definitions";
import type { RecipeDefinition } from "../data/recipe-definitions";
import type { WeaponId } from "../data/weapon-definitions";
import type { InventoryContainerView, InventoryItemInstance, InventoryMoveTarget, InventorySlot } from "../systems/inventory-system";
import { bindItemIconFallbacks, createItemIconMarkup } from "./item-icon";

export interface InventoryPanelState {
  containers: ReadonlyArray<InventoryContainerView>;
  items: ReadonlyArray<InventoryItemInstance>;
  equipment: Readonly<Partial<Record<StorageSlot, string>>>;
  quickslots: Array<string | null>;
  recipes: readonly RecipeDefinition[];
  unlockedWeapons: WeaponId[];
  equippedWeapon: WeaponId;
  weaponNames: Record<WeaponId, string>;
  developerMode: boolean;
}

export interface InventoryPanelCallbacks {
  onClose(): void;
  onCraft(recipeId: string): void;
  onUseItem(instanceId: string): void;
  onDropItem(instanceId: string): void;
  onAssignQuickslot(instanceId: string, quickslot: number): void;
  onMoveItem(instanceId: string, target: InventoryMoveTarget): void;
  onEquipItem(instanceId: string): void;
  onUnequipItem(slot: StorageSlot): void;
  onEquipWeapon(weaponId: WeaponId): void;
}

interface DragState { instanceId: string; startX: number; startY: number; dragging: boolean }
const CONTAINER_LABELS: Record<string, string> = { pockets: "주머니", shirt: "상의", pants: "바지", belt: "벨트", vest: "조끼", backpack: "가방" };

export interface RectLike { left: number; right: number; top: number; width: number; height: number }
export function getItemGridStyle(item: InventoryItemInstance): string {
  return `--item-x:${item.x};--item-y:${item.y};--item-w:${item.width};--item-h:${item.height}`;
}
export function getPopoverPosition(anchor: RectLike, popover: Pick<RectLike, "width" | "height">, viewportWidth: number, viewportHeight: number): { left: number; top: number } {
  let left = anchor.right + 8;
  if (left + popover.width > viewportWidth - 8) left = anchor.left - popover.width - 8;
  return { left: Math.max(8, Math.min(left, viewportWidth - popover.width - 8)), top: Math.max(8, Math.min(anchor.top, viewportHeight - popover.height - 8)) };
}
export function getItemContextActions(itemId: string): ReadonlyArray<"use" | "equip" | "drop" | "quick"> {
  const definition = getItemDefinition(itemId);
  return definition.storageEquipment ? ["equip", "drop"] : ["use", "drop", "quick"];
}

export function createInventorySlotIconMarkup(slot: InventorySlot | null): string {
  if (!slot) return "";
  const item = getItemDefinition(slot.itemId);
  return createItemIconMarkup({ id: item.id, name: item.name, color: item.iconColor, className: "inventory-icon" });
}

export class InventoryPanel {
  readonly root: HTMLDivElement;
  private readonly content: HTMLDivElement;
  private readonly dragGhost: HTMLDivElement;
  private readonly popover: HTMLDivElement;
  private state?: InventoryPanelState;
  private drag?: DragState;
  private popoverInstanceId?: string;

  constructor(parent: HTMLElement, private readonly callbacks: InventoryPanelCallbacks) {
    this.root = document.createElement("div");
    this.root.className = "modal-layer";
    this.root.hidden = true;
    this.root.innerHTML = `<section class="inventory-panel pixel-panel"><header><h2>인벤토리 · 제작</h2><button data-action="close">닫기 [Tab]</button></header><div class="inventory-panel__content"></div></section>`;
    const content = this.root.querySelector<HTMLDivElement>(".inventory-panel__content");
    if (!content) throw new Error("Inventory panel content missing");
    this.content = content;
    this.dragGhost = document.createElement("div");
    this.dragGhost.className = "inventory-drag-ghost";
    this.dragGhost.hidden = true;
    this.popover = document.createElement("div");
    this.popover.className = "item-context-popover pixel-panel";
    this.popover.hidden = true;
    this.root.append(this.dragGhost, this.popover);
    this.root.addEventListener("click", (event) => this.handleClick(event));
    this.root.addEventListener("pointerdown", (event) => this.handlePointerDown(event));
    this.root.addEventListener("scroll", () => this.closePopover(), true);
    window.addEventListener("pointermove", this.handlePointerMove);
    window.addEventListener("pointerup", this.handlePointerUp);
    document.addEventListener("keydown", this.handleKeyDown);
    parent.append(this.root);
  }

  show(state: InventoryPanelState): void { this.state = state; this.root.hidden = false; this.render(); }
  hide(): void { this.closePopover(); this.cancelDrag(); this.root.hidden = true; }
  isOpen(): boolean { return !this.root.hidden; }
  update(state: InventoryPanelState): void {
    this.state = state;
    if (this.popoverInstanceId && !state.items.some((item) => item.instanceId === this.popoverInstanceId)) this.closePopover();
    if (!this.root.hidden) this.render();
  }
  destroy(): void {
    window.removeEventListener("pointermove", this.handlePointerMove);
    window.removeEventListener("pointerup", this.handlePointerUp);
    document.removeEventListener("keydown", this.handleKeyDown);
    this.root.remove();
  }

  private render(): void {
    if (!this.state) return;
    const itemsById = new Map(this.state.items.map((item) => [item.instanceId, item]));
    const containers = this.state.containers.map((container) => {
      const source = container.sourceItemInstanceId ? itemsById.get(container.sourceItemInstanceId) : undefined;
      const stored = this.state!.items.filter((item) => item.containerId === container.id);
      const itemHtml = stored.map((item) => {
        const definition = getItemDefinition(item.itemId);
        const quick = this.state!.quickslots.map((id, index) => id === item.itemId ? index + 1 : null).filter(Boolean).join(",");
        return `<button class="grid-inventory__item" data-instance-id="${item.instanceId}" style="${getItemGridStyle(item)}" title="${definition.name}">
          ${createItemIconMarkup({ id: definition.id, name: definition.name, color: definition.iconColor, className: "grid-item-icon" })}
          <span class="grid-inventory__quantity">${item.quantity > 1 ? item.quantity : ""}</span>${quick ? `<em>Q${quick}</em>` : ""}
        </button>`;
      }).join("");
      const equipped = source ? `<span class="grid-inventory__equipped">${createItemIconMarkup({ id: source.itemId, name: getItemDefinition(source.itemId).name, color: getItemDefinition(source.itemId).iconColor, className: "equipment-icon" })}<b>${getItemDefinition(source.itemId).name}</b><button data-action="unequip-item" data-slot="${container.kind}">해제</button></span>` : "";
      return `<section class="grid-inventory__container" data-kind="${container.kind}"><h3>${CONTAINER_LABELS[container.kind]} <small>${container.width}×${container.height}</small>${equipped}</h3>
        <div class="grid-inventory__surface" data-container-id="${container.id}" style="--grid-w:${container.width};--grid-h:${container.height}">${itemHtml}</div></section>`;
    }).join("");
    const recipeHtml = this.state.recipes.map((recipe) => {
      const ingredients = Object.entries(recipe.ingredients).map(([id, quantity]) => `${getItemDefinition(id).name} ${quantity}`).join(" + ");
      return `<button class="recipe" data-action="craft" data-recipe="${recipe.id}"><b>${recipe.name}</b><span>${ingredients}</span><small>소음 ${recipe.noiseIntensity}</small></button>`;
    }).join("");
    const weapons = this.state.unlockedWeapons.map((weaponId) => `<button data-action="equip-weapon" data-weapon="${weaponId}" class="weapon-button ${this.state!.equippedWeapon === weaponId ? "is-active" : ""}">${createItemIconMarkup({ id: weaponId, name: this.state!.weaponNames[weaponId], color: 0x879395, className: "weapon-icon" })}<span>${this.state!.weaponNames[weaponId]}</span></button>`).join("");
    this.content.innerHTML = `<div class="grid-inventory">${containers}</div><aside><h3>무기</h3><div class="weapon-list">${weapons}</div><h3>제작</h3>${this.state.developerMode ? '<p class="developer-mode-note">개발자 모드 · 제작 재료 무시</p>' : ""}<div class="recipe-list">${recipeHtml}</div><p class="panel-note">아이템을 누르면 행동 메뉴가 열립니다.</p></aside>`;
    bindItemIconFallbacks(this.content);
  }

  private handleClick(event: Event): void {
    const target = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-action]");
    if (!target) { if (!(event.target as HTMLElement).closest(".item-context-popover,.grid-inventory__item")) this.closePopover(); return; }
    const action = target.dataset.action;
    if (action === "close") this.callbacks.onClose();
    if (action === "craft" && target.dataset.recipe) this.callbacks.onCraft(target.dataset.recipe);
    if (action === "equip-weapon" && target.dataset.weapon) this.callbacks.onEquipWeapon(target.dataset.weapon as WeaponId);
    if (action === "unequip-item" && target.dataset.slot) this.callbacks.onUnequipItem(target.dataset.slot as StorageSlot);
    const instanceId = target.dataset.instanceId;
    if (!instanceId) return;
    if (action === "use-item") this.callbacks.onUseItem(instanceId);
    if (action === "drop-item") this.callbacks.onDropItem(instanceId);
    if (action === "equip-item") this.callbacks.onEquipItem(instanceId);
    if (action === "assign-item") this.callbacks.onAssignQuickslot(instanceId, Number(target.dataset.quickslot));
    this.closePopover();
  }

  private handlePointerDown(event: PointerEvent): void {
    if (event.button !== 0) return;
    const item = (event.target as HTMLElement).closest<HTMLElement>(".grid-inventory__item");
    const instanceId = item?.dataset.instanceId;
    if (!item || !instanceId) return;
    this.closePopover();
    this.drag = { instanceId, startX: event.clientX, startY: event.clientY, dragging: false };
    this.dragGhost.innerHTML = item.innerHTML;
  }

  private readonly handlePointerMove = (event: PointerEvent): void => {
    if (!this.drag) return;
    if (!this.drag.dragging && Math.hypot(event.clientX - this.drag.startX, event.clientY - this.drag.startY) >= 5) this.drag.dragging = true;
    if (!this.drag.dragging) return;
    this.dragGhost.hidden = false;
    this.dragGhost.style.left = `${event.clientX + 10}px`;
    this.dragGhost.style.top = `${event.clientY + 10}px`;
  };

  private readonly handlePointerUp = (event: PointerEvent): void => {
    const drag = this.drag;
    if (!drag) return;
    this.drag = undefined;
    this.dragGhost.hidden = true;
    if (!drag.dragging) {
      const item = this.content.querySelector<HTMLElement>(`[data-instance-id="${drag.instanceId}"]`);
      if (item) this.openPopover(item, drag.instanceId);
      return;
    }
    const surface = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>(".grid-inventory__surface");
    if (!surface?.dataset.containerId) return;
    const rect = surface.getBoundingClientRect();
    const cell = rect.width / Number(surface.style.getPropertyValue("--grid-w"));
    this.callbacks.onMoveItem(drag.instanceId, { containerId: surface.dataset.containerId, x: Math.floor((event.clientX - rect.left) / cell), y: Math.floor((event.clientY - rect.top) / cell) });
  };

  private openPopover(anchor: HTMLElement, instanceId: string): void {
    const item = this.state?.items.find((candidate) => candidate.instanceId === instanceId);
    if (!item) return;
    const definition = getItemDefinition(item.itemId);
    const actions = getItemContextActions(item.itemId);
    this.popoverInstanceId = instanceId;
    this.popover.innerHTML = `<b>${definition.name}</b><small>${definition.description}</small><div>
      ${actions.includes("use") ? `<button data-action="use-item" data-instance-id="${instanceId}">사용</button>` : ""}
      ${actions.includes("equip") ? `<button data-action="equip-item" data-instance-id="${instanceId}">장착</button>` : ""}
      <button data-action="drop-item" data-instance-id="${instanceId}">버리기</button>
      ${actions.includes("quick") ? [0, 1, 2, 3, 4].map((quickslot) => `<button data-action="assign-item" data-instance-id="${instanceId}" data-quickslot="${quickslot}">${quickslot + 1}</button>`).join("") : ""}
    </div>`;
    this.popover.hidden = false;
    const anchorRect = anchor.getBoundingClientRect();
    const popoverRect = this.popover.getBoundingClientRect();
    const position = getPopoverPosition(anchorRect, popoverRect, window.innerWidth, window.innerHeight);
    this.popover.style.left = `${position.left}px`;
    this.popover.style.top = `${position.top}px`;
  }

  private closePopover(): void { this.popover.hidden = true; this.popoverInstanceId = undefined; }
  private cancelDrag(): void { this.drag = undefined; this.dragGhost.hidden = true; }
  private readonly handleKeyDown = (event: KeyboardEvent): void => { if (event.key === "Escape") this.closePopover(); };
}
