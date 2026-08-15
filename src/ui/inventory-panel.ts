import { getItemDefinition } from "../data/item-definitions";
import type { RecipeDefinition } from "../data/recipe-definitions";
import type { WeaponId } from "../data/weapon-definitions";
import type { InventorySlot } from "../systems/inventory-system";

export interface InventoryPanelState {
  slots: ReadonlyArray<InventorySlot | null>;
  quickslots: Array<string | null>;
  recipes: readonly RecipeDefinition[];
  unlockedWeapons: WeaponId[];
  equippedWeapon: WeaponId;
  weaponNames: Record<WeaponId, string>;
}

export interface InventoryPanelCallbacks {
  onClose(): void;
  onCraft(recipeId: string): void;
  onUseSlot(index: number): void;
  onDropSlot(index: number): void;
  onAssignQuickslot(index: number, quickslot: number): void;
  onEquipWeapon(weaponId: WeaponId): void;
}

export class InventoryPanel {
  readonly root: HTMLDivElement;
  private readonly content: HTMLDivElement;
  private state?: InventoryPanelState;

  constructor(parent: HTMLElement, private readonly callbacks: InventoryPanelCallbacks) {
    this.root = document.createElement("div");
    this.root.className = "modal-layer";
    this.root.hidden = true;
    this.root.innerHTML = `<section class="inventory-panel pixel-panel"><header><h2>배낭 · 제작</h2><button data-action="close">닫기 [Tab]</button></header><div class="inventory-panel__content"></div></section>`;
    const content = this.root.querySelector<HTMLDivElement>(".inventory-panel__content");
    if (!content) throw new Error("Inventory panel content missing");
    this.content = content;
    this.root.addEventListener("click", (event) => this.handleClick(event));
    parent.append(this.root);
  }

  show(state: InventoryPanelState): void {
    this.state = state;
    this.root.hidden = false;
    this.render();
  }

  hide(): void {
    this.root.hidden = true;
  }

  isOpen(): boolean {
    return !this.root.hidden;
  }

  update(state: InventoryPanelState): void {
    this.state = state;
    if (!this.root.hidden) this.render();
  }

  destroy(): void {
    this.root.remove();
  }

  private render(): void {
    if (!this.state) return;
    const slotHtml = this.state.slots.map((slot, index) => {
      if (!slot) return `<div class="inventory-slot is-empty"><span>${index + 1}</span></div>`;
      const item = getItemDefinition(slot.itemId);
      const quick = this.state?.quickslots.map((id, quickIndex) => id === slot.itemId ? quickIndex + 1 : null).filter(Boolean).join(",") ?? "";
      return `<div class="inventory-slot">
        <span class="item-swatch" style="--swatch:#${item.iconColor.toString(16).padStart(6, "0")}"></span>
        <span><b>${item.name}</b> ×${slot.quantity}<small>${item.description}</small></span>
        ${quick ? `<em>Q${quick}</em>` : ""}
        <div class="slot-actions">
          <button data-action="use" data-index="${index}">사용</button>
          <button data-action="drop" data-index="${index}">버리기</button>
          ${[0, 1, 2, 3, 4].map((quickslot) => `<button data-action="assign" data-index="${index}" data-quickslot="${quickslot}">${quickslot + 1}</button>`).join("")}
        </div>
      </div>`;
    }).join("");
    const recipeHtml = this.state.recipes.map((recipe) => {
      const ingredients = Object.entries(recipe.ingredients).map(([id, quantity]) => `${getItemDefinition(id).name} ${quantity}`).join(" + ");
      return `<button class="recipe" data-action="craft" data-recipe="${recipe.id}"><b>${recipe.name}</b><span>${ingredients}</span><small>소음 ${recipe.noiseIntensity}</small></button>`;
    }).join("");
    const weapons = this.state.unlockedWeapons.map((weaponId) => `<button data-action="equip" data-weapon="${weaponId}" class="weapon-button ${this.state?.equippedWeapon === weaponId ? "is-active" : ""}">${this.state?.weaponNames[weaponId]}</button>`).join("");
    this.content.innerHTML = `
      <div><h3>인벤토리 20칸</h3><div class="inventory-grid">${slotHtml}</div></div>
      <aside><h3>무기</h3><div class="weapon-list">${weapons}</div><h3>제작</h3><div class="recipe-list">${recipeHtml}</div><p class="panel-note">제작 소음은 주변 좀비를 끌어들입니다.</p></aside>
    `;
  }

  private handleClick(event: Event): void {
    const target = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-action]");
    if (!target) return;
    const action = target.dataset.action;
    if (action === "close") this.callbacks.onClose();
    if (action === "craft" && target.dataset.recipe) this.callbacks.onCraft(target.dataset.recipe);
    if (action === "use") this.callbacks.onUseSlot(Number(target.dataset.index));
    if (action === "drop") this.callbacks.onDropSlot(Number(target.dataset.index));
    if (action === "assign") this.callbacks.onAssignQuickslot(Number(target.dataset.index), Number(target.dataset.quickslot));
    if (action === "equip" && target.dataset.weapon) this.callbacks.onEquipWeapon(target.dataset.weapon as WeaponId);
  }
}

