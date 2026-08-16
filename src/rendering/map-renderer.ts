import Phaser from "phaser";
import { COLORS, DEPTH, TILE_SIZE } from "../config/game-config";
import { getTerrain, TerrainType, type DoorDefinition, type MapDefinition, type WorldObstacle } from "../data/map-definitions";

export interface MapViews {
  doorViews: Map<string, Phaser.GameObjects.Rectangle>;
  containerViews: Map<string, Phaser.GameObjects.Container>;
  extractionView: Phaser.GameObjects.Graphics;
  survivorMarker: Phaser.GameObjects.Graphics;
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

  const doorViews = new Map<string, Phaser.GameObjects.Rectangle>();
  for (const door of map.doors) {
    const view = scene.add.rectangle(
      door.tileX * TILE_SIZE + TILE_SIZE / 2,
      door.tileY * TILE_SIZE + TILE_SIZE / 2,
      TILE_SIZE - 5,
      5,
      door.open ? 0x806848 : 0x604a34,
    ).setDepth(DEPTH.actor + (door.tileY + 1) * TILE_SIZE);
    view.setStrokeStyle(1, 0x2a211a);
    updateDoorView(view, door.open, door.orientation);
    doorViews.set(door.id, view);
  }

  const containerViews = new Map<string, Phaser.GameObjects.Container>();
  for (const container of map.containers) {
    const x = container.tileX * TILE_SIZE + TILE_SIZE / 2;
    const y = container.tileY * TILE_SIZE + TILE_SIZE / 2;
    const base = scene.add.rectangle(0, 1, 12, 9, container.kind === "corpse" ? 0x4d403d : 0x765d3e).setStrokeStyle(1, 0x211b16);
    const lid = scene.add.rectangle(0, -3, 13, 3, container.kind === "vehicle" ? 0x667073 : 0x9a7c50);
    containerViews.set(container.id, scene.add.container(x, y, [base, lid]).setDepth(DEPTH.item + y));
  }

  const extractionView = scene.add.graphics().setDepth(DEPTH.item);
  extractionView.lineStyle(3, COLORS.extraction, 0.9).strokeCircle(map.extractionZone.x, map.extractionZone.y, map.extractionZone.radius);
  extractionView.fillStyle(COLORS.extraction, 0.15).fillCircle(map.extractionZone.x, map.extractionZone.y, map.extractionZone.radius);
  const survivorMarker = scene.add.graphics().setDepth(DEPTH.actor - 1);
  survivorMarker.lineStyle(1, 0xd0b86d, 0.8).strokeCircle(map.survivorSpawn.x, map.survivorSpawn.y, 12);
  return { doorViews, containerViews, extractionView, survivorMarker, staticChunkCount };
}

export function updateDoorView(view: Phaser.GameObjects.Rectangle, open: boolean, orientation: DoorDefinition["orientation"] = "horizontal"): void {
  const baseAngle = orientation === "vertical" ? 90 : orientation === "diagonal-down" ? 45 : orientation === "diagonal-up" ? -45 : 0;
  view.setRotation((baseAngle + (open ? 90 : 0)) * Math.PI / 180);
  view.setSize(TILE_SIZE - 5, 5);
  view.setDisplaySize(TILE_SIZE - 5, 5);
  view.setFillStyle(open ? 0x806848 : 0x604a34);
}
