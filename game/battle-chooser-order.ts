import { reorderOrderedOpportunity } from './ordered-opportunity';

export type PhysicalBattlePair = {
  territory: string;
  attacker: string;
  defender: string;
};
export type BattleChooserChoice = PhysicalBattlePair & { chooser: string };
export type BattleOrderUse = {
  event: string;
  afterBattle: string | null;
  player: string;
  mode: 'first' | 'last';
  eligible: string[];
  signature: string;
};
export type BattleChooserOrder = {
  version: 1;
  turn: number;
  physicalOrder: string[];
  priority: string[];
  uses: BattleOrderUse[];
};
export class BattleChooserOrderError extends Error {}
function check(value: unknown, message: string): asserts value {
  if (!value) throw new BattleChooserOrderError(message);
}
const ids = (value: unknown): value is string[] =>
  Array.isArray(value) &&
  value.every((id) => typeof id === 'string' && id.length > 0) &&
  new Set(value).size === value.length;
const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
const keys = (value: object, expected: string) =>
  Object.keys(value).sort().join(',') === expected;

/** Events name an uncommitted boundary, not a particular faction or hidden card. */
export function battleChooserEvent(
  turn: number,
  afterBattle: string | null,
  revision: number,
): string {
  return `battleOrder:${JSON.stringify([turn, afterBattle, revision])}`;
}
export function battleOrderUseSignature(
  use: Omit<BattleOrderUse, 'signature'> | BattleOrderUse,
): string {
  return JSON.stringify([
    use.event,
    use.afterBattle,
    use.player,
    use.mode,
    use.eligible,
  ]);
}
/** Each physical pair has one chooser; its original attacker/defender never swap. */
export function quoteBattleChoosers(
  pairs: readonly PhysicalBattlePair[],
  physicalOrder: readonly string[],
  priority: readonly string[] = physicalOrder,
): {
  choices: BattleChooserChoice[];
  remaining: string[];
  current: string | null;
} {
  check(
    ids(physicalOrder) &&
      ids(priority) &&
      same([...physicalOrder].sort(), [...priority].sort()),
    'Battle chooser priority must preserve every physical player circle.',
  );
  check(
    Array.isArray(pairs) &&
      pairs.every(
        (pair) =>
          pair &&
          typeof pair.territory === 'string' &&
          pair.territory.length > 0 &&
          pair.attacker !== pair.defender &&
          physicalOrder.includes(pair.attacker) &&
          physicalOrder.includes(pair.defender),
      ),
    'Choose only distinct, seated physical battle opponents.',
  );
  const remaining = priority.filter((id) =>
    pairs.some((pair) => pair.attacker === id || pair.defender === id),
  );
  const choices = pairs
    .map((pair) => ({
      ...pair,
      chooser:
        priority.indexOf(pair.attacker) < priority.indexOf(pair.defender)
          ? pair.attacker
          : pair.defender,
    }))
    .sort((a, b) => priority.indexOf(a.chooser) - priority.indexOf(b.chooser));
  return { choices, remaining, current: remaining[0] ?? null };
}
function changedPriority(priority: readonly string[], use: BattleOrderUse) {
  check(
    ids(use.eligible) &&
      use.eligible.length > 1 &&
      same(
        priority.filter((id) => use.eligible.includes(id)),
        use.eligible,
      ),
    'The saved battle ordering needs its exact remaining eligible chooser sequence.',
  );
  check(
    use.eligible.includes(use.player) &&
      (use.mode === 'first' || use.mode === 'last') &&
      (use.mode === 'first' ? use.eligible[0] : use.eligible.at(-1)) !==
        use.player,
    'Juice of Sapho must change one remaining battle chooser position.',
  );
  const next = reorderOrderedOpportunity(
    {
      event: use.event,
      eligible: priority,
      remaining: priority,
      completed: [],
      current: priority[0],
      currentStarted: false,
    },
    { event: use.event, player: use.player, position: use.mode },
  );
  // Keep the accepted phase priority if a previously uninvolved Face Dancer
  // later gains a battle. Actual eligibility always comes from current pairs.
  return [...next.remaining];
}
export function validateBattleChooserOrder(
  state: BattleChooserOrder,
  physicalOrder: readonly string[],
  turn: number,
  events: readonly string[],
): void {
  check(
    state &&
      typeof state === 'object' &&
      keys(state, 'physicalOrder,priority,turn,uses,version') &&
      state.version === 1 &&
      state.turn === turn &&
      Number.isSafeInteger(turn) &&
      turn > 0 &&
      ids(state.physicalOrder) &&
      same(state.physicalOrder, physicalOrder) &&
      ids(state.priority) &&
      Array.isArray(state.uses) &&
      state.uses.length > 0 &&
      ids(events) &&
      same(
        events,
        state.uses.map((use) => use?.event),
      ),
    'The saved battle chooser order lost its phase, physical order or independent use events.',
  );
  let priority = [...physicalOrder];
  for (const [index, use] of state.uses.entries()) {
    check(
      use &&
        typeof use === 'object' &&
        keys(use, 'afterBattle,eligible,event,mode,player,signature') &&
        (use.afterBattle === null ||
          (typeof use.afterBattle === 'string' &&
            use.afterBattle.length > 0)) &&
        use.event === battleChooserEvent(turn, use.afterBattle, index) &&
        use.signature === battleOrderUseSignature(use),
      'The saved Juice of Sapho use lost its original battle boundary.',
    );
    priority = changedPriority(priority, use);
  }
  check(
    same(priority, state.priority),
    'The battle chooser priority contradicts its played scheduling history.',
  );
}
export function reorderBattleChoosers(input: {
  state?: BattleChooserOrder;
  physicalOrder: readonly string[];
  turn: number;
  afterBattle: string | null;
  pairs: readonly PhysicalBattlePair[];
  event: string;
  player: string;
  mode: 'first' | 'last';
}): BattleChooserOrder {
  if (input.state)
    validateBattleChooserOrder(
      input.state,
      input.physicalOrder,
      input.turn,
      input.state.uses.map((use) => use.event),
    );
  const revision = input.state?.uses.length ?? 0;
  check(
    input.event === battleChooserEvent(input.turn, input.afterBattle, revision),
    'This battle chooser opportunity has expired.',
  );
  const priority = input.state?.priority ?? input.physicalOrder;
  const use: BattleOrderUse = {
    event: input.event,
    afterBattle: input.afterBattle,
    player: input.player,
    mode: input.mode,
    eligible: quoteBattleChoosers(input.pairs, input.physicalOrder, priority)
      .remaining,
    signature: '',
  };
  use.signature = battleOrderUseSignature(use);
  const next: BattleChooserOrder = {
    version: 1,
    turn: input.turn,
    physicalOrder: [...input.physicalOrder],
    priority: changedPriority(priority, use),
    uses: [
      ...(input.state?.uses ?? []).map((use) => structuredClone(use)),
      use,
    ],
  };
  validateBattleChooserOrder(
    next,
    input.physicalOrder,
    input.turn,
    next.uses.map((use) => use.event),
  );
  return next;
}
