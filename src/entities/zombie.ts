import type Phaser from "phaser";
import { ZOMBIE_DEFINITIONS, type ZombieKind, type ZombieStateName } from "../data/zombie-definitions";
import { ACTOR_PALETTES, TopDownActorView } from "../rendering/generated-sprites";
import { createZombieMind, type Point, type ZombieMind } from "../systems/zombie-ai-system";

export class Zombie {
  readonly view: TopDownActorView;
  readonly definition;
  position: Point;
  health: number;
  mind: ZombieMind;
  path: Point[] = [];
  pathIndex = 0;
  nextThinkAt = 0;
  nextPathAt = 0;
  nextAttackAt = 0;
  biteCompletesAt = 0;
  chargeReadyAt = 0;
  staggerUntil = 0;
  obstacleTargetId?: string;
  obstacleAttackCompletesAt = 0;
  nextObstacleAttackAt = 0;
  wanderTarget?: Point;
  aimAngle = 0;

  constructor(scene: Phaser.Scene, readonly id: string, readonly kind: ZombieKind, position: Point, state: ZombieStateName = "Idle") {
    this.position = { ...position };
    this.definition = ZOMBIE_DEFINITIONS[kind];
    this.health = this.definition.health;
    this.mind = { ...createZombieMind(), state };
    this.view = new TopDownActorView(scene, position.x, position.y, kind === "runner" ? ACTOR_PALETTES.runner : ACTOR_PALETTES.walker, false);
  }

  isAlive(): boolean {
    return this.health > 0 && this.mind.state !== "Dead";
  }

  damage(amount: number, knockback: Point, now: number): boolean {
    if (!this.isAlive()) return false;
    this.health = Math.max(0, this.health - amount);
    this.position.x += knockback.x;
    this.position.y += knockback.y;
    this.view.flashHit(now);
    if (this.health === 0) {
      this.mind = { ...this.mind, state: "Dead" };
      this.view.setDead(true);
      return true;
    }
    this.staggerUntil = now + 180;
    this.mind = { ...this.mind, state: "Stagger" };
    return false;
  }

  updateView(time: number, visible: boolean): void {
    this.view.setVisible(visible);
    if (!visible) return;
    this.view.setPosition(this.position.x, this.position.y);
    this.view.updateAnimation(time, this.isAlive() && this.mind.state !== "Idle", this.mind.state === "Attack", this.aimAngle);
    if (!this.isAlive()) this.view.setDead(true);
    this.view.setHealth(this.health, this.definition.health);
  }
}
