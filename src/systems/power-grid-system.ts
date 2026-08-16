import type { PlacedStructureState } from "../entities/placed-structure";

export const POWER_CONNECTION_RANGE = 168;
export const POWER_TICK_MS = 100;
export const SOLAR_OUTPUT_PER_SECOND = 8;
export const FUEL_OUTPUT_PER_SECOND = 12;
export const TURRET_CONSUMPTION_PER_SECOND = 4;
export const GENERATOR_FUEL_SECONDS = 90;
export const MAX_GENERATOR_FUEL_SECONDS = GENERATOR_FUEL_SECONDS * 4;

export interface PowerEdge { fromId: string; toId: string }
interface PowerNetwork { nodes: PlacedStructureState[]; generators: PlacedStructureState[]; batteries: PlacedStructureState[]; turrets: PlacedStructureState[] }

export class PowerGridSystem {
  private structures: PlacedStructureState[] = [];
  private networks: PowerNetwork[] = [];
  private edges: PowerEdge[] = [];
  private revisionValue = 0;

  get revision(): number { return this.revisionValue; }
  getEdges(): readonly PowerEdge[] { return this.edges; }

  rebuild(structures: readonly PlacedStructureState[], positionOf: (state: PlacedStructureState) => { x: number; y: number }): void {
    this.structures = [...structures];
    const backbone = this.structures.filter((state) => state.kind !== "turret");
    const candidates: Array<PowerEdge & { distanceSquared: number; a: number; b: number }> = [];
    for (let a = 0; a < backbone.length; a += 1) for (let b = a + 1; b < backbone.length; b += 1) {
      const first = positionOf(backbone[a]!); const second = positionOf(backbone[b]!);
      const distanceSquared = squaredDistance(first, second);
      if (distanceSquared <= POWER_CONNECTION_RANGE * POWER_CONNECTION_RANGE) candidates.push({ fromId: backbone[a]!.id, toId: backbone[b]!.id, distanceSquared, a, b });
    }
    candidates.sort((left, right) => left.distanceSquared - right.distanceSquared || edgeKey(left).localeCompare(edgeKey(right)));
    const parent = backbone.map((_, index) => index);
    const find = (value: number): number => { while (parent[value] !== value) { parent[value] = parent[parent[value]!]!; value = parent[value]!; } return value; };
    const nextEdges: PowerEdge[] = [];
    for (const candidate of candidates) {
      const rootA = find(candidate.a); const rootB = find(candidate.b);
      if (rootA === rootB) continue;
      parent[rootB] = rootA;
      nextEdges.push({ fromId: candidate.fromId, toId: candidate.toId });
    }
    for (const turret of this.structures.filter((state) => state.kind === "turret")) {
      const turretPosition = positionOf(turret);
      let nearest: PlacedStructureState | undefined; let nearestDistance = POWER_CONNECTION_RANGE * POWER_CONNECTION_RANGE + 1;
      for (const node of backbone) {
        const candidateDistance = squaredDistance(turretPosition, positionOf(node));
        if (candidateDistance <= POWER_CONNECTION_RANGE * POWER_CONNECTION_RANGE && (candidateDistance < nearestDistance || (candidateDistance === nearestDistance && node.id < (nearest?.id ?? "~")))) {
          nearest = node; nearestDistance = candidateDistance;
        }
      }
      if (nearest) nextEdges.push({ fromId: nearest.id, toId: turret.id });
    }
    this.edges = nextEdges;
    this.networks = buildNetworks(this.structures, this.edges);
    for (const network of this.networks) network.turrets.sort((a, b) => a.id.localeCompare(b.id));
    this.revisionValue += 1;
  }

  tick(deltaSeconds: number, isDay: boolean): string[] {
    const changedTurrets: string[] = [];
    for (const state of this.structures) if (state.kind === "turret" && state.powered) { state.powered = false; changedTurrets.push(state.id); }
    for (const network of this.networks) this.tickNetwork(network, deltaSeconds, isDay, changedTurrets);
    return changedTurrets;
  }

  private tickNetwork(network: PowerNetwork, deltaSeconds: number, isDay: boolean, changed: string[]): void {
    const demand = network.turrets.length * TURRET_CONSUMPTION_PER_SECOND * deltaSeconds;
    let generated = 0;
    let storageRoom = 0;
    for (const generator of network.generators) storageRoom += generatorCapacity(generator) - generator.storedEnergy;
    for (const battery of network.batteries) storageRoom += 240 - battery.storedEnergy;
    for (const generator of network.generators) {
      if (generator.kind === "solar-generator") {
        if (isDay) generated += SOLAR_OUTPUT_PER_SECOND * deltaSeconds;
      } else if ((generator.fuelSeconds ?? 0) > 0 && (demand > 0 || storageRoom > 0)) {
        const runSeconds = Math.min(deltaSeconds, generator.fuelSeconds ?? 0);
        generated += FUEL_OUTPUT_PER_SECOND * runSeconds;
        generator.fuelSeconds = Math.max(0, (generator.fuelSeconds ?? 0) - runSeconds);
      }
    }
    let available = generated;
    if (available < demand) {
      for (const battery of network.batteries) available += drain(battery, demand - available);
      for (const generator of network.generators) available += drain(generator, demand - available);
    }
    const cost = TURRET_CONSUMPTION_PER_SECOND * deltaSeconds;
    for (const turret of network.turrets) {
      const powered = available + 1e-9 >= cost;
      if (powered) available -= cost;
      if (turret.powered !== powered) { turret.powered = powered; toggleChanged(changed, turret.id); }
    }
    for (const generator of network.generators) available -= charge(generator, available, generatorCapacity(generator));
    for (const battery of network.batteries) available -= charge(battery, available, 240);
  }
}

function buildNetworks(structures: readonly PlacedStructureState[], edges: readonly PowerEdge[]): PowerNetwork[] {
  const byId = new Map(structures.map((state) => [state.id, state]));
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) { addAdjacent(adjacency, edge.fromId, edge.toId); addAdjacent(adjacency, edge.toId, edge.fromId); }
  const visited = new Set<string>(); const networks: PowerNetwork[] = [];
  for (const state of structures) {
    if (visited.has(state.id)) continue;
    const nodes: PlacedStructureState[] = []; const stack = [state.id]; visited.add(state.id);
    while (stack.length) { const id = stack.pop()!; const node = byId.get(id); if (node) nodes.push(node); for (const next of adjacency.get(id) ?? []) if (!visited.has(next)) { visited.add(next); stack.push(next); } }
    networks.push({ nodes, generators: nodes.filter((node) => node.kind === "solar-generator" || node.kind === "fuel-generator"), batteries: nodes.filter((node) => node.kind === "battery-bank"), turrets: nodes.filter((node) => node.kind === "turret") });
  }
  return networks;
}

function generatorCapacity(state: PlacedStructureState): number { return state.kind === "solar-generator" ? 40 : 60; }
function drain(state: PlacedStructureState, requested: number): number { const amount = Math.min(state.storedEnergy, Math.max(0, requested)); state.storedEnergy -= amount; return amount; }
function charge(state: PlacedStructureState, available: number, capacity: number): number { const amount = Math.min(Math.max(0, available), Math.max(0, capacity - state.storedEnergy)); state.storedEnergy += amount; return amount; }
function addAdjacent(map: Map<string, string[]>, from: string, to: string): void { const list = map.get(from); if (list) list.push(to); else map.set(from, [to]); }
function squaredDistance(a: {x:number;y:number}, b: {x:number;y:number}): number { return (a.x-b.x)**2 + (a.y-b.y)**2; }
function edgeKey(edge: PowerEdge): string { return edge.fromId < edge.toId ? `${edge.fromId}|${edge.toId}` : `${edge.toId}|${edge.fromId}`; }
function toggleChanged(changed: string[], id: string): void { const index = changed.indexOf(id); if (index >= 0) changed.splice(index, 1); else changed.push(id); }
