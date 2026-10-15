import type { Leader } from './cards';

/** Native ordinary-disc accounting. Duke contributes to opening, never this roster. */
export type EcazRevivalCohort = {
  cycle: number;
  returned: string[];
};
type Context = {
  leaders: readonly Pick<Leader, 'id' | 'dead' | 'deaths' | 'capturedBy' | 'gholaBy'>[];
  revivalCycle: number;
  ecazRevivalCohort?: EcazRevivalCohort;
};
type Quote = { cycle: number; returned: readonly string[] };
const invalid = () => { throw new Error('Ecaz revival cohort lost its original native discs.'); };

/** Provisional E3 composition: five actual Tanks open a native cohort; an
 * unavailable five-disc roster retains the base captured-leader exception.
 * Completed native returns, not death-counter equality, determine its remainder.
 * Duke's own death counter never indexes or delays a native cohort. */
export function quoteEcazRevivalCohort(p: Context, dukeInTanks: boolean, waiveOpening = false): Quote {
  const saved = p.ecazRevivalCohort;
  if (p.leaders.length !== 5 || !Number.isSafeInteger(p.revivalCycle) || p.revivalCycle < 0)
    invalid();
  if (saved !== undefined) {
    if (!saved || typeof saved !== 'object' || Array.isArray(saved) ||
      !Number.isSafeInteger(saved.cycle) || saved.cycle < 0 || !Array.isArray(saved.returned))
      invalid();
    let keys = 0;
    for (const key in saved) {
      if (key !== 'cycle' && key !== 'returned') invalid();
      keys++;
    }
    if (keys !== 2) invalid();
    for (let i = 0; i < saved.returned.length; i++) {
      if (!p.leaders.some(l => l.id === saved.returned[i]) ||
        saved.returned.indexOf(saved.returned[i]) !== i) invalid();
    }
  }
  let cycle = saved?.cycle ?? p.revivalCycle;
  // Old valid Ecaz states have only the first cohort. Face-down/revived native
  // histories seed its already-used identities once, not a shared death minimum.
  let returned: readonly string[];
  if (saved) returned = saved.returned;
  else {
    const seed: string[] = [];
    for (const leader of p.leaders)
      if (leader.deaths > 1 || (!leader.dead && leader.deaths > 0)) seed.push(leader.id);
    returned = seed;
  }
  let dead = dukeInTanks ? 1 : 0, unavailable = true, pending = false;
  for (const leader of p.leaders) {
    const tanked = leader.dead && !leader.capturedBy && !leader.gholaBy;
    if (tanked) {
      dead++;
      if (!returned.includes(leader.id)) pending = true;
    }
    if (!leader.dead && !leader.capturedBy && !leader.gholaBy) unavailable = false;
  }
  const opening = dead >= 5 || unavailable;
  if (cycle === 0 && (opening || waiveOpening)) cycle = 1;
  if (cycle > 0 && opening && !pending && returned.length > 0) {
    cycle++;
    returned = [];
  }
  return { cycle, returned };
}

/** Preserve an opening consumed by an independent Duke resurrection. */
export function recordEcazRevivalOpening(p: Context, dukeInTanks: boolean): void {
  const quote = quoteEcazRevivalCohort(p, dukeInTanks);
  if (p.ecazRevivalCohort?.cycle === quote.cycle &&
    p.ecazRevivalCohort.returned === quote.returned) return;
  if (!p.ecazRevivalCohort && quote.cycle === 0 && quote.returned.length === 0) return;
  p.ecazRevivalCohort = { cycle: quote.cycle, returned: [...quote.returned] };
  p.revivalCycle = Math.max(p.revivalCycle, quote.cycle);
}

/** Record only a completed native resurrection. Call before clearing dead. */
export function completeEcazRevivalCohortUse(p: Context, dukeInTanks: boolean, leader: string): void {
  if (!p.leaders.some(l => l.id === leader && l.dead)) invalid();
  const quote = quoteEcazRevivalCohort(p, dukeInTanks);
  if (p.ecazRevivalCohort?.cycle === quote.cycle &&
    quote.returned.includes(leader)) return;
  p.ecazRevivalCohort = { cycle: quote.cycle,
    returned: quote.returned.includes(leader) ? [...quote.returned] : [...quote.returned, leader] };
  p.revivalCycle = Math.max(p.revivalCycle, quote.cycle);
}

/** A first-death capture execution is physically face down. It skips the first
 * ordinary cohort; once that cohort is complete it has no extra lifetime ban. */
export function recordEcazFirstExecution(p: Context, dukeInTanks: boolean, leader: string): void {
  const quote = quoteEcazRevivalCohort(p, dukeInTanks);
  p.ecazRevivalCohort = { cycle: quote.cycle,
    returned: quote.cycle <= 1 && !quote.returned.includes(leader)
      ? [...quote.returned, leader] : [...quote.returned] };
  p.revivalCycle = Math.max(p.revivalCycle, quote.cycle);
}
