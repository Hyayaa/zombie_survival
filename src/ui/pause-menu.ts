export interface PauseMenuCallbacks {
  onResume(): void;
  onSave(): void;
  onRestart(): void;
}

export class PauseMenu {
  readonly root: HTMLDivElement;

  constructor(parent: HTMLElement, callbacks: PauseMenuCallbacks) {
    this.root = document.createElement("div");
    this.root.className = "modal-layer";
    this.root.hidden = true;
    this.root.innerHTML = `<section class="pause-panel pixel-panel"><h2>일시정지</h2><button data-action="resume">계속</button><button data-action="save">저장</button><button data-action="restart">새 게임</button><small>저장 데이터는 이 브라우저에 보관됩니다.</small></section>`;
    this.root.addEventListener("click", (event) => {
      const action = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-action]")?.dataset.action;
      if (action === "resume") callbacks.onResume();
      if (action === "save") callbacks.onSave();
      if (action === "restart") callbacks.onRestart();
    });
    parent.append(this.root);
  }

  toggle(): boolean {
    this.root.hidden = !this.root.hidden;
    return !this.root.hidden;
  }

  hide(): void { this.root.hidden = true; }
  isOpen(): boolean { return !this.root.hidden; }
  destroy(): void { this.root.remove(); }
}

