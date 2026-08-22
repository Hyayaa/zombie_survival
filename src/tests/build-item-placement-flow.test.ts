import { describe, expect, it, vi } from "vitest";
import { getItemDefinition } from "../data/item-definitions";
import { getRotatedStructureFootprint } from "../data/buildable-definitions";
import { createPlacedStructure } from "../entities/placed-structure";
import { BUILD_PREVIEW_ALPHA, BUILD_PREVIEW_REGISTRATIONS, confirmPendingBuildPlacement, createPendingBuildPlacement, getItemBuildableId, rotatePendingBuildPlacement, shouldReportBuildPlacementFailure, updatePendingBuildPlacement } from "../systems/build-placement-flow";
import { createStructureRenderGeometry, createStructureRenderModel } from "../rendering/structure-render-model";

describe("build item placement flow", () => {
  it("derives every kit buildable from the central item definition", () => {
    expect(getItemDefinition("turret_kit").useAction).toEqual({ kind: "place-buildable", buildableId: "turret" });
    expect(getItemBuildableId("solar_generator_kit")).toBe("solar-generator");
    expect(getItemBuildableId("fuel_generator_kit")).toBe("fuel-generator");
    expect(getItemBuildableId("battery_bank_kit")).toBe("battery-bank");
    expect(getItemBuildableId("makeshift_workbench_kit")).toBe("makeshift_workbench");
    expect(getItemBuildableId("plank_workbench_kit")).toBe("plank_workbench");
    expect(getItemBuildableId("technical_workbench_kit")).toBe("technical_workbench");
  });

  it("starts a pending item placement without creating or consuming anything", () => {
    const create=vi.fn(),consume=vi.fn();
    const pending=createPendingBuildPlacement("turret",{kind:"item",instanceId:"kit-7",itemId:"turret_kit"});
    expect(pending).toMatchObject({buildableId:"turret",source:{kind:"item",instanceId:"kit-7",itemId:"turret_kit"},valid:false,previewRevision:0});
    expect(create).not.toHaveBeenCalled();expect(consume).not.toHaveBeenCalled();
  });

  it("uses the actual rotated footprint for preview and installed geometry", () => {
    const pending=createPendingBuildPlacement("technical_workbench",{kind:"materials"});rotatePendingBuildPlacement(pending);
    expect(getRotatedStructureFootprint("technical_workbench",pending.rotation)).toEqual({width:2,height:3});
    const placement={kind:"footprint" as const,tileX:4,tileY:5,rotation:pending.rotation};
    const preview=createStructureRenderModel("technical_workbench",placement,{alpha:BUILD_PREVIEW_ALPHA});
    const installed=createPlacedStructure("structure-1","technical_workbench",4,5,pending.rotation);
    expect(preview.geometry).toEqual(createStructureRenderGeometry(installed.kind,installed.placement));
    expect(preview.alpha).toBe(0.5);expect(preview.alpha).toBeLessThan(1);
  });

  it("keeps preview out of runtime registrations and save data", () => {
    expect(BUILD_PREVIEW_REGISTRATIONS).toEqual({collision:false,worldObjects:false,powerGrid:false,saveSnapshot:false,fogVision:false,storage:false,craftingStation:false});
  });

  it("caches validation at the same snapped position and invalidates after rotation", () => {
    const pending=createPendingBuildPlacement("technical_workbench",{kind:"materials"});const validate=vi.fn(()=>null);
    expect(updatePendingBuildPlacement(pending,7,9,validate)).toBe(true);expect(updatePendingBuildPlacement(pending,7,9,validate)).toBe(false);expect(validate).toHaveBeenCalledOnce();
    rotatePendingBuildPlacement(pending);expect(updatePendingBuildPlacement(pending,7,9,validate)).toBe(true);expect(validate).toHaveBeenCalledTimes(2);expect(pending.previewRevision).toBe(3);
  });

  it("cycles footprint rotation and flips a door hinge without consuming", () => {
    const door=createPendingBuildPlacement("wood-door",{kind:"materials"});const source=door.source;
    rotatePendingBuildPlacement(door);expect(door.rotation).toBe(1);expect(door.hingeSide).toBe(-1);expect(door.source).toBe(source);
    rotatePendingBuildPlacement(door);expect(door.rotation).toBe(2);expect(door.hingeSide).toBe(1);
  });

  it("consumes once and creates once only for a valid confirmation", () => {
    const pending=createPendingBuildPlacement("turret",{kind:"item",instanceId:"kit-1",itemId:"turret_kit"});updatePendingBuildPlacement(pending,3,4,()=>null);
    const consume=vi.fn(()=>true),create=vi.fn();const transaction={validateSource:()=>true,validatePlacement:()=>true,consumeSource:consume,restoreSource:vi.fn(),create,rollbackCreate:vi.fn()};
    expect(confirmPendingBuildPlacement(pending,transaction)).toBe(true);expect(consume).toHaveBeenCalledOnce();expect(create).toHaveBeenCalledOnce();
  });

  it("does not consume, create, or exit intent for invalid placement", () => {
    const pending=createPendingBuildPlacement("turret",{kind:"item",instanceId:"kit-1",itemId:"turret_kit"});updatePendingBuildPlacement(pending,3,4,()=>"occupied");
    const consume=vi.fn(()=>true),create=vi.fn();expect(confirmPendingBuildPlacement(pending,{validateSource:()=>true,validatePlacement:()=>false,consumeSource:consume,restoreSource:vi.fn(),create,rollbackCreate:vi.fn()})).toBe(false);
    expect(consume).not.toHaveBeenCalled();expect(create).not.toHaveBeenCalled();expect(pending.invalidReason).toBe("occupied");expect(pending.valid).toBe(false);
    updatePendingBuildPlacement(pending,6,7,()=>null);expect(pending.valid).toBe(true);
  });

  it("rolls source and created runtime state back when creation fails", () => {
    const pending=createPendingBuildPlacement("turret",{kind:"item",instanceId:"kit-1",itemId:"turret_kit"});updatePendingBuildPlacement(pending,1,1,()=>null);
    const restoreSource=vi.fn(),rollbackCreate=vi.fn();expect(confirmPendingBuildPlacement(pending,{validateSource:()=>true,validatePlacement:()=>true,consumeSource:()=>true,restoreSource,create:()=>{throw new Error("registration failed");},rollbackCreate})).toBe(false);
    expect(rollbackCreate).toHaveBeenCalledOnce();expect(restoreSource).toHaveBeenCalledOnce();
  });

  it("throttles repeated invalid-click feedback", () => {
    expect(shouldReportBuildPlacementFailure(1000,0)).toBe(true);expect(shouldReportBuildPlacementFailure(1200,1000)).toBe(false);expect(shouldReportBuildPlacementFailure(1500,1000)).toBe(true);
  });
});
