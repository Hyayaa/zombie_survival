import { CompendiumPanel, type CompendiumPanelState } from "./compendium-panel";
import type { CompendiumEntry } from "../systems/compendium-system";

export interface PauseMenuCallbacks {
  onResume(): void;
  onSave(): void;
  onRestart(): void;
  onDeveloperModeChange(enabled: boolean): void;
  onZombieSpawningChange(enabled: boolean): void;
  onGrantCompendiumEntry(entry: CompendiumEntry): void;
  getCompendiumState(): CompendiumPanelState;
  onUiSound?():void;
}

export type PauseMenuScreen = "main" | "settings" | "compendium";
export function pauseEscapeAction(screen: PauseMenuScreen): "back" | "resume" { return screen === "main" ? "resume" : "back"; }

export class PauseMenu {
  readonly root: HTMLDivElement;
  private screen: PauseMenuScreen = "main";
  private developerMode = false;
  private zombieSpawningEnabled = true;
  private readonly panel: HTMLElement;
  private readonly compendium: CompendiumPanel;

  constructor(parent: HTMLElement, private readonly callbacks: PauseMenuCallbacks) {
    this.root = document.createElement("div");
    this.root.className = "modal-layer";
    this.root.hidden = true;
    this.root.innerHTML = `<section class="pause-panel pixel-panel"></section>`;
    const panel = this.root.querySelector<HTMLElement>(".pause-panel");
    if (!panel) throw new Error("Pause panel missing");
    this.panel = panel;
    this.root.addEventListener("click", (event) => {
      const action = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-action]")?.dataset.action;
      const grant=(event.target as HTMLElement).closest<HTMLButtonElement>("button[data-grant]");
      if(action||grant)callbacks.onUiSound?.();
      if (action === "resume") callbacks.onResume();
      if (action === "save") callbacks.onSave();
      if (action === "restart") callbacks.onRestart();
      if (action === "settings") this.showSettings();
      if (action === "compendium") this.showCompendium();
      if (action === "back") this.showMain();
      if (action === "developer-mode") {
        this.developerMode = !this.developerMode;
        callbacks.onDeveloperModeChange(this.developerMode);
        this.render();
        this.compendium.refresh(callbacks.getCompendiumState());
      }
      if (action === "zombie-spawning") {
        this.zombieSpawningEnabled = !this.zombieSpawningEnabled;
        callbacks.onZombieSpawningChange(this.zombieSpawningEnabled);
        this.render();
      }
    });
    this.compendium = new CompendiumPanel(this.root, () => this.showMain(), (entry) => callbacks.onGrantCompendiumEntry(entry));
    parent.append(this.root); this.render();
  }

  toggle(): boolean {
    if (this.root.hidden) { this.screen = "main"; this.root.hidden = false; this.render(); }
    else this.root.hidden = true;
    return !this.root.hidden;
  }

  setDeveloperMode(enabled: boolean): void { this.developerMode = enabled; if (this.screen === "settings") this.render(); this.compendium.refresh(); }
  setZombieSpawningEnabled(enabled: boolean): void { this.zombieSpawningEnabled = enabled; if (this.screen === "settings") this.render(); }
  getScreen(): PauseMenuScreen { return this.screen; }
  showMain(): void { this.screen = "main"; this.render(); }
  showSettings(): void { this.screen = "settings"; this.render(); }
  showCompendium(): void { this.screen = "compendium"; this.panel.hidden = true; this.compendium.show(this.callbacks.getCompendiumState()); }
  handleEscape(): "back" | "resume" | "none" {
    if (!this.isOpen()) return "none";
    if (pauseEscapeAction(this.screen) === "back") { this.showMain(); return "back"; }
    this.hide(); return "resume";
  }
  hide(): void { this.root.hidden = true; }
  isOpen(): boolean { return !this.root.hidden; }
  destroy(): void { this.root.remove(); }

  private render(): void {
    this.compendium.hide(); this.panel.hidden = false;
    this.panel.innerHTML = this.screen === "main"
      ? `<h2>일시정지</h2><button data-action="resume">계속</button><button data-action="save">저장</button><button data-action="compendium">아이템 도감</button><button data-action="settings">설정</button><button data-action="restart">새 게임</button><small>저장 데이터는 이 브라우저에 보관됩니다.</small>`
      : `<h2>설정</h2><button data-action="developer-mode">개발자 모드 · ${this.developerMode ? "켜짐" : "꺼짐"}</button><h3>테스트</h3><button data-action="zombie-spawning">테스트용 좀비 스폰 · ${this.zombieSpawningEnabled ? "ON" : "OFF"}</button><button data-action="back">뒤로</button><small>개발자·테스트 설정은 게임 저장과 별도로 유지됩니다.</small>`;
  }
}
