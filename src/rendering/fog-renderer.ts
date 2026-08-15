import Phaser from "phaser";
import { COLORS, DEPTH } from "../config/game-config";
import { FogOfWarSystem, VisibilityState } from "../systems/fog-of-war-system";

export class FogRenderer {
  private readonly graphics: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, private readonly fog: FogOfWarSystem) {
    this.graphics = scene.add.graphics().setDepth(DEPTH.fog);
  }

  render(camera: Phaser.Cameras.Scene2D.Camera): void {
    this.graphics.clear();
    const cell = this.fog.cellSize;
    const margin = cell * 2;
    const startX = Math.max(0, Math.floor((camera.worldView.x - margin) / cell));
    const startY = Math.max(0, Math.floor((camera.worldView.y - margin) / cell));
    const endX = Math.min(this.fog.widthCells - 1, Math.ceil((camera.worldView.right + margin) / cell));
    const endY = Math.min(this.fog.heightCells - 1, Math.ceil((camera.worldView.bottom + margin) / cell));
    for (let y = startY; y <= endY; y += 1) {
      for (let x = startX; x <= endX; x += 1) {
        const state = this.fog.getStateAtCell(x, y);
        if (state === VisibilityState.Visible) continue;
        if (state === VisibilityState.Unknown) this.graphics.fillStyle(COLORS.unknownFog, 0.985);
        else this.graphics.fillStyle(COLORS.exploredFog, 0.82);
        this.graphics.fillRect(x * cell, y * cell, cell, cell);
      }
    }
  }

  destroy(): void {
    this.graphics.destroy();
  }
}

