import { BUILDABLE_DEFINITIONS, getRotatedStructureFootprint, type BuildableKind } from "../data/buildable-definitions";
import { TILE_SIZE } from "../config/game-config";
import type { StructurePlacement } from "../entities/placed-structure";

export interface StructureRenderGeometry {
  kind: BuildableKind;
  placement: StructurePlacement;
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  angle: number;
}

export interface StructureRenderModel {
  geometry: StructureRenderGeometry;
  alpha: number;
  invalid: boolean;
  doorOpen: boolean;
  aimAngle: number;
}

interface GraphicsLike {
  save():this;restore():this;translateCanvas(x:number,y:number):this;rotateCanvas(radians:number):this;
  lineStyle(width: number, color: number, alpha?: number): this;
  fillStyle(color: number, alpha?: number): this;
  fillCircle(x: number, y: number, radius: number): this;
  strokeCircle(x: number, y: number, radius: number): this;
  fillRect(x: number, y: number, width: number, height: number): this;
  strokeRect(x: number, y: number, width: number, height: number): this;
  lineBetween(x1: number, y1: number, x2: number, y2: number): this;
}

export function createStructureRenderGeometry(kind: BuildableKind, placement: StructurePlacement): StructureRenderGeometry {
  if (placement.kind === "segment") return { kind, placement, centerX: (placement.startX + placement.endX) / 2, centerY: (placement.startY + placement.endY) / 2, width: Math.abs(placement.endX - placement.startX), height: Math.abs(placement.endY - placement.startY), angle: 0 };
  if(placement.kind==="furniture"){const size=BUILDABLE_DEFINITIONS[kind].furnitureSize!;return{kind,placement,centerX:placement.x,centerY:placement.y,width:size.width,height:size.height,angle:placement.angle};}
  const footprint = getRotatedStructureFootprint(kind, placement.rotation);
  return { kind, placement, centerX: (placement.tileX + footprint.width / 2) * TILE_SIZE, centerY: (placement.tileY + footprint.height / 2) * TILE_SIZE, width: footprint.width * TILE_SIZE, height: footprint.height * TILE_SIZE, angle: placement.rotation*Math.PI/2 };
}

export function createStructureRenderModel(kind: BuildableKind, placement: StructurePlacement, options: { alpha?: number; invalid?: boolean; doorOpen?: boolean; aimAngle?: number } = {}): StructureRenderModel {
  return { geometry: createStructureRenderGeometry(kind, placement), alpha: options.alpha ?? 1, invalid: options.invalid ?? false, doorOpen: options.doorOpen ?? false, aimAngle: options.aimAngle ?? 0 };
}

export function drawStructureRenderModel(graphics: GraphicsLike, model: StructureRenderModel, originX = 0, originY = 0, outlineColor = 0x111612): void {
  const { geometry, alpha, invalid } = model; const kind = geometry.kind; const x = geometry.centerX - originX; const y = geometry.centerY - originY;
  const outline = invalid ? 0xd65d57 : outlineColor; const tint = invalid ? 0xb84f4b : undefined;
  if (geometry.placement.kind === "segment") {
    const p = geometry.placement; const sx=p.startX-originX,sy=p.startY-originY; let ex=p.endX-originX,ey=p.endY-originY;
    if (kind === "wood-door" && model.doorOpen) { ex=sx+(p.endY-p.startY);ey=sy-(p.endX-p.startX); }
    const color=tint ?? (kind === "metal-wall" ? 0x667174 : kind === "wood-door" ? 0x8c643d : 0x755235);
    graphics.lineStyle(BUILDABLE_DEFINITIONS[kind].segment!.thickness+2,outline,alpha).lineBetween(sx,sy,ex,ey).lineStyle(BUILDABLE_DEFINITIONS[kind].segment!.thickness,color,alpha).lineBetween(sx,sy,ex,ey);
    return;
  }
  const rotated=geometry.placement.kind==="furniture"&&Math.abs(geometry.angle)>1e-8;if(rotated)graphics.save().translateCanvas(x,y).rotateCanvas(geometry.angle).translateCanvas(-x,-y);
  graphics.lineStyle(1,outline,alpha);
  if(kind === "turret") { const barrelX=x+Math.cos(model.aimAngle)*16,barrelY=y+Math.sin(model.aimAngle)*16;graphics.lineStyle(3,tint??0x7b8582,alpha).lineBetween(x,y,barrelX,barrelY).lineStyle(1,outline,alpha).fillStyle(tint??0x414b4a,alpha).fillCircle(x,y,8).strokeCircle(x,y,8).fillStyle(tint??0x697573,alpha).fillCircle(x,y,4); }
  else if(kind === "solar-generator") graphics.fillStyle(tint??0x294c68,alpha).fillRect(x-10,y-7,20,14).strokeRect(x-10,y-7,20,14).lineStyle(1,tint??0x71808a,alpha).lineBetween(x-3,y-7,x-3,y+7).lineBetween(x+4,y-7,x+4,y+7).lineBetween(x-10,y,x+10,y);
  else if(kind === "fuel-generator") graphics.fillStyle(tint??0x596253,alpha).fillRect(x-9,y-8,18,16).strokeRect(x-9,y-8,18,16).fillStyle(tint??0x303735,alpha).fillRect(x-5,y-5,7,4).fillStyle(tint??0xa47b45,alpha).fillRect(x+5,y-5,2,4);
  else if(kind === "battery-bank") graphics.fillStyle(tint??0x3e484d,alpha).fillRect(x-8,y-9,16,18).strokeRect(x-8,y-9,16,18).lineStyle(1,tint??0x69777b,alpha).lineBetween(x-8,y-3,x+8,y-3).lineBetween(x-8,y+3,x+8,y+3);
  else if(kind === "wood-crate"||kind === "barricade") graphics.fillStyle(tint??0x6f5033,alpha).fillRect(x-9,y-8,18,16).strokeRect(x-9,y-8,18,16).lineStyle(1,tint??0xa47a4c,alpha).lineBetween(x-8,y-2,x+8,y-2).lineBetween(x,y-7,x,y+7);
  else {
    const width=geometry.width-2,height=geometry.height-2,left=x-Math.floor(width/2),top=y-Math.floor(height/2),technical=kind==="technical_workbench",plank=kind==="plank_workbench",base=tint??(technical?0x425554:plank?0x74583b:0x5c4934),highlight=tint??(technical?0x718481:0x9b744b);
    graphics.fillStyle(base,alpha).fillRect(left,top,width,height).strokeRect(left,top,width,height).fillStyle(highlight,alpha).fillRect(left+2,top+2,width-4,3).fillStyle(tint??0x252d2b,alpha).fillRect(left+3,top+height-4,3,3).fillRect(left+width-6,top+height-4,3,3);
    if(technical)graphics.fillStyle(tint??0x56a77a,alpha).fillRect(left+5,top+6,5,2).fillStyle(tint??0x6595b0,alpha).fillRect(left+13,top+6,2,2);
    else if(plank)graphics.lineStyle(1,tint??0xd0aa6f,alpha).lineBetween(left+5,top+6,left+13,top+6).fillStyle(tint??0x596262,alpha).fillRect(left+15,top+5,4,3);
    else graphics.lineStyle(1,tint??0xb7a078,alpha).lineBetween(left+5,top+7,left+10,top+4).fillStyle(tint??0x6c7471,alpha).fillRect(left+14,top+5,4,2);
  }
  if(rotated)graphics.restore();
}
