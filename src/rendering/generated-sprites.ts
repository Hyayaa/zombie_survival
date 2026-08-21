import Phaser from "phaser";
import { DEPTH, ENTITY_OUTLINE } from "../config/game-config";
import type { WeaponId } from "../data/weapon-definitions";
import { swingOffsetAt } from "../effects/pixel-effect-math";
import type { MeleeAttackMode } from "../data/melee-attack-definitions";
import { EntityOutlineController, type EntityOutlineState, type OutlineableEntityView } from "./entity-outline";

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
  meleeMode?: MeleeAttackMode;
}

export class TopDownActorView implements OutlineableEntityView {
  readonly container: Phaser.GameObjects.Container;
  private readonly visual: Phaser.GameObjects.Container;
  private readonly aimLayer: Phaser.GameObjects.Container;
  private readonly weaponBody?: Phaser.GameObjects.Rectangle;
  private readonly weaponTip?: Phaser.GameObjects.Rectangle;
  private readonly fillOutlineShapes: Phaser.GameObjects.Shape[];
  private readonly strokeOutlineShapes: Phaser.GameObjects.Shape[];
  private readonly healthBarBackground: Phaser.GameObjects.Rectangle;
  private readonly healthBarFill: Phaser.GameObjects.Rectangle;
  private readonly postureBarBackground: Phaser.GameObjects.Rectangle;
  private readonly postureBarFill: Phaser.GameObjects.Rectangle;
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
  private lastPosture = Number.NaN;
  private lastPostureMaximum = Number.NaN;
  private lastPostureShown = false;
  private lastPostureBroken = false;
  private visible = true;
  private dead = false;
  private readonly outline: EntityOutlineController;

  constructor(scene: Phaser.Scene, x: number, y: number, palette: ActorPalette, armed = true) {
    this.container = scene.add.container(Math.round(x), Math.round(y));
    const shadow = scene.add.ellipse(0, 6, 11, 4, 0x050708, 0.62);
    this.visual = scene.add.container(0, 0);
    const torsoOutline = scene.add.ellipse(0, 1, 11, 13, ENTITY_OUTLINE.normal);
    const torso = scene.add.ellipse(0, 0, 9, 11, palette.body);
    const torsoLight = scene.add.ellipse(-2, -1, 3, 7, palette.bodyLight, 0.85);
    const headOutline = scene.add.circle(0, -5, 4.6, ENTITY_OUTLINE.normal);
    const head = scene.add.circle(0, -5, 3.7, palette.skin);
    const headLight = scene.add.rectangle(-1, -7, 3, 2, palette.skinLight);
    const aimParts = createAimLayer(scene, palette, armed);
    this.aimLayer = aimParts.container;
    this.weaponBody = aimParts.weaponBody;
    this.weaponTip = aimParts.weaponTip;
    this.fillOutlineShapes = [torsoOutline, headOutline, ...aimParts.fillOutlineShapes];
    this.strokeOutlineShapes = aimParts.strokeOutlineShapes;
    this.outline = new EntityOutlineController((color) => {
      for (const shape of this.fillOutlineShapes) shape.setFillStyle(color, 1);
      for (const shape of this.strokeOutlineShapes) shape.setStrokeStyle(1, color, 1);
    });
    this.healthBarBackground = scene.add.rectangle(-7, -13, 14, 2, 0x171a18, 0.9).setOrigin(0, 0);
    this.healthBarFill = scene.add.rectangle(-7, -13, 14, 2, 0x7aaa65, 1).setOrigin(0, 0);
    this.postureBarBackground = scene.add.rectangle(-9, -16, 18, 2, 0x171a18, 0.88).setOrigin(0, 0).setVisible(false);
    this.postureBarFill = scene.add.rectangle(-9, -16, 18, 2, 0xd8a84e, 1).setOrigin(0, 0).setVisible(false);
    this.visual.add([torsoOutline, torso, torsoLight, headOutline, head, headLight, this.aimLayer, this.healthBarBackground, this.healthBarFill, this.postureBarBackground, this.postureBarFill]);
    this.container.add([shadow, this.visual]);
    this.setAim(0);
    this.setWeapon("pistol");
    this.setPosition(x, y);
  }

  setOutlineState(state: EntityOutlineState): void {
    this.outline.setState(state);
  }

  getOutlineState(): EntityOutlineState {
    return this.outline.getState();
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
    } else if (weapon === "smg") {
      this.weaponBody.setPosition(6, -2).setDisplaySize(10, 5).setFillStyle(0x5f6c6c, 1);
      this.weaponTip.setPosition(15, -1).setDisplaySize(4, 2).setFillStyle(0x303a3a, 1);
    } else if (weapon === "shotgun") {
      this.weaponBody.setPosition(6, -2).setDisplaySize(15, 3).setFillStyle(0x806448, 1);
      this.weaponTip.setPosition(19, -1).setDisplaySize(5, 2).setFillStyle(0x46504f, 1);
    } else if (weapon === "hunting_rifle") {
      this.weaponBody.setPosition(5, -2).setDisplaySize(18, 3).setFillStyle(0x6f5b43, 1);
      this.weaponTip.setPosition(21, -1).setDisplaySize(6, 2).setFillStyle(0x37413f, 1);
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
          if (attack.meleeMode === "stab") {
            const thrust = Math.sin(progress * Math.PI) * 3;
            visualX = Math.round(Math.cos(attack.baseAimAngle) * thrust);
            visualY = Math.round(Math.sin(attack.baseAimAngle) * thrust);
          } else {
            poseAngle += swingOffsetAt(attack.weapon, progress) * (attack.meleeMode === "heavy" ? 1.15 : 1);
            visualX = -Math.round(Math.cos(attack.baseAimAngle));
            visualY = -Math.round(Math.sin(attack.baseAimAngle));
            if (attack.weapon === "bat") visualRotation = Math.sin(progress * Math.PI) * (attack.meleeMode === "heavy" ? 0.075 : 0.045);
          }
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

  setPosture(current: number, maximum: number, shown: boolean, broken: boolean): void {
    if (current === this.lastPosture && maximum === this.lastPostureMaximum && shown === this.lastPostureShown && broken === this.lastPostureBroken) return;
    this.lastPosture = current;
    this.lastPostureMaximum = maximum;
    this.lastPostureShown = shown;
    this.lastPostureBroken = broken;
    this.postureBarBackground.setVisible(shown);
    this.postureBarFill.setVisible(shown);
    if (!shown) return;
    this.postureBarFill.setScale(Math.max(0, Math.min(1, current / Math.max(1, maximum))), 1);
    this.postureBarFill.setFillStyle(broken ? 0xf0e5b0 : 0xd8a84e, 1);
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
  fillOutlineShapes: Phaser.GameObjects.Shape[];
  strokeOutlineShapes: Phaser.GameObjects.Shape[];
}

function createAimLayer(scene: Phaser.Scene, palette: ActorPalette, armed: boolean): AimLayerParts {
  const container = scene.add.container(0, 0);
  const upperArmOutline = scene.add.circle(5, -2, 2.6, ENTITY_OUTLINE.normal);
  const lowerArmOutline = scene.add.circle(5, 3, 2.6, ENTITY_OUTLINE.normal);
  container.add([
    upperArmOutline,
    lowerArmOutline,
    scene.add.circle(5, -2, 1.8, palette.skin),
    scene.add.circle(5, 3, 1.8, palette.skin),
  ]);
  if (armed) {
    const weaponBody = scene.add.rectangle(7, -2, 7, 4, palette.accent).setOrigin(0, 0).setStrokeStyle(1, ENTITY_OUTLINE.normal);
    const weaponTip = scene.add.rectangle(13, -1, 3, 2, palette.outline).setOrigin(0, 0).setStrokeStyle(1, ENTITY_OUTLINE.normal);
    container.add([weaponBody, weaponTip]);
    return { container, weaponBody, weaponTip, fillOutlineShapes: [upperArmOutline, lowerArmOutline], strokeOutlineShapes: [weaponBody, weaponTip] };
  }
  return { container, fillOutlineShapes: [upperArmOutline, lowerArmOutline], strokeOutlineShapes: [] };
}
