import Phaser from "phaser";
import { DEPTH } from "../config/game-config";
import type { BloodDecalPlan } from "./blood-effect-math";

export interface BloodDecal extends BloodDecalPlan{color:number;createdAt:number}
export interface BloodDecalPixel{x:number;y:number;width:number;height:number;color:number}
export const MAX_BLOOD_DECALS=400;

export function createBloodDecalStamp(decal:BloodDecal):BloodDecalPixel[]{
  const pixels:BloodDecalPixel[]=[];const radius=Math.max(2,Math.round(decal.radius));const dark=decal.color;const light=decal.sequence%3===0?0x6b2925:0x57201e;
  pixels.push({x:Math.round(decal.x-radius*.6),y:Math.round(decal.y-radius*.35),width:radius+1,height:Math.max(2,Math.round(radius*.65)),color:dark});
  pixels.push({x:Math.round(decal.x-radius*.2),y:Math.round(decal.y-radius*.7),width:Math.max(2,Math.round(radius*.75)),height:radius+1,color:dark});
  const baseAngle=Math.atan2(decal.directionY,decal.directionX);const melee=decal.profile==="melee";const tails=melee?4:3;
  for(let index=0;index<tails;index++){
    const angle=baseAngle+(noise(decal.sequence,index)-.5)*(melee?2.7:1.15)+(melee?.35:0);const length=2+Math.floor(noise(decal.sequence,index+11)*(melee?4:7));
    for(let step=1;step<=length;step++)if(step<3||step%2===1)pixels.push({x:Math.round(decal.x+Math.cos(angle)*step),y:Math.round(decal.y+Math.sin(angle)*step),width:step===1&&melee?2:1,height:1,color:step===1?dark:light});
  }
  const droplets=melee?4:3;
  for(let index=0;index<droplets;index++){const angle=baseAngle+(noise(decal.sequence,index+30)-.5)*Math.PI*2;const distance=radius+2+Math.floor(noise(decal.sequence,index+41)*6);pixels.push({x:Math.round(decal.x+Math.cos(angle)*distance),y:Math.round(decal.y+Math.sin(angle)*distance),width:1,height:index===0?2:1,color:light});}
  return pixels;
}

export class BloodDecalStore{private readonly decals:BloodDecal[]=[];
  add(plan:BloodDecalPlan,createdAt:number):{decal:BloodDecal;redraw:boolean}{for(let index=Math.max(0,this.decals.length-12);index<this.decals.length;index++){const prior=this.decals[index]!;if(createdAt-prior.createdAt<=120&&(prior.x-plan.x)**2+(prior.y-plan.y)**2<=64){prior.radius=Math.min(7,prior.radius+.35);prior.createdAt=createdAt;return{decal:prior,redraw:false};}}const decal:{color:number;createdAt:number}&BloodDecalPlan={...plan,color:this.decals.length%3===0?0x52201e:0x381817,createdAt};this.decals.push(decal);if(this.decals.length>MAX_BLOOD_DECALS){this.decals.splice(0,32);return{decal,redraw:true};}return{decal,redraw:false};}
  get count():number{return this.decals.length;} all():readonly BloodDecal[]{return this.decals;}
}

export class BloodDecalLayer{private readonly graphics:Phaser.GameObjects.Graphics;private readonly store=new BloodDecalStore();
  constructor(scene:Phaser.Scene){this.graphics=scene.add.graphics().setDepth(DEPTH.ground+10);}
  add(plan:BloodDecalPlan,createdAt:number):void{const result=this.store.add(plan,createdAt);if(result.redraw)this.redraw();else this.stamp(result.decal);}
  get count():number{return this.store.count;} destroy():void{this.graphics.destroy();}
  private stamp(decal:BloodDecal):void{for(const pixel of createBloodDecalStamp(decal))this.graphics.fillStyle(pixel.color,.78).fillRect(pixel.x,pixel.y,pixel.width,pixel.height);}
  private redraw():void{this.graphics.clear();for(const decal of this.store.all())this.stamp(decal);}
}

function noise(seed:number,salt:number):number{let value=(seed^Math.imul(salt+1,0x85ebca6b))>>>0;value^=value>>>13;value=Math.imul(value,0xc2b2ae35);return((value^(value>>>16))>>>0)/0x1_0000_0000;}
