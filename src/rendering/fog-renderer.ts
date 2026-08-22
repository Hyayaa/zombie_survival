import Phaser from "phaser";
import { COLORS, DEPTH, TILE_SIZE } from "../config/game-config";
import { FogOfWarSystem, VisibilityState } from "../systems/fog-of-war-system";
import { fogChunkIndexForCell, getFogChunkLayout } from "./fog-chunk-layout";

const FOG_CHUNK_TILES = 16;
const FOG_CHUNK_WORLD_SIZE = FOG_CHUNK_TILES * TILE_SIZE;
let fogTextureCounter = 0;

interface FogChunkView {
  startCellX: number;
  startCellY: number;
  widthCells: number;
  heightCells: number;
  textureKey: string;
  texture: Phaser.Textures.CanvasTexture;
  image: Phaser.GameObjects.Image;
  imageData: ImageData;
}

export interface FogRenderMetrics {
  visibleChunks: number;
  dirtyChunks: number;
  chunkWidthCells: number;
  chunkHeightCells: number;
}

/** Keeps exploration in the full compact grid, but uploads only camera-local fog textures. */
export class FogRenderer {
  private readonly chunkCells: number;
  private readonly columns: number;
  private readonly rows: number;
  private readonly chunks = new Map<number, FogChunkView>();
  private readonly activeMarkers: Uint32Array;
  private readonly dirtyMarkers: Uint32Array;
  private readonly activeIndices: number[] = [];
  private readonly nextActiveIndices: number[] = [];
  private readonly dirtyIndices: number[] = [];
  private activeGeneration = 1;
  private dirtyGeneration = 1;
  private lastViewportKey = Number.NaN;
  private lastDirtyChunkCount = 0;

  constructor(private readonly scene: Phaser.Scene, private readonly fog: FogOfWarSystem) {
    const layout = getFogChunkLayout(fog.widthCells, fog.heightCells, fog.cellSize, FOG_CHUNK_TILES, TILE_SIZE);
    this.chunkCells = layout.chunkCells;
    this.columns = layout.columns;
    this.rows = layout.rows;
    this.activeMarkers = new Uint32Array(this.columns * this.rows);
    this.dirtyMarkers = new Uint32Array(this.columns * this.rows);
  }

  updateViewport(): boolean {
    const view = this.scene.cameras.main.worldView;
    const minX = clamp(Math.floor(view.x / FOG_CHUNK_WORLD_SIZE) - 1, 0, this.columns - 1);
    const minY = clamp(Math.floor(view.y / FOG_CHUNK_WORLD_SIZE) - 1, 0, this.rows - 1);
    const maxX = clamp(Math.floor((view.right - 1) / FOG_CHUNK_WORLD_SIZE) + 1, 0, this.columns - 1);
    const maxY = clamp(Math.floor((view.bottom - 1) / FOG_CHUNK_WORLD_SIZE) + 1, 0, this.rows - 1);
    const viewportKey = (((minY * 32 + minX) * 32 + maxY) * 32 + maxX);
    if (viewportKey === this.lastViewportKey) return false;
    this.lastViewportKey = viewportKey;
    this.activeGeneration = nextGeneration(this.activeGeneration, this.activeMarkers);
    this.nextActiveIndices.length = 0;
    for (let chunkY = minY; chunkY <= maxY; chunkY += 1) {
      for (let chunkX = minX; chunkX <= maxX; chunkX += 1) {
        const index = chunkY * this.columns + chunkX;
        this.activeMarkers[index] = this.activeGeneration;
        this.nextActiveIndices.push(index);
        if (!this.chunks.has(index)) this.createChunk(index, chunkX, chunkY);
      }
    }
    for (const index of this.activeIndices) {
      if (this.activeMarkers[index] !== this.activeGeneration) this.destroyChunk(index);
    }
    this.activeIndices.length = 0;
    for (const index of this.nextActiveIndices) this.activeIndices.push(index);
    return true;
  }

  render(): number {
    this.updateViewport();
    const changed = this.fog.getChangedIndices();
    if (changed.length === 0) {
      this.lastDirtyChunkCount = 0;
      return 0;
    }
    this.dirtyGeneration = nextGeneration(this.dirtyGeneration, this.dirtyMarkers);
    this.dirtyIndices.length = 0;
    for (const cellIndex of changed) {
      const cellX = cellIndex % this.fog.widthCells;
      const cellY = Math.floor(cellIndex / this.fog.widthCells);
      const chunkIndex = fogChunkIndexForCell(cellX, cellY, { chunkCells: this.chunkCells, columns: this.columns });
      if (this.activeMarkers[chunkIndex] !== this.activeGeneration || this.dirtyMarkers[chunkIndex] === this.dirtyGeneration) continue;
      this.dirtyMarkers[chunkIndex] = this.dirtyGeneration;
      this.dirtyIndices.push(chunkIndex);
    }
    for (const index of this.dirtyIndices) {
      const chunk = this.chunks.get(index);
      if (chunk) this.rasterizeChunk(chunk);
    }
    this.lastDirtyChunkCount = this.dirtyIndices.length;
    return changed.length;
  }

  metrics(): FogRenderMetrics {
    return { visibleChunks: this.activeIndices.length, dirtyChunks: this.lastDirtyChunkCount, chunkWidthCells: this.chunkCells, chunkHeightCells: this.chunkCells };
  }

  destroy(): void {
    for (const index of this.activeIndices) this.destroyChunk(index);
    this.activeIndices.length = 0;
    this.nextActiveIndices.length = 0;
    this.dirtyIndices.length = 0;
  }

  private createChunk(index: number, chunkX: number, chunkY: number): void {
    const startCellX = chunkX * this.chunkCells;
    const startCellY = chunkY * this.chunkCells;
    const widthCells = Math.min(this.chunkCells, this.fog.widthCells - startCellX);
    const heightCells = Math.min(this.chunkCells, this.fog.heightCells - startCellY);
    const textureKey = `fog-chunk-${this.scene.sys.settings.key}-${fogTextureCounter++}`;
    const texture = this.scene.textures.createCanvas(textureKey, widthCells, heightCells);
    if (!texture) throw new Error("Unable to create fog chunk texture");
    texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    const chunk: FogChunkView = {
      startCellX, startCellY, widthCells, heightCells, textureKey, texture,
      imageData: texture.context.createImageData(widthCells, heightCells),
      image: this.scene.add.image(startCellX * this.fog.cellSize, startCellY * this.fog.cellSize, textureKey)
        .setOrigin(0)
        .setDisplaySize(widthCells * this.fog.cellSize, heightCells * this.fog.cellSize)
        .setDepth(DEPTH.fog),
    };
    this.chunks.set(index, chunk);
    this.rasterizeChunk(chunk);
  }

  private destroyChunk(index: number): void {
    const chunk = this.chunks.get(index);
    if (!chunk) return;
    chunk.image.destroy();
    this.scene.textures.remove(chunk.textureKey);
    this.chunks.delete(index);
  }

  private rasterizeChunk(chunk: FogChunkView): void {
    for (let localY = 0; localY < chunk.heightCells; localY += 1) {
      for (let localX = 0; localX < chunk.widthCells; localX += 1) {
        const state = this.fog.getStateAtCell(chunk.startCellX + localX, chunk.startCellY + localY);
        const offset = (localY * chunk.widthCells + localX) * 4;
        const color = state === VisibilityState.Visible ? 0 : state === VisibilityState.Explored ? COLORS.exploredFog : COLORS.unknownFog;
        const alpha = state === VisibilityState.Visible ? 0 : state === VisibilityState.Explored ? 0.82 : 0.985;
        chunk.imageData.data[offset] = color >> 16 & 0xff;
        chunk.imageData.data[offset + 1] = color >> 8 & 0xff;
        chunk.imageData.data[offset + 2] = color & 0xff;
        chunk.imageData.data[offset + 3] = Math.round(alpha * 255);
      }
    }
    chunk.texture.context.putImageData(chunk.imageData, 0, 0);
    chunk.texture.refresh();
  }
}

function nextGeneration(value: number, markers: Uint32Array): number {
  if (value < 0xffff_fffe) return value + 1;
  markers.fill(0);
  return 1;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
