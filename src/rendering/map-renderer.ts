import Phaser from "phaser";
import { COLORS, DEPTH, ENTITY_OUTLINE, TILE_SIZE } from "../config/game-config";
import { getTerrain, TerrainType, type DoorDefinition, type MapDefinition, type WorldObstacle } from "../data/map-definitions";
import { EntityOutlineController, type EntityOutlineState, type OutlineableEntityView } from "./entity-outline";
import { DoorView } from "./obstacle-views";

export class ContainerView implements OutlineableEntityView {
  private readonly outline: EntityOutlineController;
  constructor(readonly container: Phaser.GameObjects.Container, outlines: readonly Phaser.GameObjects.Rectangle[]) {
    this.outline = new EntityOutlineController((color) => { for (const shape of outlines) shape.setStrokeStyle(1, color, 1); });
  }
  setOutlineState(state: EntityOutlineState): void {
    this.outline.setState(state);
  }
  setVisible(visible: boolean): this { this.container.setVisible(visible); return this; }
  setAlpha(alpha: number): this { this.container.setAlpha(alpha); return this; }
  destroy(): void { this.container.destroy(true); }
}

export class ExtractionView implements OutlineableEntityView {
  private readonly outline: EntityOutlineController;
  private outlineColor: number = ENTITY_OUTLINE.normal;
  constructor(readonly graphics: Phaser.GameObjects.Graphics, private readonly x: number, private readonly y: number, private readonly radius: number) {
    this.outline = new EntityOutlineController((color) => { this.outlineColor = color; this.redraw(); }); this.redraw();
  }
  setOutlineState(state: EntityOutlineState): void { this.outline.setState(state); }
  setVisible(visible: boolean): void { this.graphics.setVisible(visible); }
  destroy(): void { this.graphics.destroy(); }
  private redraw(): void {
    this.graphics.clear();
    this.graphics.lineStyle(1, this.outlineColor, 1).strokeCircle(this.x, this.y, this.radius + 2);
    this.graphics.lineStyle(3, COLORS.extraction, 0.9).strokeCircle(this.x, this.y, this.radius);
    this.graphics.fillStyle(COLORS.extraction, 0.15).fillCircle(this.x, this.y, this.radius);
  }
}

export interface MapViews {
  doorViews: Map<string, DoorView>;
  containerViews: Map<string, ContainerView>;
  extractionView: ExtractionView;
  survivorMarkers: Map<string, Phaser.GameObjects.Graphics>;
  staticChunkCount: number;
}

const CHUNK_TILES = 16;

export function createMapRendering(scene: Phaser.Scene, map: MapDefinition): MapViews {
  const obstacleGrid: Array<WorldObstacle | undefined> = new Array(map.widthTiles * map.heightTiles);
  for (const obstacle of map.obstacles) {
    for (let y = obstacle.tileY; y < obstacle.tileY + obstacle.heightTiles; y += 1) {
      for (let x = obstacle.tileX; x < obstacle.tileX + obstacle.widthTiles; x += 1) {
        if (x >= 0 && y >= 0 && x < map.widthTiles && y < map.heightTiles) obstacleGrid[y * map.widthTiles + x] = obstacle;
      }
    }
  }
  const floorColors = new Uint32Array(map.widthTiles * map.heightTiles);
  for (const building of map.buildings) for (const index of building.floorTiles) floorColors[index] = building.floorColor;

  let staticChunkCount = 0;
  for (let chunkY = 0; chunkY < map.heightTiles; chunkY += CHUNK_TILES) {
    for (let chunkX = 0; chunkX < map.widthTiles; chunkX += CHUNK_TILES) {
      const ground = scene.add.graphics().setDepth(DEPTH.ground);
      const props = scene.add.graphics().setDepth(DEPTH.propBack + chunkY * TILE_SIZE);
      staticChunkCount += 2;
      const maxY = Math.min(map.heightTiles, chunkY + CHUNK_TILES);
      const maxX = Math.min(map.widthTiles, chunkX + CHUNK_TILES);
      for (let y = chunkY; y < maxY; y += 1) {
        for (let x = chunkX; x < maxX; x += 1) {
          const terrain = getTerrain(map, x, y);
          const index = y * map.widthTiles + x;
          const color = terrain === TerrainType.Road ? COLORS.road
            : terrain === TerrainType.Sidewalk ? 0x3c4240
              : terrain === TerrainType.Floor ? (floorColors[index] || ((x + y) % 2 === 0 ? COLORS.floor : COLORS.floorAlt))
                : ((x + y) % 3 === 0 ? COLORS.groundAlt : COLORS.ground);
          const worldX = x * TILE_SIZE;
          const worldY = y * TILE_SIZE;
          ground.fillStyle(color, 1).fillRect(worldX, worldY, TILE_SIZE, TILE_SIZE);
          const obstacle = obstacleGrid[index];
          if (!obstacle) continue;
          if (obstacle.kind === "wall") {
            props.fillStyle(COLORS.wall, 1).fillRect(worldX, worldY, TILE_SIZE, TILE_SIZE);
            props.fillStyle(COLORS.wallTop, 1).fillRect(worldX, worldY, TILE_SIZE, 5);
            props.fillStyle(0x343936, 1).fillRect(worldX, worldY + TILE_SIZE - 4, TILE_SIZE, 4);
          } else if (obstacle.kind === "vehicle" && obstacle.tileX === x && obstacle.tileY === y) {
            const width = obstacle.widthTiles * TILE_SIZE;
            const height = obstacle.heightTiles * TILE_SIZE;
            props.fillStyle(COLORS.metal, 1).fillRoundedRect(worldX + 2, worldY + 4, width - 4, height - 8, 3);
            props.fillStyle(0x202526, 1).fillRect(worldX + 7, worldY + 6, Math.max(5, width - 14), height - 12);
            props.fillStyle(0x181b1c, 1).fillRect(worldX + 3, worldY + 2, 5, 3).fillRect(worldX + width - 8, worldY + 2, 5, 3);
          } else if (obstacle.kind !== "vehicle") {
            props.fillStyle(COLORS.lowProp, 1).fillRect(worldX + 2, worldY + 5, TILE_SIZE - 4, TILE_SIZE - 7);
          }
        }
      }
    }
  }

  const laneMarkings = scene.add.graphics().setDepth(DEPTH.ground + 1);
  laneMarkings.fillStyle(COLORS.roadLine, 0.78);
  for (const road of map.roadSegments) {
    if (!road.laneMarking) continue;
    const startX = (road.startX + 0.5) * TILE_SIZE;
    const startY = (road.startY + 0.5) * TILE_SIZE;
    const deltaX = (road.endX - road.startX) * TILE_SIZE;
    const deltaY = (road.endY - road.startY) * TILE_SIZE;
    const length = Math.hypot(deltaX, deltaY);
    const steps = Math.floor(length / 13);
    for (let step = 0; step <= steps; step += 2) {
      const amount = steps === 0 ? 0 : step / steps;
      const x = Math.round(startX + deltaX * amount);
      const y = Math.round(startY + deltaY * amount);
      if (Math.abs(deltaX) > Math.abs(deltaY) * 2) laneMarkings.fillRect(x - 5, y - 1, 10, 2);
      else if (Math.abs(deltaY) > Math.abs(deltaX) * 2) laneMarkings.fillRect(x - 1, y - 5, 2, 10);
      else laneMarkings.fillRect(x - 2, y - 2, 4, 4);
    }
  }

  const doorViews = new Map<string, DoorView>();
  for (const door of map.doors) {
    const doorView = new DoorView(scene, door);
    updateDoorView(doorView, door.open, door.orientation);
    doorViews.set(door.id, doorView);
  }

  const containerViews = new Map<string, ContainerView>();
  for (const container of map.containers) {
    const x = container.tileX * TILE_SIZE + TILE_SIZE / 2;
    const y = container.tileY * TILE_SIZE + TILE_SIZE / 2;
    const base = scene.add.rectangle(0, 1, 12, 9, container.kind === "corpse" ? 0x4d403d : 0x765d3e).setStrokeStyle(1, ENTITY_OUTLINE.normal);
    const lid = scene.add.rectangle(0, -3, 13, 3, container.kind === "vehicle" ? 0x667073 : 0x9a7c50).setStrokeStyle(1, ENTITY_OUTLINE.normal);
    containerViews.set(container.id, new ContainerView(scene.add.container(x, y, [base, lid]).setDepth(DEPTH.item + y), [base, lid]));
  }

  const extractionView = new ExtractionView(scene.add.graphics().setDepth(DEPTH.item), map.extractionZone.x, map.extractionZone.y, map.extractionZone.radius);
  const survivorMarkers = new Map<string, Phaser.GameObjects.Graphics>();
  for (const spawn of map.companionSpawns) {
    const x = spawn.tileX * TILE_SIZE + TILE_SIZE / 2;
    const y = spawn.tileY * TILE_SIZE + TILE_SIZE / 2;
    const marker = scene.add.graphics().setDepth(DEPTH.actor - 1);
    marker.lineStyle(1, 0xd0b86d, 0.8).strokeCircle(x, y, 12);
    survivorMarkers.set(spawn.id, marker);
  }
  return { doorViews, containerViews, extractionView, survivorMarkers, staticChunkCount };
}

export function updateDoorView(view: DoorView, open: boolean, orientation: DoorDefinition["orientation"] = "horizontal", destroyed = false): void {
  view.setDoorState(open, destroyed, orientation);
}
