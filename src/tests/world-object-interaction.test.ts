import { describe, expect, it, vi } from "vitest";
import type { InteractionComponent, InteractionContext, WorldObject, WorldObjectKind } from "../entities/world-object";
import type { EntityOutlineState, WorldEntityView } from "../rendering/entity-outline";
import { VisibilityState } from "../systems/fog-of-war-system";
import { InteractionSystem } from "../systems/interaction-system";
import { WorldObjectRegistry } from "../systems/world-object-registry";

class FakeView implements WorldEntityView {
  readonly outlines: EntityOutlineState[] = [];
  setOutlineState(state: EntityOutlineState): void { this.outlines.push(state); }
  setVisible(): void {}
  destroy(): void {}
}

function interaction(priority: number, execute = vi.fn()): InteractionComponent {
  return {
    range: 40, requiresLineOfSight: true, selectionPriority: priority,
    isEnabled: () => true, getPrompt: () => "[E] test", execute,
  };
}

function object(id: string, kind: WorldObjectKind, x: number, interactionComponent?: InteractionComponent): WorldObject {
  return {
    id, kind, view: new FakeView(), interaction: interactionComponent,
    getPosition: () => ({ x, y: 0 }), isActive: () => true, isVisible: () => true,
  };
}

function context(visible = true): InteractionContext {
  return {
    playerPosition: { x: 0, y: 0 },
    fog: { getStateAtWorld: () => visible ? VisibilityState.Visible : VisibilityState.Explored },
    collision: { hasLineOfSight: () => true },
  };
}

describe("WorldObjectRegistry and InteractionSystem", () => {
  it("indexes unique objects by kind and removes every lifecycle index", () => {
    const registry = new WorldObjectRegistry();
    const player = object("player", "player", 0);
    const survivor = object("companion-0", "survivor", 10, interaction(10));
    registry.register(player); registry.register(survivor);
    expect([...registry.all()]).toHaveLength(2);
    expect([...registry.byKind("player")]).toEqual([player]);
    expect([...registry.interactables()]).toEqual([survivor]);
    expect(() => registry.register(player)).toThrow(/Duplicate/);
    registry.unregister(survivor.id);
    expect([...registry.byKind("survivor")]).toEqual([]);
    expect([...registry.interactables()]).toEqual([]);
  });

  it("selects exactly one target by priority, distance and stable id", () => {
    const registry = new WorldObjectRegistry();
    const fartherPriority = object("door", "door", 20, interaction(1));
    const nearerLowerPriority = object("item", "item-drop", 5, interaction(2));
    registry.register(nearerLowerPriority); registry.register(fartherPriority);
    const system = new InteractionSystem(registry);
    expect(system.refreshNow(context())?.id).toBe("door");
    expect((fartherPriority.view as FakeView).outlines).toEqual(["interactable"]);
    expect((nearerLowerPriority.view as FakeView).outlines).toEqual([]);

    registry.setInteractable("door", false);
    expect(system.refreshNow(context())?.id).toBe("item");
    expect((fartherPriority.view as FakeView).outlines.at(-1)).toBe("normal");
    expect((nearerLowerPriority.view as FakeView).outlines.at(-1)).toBe("interactable");
  });

  it("uses stable id as the final tie-break and avoids redundant outline writes", () => {
    const registry = new WorldObjectRegistry();
    const beta = object("beta", "container", 10, interaction(4));
    const alpha = object("alpha", "door", 10, interaction(4));
    registry.register(beta); registry.register(alpha);
    const system = new InteractionSystem(registry);
    expect(system.refreshNow(context())?.id).toBe("alpha");
    system.refreshNow(context());
    expect((alpha.view as FakeView).outlines).toEqual(["interactable"]);
  });

  it("clears the current target outside fog and executes only the refreshed target", () => {
    const registry = new WorldObjectRegistry();
    const execute = vi.fn();
    const target = object("target", "container", 8, interaction(1, execute));
    registry.register(target);
    const system = new InteractionSystem(registry);
    const refreshed = system.refreshNow(context());
    refreshed?.interaction?.execute();
    expect(execute).toHaveBeenCalledTimes(1);
    expect(system.refreshNow(context(false))).toBeUndefined();
    expect((target.view as FakeView).outlines.at(-1)).toBe("normal");
  });

  it("selects a door by nearest segment distance while preserving tie-breaking and one target", () => {
    const registry = new WorldObjectRegistry();
    const segmentDoor = object("segment-door", "door", 60, {
      ...interaction(4),
      distanceSquaredTo: (origin) => (origin.x - 28) ** 2 + origin.y ** 2,
    });
    const centered = object("centered", "container", 30, interaction(4));
    registry.register(centered); registry.register(segmentDoor);
    const system = new InteractionSystem(registry);
    expect(system.refreshNow(context())?.id).toBe("segment-door");
    expect((segmentDoor.view as FakeView).outlines.at(-1)).toBe("interactable");
    expect((centered.view as FakeView).outlines).toEqual([]);
    expect(system.getCurrent()?.interaction?.getPrompt()).toBe("[E] test");
  });

  it("rejects a door when its nearest segment point is outside interaction range", () => {
    const registry = new WorldObjectRegistry();
    registry.register(object("segment-door", "door", 20, {
      ...interaction(4),
      distanceSquaredTo: () => 41 ** 2,
    }));
    expect(new InteractionSystem(registry).refreshNow(context())).toBeUndefined();
  });

  it("uses a player-side visibility probe instead of the explored closed-door center", () => {
    const registry = new WorldObjectRegistry();
    const target = object("closed-door", "door", 20, {
      ...interaction(4),
      getVisibilityProbe: (origin) => ({ x: origin.x < 20 ? 16 : 24, y: 0 }),
    });
    registry.register(target);
    const probeContext = context();
    probeContext.playerPosition = { x: 0, y: 0 };
    probeContext.fog = { getStateAtWorld: (x) => x === 16 ? VisibilityState.Visible : VisibilityState.Explored };
    expect(new InteractionSystem(registry).refreshNow(probeContext)).toBe(target);
    probeContext.playerPosition = { x: 40, y: 0 };
    probeContext.fog = { getStateAtWorld: (x) => x === 24 ? VisibilityState.Visible : VisibilityState.Explored };
    expect(new InteractionSystem(registry).refreshNow(probeContext)).toBe(target);
    probeContext.fog = { getStateAtWorld: () => VisibilityState.Explored };
    expect(new InteractionSystem(registry).refreshNow(probeContext)).toBeUndefined();
  });
});
