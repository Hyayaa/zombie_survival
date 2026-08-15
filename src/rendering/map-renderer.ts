import Phaser from "phaser";
import { COLORS, DEPTH, MAP_TILES, TILE_SIZE } from "../config/game-config";
import type { MapDefinition } from "../data/map-definitions";

export interface MapViews {
  doorViews: Map<string, Phaser.GameObjects.Rectangle>;
  containerViews: Map<string, Phaser.GameObjects.Container>;
  extractionView: Phaser.GameObjects.Graphics;
  survivorMarker: Phaser.GameObjects.Graphics;
}

export function createMapRendering(scene: Phaser.Scene, map: MapDefinition): MapViews {
  const ground = scene.add.graphics().setDepth(DEPTH.ground);

  for (let y = 0; y < MAP_TILES; y += 1) {
    for (let x = 0; x < MAP_TILES; x += 1) {
      const tileKey = `${x},${y}`;
      const color = map.roadTiles.has(tileKey)
        ? COLORS.road
        : map.floorTiles.has(tileKey)
          ? ((x + y) % 2 === 0 ? COLORS.floor : COLORS.floorAlt)
          : ((x + y) % 3 === 0 ? COLORS.groundAlt : COLORS.ground);
      ground.fillStyle(color, 1).fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      if (map.roadTiles.has(tileKey) && y === 17 && x % 3 !== 0) {
        ground.fillStyle(COLORS.roadLine, 0.75).fillRect(x * TILE_SIZE + 5, y * TILE_SIZE + 11, 14, 2);
      }
    }
  }

  for (const obstacle of map.obstacles) {
    const x = obstacle.tileX * TILE_SIZE;
    const y = obstacle.tileY * TILE_SIZE;
    const width = obstacle.widthTiles * TILE_SIZE;
    const height = obstacle.heightTiles * TILE_SIZE;
    const layer = scene.add.graphics().setDepth(
      obstacle.coverHeight === "low"
        ? DEPTH.propBack + Math.round(y + height)
        : DEPTH.actor + Math.round(y + height),
    );
    if (obstacle.kind === "wall") {
      layer.fillStyle(COLORS.wall, 1).fillRect(x, y, width, height);
      layer.fillStyle(COLORS.wallTop, 1).fillRect(x, y, width, 5);
      layer.fillStyle(0x343936, 1).fillRect(x, y + height - 4, width, 4);
    } else if (obstacle.kind === "vehicle") {
      layer.fillStyle(COLORS.metal, 1).fillRoundedRect(x + 2, y + 4, width - 4, height - 8, 3);
      layer.fillStyle(0x202526, 1).fillRect(x + 7, y + 6, Math.max(5, width - 14), height - 12);
      layer.fillStyle(0x181b1c, 1).fillRect(x + 3, y + 2, 5, 3).fillRect(x + width - 8, y + 2, 5, 3);
    } else {
      layer.fillStyle(COLORS.lowProp, 1).fillRect(x + 2, y + 5, width - 4, height - 7);
      layer.fillStyle(0x756653, 1).fillRect(x + 2, y + 5, width - 4, 3);
    }
  }

  const doorViews = new Map<string, Phaser.GameObjects.Rectangle>();
  for (const door of map.doors) {
    const view = scene.add.rectangle(
      door.tileX * TILE_SIZE + TILE_SIZE / 2,
      door.tileY * TILE_SIZE + TILE_SIZE / 2,
      TILE_SIZE - 4,
      door.open ? 4 : TILE_SIZE - 4,
      door.open ? 0x806848 : 0x604a34,
    ).setDepth(DEPTH.actor + (door.tileY + 1) * TILE_SIZE);
    view.setStrokeStyle(2, 0x2a211a);
    doorViews.set(door.id, view);
  }

  const containerViews = new Map<string, Phaser.GameObjects.Container>();
  for (const container of map.containers) {
    const x = container.tileX * TILE_SIZE + TILE_SIZE / 2;
    const y = container.tileY * TILE_SIZE + TILE_SIZE / 2;
    const base = scene.add.rectangle(0, 1, 12, 9, container.kind === "corpse" ? 0x4d403d : 0x765d3e).setStrokeStyle(1, 0x211b16);
    const lid = scene.add.rectangle(0, -3, 13, 3, container.kind === "vehicle" ? 0x667073 : 0x9a7c50);
    const view = scene.add.container(x, y, [base, lid]).setDepth(DEPTH.item + y);
    containerViews.set(container.id, view);
  }

  const extractionView = scene.add.graphics().setDepth(DEPTH.item);
  extractionView.lineStyle(3, COLORS.extraction, 0.9).strokeCircle(map.extractionZone.x, map.extractionZone.y, map.extractionZone.radius);
  extractionView.fillStyle(COLORS.extraction, 0.15).fillCircle(map.extractionZone.x, map.extractionZone.y, map.extractionZone.radius);

  const survivorMarker = scene.add.graphics().setDepth(DEPTH.actor - 1);
  survivorMarker.lineStyle(1, 0xd0b86d, 0.8).strokeCircle(map.survivorSpawn.x, map.survivorSpawn.y, 12);

  return { doorViews, containerViews, extractionView, survivorMarker };
}

export function updateDoorView(view: Phaser.GameObjects.Rectangle, open: boolean): void {
  view.setSize(TILE_SIZE - 4, open ? 4 : TILE_SIZE - 4);
  view.setDisplaySize(TILE_SIZE - 4, open ? 4 : TILE_SIZE - 4);
  view.setFillStyle(open ? 0x806848 : 0x604a34);
}
