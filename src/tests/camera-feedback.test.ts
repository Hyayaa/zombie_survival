import { describe, expect, it, vi } from "vitest";
import { CAMERA_SHAKE_PROFILES, CameraFeedbackSystem } from "../systems/camera-feedback-system";

describe("camera combat feedback", () => {
  it("keeps weapon strength and melee hit ordering explicit", () => {
    expect(CAMERA_SHAKE_PROFILES["smg-shot"].intensity).toBeLessThan(CAMERA_SHAKE_PROFILES["pistol-shot"].intensity);
    expect(CAMERA_SHAKE_PROFILES["pistol-shot"].intensity).toBeLessThan(CAMERA_SHAKE_PROFILES["rifle-shot"].intensity);
    expect(CAMERA_SHAKE_PROFILES["rifle-shot"].intensity).toBeLessThan(CAMERA_SHAKE_PROFILES["shotgun-shot"].intensity);
    expect(CAMERA_SHAKE_PROFILES["melee-swing"].intensity).toBeLessThan(CAMERA_SHAKE_PROFILES["melee-hit"].intensity);
  });

  it("flushes only the strongest accepted event once per rendered frame", () => {
    const system = new CameraFeedbackSystem(); const shake = vi.fn();
    system.request("smg-shot", 100); system.request("shotgun-shot", 100); system.request("pistol-shot", 100);
    expect(system.flush(7, shake)).toBe(true); expect(shake).toHaveBeenCalledOnce();
    expect(shake).toHaveBeenCalledWith(CAMERA_SHAKE_PROFILES["shotgun-shot"].durationMs, CAMERA_SHAKE_PROFILES["shotgun-shot"].intensity);
    expect(system.flush(7, shake)).toBe(false);
  });

  it("enforces per-event cooldowns and caps damage-scaled player hits", () => {
    const system = new CameraFeedbackSystem(); const shake = vi.fn();
    expect(system.request("pistol-shot", 100)).toBe(true); expect(system.request("pistol-shot", 110)).toBe(false); system.flush(1, shake);
    system.request("player-hit", 200, 999); system.flush(2, shake); expect(shake.mock.calls.at(-1)?.[1]).toBe(0.007);
  });

  it("does not let a weak recoil overwrite an active player hit",()=>{const system=new CameraFeedbackSystem();const shake=vi.fn();system.request("player-hit",100,20);system.flush(1,shake);system.request("smg-shot",120);expect(system.flush(2,shake)).toBe(false);expect(shake).toHaveBeenCalledOnce();});

  it("uses stronger bounded profiles without stacking SMG recoil",()=>{expect(CAMERA_SHAKE_PROFILES["pistol-shot"].intensity).toBeGreaterThan(0.0014);expect(CAMERA_SHAKE_PROFILES["shotgun-shot"].intensity).toBeGreaterThan(CAMERA_SHAKE_PROFILES["pistol-shot"].intensity);expect(CAMERA_SHAKE_PROFILES["rifle-shot"].intensity).toBeGreaterThan(CAMERA_SHAKE_PROFILES["pistol-shot"].intensity);expect(Math.max(...Object.values(CAMERA_SHAKE_PROFILES).map((profile)=>profile.intensity))).toBeLessThanOrEqual(0.007);const system=new CameraFeedbackSystem();expect(system.request("smg-shot",100)).toBe(true);expect(system.request("smg-shot",120)).toBe(false);});

  it("orders melee modes and lets posture break win a frame", () => {
    expect(CAMERA_SHAKE_PROFILES["melee-stab-hit"].intensity).toBeLessThan(CAMERA_SHAKE_PROFILES["melee-swing-hit"].intensity);
    expect(CAMERA_SHAKE_PROFILES["melee-swing-hit"].intensity).toBeLessThan(CAMERA_SHAKE_PROFILES["melee-heavy-hit"].intensity);
    const system = new CameraFeedbackSystem(); const shake = vi.fn();
    system.request("melee-heavy-hit", 500); system.request("posture-break", 500); system.flush(10, shake);
    expect(shake).toHaveBeenCalledWith(CAMERA_SHAKE_PROFILES["posture-break"].durationMs, CAMERA_SHAKE_PROFILES["posture-break"].intensity);
  });
});
