import type { InteractionContext, WorldObject } from "../entities/world-object";
import { VisibilityState } from "./fog-of-war-system";
import { WorldObjectRegistry } from "./world-object-registry";

export class InteractionSystem {
  private current?: WorldObject;
  private nextRefreshAt = 0;

  constructor(private readonly registry: WorldObjectRegistry, private readonly intervalMs = 75) {}

  update(now: number, context: InteractionContext): WorldObject | undefined {
    if (now < this.nextRefreshAt) return this.current;
    this.nextRefreshAt = now + this.intervalMs;
    return this.select(context);
  }

  refreshNow(context: InteractionContext): WorldObject | undefined {
    this.nextRefreshAt = 0;
    return this.select(context);
  }

  getCurrent(): WorldObject | undefined { return this.current; }

  invalidate(): void { this.nextRefreshAt = 0; }

  clear(): void {
    if (this.current) this.current.view.setOutlineState("normal");
    this.current = undefined;
    this.nextRefreshAt = 0;
  }

  private select(context: InteractionContext): WorldObject | undefined {
    let best: WorldObject | undefined;
    let bestPriority = Number.POSITIVE_INFINITY;
    let bestDistanceSquared = Number.POSITIVE_INFINITY;
    for (const object of this.registry.interactables()) {
      const interaction = object.interaction;
      if (!interaction || !object.isActive() || !object.isVisible() || !interaction.isEnabled(context)) continue;
      const position = object.getPosition();
      if (context.fog.getStateAtWorld(position.x, position.y) !== VisibilityState.Visible) continue;
      const deltaX = position.x - context.playerPosition.x;
      const deltaY = position.y - context.playerPosition.y;
      const distanceSquared = deltaX * deltaX + deltaY * deltaY;
      if (distanceSquared > interaction.range * interaction.range) continue;
      if (interaction.requiresLineOfSight && !context.collision.hasLineOfSight(context.playerPosition, position)) continue;
      const priority = interaction.selectionPriority;
      if (priority > bestPriority) continue;
      if (priority === bestPriority && distanceSquared > bestDistanceSquared) continue;
      if (priority === bestPriority && distanceSquared === bestDistanceSquared && best && object.id >= best.id) continue;
      best = object; bestPriority = priority; bestDistanceSquared = distanceSquared;
    }
    this.setCurrent(best);
    return best;
  }

  private setCurrent(next?: WorldObject): void {
    if (next?.id === this.current?.id) return;
    this.current?.view.setOutlineState("normal");
    this.current = next;
    this.current?.view.setOutlineState("interactable");
  }
}
