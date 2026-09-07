import type { Card } from './cards';
import { isAuditorLeader } from './cards';
import type { FactionId } from './catalog';
import { auditCount } from './choam-auditor';
import {
  validateBattleCleanupContext,
  type ResolvedBattleReceipt,
} from './karama-battle-preflight';
import type { MoritaniRetention } from './moritani-retention';
import { TECH_TOKENS, type TechId, type TechState } from './tech-tokens';
import { CHEAP_HERO_TRAITOR } from './traitors';

export class BattleAftermathQuoteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BattleAftermathQuoteError';
  }
}
export type AftermathPlayer = {
  id: string;
  faction: FactionId;
  hand: readonly Card[];
  /** Actual native discs; include shared disc IDs separately in leaderIds. */
  leaders: readonly { id: string }[];
};
export type AftermathPending = {
  retention?: unknown;
  income?: unknown;
  tech?: unknown;
  capture?: unknown;
  auditor?: unknown;
  faceDance?: unknown;
};
export type AftermathCancellation = {
  kind: 'capture' | 'choamAudit' | 'choamBattleIncome';
  owner: string;
  intent?: string;
};
export type BattleAftermathInput = {
  status: string;
  phase: number;
  turn: number;
  advanced: boolean;
  battlePresent: boolean;
  lastBattle: readonly string[];
  territoryIds: readonly string[];
  context?: unknown;
  /** Only independently known old parent values; never fabricate a missing winner. */
  legacy?: { territory?: string; winner?: string | null };
  players: readonly AftermathPlayer[];
  leaderIds: readonly string[];
  physicalCards: readonly { id: string; kind?: Card['kind'] }[];
  techTokens?: TechState | null;
  pending: AftermathPending;
  cancel?: AftermathCancellation;
};
export type AftermathContext =
  | { kind: 'modern'; receipt: ResolvedBattleReceipt }
  | {
      kind: 'legacy';
      turn: number;
      combatants: string[];
      territory?: string;
      winner?: string | null;
    };
export type AftermathCapture = {
  player: string;
  loser: string;
  territory: string;
};
export type AftermathAuditor = {
  owner: string;
  opponent: string;
  territory: string;
  turn: number;
  event: string;
  survived: boolean;
  usedCards: string[];
  stage: 'offer' | 'response' | 'payment';
};
export type AftermathFaceDance = {
  player: string;
  winner: string;
  leader: string | null;
  identity: string | null;
  territory: string;
};
export type AftermathNext =
  | {
      kind: 'moritaniRetention';
      owner: string;
      player: string;
      territory: string;
      cards: string[];
    }
  | { kind: 'choamBattleIncome'; owner: string; amount: number }
  | { kind: 'techToken'; player: string; loser: string; choices: TechId[] }
  | ({ kind: 'captureOffer' } & AftermathCapture)
  | { kind: 'choamAudit'; player: string; event: string; count: number }
  | ({ kind: 'faceDance' } & AftermathFaceDance)
  /** Root resolves remaining battle geometry/collection at this separate pure boundary. */
  | { kind: 'board' };
export type AftermathStep =
  | { kind: 'cancel'; slot: 'capture' | 'income' | 'auditor' }
  | { kind: 'transferTech'; id: TechId; from: string; to: string }
  | { kind: 'emptyAuditor'; event: string };
export type AftermathSpending = { player: string; card: string };
export type BattleAftermathQuote = {
  context: AftermathContext;
  steps: AftermathStep[];
  next: AftermathNext;
};
function requireAftermath(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) throw new BattleAftermathQuoteError(message);
}
const id = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const ids = (value: unknown): value is string[] =>
  Array.isArray(value) &&
  value.every(id) &&
  new Set(value).size === value.length;
const whole = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;
const present = (value: unknown) => value !== undefined && value !== null;

/** Follow only currently compulsory aftermath, stopping at the next real choice.
 * Neither board traversal nor phase initialization is called by this module. */
export function quoteBattleAftermath(
  input: BattleAftermathInput,
  spending?: AftermathSpending,
): BattleAftermathQuote {
  try {
    // Validate the actual response/source before projecting its cost. A card
    // leaves this hand but remains a physical card in the discard pile.
    const current = calculate(input);
    if (!spending) return current;
    const owner = input.players.find((p) => p.id === spending.player);
    requireAftermath(
      id(spending.card) &&
        owner &&
        owner.hand.filter((c) => c.id === spending.card).length === 1 &&
        input.physicalCards.filter((c) => c.id === spending.card).length === 1,
      'The pending Karama cost needs unique physical custody in its owner’s hand.',
    );
    return calculate({
      ...input,
      players: input.players.map((p) =>
        p.id === owner.id
          ? { ...p, hand: p.hand.filter((c) => c.id !== spending.card) }
          : p,
      ),
    });
  } catch (error) {
    if (error instanceof BattleAftermathQuoteError) throw error;
    if (error instanceof Error)
      throw new BattleAftermathQuoteError(error.message);
    throw error;
  }
}
function calculate(input: BattleAftermathInput): BattleAftermathQuote {
  requireAftermath(
    input.status === 'playing' &&
      input.phase === 6 &&
      input.battlePresent === false &&
      whole(input.turn) &&
      input.turn > 0 &&
      Array.isArray(input.players) &&
      ids(input.players.map((p) => p.id)) &&
      ids(input.lastBattle) &&
      input.lastBattle.length === 2 &&
      input.lastBattle.every((p) =>
        input.players.some((seat) => seat.id === p),
      ) &&
      Array.isArray(input.territoryIds) &&
      Array.isArray(input.physicalCards) &&
      Array.isArray(input.leaderIds) &&
      record(input.pending),
    'Battle aftermath needs its two resolved seated combatants and current Battle phase.',
  );
  const player = (who: unknown) => {
    requireAftermath(id(who), 'This aftermath player is missing.');
    const p = input.players.find((p) => p.id === who);
    requireAftermath(p, 'This aftermath player is no longer seated.');
    return p;
  };
  let context: AftermathContext;
  if (present(input.context)) {
    requireAftermath(
      record(input.context),
      'The completed battle receipt is invalid.',
    );
    const validated = validateBattleCleanupContext({
      phase: input.phase,
      turn: input.turn,
      battlePresent: input.battlePresent,
      lastBattle: input.lastBattle,
      playerIds: input.players.map((p) => p.id),
      territoryIds: input.territoryIds,
      territory: input.context.territory as string,
      winner: input.context.winner as string | null,
      context: input.context,
    });
    requireAftermath(
      validated.kind === 'existing',
      'A modern aftermath needs its completed receipt.',
    );
    context = { kind: 'modern', receipt: validated.context };
  } else
    context = {
      kind: 'legacy',
      turn: input.turn,
      combatants: [...input.lastBattle],
    };
  function territory(value: unknown) {
    requireAftermath(
      id(value) && input.territoryIds.includes(value),
      'This aftermath territory is invalid.',
    );
    const previous =
      context.kind === 'modern' ? context.receipt.territory : context.territory;
    requireAftermath(
      previous === undefined || previous === value,
      'This aftermath territory differs from its completed battle.',
    );
    if (context.kind === 'legacy') context.territory = value;
    return value;
  }
  function winner(value: unknown) {
    requireAftermath(
      value === null || (id(value) && input.lastBattle.includes(value)),
      'This aftermath winner is not a resolved combatant.',
    );
    const previous =
      context.kind === 'modern' ? context.receipt.winner : context.winner;
    requireAftermath(
      previous === undefined || previous === value,
      'This aftermath winner differs from its completed battle.',
    );
    if (context.kind === 'legacy') context.winner = value;
    return value;
  }
  if (input.legacy?.territory !== undefined) territory(input.legacy.territory);
  if (input.legacy && 'winner' in input.legacy) winner(input.legacy.winner);
  const other = (who: string) => {
    requireAftermath(
      input.lastBattle.includes(who),
      'This aftermath participant was not a combatant.',
    );
    return input.lastBattle.find((p) => p !== who)!;
  };
  function physical(selected: readonly string[], hand?: readonly Card[]) {
    requireAftermath(
      selected.every(
        (card) =>
          input.physicalCards.filter((c) => c?.id === card).length === 1 &&
          (!hand || hand.filter((c) => c?.id === card).length === 1),
      ),
      'The aftermath cards must retain unique physical custody.',
    );
  }
  function retention(value: unknown): MoritaniRetention {
    requireAftermath(
      record(value) &&
        value.stage === 'choose' &&
        whole(value.turn) &&
        value.turn === input.turn &&
        ids(value.played) &&
        value.played.length > 0 &&
        ids(value.eligible) &&
        value.eligible.length > 0 &&
        value.eligible.every((card) =>
          (value.played as string[]).includes(card),
        ),
      'Resolve the alliance retention response first; its saved cleanup must be current.',
    );
    const owner = player(value.owner),
      loser = player(value.player);
    requireAftermath(
      owner.faction === 'moritani' &&
        owner.id !== loser.id &&
        Array.isArray(loser.hand),
      'This alliance cleanup needs its Moritani owner and defeated ally.',
    );
    const to = territory(value.territory);
    winner(other(loser.id));
    physical(value.played, loser.hand);
    return {
      owner: owner.id,
      player: loser.id,
      territory: to,
      turn: input.turn,
      played: [...value.played],
      eligible: [...value.eligible],
      stage: 'choose',
    };
  }
  function income(value: unknown) {
    requireAftermath(
      record(value) &&
        whole(value.amount) &&
        value.amount > 0 &&
        input.advanced,
      'The CHOAM battle income receipt is invalid.',
    );
    const owner = player(value.owner);
    requireAftermath(
      owner.faction === 'choam' &&
        (context.kind === 'legacy' ||
          ['normal', 'explosion', 'legacy'].includes(context.receipt.result)),
      'CHOAM battle income must follow a supported non-traitor result.',
    );
    return { owner: owner.id, amount: value.amount };
  }
  function technology(value: unknown) {
    requireAftermath(
      record(value) &&
        ids(value.choices) &&
        value.choices.length > 0 &&
        input.techTokens,
      'The battle technology choice is missing its physical tokens.',
    );
    const receiver = player(value.player),
      loser = player(value.loser);
    requireAftermath(
      other(receiver.id) === loser.id,
      'The technology transfer needs the defeated combatant.',
    );
    winner(receiver.id);
    const choices = value.choices;
    requireAftermath(
      choices.every((token) => TECH_TOKENS.some((t) => t.id === token)),
      'Choose canonical battle technology tokens.',
    );
    const allOwned = TECH_TOKENS.filter(
      (t) => input.techTokens?.[t.id]?.owner === loser.id,
    ).map((t) => t.id);
    requireAftermath(
      choices.length === allOwned.length &&
        choices.every((token) => allOwned.includes(token as TechId)) &&
        choices.every((token) =>
          whole(input.techTokens![token as TechId].spice),
        ),
      'The defeated faction must still own every pending technology choice.',
    );
    return {
      player: receiver.id,
      loser: loser.id,
      choices: [...choices] as TechId[],
    };
  }
  function capture(value: unknown): AftermathCapture {
    requireAftermath(
      record(value) && input.advanced,
      'The capture opportunity is missing.',
    );
    const captor = player(value.player),
      loser = player(value.loser);
    requireAftermath(
      captor.faction === 'harkonnen' && other(captor.id) === loser.id,
      'Only the winning Harkonnen combatant may capture from this loser.',
    );
    winner(captor.id);
    return {
      player: captor.id,
      loser: loser.id,
      territory: territory(value.territory),
    };
  }
  function auditor(
    value: unknown,
    stage: 'offer' | 'response',
  ): { pending: AftermathAuditor; count: number } {
    requireAftermath(
      record(value) &&
        input.advanced &&
        value.stage === stage &&
        id(value.event) &&
        value.turn === input.turn &&
        typeof value.survived === 'boolean' &&
        ids(value.usedCards),
      'The Auditor continuation is stale or not at its expected stage.',
    );
    const owner = player(value.owner),
      opponent = player(value.opponent);
    requireAftermath(
      owner.faction === 'choam' &&
        owner.leaders.some(isAuditorLeader) &&
        other(owner.id) === opponent.id,
      'This audit requires the actual CHOAM Auditor and opposing combatant.',
    );
    const to = territory(value.territory);
    requireAftermath(
      context.kind === 'legacy' || context.receipt.event === value.event,
      'The Auditor event differs from its completed battle.',
    );
    physical(value.usedCards);
    const count = auditCount(opponent.hand, value.usedCards, value.survived);
    return {
      count,
      pending: {
        owner: owner.id,
        opponent: opponent.id,
        territory: to,
        turn: input.turn,
        event: value.event,
        survived: value.survived,
        usedCards: [...value.usedCards],
        stage,
      },
    };
  }
  function faceDance(value: unknown): AftermathFaceDance {
    requireAftermath(record(value), 'The Face Dance opportunity is missing.');
    const owner = player(value.player),
      winning = player(value.winner);
    requireAftermath(
      owner.faction === 'tleilaxu' && owner.id !== winning.id,
      'The Face Dance opportunity needs its Tleilaxu owner and another winning faction.',
    );
    winner(winning.id);
    const to = territory(value.territory);
    requireAftermath(
      value.leader === null || id(value.leader),
      'The Face Dance winning identity is invalid.',
    );
    const hero = input.physicalCards.filter(
      (c) => c.id === value.leader && c.kind === 'hero',
    );
    if (hero.length) {
      physical([value.leader as string]);
      requireAftermath(
        value.identity === CHEAP_HERO_TRAITOR,
        'The winning hero needs its shared Face Dance identity.',
      );
    } else
      requireAftermath(
        value.identity === value.leader &&
          (value.leader === null || input.leaderIds.includes(value.leader)),
        'The Face Dance identity must match the actual winning leader disc.',
      );
    return {
      player: owner.id,
      winner: winning.id,
      leader: value.leader,
      identity: value.identity as string | null,
      territory: to,
    };
  }
  const pending = { ...input.pending },
    steps: AftermathStep[] = [];
  if (input.cancel) {
    const c = input.cancel;
    if (c.kind === 'choamBattleIncome') {
      requireAftermath(
        !present(pending.retention),
        'Finish the preceding alliance cleanup before CHOAM income.',
      );
      const current = income(pending.income);
      requireAftermath(
        c.owner === current.owner,
        'The canceled CHOAM income owner is stale.',
      );
      pending.income = null;
      steps.push({ kind: 'cancel', slot: 'income' });
    } else if (c.kind === 'capture') {
      requireAftermath(
        !present(pending.retention) &&
          !present(pending.income) &&
          !present(pending.tech),
        'The canceled capture has unresolved earlier aftermath.',
      );
      const current = capture(pending.capture);
      requireAftermath(
        c.owner === current.player,
        'The canceled capture owner is stale.',
      );
      pending.capture = null;
      steps.push({ kind: 'cancel', slot: 'capture' });
    } else if (c.kind === 'choamAudit') {
      requireAftermath(
        !present(pending.retention) &&
          !present(pending.income) &&
          !present(pending.tech) &&
          !present(pending.capture),
        'The canceled audit has unresolved earlier aftermath.',
      );
      const current = auditor(pending.auditor, 'response');
      requireAftermath(
        c.owner === current.pending.owner && c.intent === current.pending.event,
        'The canceled Auditor response is stale.',
      );
      pending.auditor = null;
      steps.push({ kind: 'cancel', slot: 'auditor' });
    } else requireAftermath(false, 'Unknown canceled battle aftermath.');
  }
  const result = (next: AftermathNext): BattleAftermathQuote => ({
    context,
    steps,
    next,
  });
  if (present(pending.retention)) {
    const p = retention(pending.retention);
    return result({
      kind: 'moritaniRetention',
      owner: p.owner,
      player: p.player,
      territory: p.territory,
      cards: [...p.eligible],
    });
  }
  if (present(pending.income))
    return result({ kind: 'choamBattleIncome', ...income(pending.income) });
  if (present(pending.tech)) {
    const p = technology(pending.tech);
    if (p.choices.length > 1) return result({ kind: 'techToken', ...p });
    steps.push({
      kind: 'transferTech',
      id: p.choices[0],
      from: p.loser,
      to: p.player,
    });
  }
  if (present(pending.capture))
    return result({ kind: 'captureOffer', ...capture(pending.capture) });
  if (present(pending.auditor)) {
    const { pending: p, count } = auditor(pending.auditor, 'offer');
    if (count)
      return result({
        kind: 'choamAudit',
        player: p.owner,
        event: p.event,
        count,
      });
    steps.push({ kind: 'emptyAuditor', event: p.event });
  }
  if (present(pending.faceDance))
    return result({ kind: 'faceDance', ...faceDance(pending.faceDance) });
  return result({ kind: 'board' });
}
