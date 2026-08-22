import Phaser from "phaser";
import { DEPTH, ENTITY_OUTLINE } from "../config/game-config";
import type { PlacedStructureState } from "../entities/placed-structure";
import { getPlacedStructureCenter } from "../entities/placed-structure";
import { BUILDABLE_DEFINITIONS } from "../data/buildable-definitions";
import { EntityOutlineController, type EntityOutlineState, type WorldEntityView } from "./entity-outline";
import { createStructureRenderModel, drawStructureRenderModel } from "./structure-render-model";

export class StructureView implements WorldEntityView {
  readonly container: Phaser.GameObjects.Container;
  private readonly body: Phaser.GameObjects.Graphics;
  private readonly status: Phaser.GameObjects.Rectangle;
  private readonly outline: EntityOutlineController;
  private powered = false;

  constructor(scene: Phaser.Scene, readonly state: PlacedStructureState) {
    const { x, y } = getPlacedStructureCenter(state);
    this.container = scene.add.container(x, y).setDepth(DEPTH.propFront + y);
    this.body = scene.add.graphics();
    this.status = scene.add.rectangle(7, -7, 2, 2, 0x4c5a57).setVisible(!BUILDABLE_DEFINITIONS[state.kind].craftingStationKind);
    this.container.add([this.body, this.status]);
    this.outline = new EntityOutlineController(() => this.draw());
    this.draw(); this.setAim(state.aimAngle ?? 0); this.updateStatus();
  }

  setOutlineState(state: EntityOutlineState): void { this.outline.setState(state); }
  setVisible(visible: boolean): this { this.container.setVisible(visible); return this; }
  setAim(angle: number): void { if(this.state.kind!=="turret")return;this.state.aimAngle=angle;this.draw(); }
  updateStatus(): void {
    if (this.powered === this.state.powered && this.status.fillColor !== 0x4c5a57) return;
    this.powered = this.state.powered;
    this.status.setFillStyle(this.powered ? 0x61d69a : 0x4c5a57);
  }
  destroy(): void { this.container.destroy(true); }

  private draw(): void {
    const outline = this.outline?.getState() === "interactable" ? ENTITY_OUTLINE.interactable : ENTITY_OUTLINE.normal;
    const center=getPlacedStructureCenter(this.state);this.body.clear();drawStructureRenderModel(this.body,createStructureRenderModel(this.state.kind,this.state.placement,{doorOpen:this.state.doorOpen,aimAngle:this.state.aimAngle}),center.x,center.y,outline);
  }
  refresh(): void { this.draw(); }

}
