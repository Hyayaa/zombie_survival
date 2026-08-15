import Phaser from "phaser";
import "./style.css";
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from "./config/game-config";
import { BootScene } from "./scenes/boot-scene";
import { ResultScene } from "./scenes/result-scene";
import { TitleScene } from "./scenes/title-scene";
import { WorldScene } from "./scenes/world-scene";

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "app",
  width: LOGICAL_WIDTH,
  height: LOGICAL_HEIGHT,
  pixelArt: true,
  antialias: false,
  roundPixels: true,
  backgroundColor: "#080b0d",
  scene: [BootScene, TitleScene, WorldScene, ResultScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
});
