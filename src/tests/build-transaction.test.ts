import { describe, expect, it } from "vitest";
import { performBuildTransaction } from "../systems/build-transaction";

class Materials { values = new Map([["wood", 20], ["screws", 20]]); count(id:string){return this.values.get(id)??0;} remove(id:string,q:number){if(this.count(id)<q)return false;this.values.set(id,this.count(id)-q);return true;} add(id:string,q:number){this.values.set(id,this.count(id)+q);return q;} }
describe("build transaction", () => {
  it("aggregates chain cost and creates atomically", () => { const inventory=new Materials(); let count=0; expect(performBuildTransaction({kind:"wood-wall",quantity:3,inventory,validate:()=>true,create:()=>{count=3;}})).toBe(true); expect(count).toBe(3); expect(inventory.count("wood")).toBe(8); });
  it("does not consume or partially place when validation or funds fail", () => { const inventory=new Materials(); inventory.values.set("wood",3); let count=0; expect(performBuildTransaction({kind:"wood-wall",quantity:2,inventory,validate:()=>true,create:()=>{count++;}})).toBe(false); expect(count).toBe(0); expect(inventory.count("wood")).toBe(3); });
  it("rolls removed costs back when creation throws", () => { const inventory=new Materials(); expect(performBuildTransaction({kind:"wood-wall",inventory,validate:()=>true,create:()=>{throw new Error("fail");}})).toBe(false); expect(inventory.count("wood")).toBe(20); expect(inventory.count("screws")).toBe(20); });
});
