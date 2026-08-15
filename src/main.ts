import Phaser from "phaser";
import "./style.css";

class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  create(): void {
    this.add
      .text(240, 135, "LAST BLOCK", {
        color: "#d8e0d6",
        fontFamily: "monospace",
        fontSize: "20px",
      })
      .setOrigin(0.5);
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "app",
  width: 480,
  height: 270,
  pixelArt: true,
  antialias: false,
  roundPixels: true,
  backgroundColor: "#080b0d",
  scene: [BootScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
});

