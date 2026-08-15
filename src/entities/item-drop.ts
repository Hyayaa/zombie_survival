import Phaser from "phaser";
import { DEPTH } from "../config/game-config";
import { getItemDefinition } from "../data/item-definitions";

export class ItemDrop {
  readonly view: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene, readonly id: string, readonly itemId: string, public quantity: number, public x: number, public y: number) {
    const definition = getItemDefinition(itemId);
    const shadow = scene.add.rectangle(0, 3, 8, 3, 0x050606, 0.55);
    const icon = scene.add.rectangle(0, 0, 6, 6, definition.iconColor).setStrokeStyle(1, 0x151818);
    this.view = scene.add.container(Math.round(x), Math.round(y), [shadow, icon]).setDepth(DEPTH.item + Math.round(y));
  }

  setVisible(visible: boolean): void {
    this.view.setVisible(visible);
  }

  destroy(): void {
    this.view.destroy(true);
  }
}

