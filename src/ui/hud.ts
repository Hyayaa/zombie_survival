import { getItemDefinition } from "../data/item-definitions";
import type { DayPhase } from "../core/game-clock";

export interface HudState {
  health: number;
  infection: number;
  time: string;
  phase: DayPhase;
  weapon: string;
  magazine: number;
  reserveAmmo: number;
  showAmmo: boolean;
  flashlightCharge: number;
  flashlightOn: boolean;
  torchRemaining: number;
  quickslots: Array<string | null>;
  collectedParts: number;
  companions: ReadonlyArray<{ id: string; health: number; maxHealth: number; rescued: boolean; alive: boolean }>;
  objective: string;
  defenseRemaining?: number;
}

const PHASE_LABELS: Record<DayPhase, string> = { day: "낮", dusk: "해질녘", night: "밤", dawn: "새벽" };

export class Hud {
  readonly root: HTMLDivElement;
  private readonly status: HTMLDivElement;
  private readonly quickslots: HTMLDivElement;
  private readonly objective: HTMLDivElement;
  private readonly message: HTMLDivElement;
  private readonly prompt: HTMLDivElement;
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
    this.root.append(this.status, this.quickslots, this.objective, this.message, this.prompt);
    parent.append(this.root);
  }

  update(state: HudState): void {
    const infectionClass = state.infection >= 70 ? "danger" : state.infection >= 40 ? "warn" : "";
    const rescuedCompanions = state.companions.filter((companion) => companion.rescued);
    const companion = `<span class="companion-summary">동료 ${rescuedCompanions.length}/4 ${rescuedCompanions.map((entry, index) => {
      const ratio = Math.max(0, Math.min(100, entry.health / entry.maxHealth * 100));
      return `<span class="companion-chip ${entry.alive ? "" : "is-dead"}" title="${entry.id}">${index + 1}<i><b style="width:${ratio}%"></b></i>${entry.alive ? Math.ceil(entry.health) : "사망"}</span>`;
    }).join("")}</span>`;
    this.status.innerHTML = `
      <span>체력 <b>${Math.ceil(state.health)}</b></span>
      <span>감염 <b class="${infectionClass}">${Math.ceil(state.infection)}%</b></span>
      <span>${state.time} · ${PHASE_LABELS[state.phase]}</span>
      <span>${state.weapon}${state.showAmmo ? ` ${state.magazine}/${state.reserveAmmo}` : ""}</span>
      <span>손전등 ${state.flashlightOn ? "ON" : "OFF"} ${Math.ceil(state.flashlightCharge)}s</span>
      ${state.torchRemaining > 0 ? `<span>횃불 ${Math.ceil(state.torchRemaining)}s</span>` : ""}
      ${companion}
    `;
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
}
