import Phaser from "phaser";
import { DEPTH } from "../config/game-config";
import type { WeaponId } from "../data/weapon-definitions";
import { swingOffsetAt } from "../effects/pixel-effect-math";

export interface ActorPalette {
  skin: number;
  skinLight: number;
  body: number;
  bodyLight: number;
  outline: number;
  accent: number;
}

export const ACTOR_PALETTES = {
  player: { skin: 0xb99b83, skinLight: 0xd0b49c, body: 0x365b72, bodyLight: 0x567f94, outline: 0x17242b, accent: 0xb9c9cf },
  companion: { skin: 0xaf9077, skinLight: 0xc9ab8e, body: 0x87623e, bodyLight: 0xa57d4e, outline: 0x2a2118, accent: 0xd3b574 },
  walker: { skin: 0x778473, skinLight: 0x9aa486, body: 0x526158, bodyLight: 0x687765, outline: 0x202923, accent: 0x4d2623 },
  runner: { skin: 0x80665b, skinLight: 0x9b8173, body: 0x533b36, bodyLight: 0x66483f, outline: 0x261b19, accent: 0x9f4237 },
} satisfies Record<string, ActorPalette>;

export interface ActorAttackAnimation {
  weapon: WeaponId;
  startedAt: number;
  durationMs: number;
  baseAimAngle: number;
}

export class TopDownActorView {
  readonly container: Phaser.GameObjects.Container;
  private readonly visual: Phaser.GameObjects.Container;
  private readonly aimLayer: Phaser.GameObjects.Container;
  private readonly weaponBody?: Phaser.GameObjects.Rectangle;
  private readonly weaponTip?: Phaser.GameObjects.Rectangle;
  private readonly healthBarBackground: Phaser.GameObjects.Rectangle;
  private readonly healthBarFill: Phaser.GameObjects.Rectangle;
  private attackAnimation?: ActorAttackAnimation;
  private weapon: WeaponId = "pistol";
  private hitUntil = 0;
  private lastX = Number.NaN;
  private lastY = Number.NaN;
  private lastDepth = Number.NaN;
  private lastAim = Number.NaN;
  private lastBob = Number.NaN;
  private lastVisualX = Number.NaN;
  private lastVisualY = Number.NaN;
  private lastVisualRotation = Number.NaN;
  private lastAlpha = Number.NaN;
  private lastHealth = Number.NaN;
  private lastMaximum = Number.NaN;
  private lastAlwaysVisible = false;
  private visible = true;
  private dead = false;

  constructor(scene: Phaser.Scene, x: number, y: number, palette: ActorPalette, armed = true) {
    this.container = scene.add.container(Math.round(x), Math.round(y));
    const shadow = scene.add.ellipse(0, 6, 11, 4, 0x050708, 0.62);
    this.visual = scene.add.container(0, 0);
    const torsoOutline = scene.add.ellipse(0, 1, 11, 13, palette.outline);
    const torso = scene.add.ellipse(0, 0, 9, 11, palette.body);
    const torsoLight = scene.add.ellipse(-2, -1, 3, 7, palette.bodyLight, 0.85);
    const headOutline = scene.add.circle(0, -5, 4.6, palette.outline);
    const head = scene.add.circle(0, -5, 3.7, palette.skin);
    const headLight = scene.add.rectangle(-1, -7, 3, 2, palette.skinLight);
    const aimParts = createAimLayer(scene, palette, armed);
    this.aimLayer = aimParts.container;
    this.weaponBody = aimParts.weaponBody;
    this.weaponTip = aimParts.weaponTip;
    this.healthBarBackground = scene.add.rectangle(-7, -13, 14, 2, 0x171a18, 0.9).setOrigin(0, 0);
    this.healthBarFill = scene.add.rectangle(-7, -13, 14, 2, 0x7aaa65, 1).setOrigin(0, 0);
    this.visual.add([torsoOutline, torso, torsoLight, headOutline, head, headLight, this.aimLayer, this.healthBarBackground, this.healthBarFill]);
    this.container.add([shadow, this.visual]);
    this.setAim(0);
    this.setWeapon("pistol");
    this.setPosition(x, y);
  }

  setPosition(x: number, y: number): void {
    const roundedX = Math.round(x);
    const roundedY = Math.round(y);
    if (roundedX !== this.lastX || roundedY !== this.lastY) {
      this.container.setPosition(roundedX, roundedY);
      this.lastX = roundedX;
      this.lastY = roundedY;
    }
    const depth = DEPTH.actor + roundedY;
    if (depth !== this.lastDepth) {
      this.container.setDepth(depth);
      this.lastDepth = depth;
    }
  }

  setAim(angle: number): void {
    const snapped = Math.round(angle / (Math.PI / 8)) * (Math.PI / 8);
    if (snapped !== this.lastAim) {
      this.aimLayer.rotation = snapped;
      this.lastAim = snapped;
    }
  }

  setWeapon(weapon: WeaponId): void {
    if (!this.weaponBody || !this.weaponTip || weapon === this.weapon) return;
    this.weapon = weapon;
    if (weapon === "knife") {
      this.weaponBody.setPosition(7, -1).setDisplaySize(7, 2).setFillStyle(0xc8d0cb, 1);
      this.weaponTip.setPosition(13, -1).setDisplaySize(2, 2).setFillStyle(0x596562, 1);
    } else if (weapon === "bat") {
      this.weaponBody.setPosition(6, -1.5).setDisplaySize(14, 3).setFillStyle(0x8c6847, 1);
      this.weaponTip.setPosition(18, -2).setDisplaySize(3, 4).setFillStyle(0x58412f, 1);
    } else {
      this.weaponBody.setPosition(7, -2).setDisplaySize(7, 4).setFillStyle(0x8d9693, 1);
      this.weaponTip.setPosition(13, -1).setDisplaySize(3, 2).setFillStyle(0x3e4948, 1);
    }
  }

  beginAttack(animation: ActorAttackAnimation): void {
    this.attackAnimation = animation;
    this.setWeapon(animation.weapon);
  }

  updateAnimation(time: number, moving: boolean, attacking: boolean, aimAngle: number): void {
    if (!this.visible) return;
    const bob = moving ? Math.round(Math.sin(time / 95)) : 0;
    let visualX = attacking ? -Math.round(Math.cos(aimAngle)) : 0;
    let visualY = 0;
    let visualRotation = 0;
    let poseAngle = aimAngle;
    let aimOffsetX = 0;
    let aimOffsetY = 0;
    let customAttacking = false;
    const attack = this.attackAnimation;
    if (attack) {
      const progress = (time - attack.startedAt) / attack.durationMs;
      if (progress >= 1) this.attackAnimation = undefined;
      else if (progress >= 0) {
        customAttacking = true;
        poseAngle = attack.baseAimAngle;
        if (attack.weapon === "knife" || attack.weapon === "bat") {
          poseAngle += swingOffsetAt(attack.weapon, progress);
          visualX = -Math.round(Math.cos(attack.baseAimAngle));
          visualY = -Math.round(Math.sin(attack.baseAimAngle));
          if (attack.weapon === "bat") visualRotation = Math.sin(progress * Math.PI) * 0.045;
        } else {
          const recoil = progress < 0.3 ? progress / 0.3 : 1 - (progress - 0.3) / 0.7;
          aimOffsetX = -Math.cos(attack.baseAimAngle) * Math.round(recoil * 2);
          aimOffsetY = -Math.sin(attack.baseAimAngle) * Math.round(recoil * 2);
          visualX = -Math.cos(attack.baseAimAngle) * Math.round(recoil);
          visualY = -Math.sin(attack.baseAimAngle) * Math.round(recoil);
        }
      }
    }
    const roundedVisualX = Math.round(visualX);
    const roundedVisualY = Math.round(visualY);
    if (roundedVisualX !== this.lastVisualX) {
      this.visual.x = roundedVisualX;
      this.lastVisualX = roundedVisualX;
    }
    if (roundedVisualY !== this.lastVisualY || bob !== this.lastBob) {
      this.visual.y = bob + roundedVisualY;
      this.lastVisualY = roundedVisualY;
      this.lastBob = bob;
    }
    if (!this.dead && visualRotation !== this.lastVisualRotation) {
      this.visual.rotation = visualRotation;
      this.lastVisualRotation = visualRotation;
    }
    const poseStep = customAttacking ? Math.PI / 32 : Math.PI / 8;
    const snappedPose = Math.round(poseAngle / poseStep) * poseStep;
    if (snappedPose !== this.lastAim) {
      this.aimLayer.rotation = snappedPose;
      this.lastAim = snappedPose;
    }
    const roundedAimX = Math.round(aimOffsetX);
    const roundedAimY = Math.round(aimOffsetY);
    if (this.aimLayer.x !== roundedAimX || this.aimLayer.y !== roundedAimY) this.aimLayer.setPosition(roundedAimX, roundedAimY);
    const alpha = this.dead ? 0.5 : time < this.hitUntil && Math.floor(time / 55) % 2 === 0 ? 0.4 : 1;
    if (alpha !== this.lastAlpha) {
      this.visual.setAlpha(alpha);
      this.lastAlpha = alpha;
    }
  }

  flashHit(now: number): void {
    this.hitUntil = now + 180;
  }

  setHealth(current: number, maximum: number, alwaysVisible = false): void {
    if (current === this.lastHealth && maximum === this.lastMaximum && alwaysVisible === this.lastAlwaysVisible) return;
    this.lastHealth = current;
    this.lastMaximum = maximum;
    this.lastAlwaysVisible = alwaysVisible;
    const shown = current < maximum || alwaysVisible;
    this.healthBarBackground.setVisible(shown);
    this.healthBarFill.setVisible(shown);
    if (!shown) return;
    const ratio = Math.max(0, current / maximum);
    this.healthBarFill.setScale(ratio, 1);
    this.healthBarFill.setFillStyle(ratio > 0.45 ? 0x7aaa65 : 0xb64f45, 1);
  }

  setVisible(visible: boolean): void {
    if (visible === this.visible) return;
    this.visible = visible;
    this.container.setVisible(visible);
  }

  setDead(dead: boolean): void {
    if (dead === this.dead) return;
    this.dead = dead;
    this.visual.rotation = dead ? Math.PI / 2 : 0;
    this.lastVisualRotation = this.visual.rotation;
    this.lastAlpha = dead ? 0.5 : 1;
    this.visual.setAlpha(this.lastAlpha);
  }

  destroy(): void {
    this.container.destroy(true);
  }
}

interface AimLayerParts {
  container: Phaser.GameObjects.Container;
  weaponBody?: Phaser.GameObjects.Rectangle;
  weaponTip?: Phaser.GameObjects.Rectangle;
}

function createAimLayer(scene: Phaser.Scene, palette: ActorPalette, armed: boolean): AimLayerParts {
  const container = scene.add.container(0, 0);
  container.add([
    scene.add.circle(5, -2, 2.6, palette.outline),
    scene.add.circle(5, 3, 2.6, palette.outline),
    scene.add.circle(5, -2, 1.8, palette.skin),
    scene.add.circle(5, 3, 1.8, palette.skin),
  ]);
  if (armed) {
    const weaponBody = scene.add.rectangle(7, -2, 7, 4, palette.accent).setOrigin(0, 0);
    const weaponTip = scene.add.rectangle(13, -1, 3, 2, palette.outline).setOrigin(0, 0);
    container.add([weaponBody, weaponTip]);
    return { container, weaponBody, weaponTip };
  }
  return { container };
}
