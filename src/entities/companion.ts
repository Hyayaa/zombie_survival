import type Phaser from "phaser";
import { ACTOR_PALETTES, TopDownActorView } from "../rendering/generated-sprites";
import type { Point } from "../systems/zombie-ai-system";
import { createCompanionNavigationState, type CompanionNavigationState } from "../systems/companion-navigation";

export type CompanionCommand = "follow" | "hold" | "move" | "focus";

export class Companion {
  readonly view: TopDownActorView;
  position: Point;
  health = 80;
  maxHealth = 80;
  rescued = false;
  alive = true;
  command: CompanionCommand = "follow";
  commandTarget?: Point;
  focusTargetId?: string;
  combatTargetId?: string;
  combatTargetLastVisibleAt = 0;
  aimAngle = 0;
  nextAttackAt = 0;
  path: Point[] = [];
  pathIndex = 0;
  nextPathAt = 0;
  readonly navigation: CompanionNavigationState;
  readonly goalScratch: Point = { x: 0, y: 0 };
  readonly steeringScratch: Point = { x: 0, y: 0 };
  readonly combatGoalScratch: Point = { x: 0, y: 0 };

  constructor(scene: Phaser.Scene, readonly id: string, position: Point, readonly formationSlotIndex = 0) {
    this.position = { ...position };
    this.navigation = createCompanionNavigationState(this.position);
    this.nextPathAt = stableCompanionStagger(id);
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
    if (!visible) return;
    this.view.setPosition(this.position.x, this.position.y);
    this.view.updateAnimation(time, moving, time < this.nextAttackAt - 450, this.aimAngle);
    if (!this.alive) this.view.setDead(true);
    this.view.setHealth(this.health, this.maxHealth, true);
  }
}

function stableCompanionStagger(id: string): number {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) hash = (Math.imul(hash, 31) + id.charCodeAt(index)) | 0;
  return Math.abs(hash) % 4 * 35;
}
