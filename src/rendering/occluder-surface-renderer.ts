import Phaser from "phaser";
import { COLORS,DEPTH,TILE_SIZE } from "../config/game-config";
import type { MapDefinition } from "../data/map-definitions";
import type { PlacedStructureState } from "../entities/placed-structure";
import type { FogOfWarSystem,VisionSource } from "../systems/fog-of-war-system";
import { VisibilityState } from "../systems/fog-of-war-system";
import { collectVisibleOccluderKeys,type VisionOccluderSurface } from "../systems/vision-occluder-surface";
import { BUILDABLE_DEFINITIONS } from "../data/buildable-definitions";

export class OccluderSurfaceRenderer{
  private readonly graphics:Phaser.GameObjects.Graphics;private readonly surfaces:VisionOccluderSurface[]=[];private readonly visibleKeys=new Set<string>();private readonly sourcePoints:Array<{x:number;y:number}>=[];private structureRevision=-1;
  constructor(scene:Phaser.Scene,private readonly map:MapDefinition){this.graphics=scene.add.graphics().setDepth(DEPTH.fog+1);this.rebuildStatic();}
  render(fog:FogOfWarSystem,sources:readonly VisionSource[],structures:readonly PlacedStructureState[],structureRevision=0):void{
    if(this.structureRevision!==structureRevision){this.structureRevision=structureRevision;for(let index=this.surfaces.length-1;index>=0;index-=1)if(this.surfaces[index]!.key.startsWith("built:"))this.surfaces.splice(index,1);
    for(const surface of this.surfaces)if(surface.key.startsWith("door:")){const door=this.map.doors.find((candidate)=>`door:${candidate.id}`===surface.key);surface.active=Boolean(door&&!door.open&&!door.destroyed);}
    for(const state of structures){if(state.placement.kind!=="segment"||!BUILDABLE_DEFINITIONS[state.kind].blocksVision||(state.kind==="wood-door"&&state.doorOpen))continue;this.surfaces.push({key:`built:${state.id}`,segment:{...state.placement,thickness:BUILDABLE_DEFINITIONS[state.kind].segment!.thickness}});}}
    this.sourcePoints.length=0;for(const source of sources)this.sourcePoints.push(source);
    collectVisibleOccluderKeys(this.surfaces,this.sourcePoints,(x,y)=>fog.getStateAtWorld(x,y)===VisibilityState.Visible,this.visibleKeys);this.graphics.clear();
    for(const obstacle of this.map.obstacles){if(obstacle.kind!=="wall"||!this.visibleKeys.has(`tile:${obstacle.id}`))continue;const x=obstacle.tileX*TILE_SIZE,y=obstacle.tileY*TILE_SIZE;this.graphics.fillStyle(COLORS.wall,1).fillRect(x,y,obstacle.widthTiles*TILE_SIZE,obstacle.heightTiles*TILE_SIZE).fillStyle(COLORS.wallTop,1).fillRect(x,y,obstacle.widthTiles*TILE_SIZE,5);}
    for(const surface of this.surfaces){if(surface.key.startsWith("tile:")||!this.visibleKeys.has(surface.key))continue;const p=surface.segment;this.graphics.lineStyle(p.thickness+2,0x252b29,1).lineBetween(p.startX,p.startY,p.endX,p.endY).lineStyle(p.thickness,surface.key.startsWith("door:")?0x8c643d:COLORS.wall,1).lineBetween(p.startX,p.startY,p.endX,p.endY);}
  }
  destroy():void{this.graphics.destroy();this.surfaces.length=0;this.visibleKeys.clear();}
  private rebuildStatic():void{
    for(const obstacle of this.map.obstacles){if(obstacle.kind!=="wall"||!obstacle.blocksVision)continue;const x=obstacle.tileX*TILE_SIZE,y=obstacle.tileY*TILE_SIZE,w=obstacle.widthTiles*TILE_SIZE,h=obstacle.heightTiles*TILE_SIZE;this.surfaces.push({key:`tile:${obstacle.id}`,segment:{startX:x,startY:y,endX:x+w,endY:y,thickness:h}});}
    this.map.wallSegments.forEach((segment,index)=>this.surfaces.push({key:`wall:${index}`,segment}));for(const door of this.map.doors)if(door.segment)this.surfaces.push({key:`door:${door.id}`,segment:door.segment,active:!door.open&&!door.destroyed});
  }
}
