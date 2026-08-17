import Phaser from "phaser";
import { AUDIO_ASSETS } from "../data/audio-definitions";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  preload():void {
    let warned=false;
    this.load.on("loaderror",(file:Phaser.Loader.File)=>{if(!warned){warned=true;console.warn(`[audio] Asset failed to load: ${file.key}`);}});
    for(const asset of AUDIO_ASSETS)this.load.audio(asset.key,asset.path);
  }

  create(): void {
    this.scene.start("title");
  }
}

