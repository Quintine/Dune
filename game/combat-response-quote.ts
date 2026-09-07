import { FACTIONS, type FactionId } from './catalog';
import { VOICE_KINDS } from './battle-cards';

export type CombatCheckKind =
  | 'kwisatz'
  | 'eliteStrength'
  | 'fremenSupport'
  | 'choamBattleAid';
export type CombatResponseKind = CombatCheckKind | 'voice' | 'prescience';
export type CombatCheck = { kind: CombatCheckKind; owner: string };
export type CombatResponseInput = {
  status: string;
  phase: number;
  advanced: boolean;
  territoryIds: readonly string[];
  players: readonly {
    id: string;
    faction: FactionId;
    ally?: string | null;
    specialKaramaUsed?: boolean;
  }[];
  battle: {
    attacker: string;
    defender: string;
    territory: string;
    revealed: boolean;
    plans: unknown;
    powerChecks?: unknown;
    eliteBlocked?: unknown;
    fremenSupportBlocked?: unknown;
    kwisatzBlocked?: unknown;
    choamAidBlocked?: unknown;
    fullPlanOffered?: unknown;
    preparation?: unknown;
    voice?: unknown;
    prescience?: unknown;
  } | null;
};
export type CombatResponseOperation =
  | { kind: 'next' }
  | { kind: 'finishPreparation' }
  | {
      kind: 'response';
      response: { kind: CombatResponseKind; owner: string };
      canceled: boolean;
    };
export type CombatResponseQuote = {
  /** Undefined preserves the legacy absence of a queue. */
  powerChecks: CombatCheck[] | undefined;
  response: (CombatCheck & { passed: string[] }) | null;
  patches: {
    eliteBlocked?: string[];
    fremenSupportBlocked?: boolean;
    kwisatzBlocked?: boolean;
    choamAidBlocked?: boolean;
    deleteVoice?: true;
    deletePrescience?: true;
    deletePreparation?: true;
    fullPlanOffered?: true;
  };
  decision: { kind: 'fullPlanOffer'; player: string } | null;
};
export class CombatResponseQuoteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CombatResponseQuoteError';
  }
}
function requireCombat(value: unknown, message: string): asserts value {
  if (!value) throw new CombatResponseQuoteError(message);
}
function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function ids(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every((id) => typeof id === 'string' && id.length > 0) &&
    new Set(value).size === value.length
  );
}
export function isCombatResponseKind(kind: string): kind is CombatResponseKind {
  return [
    'kwisatz',
    'eliteStrength',
    'fremenSupport',
    'choamBattleAid',
    'voice',
    'prescience',
  ].includes(kind);
}
/** A finite response/preparation successor. It neither evaluates plans nor
 * generates checks, reveals private information, or resolves a battle. */
export function quoteCombatResponse(
  input: CombatResponseInput,
  operation: CombatResponseOperation,
): CombatResponseQuote {
  try {
    return calculate(input, operation);
  } catch (error) {
    if (error instanceof CombatResponseQuoteError) throw error;
    throw new CombatResponseQuoteError(
      error instanceof Error ? error.message : 'Malformed combat response.',
    );
  }
}
function calculate(
  input: CombatResponseInput,
  operation: CombatResponseOperation,
): CombatResponseQuote {
  const b = input.battle;
  requireCombat(
    input.status === 'playing' &&
      input.phase === 6 &&
      typeof input.advanced === 'boolean' &&
      b &&
      b.revealed === false,
    'Combat responses require an unrevealed battle in the Battle Phase.',
  );
  requireCombat(
    Array.isArray(input.players) &&
      ids(input.players.map((p) => p.id)) &&
      input.players.every((p) => FACTIONS.some((f) => f.id === p.faction)),
    'Combat response seats are malformed.',
  );
  const combatants = [b.attacker, b.defender];
  requireCombat(
    ids(combatants) &&
      combatants.every((id) => input.players.some((p) => p.id === id)) &&
      typeof b.territory === 'string' &&
      Array.isArray(input.territoryIds) &&
      input.territoryIds.includes(b.territory),
    'Combat responses need two distinct seated combatants and their territory.',
  );
  requireCombat(
    record(b.plans) &&
      Object.keys(b.plans).every(
        (id) =>
          combatants.includes(id) &&
          record((b.plans as Record<string, unknown>)[id]),
      ),
    'Combat response plans are malformed.',
  );
  for (const flag of [
    'fremenSupportBlocked',
    'kwisatzBlocked',
    'choamAidBlocked',
    'fullPlanOffered',
  ] as const)
    requireCombat(
      b[flag] === undefined || typeof b[flag] === 'boolean',
      'Combat response flags are malformed.',
    );
  requireCombat(
    b.eliteBlocked === undefined ||
      (ids(b.eliteBlocked) &&
        b.eliteBlocked.every((id) => combatants.includes(id))),
    'Blocked elite owners are malformed.',
  );
  // This is only the possible ordering of already declared checks. Current
  // elite counts or KH availability are deliberately not benefit prerequisites.
  const possible: CombatCheck[] = [];
  for (const id of combatants) {
    const p = input.players.find((p) => p.id === id)!,
      other = input.players.find(
        (p) => p.id === combatants.find((x) => x !== id),
      )!;
    if (input.advanced && p.faction === 'atreides')
      possible.push({ kind: 'kwisatz', owner: id });
    if (
      ((input.advanced && ['emperor', 'fremen'].includes(p.faction)) ||
        (!input.advanced && p.faction === 'ixians')) &&
      !(p.faction === 'emperor' && other.faction === 'fremen')
    )
      possible.push({ kind: 'eliteStrength', owner: id });
    if (input.advanced && p.faction === 'fremen')
      possible.push({ kind: 'fremenSupport', owner: id });
  }
  const choam = input.players.find((p) => p.faction === 'choam');
  if (
    input.advanced &&
    choam?.ally &&
    combatants.includes(choam.ally) &&
    input.players.find((p) => p.id === choam.ally)?.ally === choam.id
  )
    possible.push({ kind: 'choamBattleAid', owner: choam.id });
  const rank = (value: unknown): number => {
    requireCombat(
      record(value) &&
        typeof value.kind === 'string' &&
        typeof value.owner === 'string',
      'Malformed combat response check.',
    );
    const at = possible.findIndex(
      (c) => c.kind === value.kind && c.owner === value.owner,
    );
    requireCombat(
      at >= 0,
      'Combat response check has an invalid kind, owner or faction benefit.',
    );
    return at;
  };
  requireCombat(
    b.powerChecks === undefined || Array.isArray(b.powerChecks),
    'Combat response queue is malformed.',
  );
  const raw = (b.powerChecks ?? []) as unknown[],
    ranks = raw.map(rank);
  requireCombat(
    ranks.every((v, i) => i === 0 || v > ranks[i - 1]),
    'Combat response queue is duplicated or out of order.',
  );
  const queue =
    b.powerChecks === undefined
      ? undefined
      : ranks.map((i) => ({ ...possible[i] }));
  const result: CombatResponseQuote = {
    powerChecks: queue,
    response: null,
    patches: {},
    decision: null,
  };
  const next = () => {
    const check = result.powerChecks?.shift();
    if (check) result.response = { ...check, passed: [] };
  };
  const finish = () => {
    result.patches.deletePreparation = true;
    const atreides = input.players.find((p) => p.faction === 'atreides');
    if (
      input.advanced &&
      atreides &&
      !atreides.specialKaramaUsed &&
      !b.fullPlanOffered &&
      !Object.keys(b.plans as object).length
    ) {
      result.patches.fullPlanOffered = true;
      result.decision = { kind: 'fullPlanOffer', player: atreides.id };
    }
  };
  if (operation.kind === 'next') {
    next();
    return result;
  }
  if (operation.kind === 'finishPreparation') {
    finish();
    return result;
  }
  requireCombat(
    operation.kind === 'response' &&
      typeof operation.canceled === 'boolean' &&
      record(operation.response),
    'Malformed combat response operation.',
  );
  const response = operation.response;
  if (response.kind !== 'voice' && response.kind !== 'prescience') {
    const current = rank(response);
    requireCombat(
      ranks.every((i) => i > current),
      'The current combat response does not precede its remaining checks.',
    );
    if (response.kind === 'eliteStrength' && operation.canceled) {
      const blocked = (b.eliteBlocked ?? []) as string[];
      requireCombat(
        !blocked.includes(response.owner),
        'This elite response was already canceled.',
      );
      result.patches.eliteBlocked = [...blocked, response.owner];
    } else if (response.kind === 'fremenSupport')
      result.patches.fremenSupportBlocked = operation.canceled;
    else if (response.kind === 'kwisatz')
      result.patches.kwisatzBlocked = operation.canceled;
    else if (response.kind === 'choamBattleAid')
      result.patches.choamAidBlocked = operation.canceled;
    next();
    return result;
  }
  const owner = input.players.find((p) => p.id === response.owner),
    faction = response.kind === 'voice' ? 'beneGesserit' : 'atreides';
  requireCombat(
    owner?.faction === faction,
    'Combat preparation response has the wrong faction owner.',
  );
  // Match battlePreparation's existing provider selection, including its
  // one-way ally link. CHOAM's queue above independently requires mutual links.
  const beneficiary = combatants.includes(owner.id)
    ? owner.id
    : owner.ally && combatants.includes(owner.ally)
      ? owner.ally
      : null;
  requireCombat(
    beneficiary,
    'Combat preparation owner has no combatant beneficiary.',
  );
  const opponent = combatants.find((id) => id !== beneficiary)!;
  if (response.kind === 'voice') {
    requireCombat(
      record(b.voice) &&
        b.voice.target === opponent &&
        typeof b.voice.kind === 'string' &&
        VOICE_KINDS.includes(b.voice.kind) &&
        typeof b.voice.must === 'boolean',
      'The declared Voice response is malformed or targets the wrong opponent.',
    );
    // Voice has already advanced preparation to Prescience (or its finish).
    if (b.preparation !== undefined) {
      const atreides = input.players.find((p) => p.faction === 'atreides');
      const recipient =
        atreides &&
        (combatants.includes(atreides.id)
          ? atreides.id
          : atreides.ally && combatants.includes(atreides.ally)
            ? atreides.ally
            : null);
      requireCombat(
        record(b.preparation) &&
          b.preparation.kind === 'prescience' &&
          recipient &&
          b.preparation.owner === atreides!.id &&
          b.preparation.beneficiary === recipient,
        'The Voice response has a malformed remaining Prescience preparation.',
      );
    }
    if (operation.canceled) result.patches.deleteVoice = true;
  } else {
    requireCombat(
      record(b.prescience) &&
        b.prescience.player === beneficiary &&
        ['leader', 'weapon', 'defense', 'dial'].includes(
          String(b.prescience.field),
        ),
      'The declared Prescience response is malformed or has the wrong beneficiary.',
    );
    requireCombat(
      record(b.preparation) &&
        b.preparation.kind === 'prescienceAnswer' &&
        b.preparation.owner === opponent &&
        b.preparation.beneficiary === beneficiary,
      'Prescience needs its pending opposing answer.',
    );
    if (operation.canceled) {
      result.patches.deletePrescience = true;
      finish();
    }
  }
  return result;
}
