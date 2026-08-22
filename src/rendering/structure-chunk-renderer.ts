import Phaser from "phaser";
import { DEPTH, TILE_SIZE } from "../config/game-config";
import type { PlacedStructureState } from "../entities/placed-structure";
import type { EntityOutlineState, WorldEntityView } from "./entity-outline";
import { createStructureRenderModel, drawStructureRenderModel } from "./structure-render-model";

const CHUNK_TILES=16,CHUNK_SIZE=CHUNK_TILES*TILE_SIZE;
export interface StructureRuntimeView extends WorldEntityView { setAim?(angle:number):void;updateStatus?():void;refresh?():void;destroy():void }
export class StructureChunkRenderer{
  private readonly states=new Map<string,PlacedStructureState>();private readonly chunks=new Map<string,{graphics:Phaser.GameObjects.Graphics;ids:Set<string>}>();
  constructor(private readonly scene:Phaser.Scene){}
  add(state:PlacedStructureState):StructureRuntimeView{this.states.set(state.id,state);for(const key of keysFor(state)){let chunk=this.chunks.get(key);if(!chunk){chunk={graphics:this.scene.add.graphics().setDepth(DEPTH.propFront),ids:new Set()};this.chunks.set(key,chunk);}chunk.ids.add(state.id);this.redraw(key);}return new ChunkHandle(state.id,this);}
  refresh(id:string):void{const state=this.states.get(id);if(state)for(const key of keysFor(state))this.redraw(key);}
  remove(id:string):void{const state=this.states.get(id);if(!state)return;this.states.delete(id);for(const key of keysFor(state)){const chunk=this.chunks.get(key);chunk?.ids.delete(id);if(chunk?.ids.size===0){chunk.graphics.destroy();this.chunks.delete(key);}else this.redraw(key);}}
  destroy():void{for(const chunk of this.chunks.values())chunk.graphics.destroy();this.chunks.clear();this.states.clear();}
  private redraw(key:string):void{const chunk=this.chunks.get(key);if(!chunk)return;chunk.graphics.clear();for(const id of chunk.ids){const state=this.states.get(id);if(!state||state.placement.kind!=="segment")continue;const p=state.placement,ratio=state.health/state.maximumHealth;drawStructureRenderModel(chunk.graphics,createStructureRenderModel(state.kind,p));chunk.graphics.lineStyle(1,state.kind==="metal-wall"?0xa4b0b0:0xa77b4d,1).lineBetween(p.startX,p.startY-1,p.endX,p.endY-1);if(ratio<=.7){const x=(p.startX+p.endX)/2,y=(p.startY+p.endY)/2;chunk.graphics.fillStyle(ratio<=.35?0x171c19:0x40372c).fillRect(Math.round(x)-1,Math.round(y)-1,ratio<=.35?3:2,2);}}}
}
class ChunkHandle implements StructureRuntimeView{constructor(private readonly id:string,private readonly owner:StructureChunkRenderer){}setOutlineState(_state:EntityOutlineState):void{}setVisible(_visible:boolean):this{return this;}refresh():void{this.owner.refresh(this.id);}destroy():void{this.owner.remove(this.id);}}
function keysFor(state:PlacedStructureState):string[]{if(state.placement.kind!=="segment")return[];const p=state.placement;const minX=Math.floor(Math.min(p.startX,p.endX)/CHUNK_SIZE),maxX=Math.floor(Math.max(p.startX,p.endX)/CHUNK_SIZE),minY=Math.floor(Math.min(p.startY,p.endY)/CHUNK_SIZE),maxY=Math.floor(Math.max(p.startY,p.endY)/CHUNK_SIZE);const keys:string[]=[];for(let y=minY;y<=maxY;y+=1)for(let x=minX;x<=maxX;x+=1)keys.push(`${x},${y}`);return keys;}
