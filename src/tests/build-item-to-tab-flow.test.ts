import {describe,expect,it} from "vitest";
import {createPendingBuildPlacement} from "../systems/build-placement-flow";
import {isBuildIntentExactItemAvailable,type BuildTabSelectionIntent} from "../ui/inventory-panel";

describe("build item to construction tab intent",()=>{
  const intent:BuildTabSelectionIntent={buildableId:"turret",source:{kind:"item",instanceId:"item-77",itemId:"turret_kit"},requestedAt:100};
  it("retains the exact instance without creating pending placement",()=>{expect(intent.source).toEqual({kind:"item",instanceId:"item-77",itemId:"turret_kit"});expect(isBuildIntentExactItemAvailable(intent,[{instanceId:"item-77",itemId:"turret_kit",quantity:1}])).toBe(true);});
  it("does not silently select another identical stack",()=>{expect(isBuildIntentExactItemAvailable(intent,[{instanceId:"item-78",itemId:"turret_kit",quantity:2}])).toBe(false);});
  it("only creates pending placement after placement start",()=>{const pending=createPendingBuildPlacement(intent.buildableId,intent.source);expect(pending).toMatchObject({buildableId:"turret",source:{kind:"item",instanceId:"item-77",itemId:"turret_kit"},valid:false});});
  it("allows material and developer rows without an item instance",()=>{expect(isBuildIntentExactItemAvailable({buildableId:"wood-wall",source:{kind:"materials"},requestedAt:1},[])).toBe(true);expect(isBuildIntentExactItemAvailable({buildableId:"wood-wall",source:{kind:"developer"},requestedAt:1},[])).toBe(true);});
});
