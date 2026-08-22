import {describe,expect,it} from "vitest";
import {TILE_SIZE} from "../config/game-config";
import {BUILDABLE_DEFINITIONS,WORKBENCH_WORLD_SIZE} from "../data/buildable-definitions";
import {createPlacedFurniture} from "../entities/placed-structure";
import {createStructureRenderGeometry} from "../rendering/structure-render-model";

describe("workbench world footprints",()=>{
  for(const kind of ["makeshift_workbench","plank_workbench","technical_workbench"] as const)it(`${kind} uses the common 1 x 0.5 tile OBB`,()=>{const definition=BUILDABLE_DEFINITIONS[kind],state=createPlacedFurniture(kind,kind,100,120,Math.PI/4),geometry=createStructureRenderGeometry(kind,state.placement);expect(definition.furnitureSize).toBe(WORKBENCH_WORLD_SIZE);expect(geometry).toMatchObject({width:TILE_SIZE,height:TILE_SIZE*.5,angle:Math.PI/4});expect(definition.footprint).toBeDefined();expect(definition.craftingStationKind).toBeDefined();});
});
