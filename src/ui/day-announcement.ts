export const DAY_ANNOUNCEMENT_DURATION_MS = 2_500;

export function getInitialDayAnnouncement(loadedSave: boolean, dayNumber: number): number | undefined {
  return loadedSave ? undefined : Math.max(1, Math.floor(dayNumber));
}

export class DayAnnouncement {
  private readonly element: HTMLDivElement;
  private hideTimer?: number;
  private lastAnnouncedDay = 0;

  constructor(parent: HTMLElement) {
    this.element = document.createElement("div");
    this.element.className = "day-announcement";
    this.element.hidden = true;
    parent.append(this.element);
  }

  show(dayNumber: number): boolean {
    const day = Math.max(1, Math.floor(dayNumber));
    if (day === this.lastAnnouncedDay) return false;
    this.lastAnnouncedDay = day;
    this.element.textContent = `DAY ${day}`;
    this.element.hidden = false;
    this.element.classList.remove("is-visible");
    void this.element.offsetWidth;
    this.element.classList.add("is-visible");
    if (this.hideTimer !== undefined) window.clearTimeout(this.hideTimer);
    this.hideTimer = window.setTimeout(() => {
      this.element.classList.remove("is-visible");
      this.element.hidden = true;
    }, DAY_ANNOUNCEMENT_DURATION_MS);
    return true;
  }

  destroy(): void {
    if (this.hideTimer !== undefined) window.clearTimeout(this.hideTimer);
    this.element.remove();
  }
}
