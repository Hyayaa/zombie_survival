import type { WorldObject, WorldObjectKind } from "../entities/world-object";

export class WorldObjectRegistry {
  private readonly objects = new Map<string, WorldObject>();
  private readonly kindIds = new Map<WorldObjectKind, Set<string>>();
  private readonly interactableIds = new Set<string>();

  register(object: WorldObject): void {
    if (this.objects.has(object.id)) throw new Error(`Duplicate world object id: ${object.id}`);
    this.objects.set(object.id, object);
    let ids = this.kindIds.get(object.kind);
    if (!ids) { ids = new Set<string>(); this.kindIds.set(object.kind, ids); }
    ids.add(object.id);
    if (object.interaction) this.interactableIds.add(object.id);
  }

  unregister(id: string): WorldObject | undefined {
    const object = this.objects.get(id);
    if (!object) return undefined;
    this.objects.delete(id);
    this.kindIds.get(object.kind)?.delete(id);
    this.interactableIds.delete(id);
    return object;
  }

  setInteractable(id: string, enabled: boolean): void {
    const object = this.objects.get(id);
    if (!object?.interaction) return;
    if (enabled) this.interactableIds.add(id);
    else this.interactableIds.delete(id);
  }

  get(id: string): WorldObject | undefined { return this.objects.get(id); }
  all(): Iterable<WorldObject> { return this.objects.values(); }

  *byKind(kind: WorldObjectKind): Iterable<WorldObject> {
    for (const id of this.kindIds.get(kind) ?? []) {
      const object = this.objects.get(id);
      if (object) yield object;
    }
  }

  *interactables(): Iterable<WorldObject> {
    for (const id of this.interactableIds) {
      const object = this.objects.get(id);
      if (object?.interaction) yield object;
    }
  }

  clear(): void {
    this.objects.clear(); this.kindIds.clear(); this.interactableIds.clear();
  }

  get size(): number { return this.objects.size; }
}
