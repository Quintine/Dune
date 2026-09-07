import type { Leader } from './cards';

function text(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function count(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function validateLeader(leader: Leader): void {
  if (
    !leader ||
    typeof leader !== 'object' ||
    Array.isArray(leader) ||
    !text(leader.id) ||
    !text(leader.name) ||
    !text(leader.faction) ||
    !count(leader.strength) ||
    !count(leader.deaths) ||
    typeof leader.dead !== 'boolean' ||
    (leader.usedAt !== undefined && !text(leader.usedAt))
  )
    throw new Error('Residual Poison requires a valid physical leader record.');
  if (
    leader.concealed !== undefined &&
    (!leader.concealed ||
      typeof leader.concealed !== 'object' ||
      Array.isArray(leader.concealed) ||
      !count(leader.concealed.deaths) ||
      typeof leader.concealed.dead !== 'boolean')
  )
    throw new Error('Residual Poison requires valid concealed leader history.');
}

/**
 * The caller supplies the already-authorized controlled pool. Each eligible
 * physical disc appears once; the caller draws uniformly, without strength weights.
 * This helper neither resolves secret custody nor chooses a random victim.
 */
export function residualPoisonCandidates(
  controlled: readonly Leader[],
  territory: string,
): Leader[] {
  if (!Array.isArray(controlled) || !text(territory))
    throw new Error(
      'Residual Poison requires a leader pool and battle territory.',
    );
  const seen = new Set<string>();
  const candidates: Leader[] = [];
  for (const leader of controlled) {
    validateLeader(leader);
    if (seen.has(leader.id))
      throw new Error(
        'Residual Poison cannot contain duplicate physical leader IDs.',
      );
    seen.add(leader.id);
    if (!leader.dead && (!leader.usedAt || leader.usedAt === territory))
      candidates.push(structuredClone(leader));
  }
  return candidates;
}

/** No bounty or custody transitions: the engine adapter owns those separate rules. */
export function residualPoisonDeath(leader: Leader): Leader {
  validateLeader(leader);
  if (leader.dead)
    throw new Error(
      'Residual Poison cannot kill a leader already in the Tanks.',
    );
  if (!Number.isSafeInteger(leader.deaths + 1))
    throw new Error('Residual Poison leader death history would overflow.');
  const dead = structuredClone(leader);
  dead.dead = true;
  dead.deaths += 1;
  delete dead.usedAt;
  return dead;
}
