import { visibilityProbeTowardPoint,type SegmentGeometry } from "./collision-geometry";
import type { Point } from "./zombie-ai-system";

export interface VisionOccluderSurface{key:string;segment:SegmentGeometry;active?:boolean}

export class VisionOccluderSpatialIndex {
  private readonly buckets = new Map<number, VisionOccluderSurface[]>();
  private readonly seenKeys = new Set<string>();

  constructor(private readonly bucketSize: number) {}

  clear(): void { this.buckets.clear(); }

  add(surface: VisionOccluderSurface): void {
    const segment = surface.segment;
    const padding = segment.thickness / 2;
    const minX = Math.floor((Math.min(segment.startX, segment.endX) - padding) / this.bucketSize);
    const minY = Math.floor((Math.min(segment.startY, segment.endY) - padding) / this.bucketSize);
    const maxX = Math.floor((Math.max(segment.startX, segment.endX) + padding) / this.bucketSize);
    const maxY = Math.floor((Math.max(segment.startY, segment.endY) + padding) / this.bucketSize);
    for (let y = minY; y <= maxY; y += 1) for (let x = minX; x <= maxX; x += 1) {
      const key = y * 65_536 + x;
      let bucket = this.buckets.get(key);
      if (!bucket) { bucket = []; this.buckets.set(key, bucket); }
      bucket.push(surface);
    }
  }

  query(minX: number, minY: number, maxX: number, maxY: number, output: VisionOccluderSurface[]): VisionOccluderSurface[] {
    output.length = 0;
    this.seenKeys.clear();
    const startX = Math.floor(minX / this.bucketSize);
    const startY = Math.floor(minY / this.bucketSize);
    const endX = Math.floor(maxX / this.bucketSize);
    const endY = Math.floor(maxY / this.bucketSize);
    for (let y = startY; y <= endY; y += 1) for (let x = startX; x <= endX; x += 1) {
      const bucket = this.buckets.get(y * 65_536 + x);
      if (!bucket) continue;
      for (const surface of bucket) {
        if (this.seenKeys.has(surface.key)) continue;
        this.seenKeys.add(surface.key);
        output.push(surface);
      }
    }
    return output;
  }
}

/** Collects only blocker faces whose observer-side probe is currently visible. */
export function collectVisibleOccluderKeys(occluders:readonly VisionOccluderSurface[],sources:readonly Point[],isVisibleAt:(x:number,y:number)=>boolean,out:Set<string>=new Set()):Set<string>{
  out.clear();const probe={x:0,y:0};for(const occluder of occluders){if(occluder.active===false)continue;for(const source of sources){visibilityProbeTowardPoint(source,occluder.segment,occluder.segment.thickness/2+2,probe);if(isVisibleAt(probe.x,probe.y)){out.add(occluder.key);break;}}}return out;
}
