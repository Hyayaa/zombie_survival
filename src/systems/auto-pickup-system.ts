import type { Point } from "./zombie-ai-system";

export const AUTO_PICKUP_RADIUS = 18;
export const AUTO_PICKUP_INTERVAL_MS = 80;
export const AUTO_PICKUP_BUCKET_SIZE = 48;
export interface AutoPickupDrop extends Point { id:string; itemId:string; quantity:number }
export interface AutoPickupResult { acquired:Map<string,number>; removedIds:string[]; blockedByCapacity:boolean }

export class AutoPickupSystem {
  private readonly buckets=new Map<string,Set<AutoPickupDrop>>(); private readonly dropBuckets=new Map<string,string>();
  register(drop:AutoPickupDrop):void{this.remove(drop.id);const key=this.key(drop.x,drop.y);let bucket=this.buckets.get(key);if(!bucket){bucket=new Set();this.buckets.set(key,bucket);}bucket.add(drop);this.dropBuckets.set(drop.id,key);}
  remove(id:string):void{const key=this.dropBuckets.get(id);if(!key)return;const bucket=this.buckets.get(key);if(bucket){for(const drop of bucket)if(drop.id===id){bucket.delete(drop);break;}if(bucket.size===0)this.buckets.delete(key);}this.dropBuckets.delete(id);}
  clear():void{this.buckets.clear();this.dropBuckets.clear();}
  collect(player:Point,hasLineOfSight:(from:Point,to:Point)=>boolean,add:(itemId:string,quantity:number)=>number):AutoPickupResult{
    const acquired=new Map<string,number>();const removedIds:string[]=[];let blockedByCapacity=false;const radiusSquared=AUTO_PICKUP_RADIUS*AUTO_PICKUP_RADIUS;const minX=Math.floor((player.x-AUTO_PICKUP_RADIUS)/AUTO_PICKUP_BUCKET_SIZE);const maxX=Math.floor((player.x+AUTO_PICKUP_RADIUS)/AUTO_PICKUP_BUCKET_SIZE);const minY=Math.floor((player.y-AUTO_PICKUP_RADIUS)/AUTO_PICKUP_BUCKET_SIZE);const maxY=Math.floor((player.y+AUTO_PICKUP_RADIUS)/AUTO_PICKUP_BUCKET_SIZE);
    for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){const bucket=this.buckets.get(`${x}:${y}`);if(!bucket)continue;for(const drop of bucket){const dx=drop.x-player.x,dy=drop.y-player.y;if(dx*dx+dy*dy>radiusSquared||!hasLineOfSight(player,drop))continue;const added=add(drop.itemId,drop.quantity);if(added<=0){blockedByCapacity=true;continue;}drop.quantity-=added;acquired.set(drop.itemId,(acquired.get(drop.itemId)??0)+added);if(drop.quantity<=0)removedIds.push(drop.id);}}
    for(const id of removedIds)this.remove(id);return{acquired,removedIds,blockedByCapacity};
  }
  private key(x:number,y:number):string{return `${Math.floor(x/AUTO_PICKUP_BUCKET_SIZE)}:${Math.floor(y/AUTO_PICKUP_BUCKET_SIZE)}`;}
}
