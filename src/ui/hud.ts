import { getItemDefinition } from "../data/item-definitions";
import { getItemIconPath } from "../data/item-icons";
import type { DayPhase } from "../core/game-clock";
import type { WeaponId } from "../data/weapon-definitions";

export interface HudState {
  health: number;
  infection: number;
  hunger: number;
  thirst: number;
  stamina: number;
  dayNumber: number;
  time: string;
  phase: DayPhase;
  weaponId: WeaponId;
  weapon: string;
  magazine: number;
  reserveAmmo: number;
  showAmmo: boolean;
  reloading: boolean;
  flashlightCharge: number;
  flashlightOn: boolean;
  torchRemaining: number;
  quickslots: Array<string | null>;
  collectedParts: number;
  companions: ReadonlyArray<{ id: string; health: number; maxHealth: number; rescued: boolean; alive: boolean }>;
  objective: string;
  defenseRemaining?: number;
}

export const SURVIVAL_GAUGE_ORDER = ["health", "stamina", "hunger", "thirst", "infection"] as const;
export type SurvivalGaugeKind = typeof SURVIVAL_GAUGE_ORDER[number];
export function clampHudGauge(value: number): number { return Math.max(0, Math.min(100, Math.round(value))); }

const PHASE_LABELS: Record<DayPhase, string> = { day: "낮", dusk: "해질녘", night: "밤", dawn: "새벽" };

export class Hud {
  readonly root: HTMLDivElement;
  private readonly status: HTMLDivElement;
  private readonly quickslots: HTMLDivElement;
  private readonly objective: HTMLDivElement;
  private readonly message: HTMLDivElement;
  private readonly prompt: HTMLDivElement;
  private readonly bottomRight: HTMLDivElement;
  private readonly needs: HTMLDivElement;
  private readonly needBars: Record<SurvivalGaugeKind, { row: HTMLDivElement; value: HTMLElement; fill: HTMLElement }>;
  private readonly lastNeedValues: Record<SurvivalGaugeKind, number> = { health: Number.NaN, stamina: Number.NaN, hunger: Number.NaN, thirst: Number.NaN, infection: Number.NaN };
  private readonly weaponIcon: HTMLImageElement;
  private readonly weaponFallback: HTMLElement;
  private readonly weaponName: HTMLElement;
  private readonly weaponAmmo: HTMLElement;
  private lastWeaponId = "";
  private lastAmmoText = "";
  private messageTimeout?: number;

  constructor(parent: HTMLElement) {
    this.root = document.createElement("div");
    this.root.className = "hud";
    this.status = document.createElement("div");
    this.status.className = "hud__status pixel-panel";
    this.quickslots = document.createElement("div");
    this.quickslots.className = "hud__quickslots";
    this.objective = document.createElement("div");
    this.objective.className = "hud__objective pixel-panel";
    this.message = document.createElement("div");
    this.message.className = "hud__message";
    this.prompt = document.createElement("div");
    this.prompt.className = "hud__prompt pixel-panel";
    this.prompt.hidden = true;
    this.bottomRight = document.createElement("div");
    this.bottomRight.className = "hud__bottom-right";
    this.needs = document.createElement("div");
    this.needs.className = "hud__needs pixel-panel";
    const labels: Record<SurvivalGaugeKind, string> = { health: "체력", stamina: "스태미나", hunger: "허기", thirst: "갈증", infection: "감염" };
    this.needBars = Object.fromEntries(SURVIVAL_GAUGE_ORDER.map((kind) => [kind, this.createNeedBar(labels[kind], kind)])) as typeof this.needBars;
    const weaponPanel = document.createElement("div");
    weaponPanel.className = "hud__weapon pixel-panel";
    const iconFrame = document.createElement("span");
    iconFrame.className = "hud-weapon-icon item-icon-frame";
    this.weaponIcon = document.createElement("img");
    this.weaponIcon.className = "item-icon";
    this.weaponIcon.width = 64; this.weaponIcon.height = 64;
    this.weaponFallback = document.createElement("span");
    this.weaponFallback.className = "item-icon-fallback"; this.weaponFallback.hidden = true;
    this.weaponIcon.addEventListener("error", () => { this.weaponIcon.hidden = true; this.weaponFallback.hidden = false; });
    iconFrame.append(this.weaponIcon, this.weaponFallback);
    const weaponText = document.createElement("span");
    this.weaponName = document.createElement("b");
    this.weaponAmmo = document.createElement("strong");
    weaponText.append(this.weaponName, this.weaponAmmo);
    weaponPanel.append(iconFrame, weaponText);
    this.bottomRight.append(this.needs, weaponPanel);
    this.root.append(this.status, this.quickslots, this.objective, this.message, this.prompt, this.bottomRight);
    parent.append(this.root);
  }

  update(state: HudState): void {
    const rescuedCompanions = state.companions.filter((companion) => companion.rescued);
    const companion = `<span class="companion-summary">동료 ${rescuedCompanions.length}/4 ${rescuedCompanions.map((entry, index) => {
      const ratio = Math.max(0, Math.min(100, entry.health / entry.maxHealth * 100));
      return `<span class="companion-chip ${entry.alive ? "" : "is-dead"}" title="${entry.id}">${index + 1}<i><b style="width:${ratio}%"></b></i>${entry.alive ? Math.ceil(entry.health) : "사망"}</span>`;
    }).join("")}</span>`;
    this.status.innerHTML = `
      <span>DAY ${state.dayNumber} · ${state.time} · ${PHASE_LABELS[state.phase]}</span>
      <span>손전등 ${state.flashlightOn ? "ON" : "OFF"} ${Math.ceil(state.flashlightCharge)}s</span>
      ${state.torchRemaining > 0 ? `<span>횃불 ${Math.ceil(state.torchRemaining)}s</span>` : ""}
      ${companion}
    `;
    this.updateNeedBar("health", state.health);
    this.updateNeedBar("stamina", state.stamina);
    this.updateNeedBar("hunger", state.hunger);
    this.updateNeedBar("thirst", state.thirst);
    this.updateNeedBar("infection", state.infection);
    this.updateWeapon(state);
    this.quickslots.innerHTML = state.quickslots.map((itemId, index) => {
      const label = itemId ? getItemDefinition(itemId).name : "비어 있음";
      return `<span class="quickslot"><b>${index + 1}</b>${label}</span>`;
    }).join("");
    const defense = state.defenseRemaining === undefined ? "" : `<strong> · 방어 ${Math.ceil(state.defenseRemaining)}초</strong>`;
    this.objective.innerHTML = `부품 ${state.collectedParts}/3 · ${state.objective}${defense}`;
  }

  showMessage(text: string, durationMs = 2_400): void {
    this.message.textContent = text;
    this.message.classList.add("is-visible");
    if (this.messageTimeout !== undefined) window.clearTimeout(this.messageTimeout);
    this.messageTimeout = window.setTimeout(() => this.message.classList.remove("is-visible"), durationMs);
  }

  setPrompt(text?: string): void {
    this.prompt.hidden = !text;
    this.prompt.textContent = text ?? "";
  }

  destroy(): void {
    if (this.messageTimeout !== undefined) window.clearTimeout(this.messageTimeout);
    this.root.remove();
  }

  private createNeedBar(label: string, kind: SurvivalGaugeKind): { row: HTMLDivElement; value: HTMLElement; fill: HTMLElement } {
    const row = document.createElement("div");
    row.className = `hud-need hud-need--${kind}`;
    const name = document.createElement("span");
    name.textContent = label;
    const track = document.createElement("i");
    const fill = document.createElement("b");
    track.append(fill);
    const value = document.createElement("strong");
    row.append(name, track, value);
    this.needs.append(row);
    return { row, value, fill };
  }

  private updateNeedBar(kind: SurvivalGaugeKind, rawValue: number): void {
    const value = clampHudGauge(rawValue);
    if (this.lastNeedValues[kind] === value) return;
    this.lastNeedValues[kind] = value;
    const bar = this.needBars[kind];
    bar.value.textContent = String(value);
    bar.fill.style.width = `${value}%`;
    bar.row.classList.toggle("is-low", value > 0 && value <= 25);
    bar.row.classList.toggle("is-empty", value === 0);
  }

  private updateWeapon(state: HudState): void {
    if (state.weaponId !== this.lastWeaponId) {
      this.lastWeaponId = state.weaponId;
      this.weaponName.textContent = state.weapon;
      this.weaponIcon.hidden = false; this.weaponFallback.hidden = true;
      this.weaponIcon.src = getItemIconPath(state.weaponId);
      this.weaponIcon.alt = state.weapon;
    }
    const ammoText = state.reloading ? "재장전 중…" : state.showAmmo ? `${state.magazine} / ${state.reserveAmmo}` : "근접 무기";
    if (ammoText !== this.lastAmmoText) { this.lastAmmoText = ammoText; this.weaponAmmo.textContent = ammoText; }
  }
}
