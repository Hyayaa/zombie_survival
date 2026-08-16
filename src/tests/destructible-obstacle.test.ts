import { describe, expect, it } from "vitest";
import { OBSTACLE_BALANCE } from "../config/game-config";
import type { DoorDefinition, WorldObstacle } from "../data/map-definitions";
import { DestructibleObstacleSystem, getZombieStructureDamage } from "../entities/destructible-obstacle";
import { CollisionSystem } from "../systems/collision-system";

function door(open = false): DoorDefinition {
  return {
    kind: "door", id: "door-a", tileX: 2, tileY: 2, orientation: "horizontal", open,
    health: OBSTACLE_BALANCE.doorHealth, maxHealth: OBSTACLE_BALANCE.doorHealth, destroyed: false,
  };
}

function blocker(id: string, kind: WorldObstacle["kind"] = "wall"): WorldObstacle {
  return { id, kind, tileX: 2, tileY: 2, widthTiles: 1, heightTiles: 1, blocksMovement: true, blocksVision: true, blocksProjectiles: true, coverHeight: "full" };
}

describe("destructible obstacles", () => {
  it("derives structure damage without changing actor damage values", () => {
    expect(getZombieStructureDamage(9)).toBe(7);
    expect(getZombieStructureDamage(7)).toBe(6);
    expect(getZombieStructureDamage(1)).toBe(4);
  });
  it("clamps door health and emits its destruction transition once", () => {
    const definition = door();
    const system = new DestructibleObstacleSystem([definition], 8);
    expect(system.damage(definition.id, 10)?.state.health).toBe(38);
    const destroyed = system.damage(definition.id, 100);
    expect(destroyed?.state.health).toBe(0);
    expect(destroyed?.destroyedNow).toBe(true);
    expect(system.damage(definition.id, 10)).toBeUndefined();
  });

  it("uses 96 health for saved barricades and removes destroyed runtime state", () => {
    const system = new DestructibleObstacleSystem([], 8);
    const barricade = system.addBarricade({ id: "b", tileX: 3, tileY: 3, health: 96, maxHealth: 96 });
    expect(barricade.maxHealth).toBe(OBSTACLE_BALANCE.barricadeHealth);
    expect(system.damage("b", 200)?.destroyedNow).toBe(true);
    expect(system.removeBarricade("b")?.health).toBe(0);
    expect(system.get("b")).toBeUndefined();
  });

  it("keeps an overlapping static blocker after a barricade is removed", () => {
    const collision = new CollisionSystem([blocker("wall")], [], 8, 8);
    collision.addDynamicObstacle({ ...blocker("barricade", "barricade"), blocksVision: false, coverHeight: "low" });
    expect(collision.isTileBlocked(2, 2)).toBe(true);
    expect(collision.removeDynamicObstacle("barricade")).toBe(true);
    expect(collision.isTileBlocked(2, 2)).toBe(true);
    expect(collision.isHardBlockedTile(2, 2)).toBe(true);
  });

  it("opens and destroys doors across movement, vision and projectile grids", () => {
    const definition = door();
    const collision = new CollisionSystem([], [definition], 8, 8);
    expect(collision.getZombieTraversalCost(2, 2)).toBe(OBSTACLE_BALANCE.doorTraversalCost);
    expect(collision.isTileBlocked(2, 2)).toBe(true);
    expect(collision.blocksVisionWorld(60, 60)).toBe(true);
    expect(collision.blocksProjectilesWorld(60, 60)).toBe(true);
    collision.setDoorOpen(definition.id, true);
    expect(collision.getZombieTraversalCost(2, 2)).toBe(1);
    expect(collision.isTileBlocked(2, 2)).toBe(false);
    collision.setDoorOpen(definition.id, false);
    definition.destroyed = true;
    definition.health = 0;
    collision.setDoorDestroyed(definition.id);
    expect(definition.open).toBe(true);
    expect(collision.isTileBlocked(2, 2)).toBe(false);
    expect(collision.blocksVisionWorld(60, 60)).toBe(false);
    expect(collision.blocksProjectilesWorld(60, 60)).toBe(false);
  });
});
