import { BUILDABLE_DEFINITIONS, getBuildCostItems, type BuildableCategory, type BuildableKind } from "../data/buildable-definitions";
import { getItemDefinition } from "../data/item-definitions";

export class BuildCatalogPanel {
  private readonly root: HTMLDivElement; private readonly buttons = new Map<BuildableKind, HTMLButtonElement>(); private open = false;
  constructor(parent: HTMLElement, private readonly onSelect: (kind: BuildableKind) => void) {
    this.root=document.createElement("div"); this.root.className="build-catalog"; this.root.hidden=true;
    const title=document.createElement("header"); title.textContent="건축 · B 닫기 · R 회전 · 우클릭 취소"; this.root.append(title);
    for(const category of ["defense","storage","power","production"] as BuildableCategory[]){ const section=document.createElement("section"); const heading=document.createElement("h3"); heading.textContent=category==="defense"?"방어":category==="storage"?"보관":category==="power"?"전력":"제작"; section.append(heading);
      for(const definition of Object.values(BUILDABLE_DEFINITIONS).filter((item)=>item.category===category)){ const button=document.createElement("button"); button.type="button"; button.dataset.kind=definition.kind; button.addEventListener("click",(event)=>{event.stopPropagation();this.onSelect(definition.kind);}); section.append(button); this.buttons.set(definition.kind,button); }
      this.root.append(section);
    } parent.append(this.root);
  }
  isOpen():boolean{return this.open;}
  show(count:(itemId:string)=>number):void{this.open=true;this.root.hidden=false;this.update(count);}
  hide():void{this.open=false;this.root.hidden=true;}
  toggle(count:(itemId:string)=>number):void{if(this.open)this.hide();else this.show(count);}
  update(count:(itemId:string)=>number):void{for(const [kind,button] of this.buttons){const definition=BUILDABLE_DEFINITIONS[kind];const costs=getBuildCostItems(definition);const affordable=costs.every((cost)=>count(cost.itemId)>=cost.quantity);button.disabled=!affordable;button.innerHTML=`<strong>${definition.name}</strong><small>${costs.map((cost)=>`${getItemDefinition(cost.itemId).name} ${count(cost.itemId)}/${cost.quantity}`).join(" · ")} · HP ${definition.maximumHealth}</small>`;}}
  destroy():void{this.root.remove();}
}
