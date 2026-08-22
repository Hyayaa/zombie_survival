import Phaser from "phaser";
import { COLORS, DEPTH, ENTITY_OUTLINE, TILE_SIZE } from "../config/game-config";
import { getTerrain, TerrainType, type DoorDefinition, type MapDefinition, type WorldObstacle } from "../data/map-definitions";
import { EntityOutlineController, type EntityOutlineState, type OutlineableEntityView } from "./entity-outline";
import { DoorView } from "./obstacle-views";
import { createStructureRenderModel,drawStructureRenderModel } from "./structure-render-model";
import { collectVisibleChunkIndices, getCameraChunkKey, type WorldViewRect } from "./world-chunk-visibility";

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
  updateStaticChunks(worldView: WorldViewRect): boolean;
  getStaticChunkMetrics(): StaticChunkMetrics;
}

export interface StaticChunkMetrics {
  visibleChunks: number;
  renderedChunks: number;
  terrainChunks: number;
  structureChunks: number;
  decorationChunks: number;
}

const CHUNK_TILES = 16;

export function createMapRendering(scene: Phaser.Scene, map: MapDefinition): MapViews {
  const staticChunks = new StaticWorldChunkController(map.widthTiles, map.heightTiles);
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
  const roadRenderByIndex=new Map<number,NonNullable<MapDefinition["roadRenderData"]>["tiles"][number]>();
  for(const tile of map.roadRenderData?.tiles??[])roadRenderByIndex.set(tile.tileY*map.widthTiles+tile.tileX,tile);

  let staticChunkCount = 0;
  for (let chunkY = 0; chunkY < map.heightTiles; chunkY += CHUNK_TILES) {
    for (let chunkX = 0; chunkX < map.widthTiles; chunkX += CHUNK_TILES) {
      const ground = scene.add.graphics().setDepth(DEPTH.ground);
      let props: Phaser.GameObjects.Graphics | undefined;
      staticChunks.add(chunkX / CHUNK_TILES, chunkY / CHUNK_TILES, ground, "terrain");
      staticChunkCount += 1;
      const maxY = Math.min(map.heightTiles, chunkY + CHUNK_TILES);
      const maxX = Math.min(map.widthTiles, chunkX + CHUNK_TILES);
      for (let y = chunkY; y < maxY; y += 1) {
        for (let x = chunkX; x < maxX; x += 1) {
          const terrain = getTerrain(map, x, y);
          const index = y * map.widthTiles + x;
          const roadRender=roadRenderByIndex.get(index);
          const baseTerrain=(roadRender?.underlayTerrain??terrain) as TerrainType;
          const color = terrainColor(roadRender?baseTerrain:terrain,x,y,floorColors[index]);
          const worldX = x * TILE_SIZE;
          const worldY = y * TILE_SIZE;
          ground.fillStyle(color, 1).fillRect(worldX, worldY, TILE_SIZE, TILE_SIZE);
          if(roadRender){
            drawPixelMask(ground,roadRender.sidewalkRows,worldX,worldY,0x3c4240);
            drawPixelMask(ground,roadRender.roadRows,worldX,worldY,COLORS.road);
            drawPixelMask(ground,roadRender.bridgeRows,worldX,worldY,0x4b4a45);
            drawPixelMask(ground,roadRender.centerlineRows,worldX,worldY,COLORS.roadLine,.82);
          }
          const obstacle = obstacleGrid[index];
          if (!obstacle || obstacle.kind === "water") continue;
          if (!props) {
            props = scene.add.graphics().setDepth(DEPTH.propBack + chunkY * TILE_SIZE);
            staticChunks.add(chunkX / CHUNK_TILES, chunkY / CHUNK_TILES, props, "decoration");
            staticChunkCount += 1;
          }
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

  const generatedWalls=map.generatedStructures.filter((structure)=>structure.buildableId==="wood-wall");
  if(generatedWalls.length>0){const chunks=new Map<string,Phaser.GameObjects.Graphics>();for(const structure of generatedWalls){const segment=structure.placement,midX=(segment.startX+segment.endX)/2,midY=(segment.startY+segment.endY)/2,chunkX=Math.floor(midX/(CHUNK_TILES*TILE_SIZE)),chunkY=Math.floor(midY/(CHUNK_TILES*TILE_SIZE)),key=`${chunkX},${chunkY}`;let graphics=chunks.get(key);if(!graphics){graphics=scene.add.graphics().setDepth(DEPTH.propBack);chunks.set(key,graphics);staticChunks.add(chunkX,chunkY,graphics,"structure");staticChunkCount+=1;}drawStructureRenderModel(graphics,createStructureRenderModel("wood-wall",{kind:"segment",...segment}));}}
  else if (map.wallSegments.length > 0) {
    const diagonalWalls = scene.add.graphics().setDepth(DEPTH.propBack);
    staticChunkCount += 1;
    for (const segment of map.wallSegments) {
      const deltaX = segment.endX - segment.startX;
      const deltaY = segment.endY - segment.startY;
      const length = Math.hypot(deltaX, deltaY) || 1;
      const normalX = -deltaY / length;
      const normalY = deltaX / length;
      diagonalWalls.lineStyle(segment.thickness, COLORS.wall, 1)
        .beginPath().moveTo(segment.startX, segment.startY).lineTo(segment.endX, segment.endY).strokePath();
      diagonalWalls.lineStyle(2, COLORS.wallTop, 1)
        .beginPath().moveTo(segment.startX - normalX * 2, segment.startY - normalY * 2)
        .lineTo(segment.endX - normalX * 2, segment.endY - normalY * 2).strokePath();
      diagonalWalls.lineStyle(2, 0x343936, 1)
        .beginPath().moveTo(segment.startX + normalX * 2, segment.startY + normalY * 2)
        .lineTo(segment.endX + normalX * 2, segment.endY + normalY * 2).strokePath();
    }
  }

  if(!map.roadRenderData){
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
        const markX = Math.round(startX + deltaX * amount);
        const markY = Math.round(startY + deltaY * amount);
        if (Math.abs(deltaX) > Math.abs(deltaY) * 2) laneMarkings.fillRect(markX - 5, markY - 1, 10, 2);
        else if (Math.abs(deltaY) > Math.abs(deltaX) * 2) laneMarkings.fillRect(markX - 1, markY - 5, 2, 10);
        else laneMarkings.fillRect(markX - 2, markY - 2, 4, 4);
      }
    }
  }

  if(map.districtProps?.length){
    const chunks=new Map<string,Phaser.GameObjects.Graphics>();
    for(const prop of map.districtProps){if(prop.placement==="interactive-furniture")continue;const chunkX=Math.floor(prop.tileX/CHUNK_TILES),chunkY=Math.floor(prop.tileY/CHUNK_TILES),key=`${chunkX},${chunkY}`;let graphics=chunks.get(key);if(!graphics){graphics=scene.add.graphics().setDepth(DEPTH.propBack+prop.tileY*TILE_SIZE);chunks.set(key,graphics);staticChunks.add(chunkX,chunkY,graphics,"decoration");staticChunkCount+=1;}const x=prop.tileX*TILE_SIZE,y=prop.tileY*TILE_SIZE,color=prop.district==="military"?0x68735f:prop.district==="industrial"?0x766b59:prop.district==="commercial"?0x755f76:0x68716a;graphics.fillStyle(0x222827,1).fillRect(x+8,y+14,8,5);graphics.fillStyle(color,1).fillRect(x+6,y+7,12,9);}
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
  return {
    doorViews, containerViews, extractionView, survivorMarkers, staticChunkCount,
    updateStaticChunks: (worldView) => staticChunks.update(worldView),
    getStaticChunkMetrics: () => staticChunks.metrics(),
  };
}

type StaticChunkLayer = "terrain" | "structure" | "decoration";
interface StaticChunkEntry { terrain: Phaser.GameObjects.Graphics[]; structure: Phaser.GameObjects.Graphics[]; decoration: Phaser.GameObjects.Graphics[] }

class StaticWorldChunkController {
  private readonly columns: number;
  private readonly rows: number;
  private readonly entries: Array<StaticChunkEntry | undefined>;
  private readonly visibleIndices: number[] = [];
  private readonly nextVisibleIndices: number[] = [];
  private lastCameraChunkKey = Number.NaN;
  private renderedChunks = 0;
  private terrainChunks = 0;
  private structureChunks = 0;
  private decorationChunks = 0;

  constructor(private readonly widthTiles: number, private readonly heightTiles: number) {
    this.columns = Math.ceil(widthTiles / CHUNK_TILES);
    this.rows = Math.ceil(heightTiles / CHUNK_TILES);
    this.entries = new Array(this.columns * this.rows);
  }

  add(chunkX: number, chunkY: number, graphics: Phaser.GameObjects.Graphics, layer: StaticChunkLayer): void {
    if (chunkX < 0 || chunkY < 0 || chunkX >= this.columns || chunkY >= this.rows) return;
    const index = chunkY * this.columns + chunkX;
    const entry = this.entries[index] ?? { terrain: [], structure: [], decoration: [] };
    this.entries[index] = entry;
    entry[layer].push(graphics.setVisible(false));
  }

  update(worldView: WorldViewRect): boolean {
    const cameraChunkKey = getCameraChunkKey(worldView, CHUNK_TILES, TILE_SIZE);
    if (cameraChunkKey === this.lastCameraChunkKey) return false;
    this.lastCameraChunkKey = cameraChunkKey;
    for (const index of this.visibleIndices) this.setEntryVisible(index, false);
    collectVisibleChunkIndices(worldView, {
      worldWidthTiles: this.widthTiles, worldHeightTiles: this.heightTiles,
      chunkTiles: CHUNK_TILES, tileSize: TILE_SIZE, marginChunks: 1,
    }, this.nextVisibleIndices);
    this.renderedChunks = 0;
    this.terrainChunks = 0;
    this.structureChunks = 0;
    this.decorationChunks = 0;
    for (const index of this.nextVisibleIndices) this.setEntryVisible(index, true);
    const swap = this.visibleIndices;
    this.visibleIndices.length = 0;
    this.visibleIndices.push(...this.nextVisibleIndices);
    this.nextVisibleIndices.length = 0;
    void swap;
    return true;
  }

  metrics(): StaticChunkMetrics {
    return { visibleChunks: this.visibleIndices.length, renderedChunks: this.renderedChunks, terrainChunks: this.terrainChunks, structureChunks: this.structureChunks, decorationChunks: this.decorationChunks };
  }

  private setEntryVisible(index: number, visible: boolean): void {
    const entry = this.entries[index];
    if (!entry) return;
    for (const graphics of entry.terrain) graphics.setVisible(visible);
    for (const graphics of entry.structure) graphics.setVisible(visible);
    for (const graphics of entry.decoration) graphics.setVisible(visible);
    if (!visible) return;
    this.terrainChunks += entry.terrain.length;
    this.structureChunks += entry.structure.length;
    this.decorationChunks += entry.decoration.length;
    this.renderedChunks += entry.terrain.length + entry.structure.length + entry.decoration.length;
  }
}

function terrainColor(terrain:TerrainType,x:number,y:number,floorColor:number):number{return terrain===TerrainType.Water?0x173747:terrain===TerrainType.RiverBank?0x59604b:terrain===TerrainType.BridgeRoad?0x4b4a45:terrain===TerrainType.Road?COLORS.road:terrain===TerrainType.Sidewalk?0x3c4240:terrain===TerrainType.Floor?(floorColor||((x+y)%2===0?COLORS.floor:COLORS.floorAlt)):((x+y)%3===0?COLORS.groundAlt:COLORS.ground);}
function drawPixelMask(graphics:Phaser.GameObjects.Graphics,rows:Uint32Array,worldX:number,worldY:number,color:number,alpha=1):void{graphics.fillStyle(color,alpha);for(let row=0;row<rows.length;row+=1){let bits=rows[row]!;let column=0;while(column<TILE_SIZE){while(column<TILE_SIZE&&(bits&(1<<column))===0)column+=1;if(column>=TILE_SIZE)break;const start=column;while(column<TILE_SIZE&&(bits&(1<<column))!==0)column+=1;graphics.fillRect(worldX+start,worldY+row,column-start,1);}}}

export function updateDoorView(view: DoorView, open: boolean, orientation: DoorDefinition["orientation"] = "horizontal", destroyed = false): void {
  view.setDoorState(open, destroyed, orientation);
}
