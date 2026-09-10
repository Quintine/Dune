import { FACTIONS, type FactionId } from './catalog';
import { CHEAP_HERO_TRAITOR } from './traitors';

export type TraitorDeclarationContext = {
  event: string;
  attacker: string;
  defender: string;
  plans: Record<string, { leader: string | null; kwisatz?: boolean }>;
  players: readonly {
    id: string;
    faction: FactionId;
    ally?: string | null;
    traitors: readonly string[];
  }[];
  heroLeaderIds: readonly string[];
};

export type TraitorDeclaration = {
  event: string;
  voter: string;
  beneficiary: string;
  target: string;
  leader: string;
  identity: string;
  signature: string;
};

const has = (object: object, key: string) =>
  Object.prototype.hasOwnProperty.call(object, key);
function requireDeclaration(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
function validId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
function validateContext(context: TraitorDeclarationContext): void {
  requireDeclaration(
    context &&
      validId(context.event) &&
      validId(context.attacker) &&
      validId(context.defender) &&
      context.attacker !== context.defender &&
      Array.isArray(context.players) &&
      context.players.length >= 2 &&
      context.players.length <= 6 &&
      context.plans &&
      Array.isArray(context.heroLeaderIds) &&
      context.heroLeaderIds.every(validId) &&
      new Set(context.heroLeaderIds).size === context.heroLeaderIds.length,
    'Invalid traitor declaration battle context.',
  );
  const ids = new Set<string>();
  const factions = new Set<FactionId>();
  for (const player of context.players) {
    requireDeclaration(
      player &&
        validId(player.id) &&
        !ids.has(player.id) &&
        FACTIONS.some((faction) => faction.id === player.faction) &&
        !factions.has(player.faction),
      'Invalid traitor declaration roster.',
    );
    ids.add(player.id);
    factions.add(player.faction);
  }
  for (const id of [context.attacker, context.defender]) {
    const plan = has(context.plans, id) ? context.plans[id] : undefined;
    requireDeclaration(
      ids.has(id) &&
        plan &&
        (plan.leader === null || validId(plan.leader)) &&
        (plan.kwisatz === undefined || typeof plan.kwisatz === 'boolean'),
      'A traitor declaration requires both sealed battle plans.',
    );
  }
}

function declaredElements(context: TraitorDeclarationContext, voter: string) {
  const owner = context.players.find((player) => player.id === voter);
  requireDeclaration(owner, 'The traitor declaration voter is not seated.');
  const combatants = [context.attacker, context.defender];
  const beneficiary = combatants.includes(voter) ? voter : owner.ally;
  requireDeclaration(
    beneficiary &&
      combatants.includes(beneficiary) &&
      (beneficiary === voter || owner.faction === 'harkonnen'),
    'Only a combatant or its Harkonnen ally can declare this traitor.',
  );
  const target =
    beneficiary === context.attacker ? context.defender : context.attacker;
  const plan = context.plans[target];
  requireDeclaration(
    validId(plan.leader) && !plan.kwisatz,
    'A traitor declaration requires an unprotected opposing leader.',
  );
  return {
    beneficiary,
    target,
    leader: plan.leader,
    identity: context.heroLeaderIds.includes(plan.leader)
      ? CHEAP_HERO_TRAITOR
      : plan.leader,
  };
}

/** Canonical corruption evidence, not authentication against rewritten saves. */
function signature(
  context: TraitorDeclarationContext,
  receipt: Omit<TraitorDeclaration, 'signature'>,
): string {
  return JSON.stringify([
    1,
    receipt.event,
    receipt.voter,
    receipt.beneficiary,
    receipt.target,
    receipt.leader,
    receipt.identity,
    context.players
      .map(({ id, faction }) => [id, faction])
      .sort(([a], [b]) => a.localeCompare(b)),
  ]);
}

export function createTraitorDeclaration(
  context: TraitorDeclarationContext,
  voter: string,
): TraitorDeclaration {
  validateContext(context);
  const elements = declaredElements(context, voter);
  const held = context.players.find((player) => player.id === voter)!.traitors;
  requireDeclaration(
    Array.isArray(held) && held.includes(elements.identity),
    'The declaring player must hold the matching physical traitor identity.',
  );
  const receipt = { event: context.event, voter, ...elements, signature: '' };
  receipt.signature = signature(context, receipt);
  return receipt;
}

/** Later hand exchanges do not retract an already committed declaration. */
export function validateTraitorDeclaration(
  context: TraitorDeclarationContext,
  receipt: TraitorDeclaration,
): void {
  validateContext(context);
  requireDeclaration(
    receipt &&
      Object.keys(receipt).sort().join(',') ===
        'beneficiary,event,identity,leader,signature,target,voter' &&
      receipt.event === context.event &&
      validId(receipt.voter),
    'Invalid traitor declaration receipt.',
  );
  const expected = declaredElements(context, receipt.voter);
  requireDeclaration(
    receipt.beneficiary === expected.beneficiary &&
      receipt.target === expected.target &&
      receipt.leader === expected.leader &&
      receipt.identity === expected.identity &&
      receipt.signature === signature(context, receipt),
    'The traitor declaration lost its original battle or identity binding.',
  );
}

/** Missing version AND map are the explicit legacy compatibility boundary. */
export function validateTraitorDeclarations(
  context: TraitorDeclarationContext,
  calls: Readonly<Record<string, boolean | undefined>>,
  receipts: Readonly<Record<string, TraitorDeclaration>> | undefined,
  version?: 1,
): void {
  if (version === undefined && receipts === undefined) return;
  requireDeclaration(
    version === 1 &&
      receipts &&
      typeof receipts === 'object' &&
      !Array.isArray(receipts) &&
      calls &&
      typeof calls === 'object' &&
      !Array.isArray(calls),
    'The traitor declaration version or receipt map is missing.',
  );
  validateContext(context);
  for (const [voter, called] of Object.entries(calls)) {
    requireDeclaration(
      context.players.some((player) => player.id === voter) &&
        (called === undefined || typeof called === 'boolean'),
      'Invalid traitor declaration call.',
    );
    if (called === true)
      requireDeclaration(
        has(receipts, voter),
        'A called traitor has no declaration receipt.',
      );
  }
  for (const [voter, receipt] of Object.entries(receipts)) {
    requireDeclaration(
      has(calls, voter) &&
        calls[voter] !== undefined &&
        receipt?.voter === voter,
      'A traitor declaration receipt has no matching declared call.',
    );
    validateTraitorDeclaration(context, receipt);
  }
}
