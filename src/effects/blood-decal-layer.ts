import Phaser from "phaser";
import { DEPTH } from "../config/game-config";
export interface BloodDecal{x:number;y:number;radius:number;color:number;createdAt:number}
export const MAX_BLOOD_DECALS=400;
export class BloodDecalStore{private readonly decals:BloodDecal[]=[];
  add(x:number,y:number,radius:number,createdAt:number):{decal:BloodDecal;redraw:boolean}{for(let index=Math.max(0,this.decals.length-12);index<this.decals.length;index++){const prior=this.decals[index]!;if(createdAt-prior.createdAt<=120&&(prior.x-x)**2+(prior.y-y)**2<=64){prior.radius=Math.min(7,prior.radius+.35);prior.createdAt=createdAt;return{decal:prior,redraw:false};}}const decal={x,y,radius,color:this.decals.length%3===0?0x52201e:0x381817,createdAt};this.decals.push(decal);if(this.decals.length>MAX_BLOOD_DECALS){this.decals.splice(0,32);return{decal,redraw:true};}return{decal,redraw:false};}
  get count():number{return this.decals.length;} all():readonly BloodDecal[]{return this.decals;}
}
export class BloodDecalLayer{private readonly graphics:Phaser.GameObjects.Graphics;private readonly store=new BloodDecalStore();
  constructor(scene:Phaser.Scene){this.graphics=scene.add.graphics().setDepth(DEPTH.ground+10);}
  add(x:number,y:number,radius:number,createdAt:number):void{const result=this.store.add(x,y,radius,createdAt);if(result.redraw)this.redraw();else this.stamp(result.decal);}
  get count():number{return this.store.count;} destroy():void{this.graphics.destroy();}
  private stamp(decal:BloodDecal):void{this.graphics.fillStyle(decal.color,.78).fillCircle(Math.round(decal.x),Math.round(decal.y),Math.max(1,Math.round(decal.radius))).fillStyle(0x6b2925,.65).fillRect(Math.round(decal.x+decal.radius),Math.round(decal.y),1,1);}
  private redraw():void{this.graphics.clear();for(const decal of this.store.all())this.stamp(decal);}
}
