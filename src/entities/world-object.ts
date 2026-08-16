import type { WorldEntityView } from "../rendering/entity-outline";
import type { CollisionSystem } from "../systems/collision-system";
import type { FogOfWarSystem } from "../systems/fog-of-war-system";
import type { Point } from "../systems/zombie-ai-system";

export type WorldObjectKind =
  | "player"
  | "companion"
  | "survivor"
  | "zombie"
  | "door"
  | "barricade"
  | "power-structure"
  | "container"
  | "item-drop"
  | "extraction";

export interface InteractionContext {
  playerPosition: Point;
  fog: Pick<FogOfWarSystem, "getStateAtWorld">;
  collision: Pick<CollisionSystem, "hasLineOfSight">;
}

export interface InteractionComponent {
  readonly range: number;
  readonly requiresLineOfSight: boolean;
  readonly selectionPriority: number;
  distanceSquaredTo?(origin: Point): number;
  getVisibilityProbe?(origin: Point): Point;
  isEnabled(context: InteractionContext): boolean;
  getPrompt(): string;
  execute(): void;
}

export interface WorldObject {
  readonly id: string;
  readonly kind: WorldObjectKind;
  readonly view: WorldEntityView;
  readonly interaction?: InteractionComponent;
  getPosition(): Point;
  isActive(): boolean;
  isVisible(): boolean;
}
