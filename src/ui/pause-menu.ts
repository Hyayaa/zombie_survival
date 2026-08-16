export interface PauseMenuCallbacks {
  onResume(): void;
  onSave(): void;
  onRestart(): void;
  onDeveloperModeChange(enabled: boolean): void;
}

export type PauseMenuScreen = "main" | "settings";
export function pauseEscapeAction(screen: PauseMenuScreen): "back" | "resume" { return screen === "settings" ? "back" : "resume"; }

export class PauseMenu {
  readonly root: HTMLDivElement;
  private screen: PauseMenuScreen = "main";
  private developerMode = false;
  private readonly panel: HTMLElement;

  constructor(parent: HTMLElement, callbacks: PauseMenuCallbacks) {
    this.root = document.createElement("div");
    this.root.className = "modal-layer";
    this.root.hidden = true;
    this.root.innerHTML = `<section class="pause-panel pixel-panel"></section>`;
    const panel = this.root.querySelector<HTMLElement>(".pause-panel");
    if (!panel) throw new Error("Pause panel missing");
    this.panel = panel;
    this.root.addEventListener("click", (event) => {
      const action = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-action]")?.dataset.action;
      if (action === "resume") callbacks.onResume();
      if (action === "save") callbacks.onSave();
      if (action === "restart") callbacks.onRestart();
      if (action === "settings") this.showSettings();
      if (action === "back") this.showMain();
      if (action === "developer-mode") {
        this.developerMode = !this.developerMode;
        callbacks.onDeveloperModeChange(this.developerMode);
        this.render();
      }
    });
    parent.append(this.root); this.render();
  }

  toggle(): boolean {
    if (this.root.hidden) { this.screen = "main"; this.root.hidden = false; this.render(); }
    else this.root.hidden = true;
    return !this.root.hidden;
  }

  setDeveloperMode(enabled: boolean): void { this.developerMode = enabled; if (this.screen === "settings") this.render(); }
  getScreen(): PauseMenuScreen { return this.screen; }
  showMain(): void { this.screen = "main"; this.render(); }
  showSettings(): void { this.screen = "settings"; this.render(); }
  handleEscape(): "back" | "resume" | "none" {
    if (!this.isOpen()) return "none";
    if (pauseEscapeAction(this.screen) === "back") { this.showMain(); return "back"; }
    this.hide(); return "resume";
  }
  hide(): void { this.root.hidden = true; }
  isOpen(): boolean { return !this.root.hidden; }
  destroy(): void { this.root.remove(); }

  private render(): void {
    this.panel.innerHTML = this.screen === "main"
      ? `<h2>일시정지</h2><button data-action="resume">계속</button><button data-action="save">저장</button><button data-action="settings">설정</button><button data-action="restart">새 게임</button><small>저장 데이터는 이 브라우저에 보관됩니다.</small>`
      : `<h2>설정</h2><button data-action="developer-mode">개발자 모드 · ${this.developerMode ? "켜짐" : "꺼짐"}</button><button data-action="back">뒤로</button><small>개발자 설정은 게임 저장과 별도로 유지됩니다.</small>`;
  }
}
