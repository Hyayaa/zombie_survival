import { BALANCE } from "../config/game-config";

export type DayPhase = "day" | "dusk" | "night" | "dawn";

export interface ClockSnapshot {
  elapsedSeconds: number;
  dayNumber?: number;
}

export interface ClockUpdate {
  dayStarted: boolean;
  dayNumber: number;
}

const CYCLE_SECONDS = BALANCE.daySeconds + BALANCE.duskSeconds + BALANCE.nightSeconds + BALANCE.dawnSeconds;
const DAWN_START_SECONDS = BALANCE.daySeconds + BALANCE.duskSeconds + BALANCE.nightSeconds;

export class GameClock {
  private elapsedSeconds = 0;

  update(deltaSeconds: number): ClockUpdate {
    const previousDay = this.getDayNumber();
    this.elapsedSeconds = Math.max(0, this.elapsedSeconds + deltaSeconds);
    const dayNumber = this.getDayNumber();
    return { dayStarted: dayNumber > previousDay, dayNumber };
  }

  getElapsedSeconds(): number {
    return this.elapsedSeconds;
  }

  getPhase(): DayPhase {
    const cycleElapsed = this.getCycleElapsedSeconds();
    const { daySeconds, duskSeconds, nightSeconds } = BALANCE;
    if (cycleElapsed < daySeconds) return "day";
    if (cycleElapsed < daySeconds + duskSeconds) return "dusk";
    if (cycleElapsed < daySeconds + duskSeconds + nightSeconds) return "night";
    return "dawn";
  }

  getPhaseProgress(): number {
    const phase = this.getPhase();
    const starts: Record<DayPhase, number> = {
      day: 0,
      dusk: BALANCE.daySeconds,
      night: BALANCE.daySeconds + BALANCE.duskSeconds,
      dawn: BALANCE.daySeconds + BALANCE.duskSeconds + BALANCE.nightSeconds,
    };
    const lengths: Record<DayPhase, number> = {
      day: BALANCE.daySeconds,
      dusk: BALANCE.duskSeconds,
      night: BALANCE.nightSeconds,
      dawn: BALANCE.dawnSeconds,
    };
    return Math.min(1, (this.getCycleElapsedSeconds() - starts[phase]) / lengths[phase]);
  }

  getClockLabel(): string {
    const totalMinutes = 8 * 60 + Math.floor(this.getCycleElapsedSeconds() * (16 * 60) / CYCLE_SECONDS);
    const hours = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  getDarknessFactor(): number {
    switch (this.getPhase()) {
      case "day": return 0;
      case "dusk": return smoothstep(this.getPhaseProgress());
      case "night": return 1;
      case "dawn": return 1 - smoothstep(this.getPhaseProgress());
    }
  }

  getZombieActivityMultiplier(): number {
    return this.getPhase() === "night" ? 1.25 : this.getPhase() === "dusk" ? 1.08 : 1;
  }

  getDayNumber(): number {
    if (this.elapsedSeconds < DAWN_START_SECONDS) return 1;
    return 2 + Math.floor((this.elapsedSeconds - DAWN_START_SECONDS) / CYCLE_SECONDS);
  }

  snapshot(): ClockSnapshot {
    return { elapsedSeconds: this.elapsedSeconds, dayNumber: this.getDayNumber() };
  }

  restore(snapshot: ClockSnapshot): void {
    this.elapsedSeconds = Number.isFinite(snapshot.elapsedSeconds) ? Math.max(0, snapshot.elapsedSeconds) : 0;
  }


  private getCycleElapsedSeconds(): number {
    return this.elapsedSeconds % CYCLE_SECONDS;
  }
}

function smoothstep(value: number): number {
  const clamped = Math.max(0, Math.min(1, value));
  return clamped * clamped * (3 - 2 * clamped);
}
