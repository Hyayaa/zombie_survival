import type { InventorySystem } from "../systems/inventory-system";
import type { WorldStorageContainer } from "../systems/world-storage-container";
import { getItemDefinition } from "../data/item-definitions";

export class WorldStoragePanel {
  private readonly root: HTMLDivElement; private storage?: WorldStorageContainer; private open = false;
  constructor(parent: HTMLElement, private readonly inventory: InventorySystem, private readonly onChanged: () => void) { this.root=document.createElement("div");this.root.className="world-storage-panel";this.root.hidden=true;this.root.addEventListener("dragover",(event)=>event.preventDefault());parent.append(this.root); }
  isOpen(): boolean { return this.open; }
  hide(): void { this.open=false;this.storage=undefined;this.root.hidden=true; }
  show(storage: WorldStorageContainer): void { this.storage=storage;this.open=true;this.root.hidden=false;this.render(); }
  destroy(): void { this.root.remove(); }
  private render(): void { const storage=this.storage;if(!storage)return;this.root.replaceChildren();const header=document.createElement("header");header.textContent="목재 보관함 8×6 · 드래그로 이동 · 우클릭 회전";this.root.append(header);const columns=document.createElement("div");columns.className="world-storage-panel__columns";const player=this.zone("플레이어",true),crate=this.zone("보관함",false);columns.append(player,crate);this.root.append(columns);
    for(const item of this.inventory.getStoredItems()){const node=this.item(item.instanceId,item.itemId,item.quantity);node.addEventListener("dragstart",(event)=>event.dataTransfer?.setData("application/x-player-item",item.instanceId));player.append(node);}
    for(const item of storage.getItems()){const node=this.item(item.instanceId,item.itemId,item.quantity);const footprint=getItemDefinition(item.itemId).inventoryFootprint;node.style.gridColumn=`${item.x+1} / span ${item.rotation===0?footprint.width:footprint.height}`;node.style.gridRow=`${item.y+1}`;node.addEventListener("dragstart",(event)=>event.dataTransfer?.setData("application/x-crate-item",item.instanceId));node.addEventListener("contextmenu",(event)=>{event.preventDefault();storage.rotate(item.instanceId);this.render();this.onChanged();});crate.append(node);}
  }
  private zone(label:string,playerZone:boolean):HTMLDivElement { const zone=document.createElement("div");zone.className=playerZone?"world-storage-panel__player":"world-storage-panel__crate";zone.dataset.label=label;zone.addEventListener("drop",(event)=>{event.preventDefault();const storage=this.storage;if(!storage)return;if(playerZone){const id=event.dataTransfer?.getData("application/x-crate-item");const item=id?storage.remove(id):undefined;if(item&&this.inventory.add(item.itemId,item.quantity)!==item.quantity)storage.add(item.itemId,item.quantity,item.x,item.y,item.rotation,item.instanceId);}else{const id=event.dataTransfer?.getData("application/x-player-item");const item=id?this.inventory.getItem(id):null;if(item){const dropped=this.inventory.dropInstance(item.instanceId,item.quantity);if(dropped&&!storage.add(item.itemId,item.quantity))this.inventory.add(item.itemId,item.quantity);}}this.render();this.onChanged();});return zone; }
  private item(instanceId:string,itemId:string,quantity:number):HTMLButtonElement { const button=document.createElement("button");button.type="button";button.draggable=true;button.dataset.instanceId=instanceId;button.textContent=`${getItemDefinition(itemId).name} ×${quantity}`;return button; }
}
