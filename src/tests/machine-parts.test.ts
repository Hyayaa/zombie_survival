import { describe, expect, it } from "vitest";
import { ITEM_DEFINITIONS } from "../data/item-definitions";
import { RECIPE_DEFINITIONS } from "../data/recipe-definitions";
import { createCityBlockMap } from "../data/map-definitions";

describe("machine parts",()=>{
  const ids=["screws","steel_plate","solar_panel","duct_tape","circuit_board","electric_motor"];
  it("defines and distributes every part with enough material for all four kits",()=>{for(const id of ids)expect(ITEM_DEFINITIONS[id]?.category).toBe("material");const totals:Record<string,number>={};for(const c of createCityBlockMap(77,4).containers)for(const l of c.loot)totals[l.itemId]=(totals[l.itemId]??0)+l.quantity;expect(totals).toMatchObject({screws:20,steel_plate:9,solar_panel:2,duct_tape:4,circuit_board:2,electric_motor:2});});
  it("uses new parts and never consumes escape parts",()=>{const recipes=RECIPE_DEFINITIONS.filter(r=>["turret_kit","solar_generator_kit","fuel_generator_kit","battery_bank_kit"].includes(r.id));expect(recipes).toHaveLength(4);expect(recipes.find(r=>r.id==="solar_generator_kit")!.ingredients.solar_panel).toBe(2);expect(recipes.find(r=>r.id==="fuel_generator_kit")!.ingredients.electric_motor).toBe(1);expect(recipes.find(r=>r.id==="battery_bank_kit")!.ingredients.circuit_board).toBe(1);for(const r of recipes)for(const forbidden of ["battery","fuel","engine_part"])expect(r.ingredients[forbidden]).toBeUndefined();});
});
