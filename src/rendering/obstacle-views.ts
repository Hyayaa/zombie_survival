import Phaser from "phaser";
import { DEPTH, ENTITY_OUTLINE, TILE_SIZE } from "../config/game-config";
import type { DoorDefinition } from "../data/map-definitions";
import type { DestructibleObstacleState } from "../entities/destructible-obstacle";
import { entityOutlineColor, type EntityOutlineState, type OutlineableEntityView } from "./entity-outline";

abstract class DestructibleObstacleView implements OutlineableEntityView {
  protected readonly healthBackground: Phaser.GameObjects.Rectangle;
  protected readonly healthFill: Phaser.GameObjects.Rectangle;
  private outlineState: EntityOutlineState = "normal";
  private currentHealth = Number.NaN;
  private maximumHealth = Number.NaN;
  private recentDamageUntil = 0;
  private healthVisible = false;
  private healthDisabled = false;

  protected constructor(
    protected readonly body: Phaser.GameObjects.Rectangle,
    scene: Phaser.Scene,
    x: number,
    y: number,
    barWidth: number,
  ) {
    this.healthBackground = scene.add.rectangle(x - barWidth / 2, y - 14, barWidth, 2, 0x000000, 0.95)
      .setOrigin(0, 0).setDepth(DEPTH.propFront + Math.round(y));
    this.healthFill = scene.add.rectangle(x - barWidth / 2, y - 14, barWidth, 2, 0x9c6844, 1)
      .setOrigin(0, 0).setDepth(DEPTH.propFront + Math.round(y) + 1);
    this.healthBackground.setVisible(false);
    this.healthFill.setVisible(false);
  }

  setOutlineState(state: EntityOutlineState): void {
    if (state === this.outlineState) return;
    this.outlineState = state;
    this.body.setStrokeStyle(1, entityOutlineColor(state), 1);
  }

  setHealth(current: number, maximum: number, now: number): void {
    if (current === this.currentHealth && maximum === this.maximumHealth) return;
    if (Number.isFinite(this.currentHealth) && current < this.currentHealth) this.recentDamageUntil = now + 1_500;
    this.currentHealth = current;
    this.maximumHealth = maximum;
    this.healthFill.setScale(maximum > 0 ? Math.max(0, current / maximum) : 0, 1);
  }

  updateStatus(now: number, targeted: boolean): void {
    const visible = !this.healthDisabled && (this.currentHealth < this.maximumHealth || targeted || now < this.recentDamageUntil);
    if (visible === this.healthVisible) return;
    this.healthVisible = visible;
    this.healthBackground.setVisible(visible);
    this.healthFill.setVisible(visible);
  }

  protected disableHealthBar(disabled: boolean): void {
    this.healthDisabled = disabled;
    if (!disabled || !this.healthVisible) return;
    this.healthVisible = false;
    this.healthBackground.setVisible(false);
    this.healthFill.setVisible(false);
  }

  setVisible(visible: boolean): void {
    this.body.setVisible(visible);
    this.healthBackground.setVisible(visible && this.healthVisible);
    this.healthFill.setVisible(visible && this.healthVisible);
  }

  destroy(): void {
    this.body.destroy();
    this.healthBackground.destroy();
    this.healthFill.destroy();
  }
}

export class DoorView extends DestructibleObstacleView {
  constructor(scene: Phaser.Scene, door: DoorDefinition) {
    const x = door.tileX * TILE_SIZE + TILE_SIZE / 2;
    const y = door.tileY * TILE_SIZE + TILE_SIZE / 2;
    const body = scene.add.rectangle(x, y, TILE_SIZE - 5, 5, 0x604a34)
      .setStrokeStyle(1, ENTITY_OUTLINE.normal)
      .setDepth(DEPTH.actor + (door.tileY + 1) * TILE_SIZE);
    super(body, scene, x, y, 14);
    this.setDoorState(door.open, door.destroyed, door.orientation);
    this.setHealth(door.health, door.maxHealth, 0);
  }

  setDoorState(open: boolean, destroyed: boolean, orientation: DoorDefinition["orientation"]): void {
    const baseAngle = orientation === "vertical" ? 90 : orientation === "diagonal-down" ? 45 : orientation === "diagonal-up" ? -45 : 0;
    this.body.setRotation((baseAngle + (open ? 90 : 0)) * Math.PI / 180);
    this.body.setSize(destroyed ? 11 : TILE_SIZE - 5, 5);
    this.body.setDisplaySize(destroyed ? 11 : TILE_SIZE - 5, destroyed ? 3 : 5);
    this.body.setFillStyle(destroyed ? 0x4a3b2e : open ? 0x806848 : 0x604a34);
    this.body.setAlpha(destroyed ? 0.55 : 1);
    this.disableHealthBar(destroyed);
  }
}

export class BarricadeView extends DestructibleObstacleView {
  constructor(scene: Phaser.Scene, state: DestructibleObstacleState) {
    const x = state.tileX * TILE_SIZE + TILE_SIZE / 2;
    const y = state.tileY * TILE_SIZE + TILE_SIZE / 2;
    const body = scene.add.rectangle(x, y, TILE_SIZE - 4, 9, 0x825e3d)
      .setStrokeStyle(1, ENTITY_OUTLINE.normal)
      .setDepth(DEPTH.propBack + Math.round(y));
    super(body, scene, x, y, 16);
    this.setHealth(state.health, state.maxHealth, 0);
  }
}
