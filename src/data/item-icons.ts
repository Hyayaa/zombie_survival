import { ITEM_DEFINITIONS } from "./item-definitions";
import { WEAPON_DEFINITIONS } from "./weapon-definitions";

export const ITEM_ICON_SOURCE_SIZE=64;
const DEDICATED_ICON_IDS=new Set([...Object.keys(ITEM_DEFINITIONS),...Object.keys(WEAPON_DEFINITIONS)]);

export function getItemIconPath(id:string,basePath=import.meta.env.BASE_URL):string{
  const base=basePath.endsWith("/")?basePath:`${basePath}/`;
  return `${base}assets/items/${id}.png`;
}

export function hasDedicatedItemIcon(id:string):boolean{return DEDICATED_ICON_IDS.has(id);}

export function getItemIconSourceDimensions(id:string):{width:number;height:number}{
  const footprint=ITEM_DEFINITIONS[id]?.inventoryFootprint??WEAPON_DEFINITIONS[id as keyof typeof WEAPON_DEFINITIONS]?.inventoryFootprint;
  return footprint?{width:footprint.width*ITEM_ICON_SOURCE_SIZE,height:footprint.height*ITEM_ICON_SOURCE_SIZE}:{width:ITEM_ICON_SOURCE_SIZE,height:ITEM_ICON_SOURCE_SIZE};
}
