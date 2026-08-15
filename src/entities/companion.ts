import type Phaser from "phaser";
import { ACTOR_PALETTES, TopDownActorView } from "../rendering/generated-sprites";
import type { Point } from "../systems/zombie-ai-system";

export type CompanionCommand = "follow" | "hold" | "move" | "focus";

export class Companion {
  readonly id = "companion";
  readonly view: TopDownActorView;
  position: Point;
  health = 80;
  maxHealth = 80;
  rescued = false;
  alive = true;
  command: CompanionCommand = "follow";
  commandTarget?: Point;
  focusTargetId?: string;
  aimAngle = 0;
  nextAttackAt = 0;
  path: Point[] = [];
  pathIndex = 0;
  nextPathAt = 0;

  constructor(scene: Phaser.Scene, position: Point) {
    this.position = { ...position };
    this.view = new TopDownActorView(scene, position.x, position.y, ACTOR_PALETTES.companion, true);
  }

  damage(amount: number, now: number): boolean {
    if (!this.alive) return false;
    this.health = Math.max(0, this.health - amount);
    this.view.flashHit(now);
    if (this.health === 0) {
      this.alive = false;
      this.view.setDead(true);
      return true;
    }
    return false;
  }

  updateView(time: number, visible: boolean, moving: boolean): void {
    this.view.setVisible(visible);
    this.view.setPosition(this.position.x, this.position.y);
    this.view.updateAnimation(time, moving, time < this.nextAttackAt - 450, this.aimAngle);
    if (!this.alive) this.view.setDead(true);
    this.view.setHealth(this.health, this.maxHealth, true);
  }
}
