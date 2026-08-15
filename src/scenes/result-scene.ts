import Phaser from "phaser";

interface ResultData {
  won: boolean;
  reason: string;
  companionAlive: boolean;
  companionRescued: boolean;
  elapsedSeconds: number;
  parts: number;
}

export class ResultScene extends Phaser.Scene {
  constructor() {
    super("result");
  }

  create(data: ResultData): void {
    const won = Boolean(data.won);
    this.cameras.main.setBackgroundColor(won ? 0x15201b : 0x1c1010);
    this.add.text(240, 55, won ? "탈출 성공" : "생존 실패", {
      fontFamily: "monospace", fontSize: "28px", color: won ? "#b9d29d" : "#d38a7e", fontStyle: "bold",
    }).setOrigin(0.5);
    this.add.text(240, 98, data.reason, { fontFamily: "monospace", fontSize: "11px", color: "#d5dbd5" }).setOrigin(0.5);
    const companion = !data.companionRescued ? "생존자를 찾지 못함" : data.companionAlive ? "동료와 함께 생존" : "동료는 탈출하지 못함";
    const minutes = Math.floor((data.elapsedSeconds ?? 0) / 60);
    const seconds = Math.floor((data.elapsedSeconds ?? 0) % 60);
    this.add.text(240, 127, `경과 ${minutes}:${String(seconds).padStart(2, "0")}\n탈출 부품 ${data.parts}/3\n${companion}`, {
      fontFamily: "monospace", fontSize: "11px", color: "#9fac9f", align: "center", lineSpacing: 5,
    }).setOrigin(0.5, 0);
    const button = this.add.rectangle(240, 218, 160, 30, 0x2d3c37).setStrokeStyle(1, 0x85958c).setInteractive({ useHandCursor: true });
    this.add.text(240, 218, "타이틀로", { fontFamily: "monospace", fontSize: "12px", color: "#ecf0eb" }).setOrigin(0.5);
    button.on("pointerdown", () => this.scene.start("title"));
  }
}

