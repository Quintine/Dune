import type { Game, Player } from './engine';
import { eliteRevivalRemaining } from './revival';

export const EMPEROR_NEXUS_REVIVALS = 3;
export type EmperorNexusPools = {
  reserves: number;
  tanks: number;
  eliteReserves: number;
  eliteTanks: number;
  eliteRevived: number;
  revived: number;
  freeForcesRevived: number | null;
  spice: number;
};
export type NexusEmperorRevival = {
  kind: 'revival';
  event: string;
  owner: string;
  turn: number;
  phase: 4;
  sequence: number;
  faction: Player['faction'];
  advanced: boolean;
  elite: number;
  before: EmperorNexusPools;
  after: EmperorNexusPools;
  signature: string;
};
export function emperorNexusPools(p: Player): EmperorNexusPools {
  return {
    reserves: p.reserves,
    tanks: p.tanks,
    eliteReserves: p.elites?.reserves ?? 0,
    eliteTanks: p.elites?.tanks ?? 0,
    eliteRevived: p.elites?.revived ?? 0,
    revived: p.revived,
    freeForcesRevived: p.freeForcesRevived ?? null,
    spice: p.spice,
  };
}
export function emperorNexusEvent(
  turn: number,
  phase: number,
  owner: string,
  sequence: number,
): string {
  return JSON.stringify([
    'nexusEmperorSecretAlly',
    turn,
    phase,
    owner,
    sequence,
  ]);
}
export function emperorNexusSignature(record: object): string {
  return JSON.stringify({ ...record, signature: undefined });
}
export function emperorNexusModeSupported(g: Game): boolean {
  return (
    !g.expansions.length &&
    g.players.every((p) =>
      ['atreides', 'harkonnen', 'fremen', 'guild', 'beneGesserit'].includes(
        p.faction,
      ),
    ) &&
    !g.homeworlds &&
    !g.leaderSkills &&
    !g.discoveryEnabled &&
    !g.discoveries &&
    !g.discoveryStash &&
    !g.greatMaker &&
    !g.techTokens &&
    !g.strongholdCards
  );
}
/** A fixed three-counter grant preserves the separate Advanced elite cap. */
export function emperorNexusRevivalElites(
  p: Player,
  advanced: boolean,
): number[] {
  const choices: number[] = [];
  for (let elite = 0; elite <= 3; elite++)
    if (
      elite <= eliteRevivalRemaining(p, advanced) &&
      elite <= (p.elites?.tanks ?? 0) &&
      3 - elite <= p.tanks - (p.elites?.tanks ?? 0)
    )
      choices.push(elite);
  return choices;
}
export function validateEmperorNexusRevival(
  g: Game,
  r: NexusEmperorRevival,
): void {
  const p = r && g.players.find((p) => p.id === r.owner);
  const validPools = (pool: EmperorNexusPools) =>
    pool &&
    Object.keys(pool).sort().join(',') ===
      'eliteReserves,eliteRevived,eliteTanks,freeForcesRevived,reserves,revived,spice,tanks' &&
    Object.entries(pool).every(
      ([key, n]) =>
        (key === 'freeForcesRevived' && n === null) ||
        (Number.isSafeInteger(n) && n! >= 0),
    ) &&
    pool.eliteReserves <= pool.reserves &&
    pool.eliteTanks <= pool.tanks &&
    pool.reserves + pool.tanks <= 20;
  if (
    !p ||
    Object.keys(r).sort().join(',') !==
      'advanced,after,before,elite,event,faction,kind,owner,phase,sequence,signature,turn' ||
    r.kind !== 'revival' ||
    r.phase !== 4 ||
    !Number.isSafeInteger(r.turn) ||
    r.turn < 1 ||
    r.turn > g.turn ||
    r.faction !== p.faction ||
    r.advanced !== g.advanced ||
    !Number.isSafeInteger(r.sequence) ||
    r.sequence < 0 ||
    !Number.isSafeInteger(r.elite) ||
    r.elite < 0 ||
    r.elite > 3 ||
    r.event !== emperorNexusEvent(r.turn, 4, r.owner, r.sequence) ||
    r.signature !== emperorNexusSignature(r) ||
    !validPools(r.before) ||
    !validPools(r.after) ||
    r.before.tanks < 3 ||
    r.elite > r.before.eliteTanks ||
    3 - r.elite > r.before.tanks - r.before.eliteTanks ||
    (g.advanced && r.before.eliteRevived + r.elite > 1) ||
    (p.faction !== 'fremen' &&
      (r.elite || r.before.eliteTanks || r.before.eliteReserves)) ||
    JSON.stringify(r.after) !==
      JSON.stringify({
        ...r.before,
        reserves: r.before.reserves + 3,
        tanks: r.before.tanks - 3,
        eliteReserves: r.before.eliteReserves + r.elite,
        eliteTanks: r.before.eliteTanks - r.elite,
        eliteRevived: r.before.eliteRevived + r.elite,
      })
  )
    throw new Error(
      'Emperor Nexus revival has lost its exact original physical return or allowance.',
    );
}
