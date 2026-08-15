import { BALANCE } from "../config/game-config";

export type DayPhase = "day" | "dusk" | "night" | "dawn";

export interface ClockSnapshot {
  elapsedSeconds: number;
}

export class GameClock {
  private elapsedSeconds = 0;

  update(deltaSeconds: number): void {
    this.elapsedSeconds = Math.max(0, this.elapsedSeconds + deltaSeconds);
  }

  getElapsedSeconds(): number {
    return this.elapsedSeconds;
  }

  getPhase(): DayPhase {
    const { daySeconds, duskSeconds, nightSeconds } = BALANCE;
    if (this.elapsedSeconds < daySeconds) return "day";
    if (this.elapsedSeconds < daySeconds + duskSeconds) return "dusk";
    if (this.elapsedSeconds < daySeconds + duskSeconds + nightSeconds) return "night";
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
    return Math.min(1, (this.elapsedSeconds - starts[phase]) / lengths[phase]);
  }

  getClockLabel(): string {
    const totalMinutes = 8 * 60 + Math.floor(this.elapsedSeconds * (16 * 60) / 1_080);
    const hours = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  getBaseVisionRadius(): number {
    switch (this.getPhase()) {
      case "day": return 150;
      case "dusk": return 150 - 60 * this.getPhaseProgress();
      case "night": return 76;
      case "dawn": return 76 + 52 * this.getPhaseProgress();
    }
  }

  getZombieActivityMultiplier(): number {
    return this.getPhase() === "night" ? 1.25 : this.getPhase() === "dusk" ? 1.08 : 1;
  }

  snapshot(): ClockSnapshot {
    return { elapsedSeconds: this.elapsedSeconds };
  }

  restore(snapshot: ClockSnapshot): void {
    this.elapsedSeconds = Math.max(0, snapshot.elapsedSeconds);
  }
}

