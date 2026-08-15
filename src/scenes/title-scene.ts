import Phaser from "phaser";
import { SAVE_KEY } from "../config/game-config";
import { CONTROL_HELP } from "../config/controls-config";
import { SaveSystem } from "../systems/save-system";

export class TitleScene extends Phaser.Scene {
  constructor() {
    super("title");
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x080b0d);
    this.add.rectangle(240, 135, 470, 260, 0x12191a).setStrokeStyle(2, 0x52605b);
    this.add.text(28, 24, "LAST BLOCK", { fontFamily: "monospace", fontSize: "30px", color: "#d8e0d6", fontStyle: "bold" });
    this.add.text(30, 61, "마지막 도시 블록에서 물자와 동료를 모아\n밤의 포위망을 뚫고 탈출하세요.", { fontFamily: "monospace", fontSize: "11px", color: "#9daaa4", lineSpacing: 3 });

    this.createButton(32, 112, "새 게임", () => {
      new SaveSystem(window.localStorage, SAVE_KEY).clear();
      this.scene.start("world", { load: false });
    });
    const saveSystem = new SaveSystem(window.localStorage, SAVE_KEY);
    if (saveSystem.hasSave()) this.createButton(32, 147, "계속하기", () => this.scene.start("world", { load: true }));

    this.add.text(235, 24, "조작", { fontFamily: "monospace", fontSize: "13px", color: "#d0b86d" });
    const controls = CONTROL_HELP.map(([key, action]) => `${key.padEnd(8, " ")} ${action}`).join("\n");
    this.add.text(235, 48, controls, { fontFamily: "monospace", fontSize: "9px", color: "#b8c0bb", lineSpacing: 2 });
    this.add.text(30, 232, "독립 제작 프로토타입 · 원작 그래픽/음악/맵 미사용", { fontFamily: "monospace", fontSize: "8px", color: "#68736e" });
  }

  private createButton(x: number, y: number, label: string, action: () => void): void {
    const background = this.add.rectangle(x, y, 160, 27, 0x273331).setOrigin(0, 0.5).setStrokeStyle(1, 0x76867f).setInteractive({ useHandCursor: true });
    const text = this.add.text(x + 12, y, label, { fontFamily: "monospace", fontSize: "12px", color: "#e1e6df" }).setOrigin(0, 0.5);
    background.on("pointerover", () => { background.setFillStyle(0x3b4b47); text.setColor("#ffffff"); });
    background.on("pointerout", () => { background.setFillStyle(0x273331); text.setColor("#e1e6df"); });
    background.on("pointerdown", action);
  }
}

