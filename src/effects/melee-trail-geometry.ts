export interface PixelPoint { x: number; y: number }

export interface CrescentTrailInput {
  originX: number;
  originY: number;
  aimAngle: number;
  sweepDirection: -1 | 1;
  innerRadius: number;
  outerRadius: number;
  arcRadians: number;
  segmentCount: number;
  maximumThickness: number;
  sequence: number;
}

export interface CrescentTrailGeometry {
  kind: "crescent";
  mainPolygon: PixelPoint[];
  highlightPolygon: PixelPoint[];
  revealPolygons: PixelPoint[][];
  highlightRevealPolygons: PixelPoint[][];
  trailingFragments: PixelPoint[];
  outerSamples: PixelPoint[];
  innerSamples: PixelPoint[];
}

export interface StabTrailInput {
  originX: number;
  originY: number;
  aimAngle: number;
  startOffset: number;
  length: number;
  maximumWidth: number;
  fragmentCount: number;
  sequence: number;
}

export interface StabTrailGeometry {
  kind: "stab";
  mainPolygon: PixelPoint[];
  revealPolygons: PixelPoint[][];
  coreLine: PixelPoint[];
  tipPolygon: PixelPoint[];
  trailingFragments: PixelPoint[];
  start: PixelPoint;
  tip: PixelPoint;
}

const REVEAL_STEPS = 8;

export function createCrescentTrailGeometry(input: CrescentTrailInput): CrescentTrailGeometry {
  const segments = Math.max(4, Math.round(input.segmentCount));
  const innerBase = Math.max(1, Math.min(input.innerRadius, input.outerRadius - 1));
  const outerBase = Math.max(innerBase + 1, input.outerRadius);
  const maximumThickness = Math.max(2, Math.min(input.maximumThickness, outerBase - innerBase));
  const outerSamples: PixelPoint[] = [];
  const innerSamples: PixelPoint[] = [];
  const highlightOuter: PixelPoint[] = [];
  const highlightInner: PixelPoint[] = [];
  for (let index = 0; index <= segments; index += 1) {
    const progress = index / segments;
    const directedProgress = input.sweepDirection === 1 ? progress : 1 - progress;
    const angle = input.aimAngle - input.arcRadians * 0.5 + input.arcRadians * directedProgress;
    const taper = Math.sin(Math.PI * progress);
    const thickness = 1 + (maximumThickness - 1) * taper;
    const outerRadius = outerBase - (maximumThickness - thickness) * 0.35;
    const innerRadius = Math.max(innerBase, outerRadius - thickness);
    const highlightThickness = Math.max(1, thickness * 0.36);
    outerSamples.push(pointOnCircle(input.originX, input.originY, angle, outerRadius));
    innerSamples.push(pointOnCircle(input.originX, input.originY, angle, innerRadius));
    highlightOuter.push(pointOnCircle(input.originX, input.originY, angle, outerRadius - 1));
    highlightInner.push(pointOnCircle(input.originX, input.originY, angle, outerRadius - 1 - highlightThickness));
  }
  const mainPolygon = ribbonPolygon(outerSamples, innerSamples);
  const highlightPolygon = ribbonPolygon(highlightOuter, highlightInner);
  return {
    kind: "crescent",
    mainPolygon,
    highlightPolygon,
    revealPolygons: createRevealPolygons(outerSamples, innerSamples),
    highlightRevealPolygons: createRevealPolygons(highlightOuter, highlightInner),
    trailingFragments: createCrescentFragments(input, innerBase, outerBase),
    outerSamples,
    innerSamples,
  };
}

export function createStabTrailGeometry(input: StabTrailInput): StabTrailGeometry {
  const directionX = Math.cos(input.aimAngle), directionY = Math.sin(input.aimAngle);
  const perpendicularX = -directionY, perpendicularY = directionX;
  const length = Math.max(4, input.length);
  const halfWidth = Math.max(1, input.maximumWidth * 0.5);
  const startX = input.originX + directionX * input.startOffset;
  const startY = input.originY + directionY * input.startOffset;
  const shoulderX = startX + directionX * length * 0.72;
  const shoulderY = startY + directionY * length * 0.72;
  const tipX = startX + directionX * length;
  const tipY = startY + directionY * length;
  const start = roundedPoint(startX, startY);
  const tip = roundedPoint(tipX, tipY);
  const mainPolygon = dedupePoints([
    roundedPoint(startX + perpendicularX, startY + perpendicularY),
    roundedPoint(shoulderX + perpendicularX * halfWidth, shoulderY + perpendicularY * halfWidth),
    tip,
    roundedPoint(shoulderX - perpendicularX * halfWidth, shoulderY - perpendicularY * halfWidth),
    roundedPoint(startX - perpendicularX, startY - perpendicularY),
  ]);
  const tipHalf = Math.max(1, Math.round(halfWidth * 0.65));
  const tipPolygon = dedupePoints([
    roundedPoint(tipX, tipY),
    roundedPoint(tipX - directionX * 3 + perpendicularX * tipHalf, tipY - directionY * 3 + perpendicularY * tipHalf),
    roundedPoint(tipX - directionX * 5, tipY - directionY * 5),
    roundedPoint(tipX - directionX * 3 - perpendicularX * tipHalf, tipY - directionY * 3 - perpendicularY * tipHalf),
  ]);
  return {
    kind: "stab",
    mainPolygon,
    revealPolygons: createStabRevealPolygons(input, startX, startY, directionX, directionY, perpendicularX, perpendicularY),
    coreLine: rasterLine(start.x, start.y, tip.x, tip.y),
    tipPolygon,
    trailingFragments: createStabFragments(input, startX, startY, directionX, directionY, perpendicularX, perpendicularY),
    start,
    tip,
  };
}

function createRevealPolygons(outer: readonly PixelPoint[], inner: readonly PixelPoint[]): PixelPoint[][] {
  const polygons: PixelPoint[][] = [];
  for (let step = 1; step <= REVEAL_STEPS; step += 1) {
    const count = Math.max(2, Math.ceil((outer.length - 1) * step / REVEAL_STEPS) + 1);
    polygons.push(ribbonPolygon(outer.slice(0, count), inner.slice(0, count)));
  }
  return polygons;
}

function createStabRevealPolygons(input: StabTrailInput, startX: number, startY: number, dx: number, dy: number, px: number, py: number): PixelPoint[][] {
  const polygons: PixelPoint[][] = [];
  for (let step = 1; step <= REVEAL_STEPS; step += 1) {
    const progress = step / REVEAL_STEPS;
    const currentLength = input.length * progress;
    const width = Math.max(1, input.maximumWidth * 0.5 * Math.sin(progress * Math.PI * 0.72));
    const endX = startX + dx * currentLength, endY = startY + dy * currentLength;
    polygons.push(dedupePoints([
      roundedPoint(startX + px, startY + py),
      roundedPoint(endX + px * width, endY + py * width),
      roundedPoint(endX + dx * Math.min(3, input.length - currentLength + 1), endY + dy * Math.min(3, input.length - currentLength + 1)),
      roundedPoint(endX - px * width, endY - py * width),
      roundedPoint(startX - px, startY - py),
    ]));
  }
  return polygons;
}

function createCrescentFragments(input: CrescentTrailInput, inner: number, outer: number): PixelPoint[] {
  const fragments: PixelPoint[] = [];
  const trailingAngle = input.aimAngle + (input.sweepDirection === 1 ? -input.arcRadians * 0.56 : input.arcRadians * 0.56);
  for (let index = 0; index < 5; index += 1) {
    const radius = inner + (outer - inner) * (0.2 + random(input.sequence, index) * 0.65);
    const angle = trailingAngle + (random(input.sequence, 20 + index) - 0.5) * 0.18;
    fragments.push(pointOnCircle(input.originX, input.originY, angle, radius));
  }
  return fragments;
}

function createStabFragments(input: StabTrailInput, startX: number, startY: number, dx: number, dy: number, px: number, py: number): PixelPoint[] {
  const fragments: PixelPoint[] = [];
  for (let index = 0; index < Math.max(0, Math.round(input.fragmentCount)); index += 1) {
    const along = input.length * (0.08 + random(input.sequence, index) * 0.52);
    const side = (random(input.sequence, 30 + index) - 0.5) * input.maximumWidth * 1.4;
    fragments.push(roundedPoint(startX + dx * along + px * side, startY + dy * along + py * side));
  }
  return fragments;
}

function ribbonPolygon(outer: readonly PixelPoint[], inner: readonly PixelPoint[]): PixelPoint[] {
  const points: PixelPoint[] = [];
  for (const point of outer) points.push(point);
  for (let index = inner.length - 1; index >= 0; index -= 1) points.push(inner[index]!);
  return dedupePoints(points);
}

function rasterLine(x0: number, y0: number, x1: number, y1: number): PixelPoint[] {
  const points: PixelPoint[] = [];
  let x = x0, y = y0;
  const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
  let error = dx + dy;
  while (true) {
    points.push({ x, y });
    if (x === x1 && y === y1) break;
    const twice = error * 2;
    if (twice >= dy) { error += dy; x += sx; }
    if (twice <= dx) { error += dx; y += sy; }
  }
  return points;
}

function pointOnCircle(originX: number, originY: number, angle: number, radius: number): PixelPoint {
  return roundedPoint(originX + Math.cos(angle) * radius, originY + Math.sin(angle) * radius);
}

function roundedPoint(x: number, y: number): PixelPoint { return { x: Math.round(x), y: Math.round(y) }; }
function dedupePoints(points: readonly PixelPoint[]): PixelPoint[] {
  const result: PixelPoint[] = [];
  for (const point of points) if (!result.length || result[result.length - 1]!.x !== point.x || result[result.length - 1]!.y !== point.y) result.push(point);
  return result;
}
function random(seed: number, salt: number): number {
  let value = (seed ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0;
  value ^= value >>> 16; value = Math.imul(value, 0x7feb352d); value ^= value >>> 15;
  return (value >>> 0) / 0x1_0000_0000;
}
