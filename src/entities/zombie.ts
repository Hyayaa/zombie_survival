import type Phaser from "phaser";
import { ZOMBIE_DEFINITIONS, type ZombieKind, type ZombieStateName } from "../data/zombie-definitions";
import { ACTOR_PALETTES, TopDownActorView } from "../rendering/generated-sprites";
import { createZombieMind, type Point, type ZombieMind } from "../systems/zombie-ai-system";
import { cancelZombieAttackWindups, createZombiePosture, damageZombiePosture, updateZombiePosture, type ZombiePostureDamageResult, type ZombiePostureState } from "../systems/zombie-posture-system";
import { createActorMotionSmoothingState } from "../systems/actor-motion-smoothing";
import { createZombieOrganicBehaviorState, type ZombieOrganicBehaviorState } from "../systems/zombie-organic-behavior";

export class Zombie {
  readonly view: TopDownActorView;
  readonly definition;
  position: Point;
  health: number;
  readonly posture: ZombiePostureState;
  mind: ZombieMind;
  path: Point[] = [];
  pathIndex = 0;
  pathNavigationRevision = -1;
  nextThinkAt = 0;
  nextPathAt = 0;
  nextAttackAt = 0;
  biteCompletesAt = 0;
  chargeReadyAt = 0;
  staggerUntil = 0;
  obstacleTargetId?: string;
  obstacleAttackCompletesAt = 0;
  nextObstacleAttackAt = 0;
  lastDamagedAt=Number.NEGATIVE_INFINITY;
  wanderTarget?: Point;
  aimAngle = 0;
  readonly motion = createActorMotionSmoothingState();
  readonly organic: ZombieOrganicBehaviorState;

  constructor(scene: Phaser.Scene, readonly id: string, readonly kind: ZombieKind, position: Point, state: ZombieStateName = "Idle") {
    this.position = { ...position };
    this.definition = ZOMBIE_DEFINITIONS[kind];
    this.health = this.definition.health;
    this.posture = createZombiePosture(this.definition);
    this.organic = createZombieOrganicBehaviorState(id);
    this.mind = { ...createZombieMind(), state };
    this.view = new TopDownActorView(scene, position.x, position.y, kind === "runner" ? ACTOR_PALETTES.runner : ACTOR_PALETTES.walker, false, false);
  }

  isAlive(): boolean {
    return this.health > 0 && this.mind.state !== "Dead";
  }

  get alive(): boolean { return this.isAlive(); }

  damage(amount: number, knockback: Point, now: number): boolean {
    if (!this.isAlive() || amount <= 0) return false;
    this.health = Math.max(0, this.health - amount);
    this.applyKnockback(knockback);
    this.view.flashHit(now);
    this.lastDamagedAt=now;
    if (this.health === 0) {
      this.mind = { ...this.mind, state: "Dead" };
      this.view.setDead(true);
      return true;
    }
    return false;
  }

  damagePosture(amount: number, now: number): ZombiePostureDamageResult {
    const result = damageZombiePosture(this.posture, amount, now, this.definition);
    if (result.broken) {
      this.staggerUntil = this.posture.staggerUntil;
      this.mind = { ...this.mind, state: "Stagger" };
      this.cancelAttackWindups();
    }
    return result;
  }

  updatePosture(now: number, deltaSeconds: number): void {
    updateZombiePosture(this.posture, this.definition, now, deltaSeconds);
  }

  cancelAttackWindups(): void {
    cancelZombieAttackWindups(this);
  }

  applyKnockback(knockback: Point): void {
    this.position.x += Number.isFinite(knockback.x) ? knockback.x : 0;
    this.position.y += Number.isFinite(knockback.y) ? knockback.y : 0;
  }

  updateView(time: number, visible: boolean): void {
    this.view.setVisible(visible);
    if (!visible) return;
    this.view.setPosition(this.position.x, this.position.y);
    this.view.updateAnimation(time, this.isAlive() && this.motion.currentSpeed > 0.5, this.mind.state === "Attack", this.motion.headAngle);
    if (!this.isAlive()) this.view.setDead(true);
  }
}
