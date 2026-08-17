import { getItemIconPath, ITEM_ICON_SOURCE_SIZE } from "../data/item-icons";

export interface ItemIconMarkupOptions{id:string;name:string;color:number;className?:string;path?:string}

export function createItemIconMarkup(options:ItemIconMarkupOptions):string{
  const color=options.color.toString(16).padStart(6,"0");
  return `<span class="item-icon-frame ${options.className??""}" style="--swatch:#${color}"><img class="item-icon" src="${options.path??getItemIconPath(options.id)}" alt="${escapeAttribute(options.name)}" width="${ITEM_ICON_SOURCE_SIZE}" height="${ITEM_ICON_SOURCE_SIZE}"><span class="item-icon-fallback" hidden></span></span>`;
}

export function bindItemIconFallbacks(root:ParentNode):void{
  for(const image of root.querySelectorAll<HTMLImageElement>("img.item-icon"))image.addEventListener("error",()=>{image.hidden=true;const fallback=image.nextElementSibling as HTMLElement|null;if(fallback)fallback.hidden=false;},{once:true});
}

function escapeAttribute(value:string):string{return value.replaceAll("&","&amp;").replaceAll('"',"&quot;").replaceAll("<","&lt;").replaceAll(">","&gt;");}
