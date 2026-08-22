import { visibilityProbeTowardPoint,type SegmentGeometry } from "./collision-geometry";
import type { Point } from "./zombie-ai-system";

export interface VisionOccluderSurface{key:string;segment:SegmentGeometry;active?:boolean}

/** Collects only blocker faces whose observer-side probe is currently visible. */
export function collectVisibleOccluderKeys(occluders:readonly VisionOccluderSurface[],sources:readonly Point[],isVisibleAt:(x:number,y:number)=>boolean,out:Set<string>=new Set()):Set<string>{
  out.clear();const probe={x:0,y:0};for(const occluder of occluders){if(occluder.active===false)continue;for(const source of sources){visibilityProbeTowardPoint(source,occluder.segment,occluder.segment.thickness/2+2,probe);if(isVisibleAt(probe.x,probe.y)){out.add(occluder.key);break;}}}return out;
}
