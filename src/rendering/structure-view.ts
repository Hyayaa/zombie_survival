import Phaser from "phaser";
import { DEPTH, ENTITY_OUTLINE, TILE_SIZE } from "../config/game-config";
import type { PlacedStructureState } from "../entities/placed-structure";
import { EntityOutlineController, type EntityOutlineState, type WorldEntityView } from "./entity-outline";

export class StructureView implements WorldEntityView {
  readonly container: Phaser.GameObjects.Container;
  private readonly body: Phaser.GameObjects.Graphics;
  private readonly barrel?: Phaser.GameObjects.Rectangle;
  private readonly status: Phaser.GameObjects.Rectangle;
  private readonly outline: EntityOutlineController;
  private powered = false;

  constructor(scene: Phaser.Scene, readonly state: PlacedStructureState) {
    const x = (state.tileX + 0.5) * TILE_SIZE; const y = (state.tileY + 0.5) * TILE_SIZE;
    this.container = scene.add.container(x, y).setDepth(DEPTH.propFront + y);
    this.body = scene.add.graphics();
    this.status = scene.add.rectangle(7, -7, 2, 2, 0x4c5a57);
    this.container.add([this.body, this.status]);
    if (state.kind === "turret") {
      this.barrel = scene.add.rectangle(2, 0, 14, 3, 0x7b8582).setOrigin(0, 0.5);
      this.container.add(this.barrel);
    }
    this.outline = new EntityOutlineController(() => this.draw());
    this.draw(); this.setAim(state.aimAngle ?? 0); this.updateStatus();
  }

  setOutlineState(state: EntityOutlineState): void { this.outline.setState(state); }
  setVisible(visible: boolean): this { this.container.setVisible(visible); return this; }
  setAim(angle: number): void { if (this.barrel) this.barrel.rotation = angle; }
  updateStatus(): void {
    if (this.powered === this.state.powered && this.status.fillColor !== 0x4c5a57) return;
    this.powered = this.state.powered;
    this.status.setFillStyle(this.powered ? 0x61d69a : 0x4c5a57);
  }
  destroy(): void { this.container.destroy(true); }

  private draw(): void {
    const outline = this.outline?.getState() === "interactable" ? ENTITY_OUTLINE.interactable : ENTITY_OUTLINE.normal;
    this.body.clear().lineStyle(1, outline, 1);
    if (this.state.kind === "turret") this.body.fillStyle(0x414b4a).fillCircle(0, 0, 8).strokeCircle(0, 0, 8).fillStyle(0x697573).fillCircle(0, 0, 4);
    else if (this.state.kind === "solar-generator") {
      this.body.fillStyle(0x294c68).fillRect(-10, -7, 20, 14).strokeRect(-10, -7, 20, 14).lineStyle(1, 0x71808a, 0.8).lineBetween(-3, -7, -3, 7).lineBetween(4, -7, 4, 7).lineBetween(-10, 0, 10, 0);
    } else if (this.state.kind === "fuel-generator") this.body.fillStyle(0x596253).fillRect(-9, -8, 18, 16).strokeRect(-9, -8, 18, 16).fillStyle(0x303735).fillRect(-5, -5, 7, 4).fillStyle(0xa47b45).fillRect(5, -5, 2, 4);
    else this.body.fillStyle(0x3e484d).fillRect(-8, -9, 16, 18).strokeRect(-8, -9, 16, 18).lineStyle(1, 0x69777b).lineBetween(-8, -3, 8, -3).lineBetween(-8, 3, 8, 3);
  }
}
