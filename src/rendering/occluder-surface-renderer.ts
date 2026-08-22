import Phaser from "phaser";
import { COLORS,DEPTH,TILE_SIZE } from "../config/game-config";
import type { MapDefinition } from "../data/map-definitions";
import type { PlacedStructureState } from "../entities/placed-structure";
import type { FogOfWarSystem,VisionSource } from "../systems/fog-of-war-system";
import { VisibilityState } from "../systems/fog-of-war-system";
import { collectVisibleOccluderKeys,VisionOccluderSpatialIndex,type VisionOccluderSurface } from "../systems/vision-occluder-surface";
import { BUILDABLE_DEFINITIONS } from "../data/buildable-definitions";

export class OccluderSurfaceRenderer{
  private readonly graphics:Phaser.GameObjects.Graphics;private readonly surfaces:VisionOccluderSurface[]=[];private readonly candidates:VisionOccluderSurface[]=[];private readonly visibleKeys=new Set<string>();private readonly sourcePoints:Array<{x:number;y:number}>=[];private readonly index=new VisionOccluderSpatialIndex(16*TILE_SIZE);private readonly obstacleByKey=new Map<string,MapDefinition["obstacles"][number]>();private structureRevision=-1;
  constructor(private readonly scene:Phaser.Scene,private readonly map:MapDefinition){this.graphics=scene.add.graphics().setDepth(DEPTH.fog+1);this.rebuildStatic();}
  render(fog:FogOfWarSystem,sources:readonly VisionSource[],structures:readonly PlacedStructureState[],structureRevision=0):void{
    if(this.structureRevision!==structureRevision){this.structureRevision=structureRevision;for(let index=this.surfaces.length-1;index>=0;index-=1)if(this.surfaces[index]!.key.startsWith("built:"))this.surfaces.splice(index,1);
    for(let index=0;index<this.map.doors.length;index+=1){const door=this.map.doors[index]!,surface=this.surfaces.find((candidate)=>candidate.key===`door:${door.id}`);if(surface)surface.active=!door.open&&!door.destroyed;}
    for(const state of structures){if(state.placement.kind!=="segment"||!BUILDABLE_DEFINITIONS[state.kind].blocksVision||(state.kind==="wood-door"&&state.doorOpen))continue;this.surfaces.push({key:`built:${state.id}`,segment:{...state.placement,thickness:BUILDABLE_DEFINITIONS[state.kind].segment!.thickness}});}this.rebuildIndex();}
    this.sourcePoints.length=0;for(const source of sources)this.sourcePoints.push(source);
    const view=this.scene.cameras.main.worldView,margin=16*TILE_SIZE;this.index.query(view.x-margin,view.y-margin,view.right+margin,view.bottom+margin,this.candidates);
    collectVisibleOccluderKeys(this.candidates,this.sourcePoints,(x,y)=>fog.getStateAtWorld(x,y)===VisibilityState.Visible,this.visibleKeys);this.graphics.clear();
    for(const surface of this.candidates){if(!this.visibleKeys.has(surface.key))continue;const obstacle=this.obstacleByKey.get(surface.key);if(obstacle){const x=obstacle.tileX*TILE_SIZE,y=obstacle.tileY*TILE_SIZE;this.graphics.fillStyle(COLORS.wall,1).fillRect(x,y,obstacle.widthTiles*TILE_SIZE,obstacle.heightTiles*TILE_SIZE).fillStyle(COLORS.wallTop,1).fillRect(x,y,obstacle.widthTiles*TILE_SIZE,5);continue;}const p=surface.segment;this.graphics.lineStyle(p.thickness+2,0x252b29,1).lineBetween(p.startX,p.startY,p.endX,p.endY).lineStyle(p.thickness,surface.key.startsWith("door:")?0x8c643d:COLORS.wall,1).lineBetween(p.startX,p.startY,p.endX,p.endY);}
  }
  destroy():void{this.graphics.destroy();this.surfaces.length=0;this.visibleKeys.clear();}
  private rebuildStatic():void{
    for(const obstacle of this.map.obstacles){if(obstacle.kind!=="wall"||!obstacle.blocksVision)continue;const x=obstacle.tileX*TILE_SIZE,y=obstacle.tileY*TILE_SIZE,w=obstacle.widthTiles*TILE_SIZE,h=obstacle.heightTiles*TILE_SIZE,key=`tile:${obstacle.id}`;this.surfaces.push({key,segment:{startX:x,startY:y,endX:x+w,endY:y,thickness:h}});this.obstacleByKey.set(key,obstacle);}
    this.map.wallSegments.forEach((segment,index)=>this.surfaces.push({key:`wall:${index}`,segment}));for(const door of this.map.doors)if(door.segment)this.surfaces.push({key:`door:${door.id}`,segment:door.segment,active:!door.open&&!door.destroyed});this.rebuildIndex();
  }
  private rebuildIndex():void{this.index.clear();for(const surface of this.surfaces)this.index.add(surface);}
}
