import type { Point } from "./zombie-ai-system";

export interface OrientedRectangle { x: number; y: number; halfWidth: number; halfHeight: number; angle: number }
export interface WorldAabb { minX: number; minY: number; maxX: number; maxY: number }
export interface SegmentObbIntersection { point: Point; amount: number }

export function getObbCorners(obb: OrientedRectangle, out: Point[] = [{x:0,y:0},{x:0,y:0},{x:0,y:0},{x:0,y:0}]): Point[] {
  const c=Math.cos(obb.angle),s=Math.sin(obb.angle),ux=c*obb.halfWidth,uy=s*obb.halfWidth,vx=-s*obb.halfHeight,vy=c*obb.halfHeight;
  set(out[0]!,obb.x-ux-vx,obb.y-uy-vy);set(out[1]!,obb.x+ux-vx,obb.y+uy-vy);set(out[2]!,obb.x+ux+vx,obb.y+uy+vy);set(out[3]!,obb.x-ux+vx,obb.y-uy+vy);return out;
}

export function getObbAabb(obb: OrientedRectangle): WorldAabb {
  const c=Math.abs(Math.cos(obb.angle)),s=Math.abs(Math.sin(obb.angle)),extentX=c*obb.halfWidth+s*obb.halfHeight,extentY=s*obb.halfWidth+c*obb.halfHeight;
  return {minX:obb.x-extentX,minY:obb.y-extentY,maxX:obb.x+extentX,maxY:obb.y+extentY};
}

export function circleIntersectsObb(x:number,y:number,radius:number,obb:OrientedRectangle):boolean {
  const local=toLocal(x,y,obb),nearestX=clamp(local.x,-obb.halfWidth,obb.halfWidth),nearestY=clamp(local.y,-obb.halfHeight,obb.halfHeight),dx=local.x-nearestX,dy=local.y-nearestY;
  return dx*dx+dy*dy<radius*radius;
}

export function segmentIntersectsObb(from:Point,to:Point,obb:OrientedRectangle,padding=0):SegmentObbIntersection|null {
  const start=toLocal(from.x,from.y,obb),end=toLocal(to.x,to.y,obb),dx=end.x-start.x,dy=end.y-start.y;
  let enter=0,exit=1;const minX=-obb.halfWidth-padding,maxX=obb.halfWidth+padding,minY=-obb.halfHeight-padding,maxY=obb.halfHeight+padding;
  const clip=(p:number,q:number):boolean=>{if(Math.abs(p)<1e-9)return q>=0;const r=q/p;if(p<0){if(r>exit)return false;if(r>enter)enter=r;}else{if(r<enter)return false;if(r<exit)exit=r;}return true;};
  if(!clip(-dx,start.x-minX)||!clip(dx,maxX-start.x)||!clip(-dy,start.y-minY)||!clip(dy,maxY-start.y))return null;
  return {amount:enter,point:{x:from.x+(to.x-from.x)*enter,y:from.y+(to.y-from.y)*enter}};
}

export function obbIntersectsObb(a:OrientedRectangle,b:OrientedRectangle):boolean {
  const axes=[axis(a.angle),axis(a.angle+Math.PI/2),axis(b.angle),axis(b.angle+Math.PI/2)];
  const ac=getObbCorners(a),bc=getObbCorners(b);
  for(const test of axes){let amin=Infinity,amax=-Infinity,bmin=Infinity,bmax=-Infinity;for(const p of ac){const v=p.x*test.x+p.y*test.y;amin=Math.min(amin,v);amax=Math.max(amax,v);}for(const p of bc){const v=p.x*test.x+p.y*test.y;bmin=Math.min(bmin,v);bmax=Math.max(bmax,v);}if(amax<=bmin||bmax<=amin)return false;}return true;
}

export function aabbsOverlap(a:WorldAabb,b:WorldAabb):boolean{return a.minX<b.maxX&&a.maxX>b.minX&&a.minY<b.maxY&&a.maxY>b.minY;}
function toLocal(x:number,y:number,obb:OrientedRectangle):Point{const dx=x-obb.x,dy=y-obb.y,c=Math.cos(obb.angle),s=Math.sin(obb.angle);return{x:dx*c+dy*s,y:-dx*s+dy*c};}
function axis(angle:number):Point{return{x:Math.cos(angle),y:Math.sin(angle)};}
function clamp(value:number,min:number,max:number):number{return Math.max(min,Math.min(max,value));}
function set(point:Point,x:number,y:number):void{point.x=x;point.y=y;}
