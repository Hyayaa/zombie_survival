import type Phaser from "phaser";
import { DEPTH } from "../config/game-config";

export interface ProjectileRenderItem {
  x: number; y: number; velocityX: number; velocityY: number;
  visualLength: number; visualWidth: number;
}

export interface ProjectilePixelCommand { x: number; y: number; width: number; height: number; color: number; role: "head" | "body" | "tail" }

export function createProjectilePixelPlan(item: ProjectileRenderItem): ProjectilePixelCommand[] {
  const angle = Math.atan2(item.velocityY, item.velocityX);
  const visualAngle = Math.round(angle / (Math.PI * 2 / 32)) * (Math.PI * 2 / 32);
  const directionX = Math.cos(visualAngle);
  const directionY = Math.sin(visualAngle);
  const headSize = Math.max(1, Math.round(item.visualWidth));
  const commands: ProjectilePixelCommand[] = [{ x: Math.round(item.x), y: Math.round(item.y), width: headSize, height: headSize, color: 0xfff9d2, role: "head" }];
  const length = Math.max(2, Math.round(item.visualLength));
  for (let step = 1; step <= length; step += 1) {
    if (step > Math.ceil(length * 0.55) && step % 2 === 0) continue;
    commands.push({
      x: Math.round(item.x - directionX * step), y: Math.round(item.y - directionY * step),
      width: step <= 2 ? headSize : 1, height: step <= 2 ? headSize : 1,
      color: step <= 2 ? 0xf1d66b : step <= Math.ceil(length * 0.65) ? 0xd99a3f : 0xa85d2b,
      role: step <= 2 ? "body" : "tail",
    });
  }
  return commands;
}

export class ProjectileRenderer {
  private readonly graphics: Phaser.GameObjects.Graphics;
  constructor(scene: Phaser.Scene, private readonly isVisible: (x: number, y: number) => boolean) {
    this.graphics = scene.add.graphics().setDepth(DEPTH.effectWorld + 1);
  }
  render(items: Iterable<ProjectileRenderItem>): void {
    this.graphics.clear();
    for (const item of items) {
      if (!this.isVisible(item.x, item.y)) continue;
      for (const command of createProjectilePixelPlan(item)) {
        this.graphics.fillStyle(command.color, 1).fillRect(command.x, command.y, command.width, command.height);
      }
    }
  }
  clear(): void { this.graphics.clear(); }
  destroy(): void { this.graphics.destroy(); }
}
