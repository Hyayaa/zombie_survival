import { describe, expect, it } from "vitest";
import { BALANCE } from "../config/game-config";
import { GameClock } from "../core/game-clock";
import { DAY_ANNOUNCEMENT_DURATION_MS, getInitialDayAnnouncement } from "../ui/day-announcement";

describe("day announcement clock", () => {
  it("starts at DAY 1 and only announces a new game initially", () => {
    const clock = new GameClock(); expect(clock.getDayNumber()).toBe(1);
    expect(getInitialDayAnnouncement(false, clock.getDayNumber())).toBe(1);
    expect(getInitialDayAnnouncement(true, 3)).toBeUndefined();
  });

  it("increments once on night to dawn even with a large delta", () => {
    const clock = new GameClock();
    clock.update(BALANCE.daySeconds + BALANCE.duskSeconds + BALANCE.nightSeconds - 0.1);
    expect(clock.getPhase()).toBe("night");
    const transition = clock.update(0.2);
    expect(transition).toEqual({ dayStarted: true, dayNumber: 2 });
    expect(clock.update(10)).toEqual({ dayStarted: false, dayNumber: 2 });
  });

  it("loops phases, saves the day, and keeps the overlay duration bounded", () => {
    const clock = new GameClock(); clock.update(2_100);
    expect(clock.getDayNumber()).toBe(3);
    const restored = new GameClock(); restored.restore(clock.snapshot());
    expect(restored.getDayNumber()).toBe(3);
    expect(DAY_ANNOUNCEMENT_DURATION_MS).toBeGreaterThanOrEqual(2_000);
    expect(DAY_ANNOUNCEMENT_DURATION_MS).toBeLessThanOrEqual(2_800);
  });
});
