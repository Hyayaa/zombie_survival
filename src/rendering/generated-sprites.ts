import Phaser from "phaser";
import { DEPTH } from "../config/game-config";

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

export class TopDownActorView {
  readonly container: Phaser.GameObjects.Container;
  private readonly visual: Phaser.GameObjects.Container;
  private readonly aimLayer: Phaser.GameObjects.Container;
  private readonly idleAim: Phaser.GameObjects.Container;
  private readonly attackAim: Phaser.GameObjects.Container;
  private readonly healthBarBackground: Phaser.GameObjects.Rectangle;
  private readonly healthBarFill: Phaser.GameObjects.Rectangle;
  private hitUntil = 0;
  private lastX = Number.NaN;
  private lastY = Number.NaN;
  private lastDepth = Number.NaN;
  private lastAim = Number.NaN;
  private lastAttacking = false;
  private lastBob = Number.NaN;
  private lastVisualX = Number.NaN;
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
    this.aimLayer = scene.add.container(0, 0);
    this.idleAim = createAimLayer(scene, palette, armed, false);
    this.attackAim = createAimLayer(scene, palette, armed, true).setVisible(false);
    this.aimLayer.add([this.idleAim, this.attackAim]);
    this.healthBarBackground = scene.add.rectangle(-7, -13, 14, 2, 0x171a18, 0.9).setOrigin(0, 0);
    this.healthBarFill = scene.add.rectangle(-7, -13, 14, 2, 0x7aaa65, 1).setOrigin(0, 0);
    this.visual.add([torsoOutline, torso, torsoLight, headOutline, head, headLight, this.aimLayer, this.healthBarBackground, this.healthBarFill]);
    this.container.add([shadow, this.visual]);
    this.setAim(0, false);
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

  setAim(angle: number, attacking: boolean): void {
    const snapped = Math.round(angle / (Math.PI / 8)) * (Math.PI / 8);
    if (snapped !== this.lastAim) {
      this.aimLayer.rotation = snapped;
      this.lastAim = snapped;
    }
    if (attacking !== this.lastAttacking) {
      this.idleAim.setVisible(!attacking);
      this.attackAim.setVisible(attacking);
      this.lastAttacking = attacking;
    }
  }

  updateAnimation(time: number, moving: boolean, attacking: boolean, aimAngle: number): void {
    if (!this.visible) return;
    const bob = moving ? Math.round(Math.sin(time / 95)) : 0;
    if (bob !== this.lastBob) {
      this.visual.y = bob;
      this.lastBob = bob;
    }
    const visualX = attacking ? -Math.round(Math.cos(aimAngle)) : 0;
    if (visualX !== this.lastVisualX) {
      this.visual.x = visualX;
      this.lastVisualX = visualX;
    }
    this.setAim(aimAngle, attacking);
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
    this.lastAlpha = dead ? 0.5 : 1;
    this.visual.setAlpha(this.lastAlpha);
  }

  destroy(): void {
    this.container.destroy(true);
  }
}

function createAimLayer(scene: Phaser.Scene, palette: ActorPalette, armed: boolean, attacking: boolean): Phaser.GameObjects.Container {
  const container = scene.add.container(0, 0);
  container.add([
    scene.add.circle(5, -2, 2.6, palette.outline),
    scene.add.circle(5, 3, 2.6, palette.outline),
    scene.add.circle(5, -2, 1.8, palette.skin),
    scene.add.circle(5, 3, 1.8, palette.skin),
  ]);
  if (armed) {
    const length = attacking ? 12 : 9;
    const start = attacking ? 5 : 4;
    container.add([
      scene.add.rectangle(start, -1, length, 2, palette.accent).setOrigin(0, 0),
      scene.add.rectangle(attacking ? 14 : 11, -1, 2, 2, palette.outline).setOrigin(0, 0),
    ]);
  }
  return container;
}
