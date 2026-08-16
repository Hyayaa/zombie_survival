import { ENTITY_OUTLINE } from "../config/game-config";

export type EntityOutlineState = "normal" | "interactable";

export interface OutlineableEntityView {
  setOutlineState(state: EntityOutlineState): void;
}

export interface WorldEntityView extends OutlineableEntityView {
  setVisible(visible: boolean): unknown;
  destroy(): void;
}

export class EntityOutlineController {
  private state: EntityOutlineState = "normal";

  constructor(private readonly applyColor: (color: number) => void) {}

  setState(state: EntityOutlineState): boolean {
    if (state === this.state) return false;
    this.state = state;
    this.applyColor(entityOutlineColor(state));
    return true;
  }

  getState(): EntityOutlineState { return this.state; }
}

export function entityOutlineColor(state: EntityOutlineState): number {
  return ENTITY_OUTLINE[state];
}
