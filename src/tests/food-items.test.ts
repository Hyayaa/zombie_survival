import { describe, expect, it } from "vitest";
import { ITEM_DEFINITIONS } from "../data/item-definitions";
import { applyConsumable, canApplyConsumable } from "../systems/consumable-system";
import { createCityBlockMap } from "../data/map-definitions";

describe("food item variety", () => {
  const ids=["cabbage","carrot","potato","apple","beef","pork"] as const;
  it("defines six usable foods and keeps canned food data driven",()=>{for(const id of ids){expect(ITEM_DEFINITIONS[id]?.category).toBe("food");expect(ITEM_DEFINITIONS[id]?.consumableEffect).toBeDefined();}expect(ITEM_DEFINITIONS.canned_food?.consumableEffect).toBeDefined();});
  it("applies combined effects with clamping and permits hunger use at full health",()=>{const effect=ITEM_DEFINITIONS.apple!.consumableEffect!;expect(canApplyConsumable(effect,{health:100,maxHealth:100,infection:0},{hunger:80,thirst:95,stamina:100})).toBe(true);expect(applyConsumable(effect,{health:100,maxHealth:100,infection:0},{hunger:95,thirst:95,stamina:100})).toMatchObject({needs:{hunger:100,thirst:100}});expect(canApplyConsumable(effect,{health:100,maxHealth:100,infection:0},{hunger:100,thirst:100,stamina:100})).toBe(false);});
  it("places every new food deterministically",()=>{const first=createCityBlockMap(123);const second=createCityBlockMap(123);const loot=(map:ReturnType<typeof createCityBlockMap>)=>map.containers.flatMap(c=>c.loot.map(l=>l.itemId));expect(loot(first)).toEqual(loot(second));for(const id of ids)expect(loot(first)).toContain(id);});
});
