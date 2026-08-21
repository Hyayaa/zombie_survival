import { describe, expect, it } from "vitest";
import { WEAPON_DEFINITIONS } from "../data/weapon-definitions";
import { AttackEffectController, getAttackBlockReason, type AttackEffectSink } from "../effects/attack-effect-controller";
import type { AttackEffectEvent } from "../effects/pixel-effect-definitions";
import { AudioEventGate,playFirearmShotForEvent,type FirearmShotCue } from "../systems/audio-system";

class RecordingSink implements AttackEffectSink {
  readonly events: AttackEffectEvent[] = [];
  playAttack(event: AttackEffectEvent): void { this.events.push(event); }
}

function readiness(overrides: Partial<Parameters<typeof getAttackBlockReason>[0]> = {}): Parameters<typeof getAttackBlockReason>[0] {
  return { now: 1_000, lastAttackAt: 0, reloadingUntil: 0, magazine: 8, blocked: false, ...overrides };
}

describe("attack effect integration", () => {
  it("dispatches one sequenced event for accepted knife and bat attacks", () => {
    const sink = new RecordingSink();
    const controller = new AttackEffectController(sink);
    for (const weapon of ["knife", "bat"] as const) {
      if (getAttackBlockReason(readiness(), WEAPON_DEFINITIONS[weapon]) === null) {
        controller.play({ weapon, originX: 10, originY: 20, angle: 0, startedAt: 1_000, impacts: [] });
      }
    }
    expect(sink.events.map((event) => event.weapon)).toEqual(["knife", "bat"]);
    expect(sink.events.map((event) => event.sequence)).toEqual([1, 2]);
  });

  it("dispatches no fake effect during cooldown, reload, empty magazine, or blocked UI", () => {
    const sink = new RecordingSink();
    const controller = new AttackEffectController(sink);
    const blockedStates = [
      readiness({ lastAttackAt: 900 }),
      readiness({ reloadingUntil: 1_200 }),
      readiness({ magazine: 0 }),
      readiness({ blocked: true }),
    ];
    for (const state of blockedStates) {
      if (getAttackBlockReason(state, WEAPON_DEFINITIONS.pistol) === null) {
        controller.play({ weapon: "pistol", originX: 0, originY: 0, angle: 0, startedAt: state.now, impacts: [] });
      }
    }
    expect(sink.events).toHaveLength(0);
    expect(controller.lastSequence).toBe(0);
  });

  it("records one muzzle/tracer event and one ammo cost for an accepted pistol shot", () => {
    const sink = new RecordingSink();
    const controller = new AttackEffectController(sink);
    const state = readiness({ magazine: 3 });
    let magazine = state.magazine;
    if (getAttackBlockReason(state, WEAPON_DEFINITIONS.pistol) === null) {
      magazine -= 1;
      controller.play({ weapon: "pistol", originX: 10, originY: 20, angle: 0, startedAt: state.now, impacts: [] });
    }
    expect(magazine).toBe(2);
    expect(sink.events).toHaveLength(1);
    expect(sink.events[0]).toMatchObject({ weapon: "pistol", impacts: [] });
  });

  it("passes wall and zombie results through without a second hit test", () => {
    const sink = new RecordingSink();
    const controller = new AttackEffectController(sink);
    controller.play({
      weapon: "pistol", originX: 0, originY: 0, angle: 0, startedAt: 0,
      impacts: [{ x: 40, y: 0, kind: "wall" }],
    });
    controller.play({
      weapon: "knife", originX: 0, originY: 0, angle: 0, startedAt: 400,
      impacts: [{ x: 12, y: 0, kind: "zombie" }],
    });
    controller.play({ weapon: "knife", originX: 0, originY: 0, angle: 0, startedAt: 800, impacts: [] });
    expect(sink.events[0]?.impacts[0]?.kind).toBe("wall");
    expect(sink.events[1]?.impacts[0]?.kind).toBe("zombie");
    expect(sink.events[2]?.impacts).toHaveLength(0);
  });

  it("dispatches exactly one firearm sound for each accepted shot sequence",()=>{const gate=new AudioEventGate();const calls:FirearmShotCue[]=[];const audio={playForEvent:(cue:FirearmShotCue,sequence:number)=>{if(!gate.allow(cue,sequence))return false;calls.push(cue);return true;}};const pistol=readiness({magazine:3});if(getAttackBlockReason(pistol,WEAPON_DEFINITIONS.pistol)===null){playFirearmShotForEvent(audio,"pistol",12);playFirearmShotForEvent(audio,"pistol",12);}expect(calls).toEqual(["pistol-shot"]);const shotgun=readiness({magazine:2});if(getAttackBlockReason(shotgun,WEAPON_DEFINITIONS.shotgun)===null){for(let pellet=0;pellet<(WEAPON_DEFINITIONS.shotgun.pelletCount??1);pellet++)void pellet;playFirearmShotForEvent(audio,"shotgun",13);}expect(calls).toEqual(["pistol-shot","shotgun-shot"]);});

  it("dispatches no firearm sound for cooldown, reload, empty magazine, or blocked UI",()=>{const calls:FirearmShotCue[]=[];const audio={playForEvent:(cue:FirearmShotCue)=>{calls.push(cue);return true;}};for(const state of [readiness({lastAttackAt:900}),readiness({reloadingUntil:1200}),readiness({magazine:0}),readiness({blocked:true})])if(getAttackBlockReason(state,WEAPON_DEFINITIONS.pistol)===null)playFirearmShotForEvent(audio,"pistol",20);expect(calls).toEqual([]);});
});
