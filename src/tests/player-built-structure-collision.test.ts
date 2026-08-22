import { describe, expect, it } from "vitest";
import { CollisionSystem } from "../systems/collision-system";

describe("player-built segment collision", () => {
  it("blocks movement, vision and projectiles precisely, then updates revisions on removal", () => {
    const collision=new CollisionSystem([],[],8,8,24); const geometry={startX:48,startY:48,endX:72,endY:72,thickness:5};
    collision.addDynamicSegment("wall",geometry,{blocksMovement:true,blocksVision:true,blocksProjectiles:true});
    expect(collision.canOccupyCircle(60,60,5)).toBe(false); expect(collision.canOccupyCircle(60,36,5)).toBe(true);
    expect(collision.hasLineOfSight({x:48,y:72},{x:72,y:48})).toBe(false); expect(collision.firstProjectileCollision({x:48,y:72},{x:72,y:48})).not.toBeNull();
    const navigation=collision.navigationRevision, vision=collision.visionRevision, projectile=collision.projectileCollisionRevision;
    collision.removeDynamicSegment("wall"); expect(collision.canOccupyCircle(60,60,5)).toBe(true);
    expect(collision.navigationRevision).toBeGreaterThan(navigation); expect(collision.visionRevision).toBeGreaterThan(vision); expect(collision.projectileCollisionRevision).toBeGreaterThan(projectile);
  });
  it("opens and closes a player door without rebuilding the grid", () => { const collision=new CollisionSystem([],[],8,8,24); collision.addDynamicSegment("door",{startX:48,startY:48,endX:72,endY:48,thickness:5},{blocksMovement:true,blocksVision:true,blocksProjectiles:true}); expect(collision.canOccupyCircle(60,48,4)).toBe(false); collision.setDynamicSegmentActive("door",false); expect(collision.canOccupyCircle(60,48,4)).toBe(true); });
});
