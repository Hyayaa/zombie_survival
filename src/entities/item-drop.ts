import Phaser from "phaser";
import { DEPTH, ENTITY_OUTLINE } from "../config/game-config";
import { getInventoryObjectDefinition } from "../data/inventory-object-definitions";
import { EntityOutlineController, type EntityOutlineState, type OutlineableEntityView } from "../rendering/entity-outline";

export class ItemDrop implements OutlineableEntityView {
  readonly view: Phaser.GameObjects.Container;
  private readonly icon: Phaser.GameObjects.Rectangle;
  private readonly outline: EntityOutlineController;

  constructor(scene: Phaser.Scene, readonly id: string, readonly itemId: string, public quantity: number, public x: number, public y: number) {
    const definition = getInventoryObjectDefinition(itemId);
    const shadow = scene.add.rectangle(0, 3, 8, 3, 0x050606, 0.55);
    this.icon = scene.add.rectangle(0, 0, 6, 6, definition.iconColor).setStrokeStyle(1, ENTITY_OUTLINE.normal);
    this.outline = new EntityOutlineController((color) => this.icon.setStrokeStyle(1, color, 1));
    this.view = scene.add.container(Math.round(x), Math.round(y), [shadow, this.icon]).setDepth(DEPTH.item + Math.round(y));
  }

  setOutlineState(state: EntityOutlineState): void {
    this.outline.setState(state);
  }

  setVisible(visible: boolean): void {
    this.view.setVisible(visible);
  }

  destroy(): void {
    this.view.destroy(true);
  }
}
