import { describe, expect, it, vi } from "vitest";
import { AUTO_PICKUP_BUCKET_SIZE, AUTO_PICKUP_INTERVAL_MS, AUTO_PICKUP_RADIUS, AutoPickupSystem } from "../systems/auto-pickup-system";

describe("automatic item pickup", () => {
  it("uses the fixed interval, radius, and two-tile spatial buckets", () => {
    expect(AUTO_PICKUP_INTERVAL_MS).toBe(80); expect(AUTO_PICKUP_RADIUS).toBe(18); expect(AUTO_PICKUP_BUCKET_SIZE).toBe(48);
  });

  it("collects only nearby visible drops and aggregates identical items", () => {
    const system = new AutoPickupSystem();
    system.register({ id: "a", itemId: "wood", quantity: 2, x: 10, y: 0 });
    system.register({ id: "b", itemId: "wood", quantity: 3, x: -10, y: 0 });
    system.register({ id: "far", itemId: "metal", quantity: 1, x: 19, y: 0 });
    system.register({ id: "wall", itemId: "cloth", quantity: 1, x: 0, y: 10 });
    const result = system.collect({ x: 0, y: 0 }, (_from, to) => to.y === 0, (_id, amount) => amount);
    expect([...result.acquired]).toEqual([["wood", 5]]); expect(result.removedIds.sort()).toEqual(["a", "b"]); expect(result.blockedByCapacity).toBe(false);
  });

  it("leaves partial quantities registered and reports capacity blockage", () => {
    const system = new AutoPickupSystem(); const drop = { id: "partial", itemId: "wood", quantity: 5, x: 1, y: 1 }; system.register(drop);
    expect(system.collect({ x: 0, y: 0 }, () => true, () => 2)).toMatchObject({ removedIds: [], blockedByCapacity: false });
    expect(drop.quantity).toBe(3);
    const blocked = system.collect({ x: 0, y: 0 }, () => true, () => 0);
    expect(blocked.blockedByCapacity).toBe(true); expect(drop.quantity).toBe(3);
  });

  it("removes lifecycle entries from buckets", () => {
    const system = new AutoPickupSystem(); system.register({ id: "gone", itemId: "wood", quantity: 1, x: 0, y: 0 }); system.remove("gone");
    const add = vi.fn(); system.collect({ x: 0, y: 0 }, () => true, add); expect(add).not.toHaveBeenCalled();
  });
});
