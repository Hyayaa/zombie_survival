export interface PixelCell { x: number; y: number }

export interface PixelCrescentFrame {
  cells: readonly PixelCell[];
  edgeCells: readonly PixelCell[];
}

export interface CrescentTrailInput {
  originX: number;
  originY: number;
  aimAngle: number;
  sweepDirection: -1 | 1;
  innerRadius: number;
  outerRadius: number;
  arcRadians: number;
  maximumThickness: number;
}

export interface CrescentTrailGeometry {
  kind: "crescent";
  frame: PixelCrescentFrame;
  revealFrames: readonly PixelCrescentFrame[];
  innerRadius: number;
  outerRadius: number;
  arcRadians: number;
}

export interface StabTrailInput {
  originX: number;
  originY: number;
  aimAngle: number;
  length: number;
  blunt: boolean;
  heavy: boolean;
}

export interface StabTrailGeometry {
  kind: "stab";
  frame: PixelCrescentFrame;
  revealFrames: readonly PixelCrescentFrame[];
  length: number;
  blunt: boolean;
}

export type MeleeTrailGeometry = CrescentTrailGeometry | StabTrailGeometry;

const REVEAL_STEPS = 8;

export function createCrescentTrailGeometry(input: CrescentTrailInput): CrescentTrailGeometry {
  const originX = Math.round(input.originX);
  const originY = Math.round(input.originY);
  const innerRadius = Math.max(1, Math.round(Math.min(input.innerRadius, input.outerRadius - 1)));
  const outerRadius = Math.max(innerRadius + 1, Math.round(input.outerRadius));
  const arcRadians = Math.max(0.05, Math.min(Math.PI * 1.5, input.arcRadians));
  const maximumThickness = Math.max(2, Math.min(Math.round(input.maximumThickness), outerRadius - innerRadius));
  const startAngle = input.aimAngle - arcRadians * 0.5;
  const revealCells: PixelCell[][] = Array.from({ length: REVEAL_STEPS }, () => []);
  const revealEdges: PixelCell[][] = Array.from({ length: REVEAL_STEPS }, () => []);
  const cells: PixelCell[] = [];
  const edgeCells: PixelCell[] = [];

  for (let localY = -outerRadius; localY <= outerRadius; localY += 1) {
    for (let localX = -outerRadius; localX <= outerRadius; localX += 1) {
      const radius = Math.hypot(localX, localY);
      if (radius > outerRadius + 0.35) continue;
      const angularProgress = positiveAngle(Math.atan2(localY, localX) - startAngle) / arcRadians;
      if (angularProgress > 1) continue;
      const taper = Math.sin(Math.PI * angularProgress);
      const thickness = 1 + (maximumThickness - 1) * taper;
      const localOuterRadius = outerRadius - (maximumThickness - thickness) * 0.35;
      const localInnerRadius = Math.max(innerRadius, localOuterRadius - thickness);
      if (radius < localInnerRadius - 0.35 || radius > localOuterRadius + 0.35) continue;

      const cell = { x: originX + localX, y: originY + localY };
      const isEdge = radius <= localInnerRadius + 1.15;
      (isEdge ? edgeCells : cells).push(cell);
      const revealProgress = input.sweepDirection === 1 ? angularProgress : 1 - angularProgress;
      for (let step = Math.max(0, Math.ceil(revealProgress * REVEAL_STEPS) - 1); step < REVEAL_STEPS; step += 1) {
        (isEdge ? revealEdges[step]! : revealCells[step]!).push(cell);
      }
    }
  }

  return {
    kind: "crescent",
    frame: { cells, edgeCells },
    revealFrames: revealCells.map((frameCells, index) => ({ cells: frameCells, edgeCells: revealEdges[index]! })),
    innerRadius,
    outerRadius,
    arcRadians,
  };
}

export function crescentThicknessAt(progress: number, maximumThickness: number): number {
  const amount = Math.max(0, Math.min(1, progress));
  return 1 + (Math.max(2, maximumThickness) - 1) * Math.sin(Math.PI * amount);
}

export function createStabTrailGeometry(input: StabTrailInput): StabTrailGeometry {
  const length = Math.max(6, Math.round(input.length));
  const start = input.blunt ? 5 : 4;
  const directionX = Math.cos(input.aimAngle);
  const directionY = Math.sin(input.aimAngle);
  const perpendicularX = -directionY;
  const perpendicularY = directionX;
  const frameCells: PixelCell[] = [];
  const frameEdges: PixelCell[] = [];
  const revealCells: PixelCell[][] = Array.from({ length: 4 }, () => []);
  const revealEdges: PixelCell[][] = Array.from({ length: 4 }, () => []);
  const seen = new Set<string>();

  const add = (distance: number, side: number, edge: boolean): void => {
    const cell = {
      x: Math.round(input.originX + directionX * distance + perpendicularX * side),
      y: Math.round(input.originY + directionY * distance + perpendicularY * side),
    };
    const key = `${cell.x}:${cell.y}`;
    if (seen.has(key)) return;
    seen.add(key);
    (edge ? frameEdges : frameCells).push(cell);
    const revealStart = Math.min(3, Math.max(0, Math.floor(distance / Math.max(1, length) * 4)));
    for (let step = revealStart; step < 4; step += 1) (edge ? revealEdges[step]! : revealCells[step]!).push(cell);
  };

  for (let distance = start; distance <= length; distance += 1) {
    if (distance < start + 3 && distance % 2 === 0) add(distance, 0, true);
    else add(distance, 0, false);
    if (input.blunt && distance >= length - 4) { add(distance, -1, true); add(distance, 1, true); }
    else if ((input.heavy || distance % 4 === 1) && distance >= start + 2 && distance < length - 1) {
      const side = distance % 2 === 0 ? -1 : 1;
      add(distance, side, true);
    }
  }
  add(length, 1, false);
  if (input.blunt || input.heavy) add(length, -1, false);
  if (input.blunt) { add(length - 1, 1, false); add(length - 1, -1, false); }

  return {
    kind: "stab",
    frame: { cells: frameCells, edgeCells: frameEdges },
    revealFrames: revealCells.map((cells, index) => ({ cells, edgeCells: revealEdges[index]! })),
    length,
    blunt: input.blunt,
  };
}

function positiveAngle(value: number): number {
  const full = Math.PI * 2;
  return ((value % full) + full) % full;
}
