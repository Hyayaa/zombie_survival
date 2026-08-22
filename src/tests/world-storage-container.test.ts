import { describe, expect, it } from "vitest";
import { deterministicStorageDropOffsets, WorldStorageContainer } from "../systems/world-storage-container";

describe("world storage container", () => {
  it("is an independent 8x6 rotatable grid with stable snapshots", () => { const crate=new WorldStorageContainer("structure:c:storage"); expect(crate.width).toBe(8); expect(crate.height).toBe(6); expect(crate.add("wood",4,0,0)).toBe(true); const id=crate.getItems()[0]!.instanceId; expect(crate.rotate(id)).toBe(true); const restored=new WorldStorageContainer("structure:c:storage",8,6,crate.snapshot()); expect(restored.getItems()).toEqual(crate.getItems()); });
  it("drains every item in stable order and uses deterministic scatter", () => { const crate=new WorldStorageContainer("structure:c:storage"); crate.add("cloth",2,2,0); crate.add("wood",3,0,0); const before=crate.getItems().reduce((sum,item)=>sum+item.quantity,0); const dropped=crate.drainForDestruction(); expect(dropped.reduce((sum,item)=>sum+item.quantity,0)).toBe(before); expect(crate.isEmpty()).toBe(true); expect(deterministicStorageDropOffsets(10)).toEqual(deterministicStorageDropOffsets(10)); });
});
