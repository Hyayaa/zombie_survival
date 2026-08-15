export class PixelSlotPool {
  readonly capacity: number;
  private readonly active: Uint8Array;
  private readonly priorities: Uint8Array;
  private readonly bornAt: Float64Array;
  private readonly freeIndices: Int32Array;
  private freeCount: number;
  private activeCountValue = 0;
  private destroyed = false;

  constructor(capacity: number) {
    this.capacity = Math.max(1, Math.floor(capacity));
    this.active = new Uint8Array(this.capacity);
    this.priorities = new Uint8Array(this.capacity);
    this.bornAt = new Float64Array(this.capacity);
    this.freeIndices = new Int32Array(this.capacity);
    this.freeCount = this.capacity;
    for (let index = 0; index < this.capacity; index += 1) this.freeIndices[index] = this.capacity - index - 1;
  }

  acquire(priority: number, now: number): number {
    if (this.destroyed) return -1;
    let index = -1;
    if (this.freeCount > 0) {
      this.freeCount -= 1;
      index = this.freeIndices[this.freeCount] as number;
      this.activeCountValue += 1;
    } else {
      let candidatePriority = Number.POSITIVE_INFINITY;
      let candidateBornAt = Number.POSITIVE_INFINITY;
      for (let cursor = 0; cursor < this.capacity; cursor += 1) {
        const existingPriority = this.priorities[cursor] as number;
        const existingBornAt = this.bornAt[cursor] as number;
        if (existingPriority < candidatePriority || existingPriority === candidatePriority && existingBornAt < candidateBornAt) {
          candidatePriority = existingPriority;
          candidateBornAt = existingBornAt;
          index = cursor;
        }
      }
      if (candidatePriority > priority) return -1;
    }
    this.active[index] = 1;
    this.priorities[index] = priority;
    this.bornAt[index] = now;
    return index;
  }

  release(index: number): void {
    if (index < 0 || index >= this.capacity || this.active[index] === 0) return;
    this.active[index] = 0;
    this.priorities[index] = 0;
    this.freeIndices[this.freeCount] = index;
    this.freeCount += 1;
    this.activeCountValue -= 1;
  }

  isActive(index: number): boolean {
    return index >= 0 && index < this.capacity && this.active[index] === 1;
  }

  get activeCount(): number {
    return this.activeCountValue;
  }

  clear(): void {
    this.active.fill(0);
    this.priorities.fill(0);
    this.activeCountValue = 0;
    this.freeCount = this.capacity;
    for (let index = 0; index < this.capacity; index += 1) this.freeIndices[index] = this.capacity - index - 1;
  }

  destroy(): void {
    this.clear();
    this.destroyed = true;
  }
}
