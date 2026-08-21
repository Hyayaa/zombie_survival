import { describe,expect,it } from "vitest";
// @ts-expect-error Vitest runs on Node; keeping Node types out avoids a new project dependency.
import { readFileSync,readdirSync,statSync } from "node:fs";
import { ITEM_DEFINITIONS } from "../data/item-definitions";
import { WEAPON_DEFINITIONS } from "../data/weapon-definitions";
import { getItemIconPath,getItemIconSourceDimensions,hasDedicatedItemIcon } from "../data/item-icons";
import { createCompendiumEntries,filterCompendiumEntries } from "../systems/compendium-system";
import { createItemIconMarkup } from "../ui/item-icon";
import { createInventorySlotIconMarkup } from "../ui/inventory-panel";

describe("item icon assets",()=>{
  it("provides a unique dedicated footprint-sized PNG for every item and weapon",()=>{
    const ids=[...Object.keys(ITEM_DEFINITIONS),...Object.keys(WEAPON_DEFINITIONS)];
    const paths=ids.map((id)=>`public/assets/items/${id}.png`);
    expect(new Set(paths).size).toBe(ids.length);expect(ids.filter((id)=>!hasDedicatedItemIcon(id))).toEqual([]);
    let total=0;
    for(let index=0;index<paths.length;index++){const bytes=readFileSync(paths[index]!);const dimensions=getItemIconSourceDimensions(ids[index]!);total+=statSync(paths[index]!).size;expect([...bytes.subarray(0,8)]).toEqual([137,80,78,71,13,10,26,10]);expect(bytes.readUInt32BE(16)).toBe(dimensions.width);expect(bytes.readUInt32BE(20)).toBe(dimensions.height);expect(bytes.length).toBeLessThan(64*1024);}
    expect(total).toBeLessThan(1024*1024);
    expect(readdirSync("public/assets/items").filter((name:string)=>/\.(zip|bmp|psd)$/i.test(name))).toEqual([]);
  });

  it("keeps icon paths through compendium search and category filters",()=>{const entries=createCompendiumEntries();expect(entries).toHaveLength(Object.keys(ITEM_DEFINITIONS).length+Object.keys(WEAPON_DEFINITIONS).length);expect(entries.every((entry)=>entry.iconPath===getItemIconPath(entry.sourceId))).toBe(true);expect(filterCompendiumEntries(entries,"권총","all").every((entry)=>entry.iconPath.endsWith(`${entry.sourceId}.png`))).toBe(true);expect(filterCompendiumEntries(entries,"","ammo").every((entry)=>entry.iconPath.endsWith(`${entry.sourceId}.png`))).toBe(true);});

  it("uses the GitHub Pages base and emits fixed layout, alt text, and fallback markup",()=>{expect(getItemIconPath("bandage","/zombie_survival/")).toBe("/zombie_survival/assets/items/bandage.png");const markup=createItemIconMarkup({id:"bandage",name:'붕대 "A"',color:0xffffff});expect(markup).toContain('width="64" height="64"');expect(markup).toContain('alt="붕대 &quot;A&quot;"');expect(markup).toContain("item-icon-fallback");});
  it("renders an inventory icon only for a filled slot",()=>{expect(createInventorySlotIconMarkup(null)).toBe("");const markup=createInventorySlotIconMarkup({itemId:"water",quantity:3});expect(markup).toContain("water.png");expect(markup).toContain('alt="물"');expect(markup).toContain("inventory-icon");});
});
