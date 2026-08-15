import type { CompanionCommand } from "../entities/companion";

export class CompanionCommandPanel {
  readonly root: HTMLDivElement;

  constructor(parent: HTMLElement, onCommand: (command: CompanionCommand) => void) {
    this.root = document.createElement("div");
    this.root.className = "command-panel pixel-panel";
    this.root.hidden = true;
    this.root.innerHTML = `
      <b>동료 명령</b>
      <button data-command="follow">따라오기</button>
      <button data-command="hold">현재 위치 사수</button>
      <button data-command="move">지정 위치로 이동</button>
      <button data-command="focus">지정 적 집중 공격</button>
      <small>이동·집중은 버튼 뒤 월드를 클릭</small>
    `;
    this.root.addEventListener("click", (event) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-command]");
      if (button?.dataset.command) onCommand(button.dataset.command as CompanionCommand);
    });
    parent.append(this.root);
  }

  toggle(): boolean {
    this.root.hidden = !this.root.hidden;
    return !this.root.hidden;
  }

  hide(): void {
    this.root.hidden = true;
  }

  isOpen(): boolean {
    return !this.root.hidden;
  }

  destroy(): void {
    this.root.remove();
  }
}

