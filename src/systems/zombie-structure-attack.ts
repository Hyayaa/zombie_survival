import { BUILDABLE_DEFINITIONS } from "../data/buildable-definitions";
import { getPlacedStructureCenter, type PlacedStructureState } from "../entities/placed-structure";
import { segmentIntersectsThickSegment, type SegmentGeometry } from "./collision-geometry";
import { estimateStructureBreakCost } from "./structure-durability-system";
import type { Point } from "./zombie-ai-system";
import { segmentIntersectsObb } from "./oriented-furniture-collision";

export interface NavigationWaypoint extends Point { blockingStructureId?: string }
export const ZOMBIE_STRUCTURE_DAMAGE = { walker: 12, runner: 8 } as const;

export function chooseBlockingStructure(from: Point, to: Point, candidates: readonly PlacedStructureState[]): PlacedStructureState | undefined {
  const movement:SegmentGeometry={startX:from.x,startY:from.y,endX:to.x,endY:to.y,thickness:0}; let best:PlacedStructureState|undefined;let bestCost=Number.POSITIVE_INFINITY;
  for(const state of candidates){if(state.health<=0||(state.kind==="wood-door"&&state.doorOpen))continue;const definition=BUILDABLE_DEFINITIONS[state.kind];let blocks=false;
    if(state.placement.kind==="segment")blocks=segmentIntersectsThickSegment(movement,{...state.placement,thickness:definition.segment!.thickness},5);
    else if(state.placement.kind==="furniture"){const size=definition.furnitureSize!;blocks=segmentIntersectsObb(from,to,{x:state.placement.x,y:state.placement.y,angle:state.placement.angle,halfWidth:size.width/2,halfHeight:size.height/2},5)!==null;}
    else{const center=getPlacedStructureCenter(state);const radius=Math.hypot(definition.footprint!.width*12,definition.footprint!.height*12);blocks=distanceToSegmentSquared(center,movement)<=radius*radius;}
    if(!blocks)continue;const center=getPlacedStructureCenter(state);const cost=Math.hypot(center.x-from.x,center.y-from.y)+estimateStructureBreakCost(state,12,8);if(cost<bestCost){best=state;bestCost=cost;}
  }return best;
}
export function getStructureAttackSlot(structure:PlacedStructureState,zombieId:string,offset=14):Point{const center=getPlacedStructureCenter(structure);const hash=hashId(zombieId);if(structure.placement.kind==="segment"){const p=structure.placement;const length=Math.max(1,Math.hypot(p.endX-p.startX,p.endY-p.startY));const side=hash%2===0?1:-1;const along=((hash>>>1)%5-2)*3;return{x:center.x+(p.endX-p.startX)/length*along-(p.endY-p.startY)/length*offset*side,y:center.y+(p.endY-p.startY)/length*along+(p.endX-p.startX)/length*offset*side};}const angle=(hash%8)*Math.PI/4;return{x:center.x+Math.cos(angle)*offset,y:center.y+Math.sin(angle)*offset};}
function hashId(id:string):number{let value=2166136261;for(let index=0;index<id.length;index+=1)value=Math.imul(value^id.charCodeAt(index),16777619);return value>>>0;}
function distanceToSegmentSquared(point:Point,segment:SegmentGeometry):number{const dx=segment.endX-segment.startX,dy=segment.endY-segment.startY,length=dx*dx+dy*dy;const t=length===0?0:Math.max(0,Math.min(1,((point.x-segment.startX)*dx+(point.y-segment.startY)*dy)/length));const x=segment.startX+dx*t,y=segment.startY+dy*t;return(point.x-x)**2+(point.y-y)**2;}
