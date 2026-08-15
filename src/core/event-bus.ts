type EventMap = Record<string, unknown>;
type Listener<T> = (payload: T) => void;

export class TypedEventBus<Events extends EventMap> {
  private readonly listeners = new Map<keyof Events, Set<Listener<Events[keyof Events]>>>();

  on<Key extends keyof Events>(key: Key, listener: Listener<Events[Key]>): () => void {
    const bucket = this.listeners.get(key) ?? new Set();
    bucket.add(listener as Listener<Events[keyof Events]>);
    this.listeners.set(key, bucket);
    return () => bucket.delete(listener as Listener<Events[keyof Events]>);
  }

  emit<Key extends keyof Events>(key: Key, payload: Events[Key]): void {
    this.listeners.get(key)?.forEach((listener) => listener(payload));
  }

  clear(): void {
    this.listeners.clear();
  }
}

