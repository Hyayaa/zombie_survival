import { isFirearmId, type WeaponId } from "../data/weapon-definitions";
import { createWeaponMagazines, type WeaponMagazines } from "../systems/weapon-system";
import { ATTACK_EFFECT_DURATION_MS } from "../effects/pixel-effect-definitions";
import type { VitalState } from "../systems/infection-system";
import type { Point } from "../systems/zombie-ai-system";
import { ACTOR_PALETTES, TopDownActorView } from "../rendering/generated-sprites";
import type Phaser from "phaser";
import { createSurvivalNeeds, createSurvivalRuntime } from "../systems/survival-needs-system";
import type { MeleeAttackMode } from "../data/melee-attack-definitions";

export class Player {
  readonly id = "player";
  readonly view: TopDownActorView;
  position: Point;
  movement: Point = { x: 0, y: 0 };
  aimAngle = 0;
  vitals: VitalState = { health: 100, maxHealth: 100, infection: 0 };
  survivalNeeds = createSurvivalNeeds();
  readonly survivalRuntime = createSurvivalRuntime();
  equippedWeapon: WeaponId | null = null;
  readonly unlockedWeapons = new Set<WeaponId>(["knife"]);
  magazines: WeaponMagazines = createWeaponMagazines();
  flashlightCharge = 180;
  flashlightOn = false;
  torchRemaining = 0;
  lastAttackAt = -10_000;
  reloadingUntil = 0;
  invulnerableUntil = 0;

  constructor(scene: Phaser.Scene, position: Point) {
    this.position = { ...position };
    this.view = new TopDownActorView(scene, position.x, position.y, ACTOR_PALETTES.player, true);
    this.view.setWeapon(this.equippedWeapon ?? "knife");
  }

  unlockWeapon(weapon: WeaponId, equip = true): void {
    this.unlockedWeapons.add(weapon);
    if (equip) this.equippedWeapon = weapon;
    if (isFirearmId(weapon) && this.magazines[weapon] === 0) {
      this.magazines[weapon] = weapon === "pistol" ? 4 : weapon === "smg" ? 12 : 3;
    }
  }

  get magazine(): number {
    return this.equippedWeapon && isFirearmId(this.equippedWeapon) ? this.magazines[this.equippedWeapon] : 0;
  }

  set magazine(rounds: number) {
    const weapon = this.equippedWeapon && isFirearmId(this.equippedWeapon) ? this.equippedWeapon : "pistol";
    this.magazines[weapon] = rounds;
  }

  updateView(time: number): void {
    const moving = Math.hypot(this.movement.x, this.movement.y) > 0.1;
    this.view.setPosition(this.position.x, this.position.y);
    const visualWeapon = this.equippedWeapon ?? "knife";
    this.view.setWeapon(visualWeapon);
    this.view.updateAnimation(time, moving, this.equippedWeapon !== null && time - this.lastAttackAt < ATTACK_EFFECT_DURATION_MS[visualWeapon], this.aimAngle);
    this.view.setHealth(this.vitals.health, this.vitals.maxHealth, true);
  }

  beginAttack(startedAt: number, meleeMode?: MeleeAttackMode, durationMs?: number): void {
    if (!this.equippedWeapon) return;
    this.view.beginAttack({
      weapon: this.equippedWeapon,
      startedAt,
      durationMs: durationMs ?? ATTACK_EFFECT_DURATION_MS[this.equippedWeapon],
      baseAimAngle: this.aimAngle,
      meleeMode,
    });
  }
}
