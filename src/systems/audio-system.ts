import Phaser from "phaser";
import { AUDIO_CUES, BGM_DEFINITION, type AudioCue } from "../data/audio-definitions";
import type { Point } from "./zombie-ai-system";
import type { FirearmId } from "../data/weapon-definitions";
export interface AudioPlayOptions { source?:Point; listener?:Point; volumeScale?:number }
export type FirearmShotCue="pistol-shot"|"smg-shot"|"shotgun-shot"|"rifle-shot";
export interface FirearmAudioSink{playForEvent(cue:FirearmShotCue,eventSequence:number,options?:AudioPlayOptions):boolean}
export function getFirearmShotCue(weaponId:FirearmId):FirearmShotCue{return weaponId==="smg"?"smg-shot":weaponId==="shotgun"?"shotgun-shot":weaponId==="hunting_rifle"?"rifle-shot":"pistol-shot";}
export function playFirearmShotForEvent(sink:FirearmAudioSink,weaponId:FirearmId,eventSequence:number,options:AudioPlayOptions={}):boolean{return sink.playForEvent(getFirearmShotCue(weaponId),eventSequence,options);}
export class AudioEventGate {
  private readonly lastSequence=new Map<AudioCue,number>();
  allow(cue:AudioCue,sequence:number):boolean{if(this.lastSequence.get(cue)===sequence)return false;this.lastSequence.set(cue,sequence);return true;}
  clear():void{this.lastSequence.clear();}
}
export class AudioSystem {
  private readonly pools=new Map<AudioCue,Phaser.Sound.BaseSound[]>(); private readonly lastPlayedAt=new Map<AudioCue,number>(); private readonly eventGate=new AudioEventGate(); private bgm?:Phaser.Sound.BaseSound; private variantSequence=0; private destroyed=false;
  constructor(private readonly scene:Phaser.Scene){for(const cue of Object.keys(AUDIO_CUES) as AudioCue[]){const definition=AUDIO_CUES[cue];const pool:Phaser.Sound.BaseSound[]=[];for(let index=0;index<definition.maxInstances;index++)pool.push(scene.sound.add(definition.assets[index%definition.assets.length]!));this.pools.set(cue,pool);}}
  unlockAndStartBgm():void{if(this.destroyed)return;try{if(this.scene.sound.locked)this.scene.sound.unlock();if(!this.bgm){this.bgm=this.scene.sound.add(BGM_DEFINITION.asset,{loop:true,volume:BGM_DEFINITION.volume});this.bgm.play();}else if(!this.bgm.isPlaying)this.bgm.play();}catch{/* Optional audio can be rejected by autoplay policy or a missing decoder. */}}
  play(cue:AudioCue,options:AudioPlayOptions={}):boolean{if(this.destroyed)return false;const now=this.scene.time.now;const definition=AUDIO_CUES[cue];if(now-(this.lastPlayedAt.get(cue)??-Infinity)<definition.minIntervalMs)return false;let gain=definition.volume*(options.volumeScale??1);if(definition.spatialRange&&options.source&&options.listener){const distance=Math.hypot(options.source.x-options.listener.x,options.source.y-options.listener.y);gain*=Math.max(0,1-distance/definition.spatialRange);}if(gain<=.01)return false;const pool=this.pools.get(cue)!;const start=this.variantSequence++%pool.length;for(let offset=0;offset<pool.length;offset++){const sound=pool[(start+offset)%pool.length]!;if(sound.isPlaying)continue;this.lastPlayedAt.set(cue,now);const variance=definition.pitchVariance??0;const rate=1+variance*((this.variantSequence%7)/3-1);sound.play({volume:Math.min(1,gain),rate});return true;}return false;}
  playForEvent(cue:AudioCue,eventSequence:number,options:AudioPlayOptions={}):boolean{return this.eventGate.allow(cue,eventSequence)&&this.play(cue,options);}
  destroy():void{if(this.destroyed)return;this.destroyed=true;this.bgm?.stop();this.bgm?.destroy();for(const pool of this.pools.values())for(const sound of pool){sound.stop();sound.destroy();}this.pools.clear();this.eventGate.clear();}
}

