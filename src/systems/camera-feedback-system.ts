export type CameraFeedbackEvent="melee-swing"|"melee-hit"|"pistol-shot"|"smg-shot"|"shotgun-shot"|"rifle-shot"|"player-hit";
export interface CameraShakeProfile{durationMs:number;intensity:number;cooldownMs:number;priority:number}
export const CAMERA_SHAKE_PROFILES:Record<CameraFeedbackEvent,CameraShakeProfile>={
  "melee-swing":{durationMs:45,intensity:0.0008,cooldownMs:35,priority:1},"melee-hit":{durationMs:70,intensity:0.0016,cooldownMs:45,priority:2},
  "pistol-shot":{durationMs:65,intensity:0.0014,cooldownMs:45,priority:2},"smg-shot":{durationMs:38,intensity:0.00075,cooldownMs:75,priority:1},
  "shotgun-shot":{durationMs:105,intensity:0.0036,cooldownMs:90,priority:3},"rifle-shot":{durationMs:95,intensity:0.0028,cooldownMs:80,priority:3},
  "player-hit":{durationMs:120,intensity:0.0032,cooldownMs:90,priority:4},
};
export class CameraFeedbackSystem{private readonly lastAt=new Map<CameraFeedbackEvent,number>();private pending?:{profile:CameraShakeProfile;event:CameraFeedbackEvent;requestedAt:number};private lastFrame=-1;private activeUntil=0;private activePriority=0;
  request(event:CameraFeedbackEvent,now:number,damage=0):boolean{const base=CAMERA_SHAKE_PROFILES[event];if(now-(this.lastAt.get(event)??-Infinity)<base.cooldownMs)return false;const profile=event==="player-hit"?{...base,intensity:Math.min(0.0048,Math.max(0.0025,0.0025+damage*0.00008))}:base;this.lastAt.set(event,now);if(!this.pending||profile.priority>this.pending.profile.priority||profile.priority===this.pending.profile.priority&&profile.intensity>this.pending.profile.intensity)this.pending={profile,event,requestedAt:now};return true;}
  flush(frame:number,shake:(durationMs:number,intensity:number)=>void):boolean{if(frame===this.lastFrame||!this.pending)return false;this.lastFrame=frame;const pending=this.pending;this.pending=undefined;if(pending.requestedAt<this.activeUntil&&pending.profile.priority<this.activePriority)return false;this.activeUntil=pending.requestedAt+pending.profile.durationMs;this.activePriority=pending.profile.priority;shake(pending.profile.durationMs,pending.profile.intensity);return true;}
}
