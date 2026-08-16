export interface WirePoint { x: number; y: number }

export function createPowerWirePolyline(start: WirePoint, end: WirePoint, firstId: string, secondId: string): WirePoint[] {
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const length = Math.hypot(deltaX, deltaY);
  if (length === 0) return [{ ...start }, { ...start }, { ...end }];
  const normalX = -deltaY / length;
  const normalY = deltaX / length;
  const hash = stableHash(firstId < secondId ? `${firstId}|${secondId}` : `${secondId}|${firstId}`);
  const offset = 1 + hash % 3;
  const sign = hash & 4 ? 1 : -1;
  return [
    { ...start },
    { x: start.x + deltaX / 3 + normalX * offset * sign, y: start.y + deltaY / 3 + normalY * offset * sign },
    { x: start.x + deltaX * 2 / 3 - normalX * offset * sign, y: start.y + deltaY * 2 / 3 - normalY * offset * sign },
    { ...end },
  ];
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  return hash >>> 0;
}
