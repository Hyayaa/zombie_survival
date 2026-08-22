import { spreadToCrosshairGap } from "../systems/weapon-accuracy-system";

export interface WeaponCrosshairState {
  x: number; y: number; spreadRadians: number; ranged: boolean; pointerInsideGame: boolean;
  windowFocused: boolean; blocked: boolean; now: number;
}

export function shouldShowWeaponCrosshair(state: Pick<WeaponCrosshairState, "ranged" | "pointerInsideGame" | "windowFocused" | "blocked">): boolean {
  return state.ranged && state.pointerInsideGame && state.windowFocused && !state.blocked;
}

const HIT_DURATION_MS = 85;
const HIT_MIN_INTERVAL_MS = 42;

export class WeaponCrosshair {
  readonly root: HTMLDivElement;
  private hitUntil = 0;
  private lastHitAt = -10_000;
  private lastHitSequence = -1;

  constructor(parent: HTMLElement, private readonly canvas: HTMLCanvasElement) {
    this.root = document.createElement("div");
    this.root.className = "weapon-crosshair";
    this.root.setAttribute("aria-hidden", "true");
    for (const direction of ["top", "right", "bottom", "left"] as const) {
      const arm = document.createElement("i"); arm.className = `weapon-crosshair__arm weapon-crosshair__arm--${direction}`; this.root.append(arm);
    }
    parent.append(this.root);
  }

  update(state: WeaponCrosshairState): void {
    const visible = shouldShowWeaponCrosshair(state);
    this.root.hidden = !visible;
    this.canvas.classList.toggle("has-weapon-crosshair", visible);
    if (!visible) return;
    const hit = state.now < this.hitUntil;
    const gap = Math.max(5, spreadToCrosshairGap(state.spreadRadians) - (hit ? 3 : 0));
    this.root.style.setProperty("--crosshair-x", `${Math.round(state.x)}px`);
    this.root.style.setProperty("--crosshair-y", `${Math.round(state.y)}px`);
    this.root.style.setProperty("--crosshair-gap", `${gap}px`);
    this.root.classList.toggle("is-hit", hit);
  }

  registerHit(shotSequence: number, now: number): boolean {
    if (shotSequence === this.lastHitSequence || now - this.lastHitAt < HIT_MIN_INTERVAL_MS) return false;
    this.lastHitSequence = shotSequence; this.lastHitAt = now; this.hitUntil = now + HIT_DURATION_MS;
    return true;
  }

  clearFeedback(): void { this.hitUntil = 0; this.lastHitAt = -10_000; this.lastHitSequence = -1; this.root.classList.remove("is-hit"); }
  destroy(): void { this.canvas.classList.remove("has-weapon-crosshair"); this.root.remove(); }
}

export const WEAPON_CROSSHAIR_HIT_DURATION_MS = HIT_DURATION_MS;
