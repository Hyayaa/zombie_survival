import type { WeaponId } from "../data/weapon-definitions";
import type { VitalState } from "../systems/infection-system";
import type { Point } from "../systems/zombie-ai-system";
import { ACTOR_PALETTES, TopDownActorView } from "../rendering/generated-sprites";
import type Phaser from "phaser";

export class Player {
  readonly id = "player";
  readonly view: TopDownActorView;
  position: Point;
  movement: Point = { x: 0, y: 0 };
  aimAngle = 0;
  vitals: VitalState = { health: 100, maxHealth: 100, infection: 0 };
  equippedWeapon: WeaponId = "knife";
  readonly unlockedWeapons = new Set<WeaponId>(["knife"]);
  magazine = 0;
  flashlightCharge = 180;
  flashlightOn = false;
  torchRemaining = 0;
  lastAttackAt = -10_000;
  reloadingUntil = 0;
  invulnerableUntil = 0;

  constructor(scene: Phaser.Scene, position: Point) {
    this.position = { ...position };
    this.view = new TopDownActorView(scene, position.x, position.y, ACTOR_PALETTES.player, true);
  }

  unlockWeapon(weapon: WeaponId): void {
    this.unlockedWeapons.add(weapon);
    this.equippedWeapon = weapon;
    if (weapon === "pistol" && this.magazine === 0) this.magazine = 4;
  }

  updateView(time: number): void {
    const moving = Math.hypot(this.movement.x, this.movement.y) > 0.1;
    this.view.setPosition(this.position.x, this.position.y);
    this.view.updateAnimation(time, moving, time - this.lastAttackAt < 100, this.aimAngle);
    this.view.setHealth(this.vitals.health, this.vitals.maxHealth, true);
  }
}

