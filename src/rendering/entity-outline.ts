import { ENTITY_OUTLINE } from "../config/game-config";

export type EntityOutlineState = "normal" | "interactable";

export interface OutlineableEntityView {
  setOutlineState(state: EntityOutlineState): void;
}

export function entityOutlineColor(state: EntityOutlineState): number {
  return ENTITY_OUTLINE[state];
}
