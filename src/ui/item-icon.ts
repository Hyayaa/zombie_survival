import { getItemIconPath, getItemIconSourceDimensions } from "../data/item-icons";
import { getInventoryRenderStyle, type InventoryItemRenderGeometry } from "./inventory-item-render-geometry";

export interface ItemIconMarkupOptions{id:string;name:string;color:number;className?:string;path?:string;rotation?:0|1;renderGeometry?:InventoryItemRenderGeometry}

export function createItemIconMarkup(options:ItemIconMarkupOptions):string{
  const color=options.color.toString(16).padStart(6,"0");
  const dimensions=getItemIconSourceDimensions(options.id);
  const geometryStyle=options.renderGeometry?`;${getInventoryRenderStyle(options.renderGeometry)}`:"";
  return `<span class="item-icon-frame ${options.className??""}" style="--swatch:#${color};--icon-rotation:${options.rotation===1?90:0}deg${geometryStyle}"><img class="item-icon" src="${options.path??getItemIconPath(options.id)}" alt="${escapeAttribute(options.name)}" width="${dimensions.width}" height="${dimensions.height}"><span class="item-icon-fallback" hidden></span></span>`;
}

export function bindItemIconFallbacks(root:ParentNode):void{
  for(const image of root.querySelectorAll<HTMLImageElement>("img.item-icon,img.inventory-item-image"))image.addEventListener("error",()=>{image.hidden=true;const fallback=image.nextElementSibling as HTMLElement|null;if(fallback)fallback.hidden=false;},{once:true});
}

function escapeAttribute(value:string):string{return value.replaceAll("&","&amp;").replaceAll('"',"&quot;").replaceAll("<","&lt;").replaceAll(">","&gt;");}
