import Phaser from "phaser";
import { DEPTH, ENTITY_OUTLINE, TILE_SIZE } from "../config/game-config";
import type { PlacedStructureState } from "../entities/placed-structure";
import { getPlacedStructureCenter } from "../entities/placed-structure";
import { BUILDABLE_DEFINITIONS } from "../data/buildable-definitions";
import { EntityOutlineController, type EntityOutlineState, type WorldEntityView } from "./entity-outline";

export class StructureView implements WorldEntityView {
  readonly container: Phaser.GameObjects.Container;
  private readonly body: Phaser.GameObjects.Graphics;
  private readonly barrel?: Phaser.GameObjects.Rectangle;
  private readonly status: Phaser.GameObjects.Rectangle;
  private readonly outline: EntityOutlineController;
  private powered = false;

  constructor(scene: Phaser.Scene, readonly state: PlacedStructureState) {
    const { x, y } = getPlacedStructureCenter(state);
    this.container = scene.add.container(x, y).setDepth(DEPTH.propFront + y);
    this.body = scene.add.graphics();
    this.status = scene.add.rectangle(7, -7, 2, 2, 0x4c5a57).setVisible(!BUILDABLE_DEFINITIONS[state.kind].craftingStationKind);
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
    else if (this.state.kind === "battery-bank") this.body.fillStyle(0x3e484d).fillRect(-8, -9, 16, 18).strokeRect(-8, -9, 16, 18).lineStyle(1, 0x69777b).lineBetween(-8, -3, 8, -3).lineBetween(-8, 3, 8, 3);
    else if (this.state.kind === "wood-crate" || this.state.kind === "barricade") this.body.fillStyle(0x6f5033).fillRect(-9, -8, 18, 16).strokeRect(-9, -8, 18, 16).lineStyle(1, 0xa47a4c).lineBetween(-8, -2, 8, -2).lineBetween(0, -7, 0, 7);
    else if (this.state.kind === "wood-wall" || this.state.kind === "metal-wall" || this.state.kind === "wood-door") this.drawSegment(outline);
    else this.drawWorkbench(outline);
  }
  refresh(): void { this.draw(); }

  private drawSegment(outline: number): void {
    if (this.state.placement.kind !== "segment") return;
    const placement = this.state.placement; const center = getPlacedStructureCenter(this.state);
    const startX = placement.startX - center.x; const startY = placement.startY - center.y; const endX = placement.endX - center.x; const endY = placement.endY - center.y;
    const open = this.state.kind === "wood-door" && this.state.doorOpen;
    const color = this.state.kind === "metal-wall" ? 0x667174 : this.state.kind === "wood-door" ? 0x8c643d : 0x755235;
    this.body.lineStyle(BUILDABLE_DEFINITIONS[this.state.kind].segment!.thickness + 2, outline, 1).lineBetween(startX, startY, open ? startX + (endY - startY) : endX, open ? startY - (endX - startX) : endY);
    this.body.lineStyle(BUILDABLE_DEFINITIONS[this.state.kind].segment!.thickness, color, 1).lineBetween(startX, startY, open ? startX + (endY - startY) : endX, open ? startY - (endX - startX) : endY);
  }

  private drawWorkbench(outline: number): void {
    const definition = BUILDABLE_DEFINITIONS[this.state.kind]; const width = definition.footprint!.width * TILE_SIZE - 5; const height = definition.footprint!.height * TILE_SIZE - 7;
    const left = -Math.floor(width / 2); const top = -Math.floor(height / 2);
    const technical = this.state.kind === "technical_workbench"; const plank = this.state.kind === "plank_workbench";
    this.body.lineStyle(1, outline, 1).fillStyle(technical ? 0x425554 : plank ? 0x74583b : 0x5c4934).fillRect(left, top, width, height).strokeRect(left, top, width, height);
    this.body.fillStyle(technical ? 0x718481 : 0x9b744b).fillRect(left + 2, top + 3, width - 4, 5);
    this.body.fillStyle(0x252d2b).fillRect(left + 4, top + 11, width - 8, 3).fillRect(left + 4, top + height - 7, 4, 6).fillRect(left + width - 8, top + height - 7, 4, 6);
    if (technical) this.body.fillStyle(0x4d9a72).fillRect(left + 6, top + 16, 8, 5).fillStyle(0xb58b45).fillRect(left + 17, top + 15, 5, 6).fillStyle(0x78848a).fillRect(left + width - 15, top + 13, 10, 8);
    else this.body.fillStyle(0xb3a07a).fillRect(left + 6, top + 14, 10, 3).fillStyle(0x6e7774).fillRect(left + width - 14, top + 13, 7, 7);
  }
}
