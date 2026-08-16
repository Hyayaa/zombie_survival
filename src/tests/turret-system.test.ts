import { describe, expect, it } from "vitest";
import { selectTurretTarget } from "../systems/turret-system";
import { CollisionSystem } from "../systems/collision-system";

const zombie = (id: string, x: number, alive=true, active=true) => ({ id, position:{x,y:0}, alive, active, kind:"zombie" as const });
describe("turret system", () => {
  it("requires power and chooses nearest active living visible zombie in range", () => {
    const targets=[zombie("far",150),zombie("near",50),zombie("dead",20,false),zombie("dormant",10,true,false),zombie("out",181)];
    expect(selectTurretTarget({x:0,y:0},false,targets,()=>true)).toBeUndefined();
    expect(selectTurretTarget({x:0,y:0},true,targets,()=>true)?.id).toBe("near");
    expect(selectTurretTarget({x:0,y:0},true,targets,(_from,to)=>to.x!==50)?.id).toBe("far");
  });
  it("keeps a current target unless the replacement is materially closer", () => {
    expect(selectTurretTarget({x:0,y:0},true,[zombie("current",100),zombie("new",90)],()=>true,"current")?.id).toBe("current");
    expect(selectTurretTarget({x:0,y:0},true,[zombie("current",100),zombie("new",70)],()=>true,"current")?.id).toBe("new");
  });
  it("rejects targets behind walls and closed doors but accepts an opened door", () => {
    const origin={x:12,y:12}; const target=[{...zombie("z",60),position:{x:60,y:12}}];
    const wall = new CollisionSystem([{ id:"wall",tileX:1,tileY:0,widthTiles:1,heightTiles:1,blocksMovement:true,blocksVision:true,blocksProjectiles:true,coverHeight:"full",kind:"wall" }],[],8,8,24);
    expect(selectTurretTarget(origin,true,target,(from,to)=>wall.hasLineOfSight(from,to))).toBeUndefined();
    const door = { kind:"door" as const,id:"door",tileX:1,tileY:0,orientation:"vertical" as const,open:false,health:48,maxHealth:48,destroyed:false };
    const doors = new CollisionSystem([], [door], 8, 8, 24);
    expect(selectTurretTarget(origin,true,target,(from,to)=>doors.hasLineOfSight(from,to))).toBeUndefined();
    doors.setDoorOpen("door",true);
    expect(selectTurretTarget(origin,true,target,(from,to)=>doors.hasLineOfSight(from,to))?.id).toBe("z");
  });
  it("starts projectiles outside its own blocking base", () => {
    const collision = new CollisionSystem([], [], 8, 8, 24);
    collision.addDynamicObstacle({ id:"turret",tileX:0,tileY:0,widthTiles:1,heightTiles:1,blocksMovement:true,blocksVision:false,blocksProjectiles:true,coverHeight:"low",kind:"furniture" });
    expect(collision.firstProjectileCollision({x:25,y:12},{x:80,y:12})).toBeNull();
  });
});
