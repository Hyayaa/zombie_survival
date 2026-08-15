import Phaser from "phaser";
import { COLORS, DEPTH } from "../config/game-config";
import { FogOfWarSystem, VisibilityState } from "../systems/fog-of-war-system";

let fogTextureCounter = 0;

export class FogRenderer {
  private readonly textureKey: string;
  private readonly texture: Phaser.Textures.CanvasTexture;
  private readonly image: Phaser.GameObjects.Image;
  private readonly imageData: ImageData;
  private initialized = false;

  constructor(private readonly scene: Phaser.Scene, private readonly fog: FogOfWarSystem) {
    this.textureKey = `fog-${scene.sys.settings.key}-${fogTextureCounter++}`;
    const texture = scene.textures.createCanvas(this.textureKey, fog.widthCells, fog.heightCells);
    if (!texture) throw new Error("Unable to create fog texture");
    this.texture = texture;
    this.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.imageData = texture.context.createImageData(fog.widthCells, fog.heightCells);
    this.image = scene.add.image(0, 0, this.textureKey)
      .setOrigin(0)
      .setDisplaySize(fog.widthPixels, fog.heightPixels)
      .setDepth(DEPTH.fog);
  }

  render(): number {
    if (!this.initialized) {
      const cellCount = this.fog.widthCells * this.fog.heightCells;
      for (let index = 0; index < cellCount; index += 1) this.writeState(index);
      this.texture.context.putImageData(this.imageData, 0, 0);
      this.initialized = true;
    } else {
      const changed = this.fog.getChangedIndices();
      if (changed.length === 0) return 0;
      let minX = this.fog.widthCells;
      let minY = this.fog.heightCells;
      let maxX = 0;
      let maxY = 0;
      for (const index of changed) {
        this.writeState(index);
        const x = index % this.fog.widthCells;
        const y = Math.floor(index / this.fog.widthCells);
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
      this.texture.context.putImageData(this.imageData, 0, 0, minX, minY, maxX - minX + 1, maxY - minY + 1);
    }
    this.texture.refresh();
    return this.fog.getChangedIndices().length;
  }

  destroy(): void {
    this.image.destroy();
    this.scene.textures.remove(this.textureKey);
  }

  private writeState(index: number): void {
    const x = index % this.fog.widthCells;
    const y = Math.floor(index / this.fog.widthCells);
    const state = this.fog.getStateAtCell(x, y);
    if (state === VisibilityState.Visible) {
      this.writePixel(index, 0, 0);
    } else if (state === VisibilityState.Explored) {
      this.writePixel(index, COLORS.exploredFog, 0.82);
    } else {
      this.writePixel(index, COLORS.unknownFog, 0.985);
    }
  }

  private writePixel(index: number, color: number, alpha: number): void {
    const offset = index * 4;
    this.imageData.data[offset] = color >> 16 & 0xff;
    this.imageData.data[offset + 1] = color >> 8 & 0xff;
    this.imageData.data[offset + 2] = color & 0xff;
    this.imageData.data[offset + 3] = Math.round(alpha * 255);
  }
}
