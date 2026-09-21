import { shipmentAvailable } from './shipment-opportunity';
import type { ShipmentClaim } from './shipment-promises';
import {
  shipmentPromiseModeSupported,
  parseShipmentClaim,
  shipmentClaimText,
  ShipmentClaimError,
} from './shipment-promises';
import {
  parseCardCountFact,
  cardCountFactMatches,
  cardCountFactText,
  type CardCountFact,
} from './truthtrance-card-count';
import { richeseCards } from './richese-cards';
import {
  parseHandInventoryFact,
  handInventoryFactMatches,
  handInventoryFactText,
  type HandInventoryFact,
} from './truthtrance-hand-inventory';
import {
  parsePlanClaim,
  planClaimText,
  type PlanClaim,
} from './battle-promises';
import { gameTerritories, territory } from './board';
import { parseForceCountFact, forceCountFactMatches, forceCountFactText, forceCountCounterError, type ForceCountFact, type ForceCountPlayer } from './truthtrance-force-count';
import type { Action, Game, Player } from './engine';
import { treacheryDeck } from './cards';
import { CHEAP_HERO_TRAITOR } from './traitors';
import { DUKE_VIDAL_ID } from './duke-vidal';
import { canUseAsTruthtranceRole } from './shrine';
import { isKnowledgeFact, parseKnowledgeFact, knowledgeFactAnswer, knowledgeFactText, truthKnowledgeOf, type KnowledgeFact, type TruthKnowledge } from './truthtrance-knowledge';

export type TruthFact =
  | KnowledgeFact
  | CardCountFact
  | HandInventoryFact
  | ForceCountFact
  | { kind: 'hand'; name: string }
  | { kind: 'traitor'; leader: string }
  | { kind: 'spice'; compare: 'eq' | 'gte' | 'lte'; value: number }
  | { kind: 'and' | 'or'; terms: TruthFact[] };
export type TruthQuestion =
  | ({ kind: 'shipment'; target: string } & ShipmentClaim)
  | { kind: 'battlePlan'; target: string; territory: string; claim: PlanClaim }
  | { kind: 'fact'; target: string; fact: TruthFact }
  | {
      kind: 'freeform';
      target: string;
      text: string;
      scope: 'fact' | 'currentTurn';
    };
export type TruthAnswer = 'yes' | 'no' | 'unknown';
export type TruthQueueEntry = {
  player: string;
  card: string;
  /** Durable authorization for a Karama committed through an occupied Shrine. */
  source?: 'shrine';
};
export type TruthWindow = {
  stage: 'priority' | 'ask' | 'answer' | 'unknown';
  queue: TruthQueueEntry[];
  passed: string[];
  question: TruthQuestion | null;
};
export type TruthRecord = {
  turn: number;
  phase: number;
  asker: string;
  question: TruthQuestion;
  answer: TruthAnswer;
};
export class TruthError extends Error {}
function check(value: unknown, message: string): asserts value {
  if (!value) throw new TruthError(message);
}
export const TRUTH_CARD_NAMES = [
  ...new Set([...treacheryDeck(['ix']), ...richeseCards()].map((c) => c.name)),
].sort();
const record = (value: unknown): Record<string, unknown> => {
  check(
    value && typeof value === 'object' && !Array.isArray(value),
    'Choose a valid Truthtrance question.',
  );
  return value as Record<string, unknown>;
};
function parseFact(
  g: Game,
  value: unknown,
  respondent: Player,
  depth = 0,
  budget = { remaining: 16 },
): TruthFact {
  check(
    depth <= 4 && budget.remaining-- > 0,
    'Truthtrance supports at most 16 clauses and four levels of grouping.',
  );
  const v = record(value);
  if (v.kind === 'forceCount') {
    try {
      const fact = parseForceCountFact(v, gameTerritories(g).flatMap(t =>
        t.sectors.map(sector => ({ territory: t.id, sector }))));
      const unavailable = forceCountCounterError(respondent, fact.counter);
      check(!unavailable, unavailable ?? 'Choose a recorded physical counter type.');
      return fact;
    } catch (error) {
      throw new TruthError(error instanceof Error ? error.message : String(error));
    }
  }
  if (isKnowledgeFact(v)) {
    try { return parseKnowledgeFact(v); }
    catch (error) { throw new TruthError(error instanceof Error ? error.message : String(error)); }
  }
  if (v.kind === 'handCount' || v.kind === 'handInventory') {
    try {
      return v.kind === 'handCount'
        ? parseCardCountFact(v, TRUTH_CARD_NAMES)
        : parseHandInventoryFact(v);
    } catch (error) {
      throw new TruthError(
        error instanceof Error ? error.message : String(error),
      );
    }
  }
  if (v.kind === 'hand') {
    check(
      typeof v.name === 'string' && TRUTH_CARD_NAMES.includes(v.name),
      'Choose a known treachery card name.',
    );
    return { kind: 'hand', name: v.name };
  }
  if (v.kind === 'traitor') {
    check(
      typeof v.leader === 'string' &&
        (v.leader === CHEAP_HERO_TRAITOR ||
          g.players.some((p) => p.leaders.some((l) => l.id === v.leader))),
      'Choose a leader in this game.',
    );
    return { kind: 'traitor', leader: v.leader };
  }
  if (v.kind === 'spice') {
    check(
      v.compare === 'eq' || v.compare === 'gte' || v.compare === 'lte',
      'Compare currently held spice using exactly, at least, or at most.',
    );
    check(
      typeof v.value === 'number' &&
        Number.isSafeInteger(v.value) &&
        v.value >= 0,
      'Choose a nonnegative whole spice amount within the safe integer range.',
    );
    return { kind: 'spice', compare: v.compare, value: v.value };
  }
  check(
    (v.kind === 'and' || v.kind === 'or') &&
      Array.isArray(v.terms) &&
      v.terms.length >= 2 &&
      v.terms.length <= 8,
    'Combine two to eight fact clauses with AND or OR.',
  );
  return {
    kind: v.kind,
    terms: v.terms.map((term) => parseFact(g, term, respondent, depth + 1, budget)),
  };
}
/** Shared battle discs are valid plan identities, but never expand the traitor inventory. */
function battleLeaderIdentities(g: Game) {
  return [
    ...g.players.flatMap((player) => player.leaders),
    ...(g.dukeVidal?.leader.id === DUKE_VIDAL_ID ? [g.dukeVidal.leader] : []),
  ];
}
function parseQuestion(g: Game, asker: string, value: unknown): TruthQuestion {
  const v = record(value);
  check(
    typeof v.target === 'string' &&
      v.target !== asker &&
      g.players.some((p) => p.id === v.target),
    'Ask one other player.',
  );
  if (v.kind === 'shipment') {
    check(
      shipmentPromiseModeSupported(g) &&
        g.status === 'playing' &&
        g.phase === 5 &&
        g.active === v.target &&
        shipmentAvailable(
          g,
          g.players.find((p) => p.id === v.target)!,
        ) &&
        !g.response &&
        !g.decision &&
        !g.phaseOpening &&
        !g.pendingShipment,
      'Structured shipment promises currently support base Basic games and base Advanced games without Guild or optional modules, during the active unused shipment. Finish any pending decision first.',
    );
    try {
      return { kind: 'shipment', target: v.target, ...parseShipmentClaim(v) };
    } catch (error) {
      if (error instanceof ShipmentClaimError)
        throw new TruthError(error.message);
      throw error;
    }
  }
  if (v.kind === 'battlePlan') {
    check(
      g.phase === 6 &&
        g.battle &&
        [g.battle.attacker, g.battle.defender].includes(v.target),
      'Ask a combatant about the current battle.',
    );
    return {
      kind: 'battlePlan',
      target: v.target,
      territory: g.battle.territory,
      claim: parsePlanClaim(
        v.claim,
        battleLeaderIdentities(g).map((leader) => leader.id),
      ),
    };
  }
  if (v.kind === 'fact')
    return { kind: 'fact', target: v.target, fact: parseFact(g, v.fact, g.players.find(p => p.id === v.target)!) };
  check(
    v.kind === 'freeform' &&
      typeof v.text === 'string' &&
      v.text.trim().length > 0 &&
      v.text.length <= 500,
    'Write a game-related yes/no question of up to 500 characters.',
  );
  check(
    v.scope === 'fact' || v.scope === 'currentTurn',
    'Commitments may only concern the current turn.',
  );
  return {
    kind: 'freeform',
    target: v.target,
    text: v.text.trim(),
    scope: v.scope,
  };
}
/** Reparse a committed question without recomputing its answer or binding again.
 * The caller supplies the unchanged parent opportunity with its controls restored. */
export function validateTruthQuestionReceipt(
  g: Game,
  asker: string,
  question: TruthQuestion,
) {
  check(
    JSON.stringify(parseQuestion(g, asker, question)) ===
      JSON.stringify(question),
    'The completed Truthtrance question does not match its recorded opportunity.',
  );
}
/** Revalidate persisted physical card receipts before any write or projection. */
export function validateSavedTruthtrance(g: Game) {
  const window = g.truthtrance;
  // Older timing-only fixtures may represent the instant before the first
  // declaration with an empty priority queue. No card is committed there.
  if (window && window.queue.length > 0) {
    check(
      Array.isArray(window.queue) &&
        window.queue.length > 0 &&
        new Set(window.queue.map((entry) => entry?.card)).size ===
          window.queue.length &&
        window.queue.every((entry) => {
          if (
            !entry ||
            typeof entry.player !== 'string' ||
            typeof entry.card !== 'string' ||
            (entry.source !== undefined && entry.source !== 'shrine')
          )
            return false;
          return queuedTruthCardMatches(
            g.players.find((player) => player.id === entry.player)?.hand ?? [],
            entry,
          );
        }),
      'The saved Truthtrance must retain each committed physical card in its holder’s hand.',
    );
  }
  if (window?.question?.kind === 'fact') {
    check((window.stage === 'answer' || window.stage === 'unknown') && window.queue.length > 0,
      'The saved fact question must retain its asking player and answer stage.');
    check(JSON.stringify(parseQuestion(g, window.queue[0].player, window.question)) === JSON.stringify(window.question),
      'The saved fact question no longer matches its recorded form.');
    return;
  }
  if (window?.question?.kind !== 'shipment') return;
  check(
    (window.stage === 'answer' || window.stage === 'unknown') &&
      Array.isArray(window.queue) &&
      window.queue.length > 0 &&
      new Set(window.queue.map((entry) => entry?.card)).size ===
        window.queue.length &&
      window.queue.every((entry) =>
        queuedTruthCardMatches(
          g.players.find((p) => p.id === entry.player)?.hand ?? [],
          entry,
        ),
      ),
    'The saved shipment question must retain each physical Truthtrance in its holder’s hand.',
  );
  parseQuestion(g, window.queue[0].player, window.question);
}

/** Historical name retained for source references and focused callers. */
export const validateSavedShipmentQuestion = validateSavedTruthtrance;

/** Receipt validation uses the printed card identity, never current Shrine occupation. */
export function queuedTruthCardMatches(
  hand: readonly { id: string; effect?: string }[],
  entry: TruthQueueEntry,
): boolean {
  return (
    hand.filter(
      (card) =>
        card.id === entry.card &&
        card.effect === (entry.source === 'shrine' ? 'karama' : 'truthtrance'),
    ).length === 1
  );
}
/** A fact answer never returns which disjunct matched or any underlying private cards. */
export function truthFactAnswer(
  p: Pick<Player, 'hand' | 'traitors' | 'traitorChoices' | 'spice'> & Partial<ForceCountPlayer>,
  fact: TruthFact,
  knowledge?: TruthKnowledge,
): TruthAnswer {
  if (isKnowledgeFact(fact)) return knowledgeFactAnswer(fact, knowledge);
  if (fact.kind === 'forceCount')
    return forceCountFactMatches(p as ForceCountPlayer, fact) ? 'yes' : 'no';
  if (fact.kind === 'handInventory')
    return handInventoryFactMatches(p.hand, fact) ? 'yes' : 'no';
  if (fact.kind === 'handCount')
    return cardCountFactMatches(p.hand, fact) ? 'yes' : 'no';
  if (fact.kind === 'hand')
    return p.hand.some((c) => c.name === fact.name) ? 'yes' : 'no';
  if (fact.kind === 'traitor') {
    if (p.traitorChoices.length) return 'unknown';
    return p.traitors.includes(fact.leader) ? 'yes' : 'no';
  }
  if (fact.kind === 'spice') {
    // A current fact reports personal custody, not transaction-specific spending power or a future promise.
    const matches =
      fact.compare === 'eq'
        ? p.spice === fact.value
        : fact.compare === 'gte'
          ? p.spice >= fact.value
          : p.spice <= fact.value;
    return matches ? 'yes' : 'no';
  }
  const answers = fact.terms.map((term) => truthFactAnswer(p, term, knowledge));
  if (fact.kind === 'and')
    return answers.includes('no')
      ? 'no'
      : answers.includes('unknown')
        ? 'unknown'
        : 'yes';
  return answers.includes('yes')
    ? 'yes'
    : answers.includes('unknown')
      ? 'unknown'
      : 'no';
}
export function truthQuestionText(
  q: TruthQuestion,
  leaderName: (id: string) => string,
): string {
  if (q.kind === 'freeform') return q.text;
  if (q.kind === 'shipment')
    return `Will you ${shipmentClaimText(q)} this turn?`;
  if (q.kind === 'battlePlan')
    return `In this battle in ${territory(q.territory).name}, will it be true that ${planClaimText(q.claim, leaderName)}?`;
  const clause = (f: TruthFact): string => {
    if (isKnowledgeFact(f)) return knowledgeFactText(f);
    if (f.kind === 'forceCount') return forceCountFactText(f);
    if (f.kind === 'handInventory') return handInventoryFactText(f);
    if (f.kind === 'handCount') return cardCountFactText(f);
    if (f.kind === 'hand') return `you hold ${f.name}`;
    if (f.kind === 'traitor') return `${leaderName(f.leader)} is your traitor`;
    if (f.kind === 'spice')
      return `you currently hold ${f.compare === 'eq' ? 'exactly' : f.compare === 'gte' ? 'at least' : 'at most'} ${f.value} spice`;
    return `(${f.terms.map(clause).join(f.kind === 'and' ? ' AND ' : ' OR ')})`;
  };
  return `Is it true that ${clause(q.fact)}?`;
}
/** The interrupt overlays existing state. No battle/auction/response objects are moved or reconstructed. */
export function resolveTruthAction(
  g: Game,
  p: Player,
  a: Action,
  effects: {
    completeDefiniteAnswer: (g: Game) => void;
    log: (g: Game, text: string) => void;
    shipmentAnswers: (
      g: Game,
      p: Player,
      claim: ShipmentClaim,
    ) => TruthAnswer[];
    bindShipment: (
      g: Game,
      p: Player,
      claim: ShipmentClaim,
      answer: boolean,
      asker: string,
    ) => void;
    battleAnswers: (g: Game, p: Player, claim: PlanClaim) => TruthAnswer[];
    bindBattle: (
      g: Game,
      p: Player,
      claim: PlanClaim,
      answer: boolean,
      asker: string,
    ) => void;
    cardBlock: (g: Game, p: Player, card: Player['hand'][number]) => string | null;
  },
): boolean {
  const selectedCard =
    a.type === 'card' && typeof a.card === 'string'
      ? p.hand.find((card) => card.id === a.card)
      : undefined;
  const shrineCards = Array.isArray(a.shrineTruthtrance)
    ? a.shrineTruthtrance
    : [];
  const isPlay =
    a.type === 'card' &&
    !a.mode &&
    !!selectedCard &&
    canUseAsTruthtranceRole(g, p, selectedCard) &&
    (selectedCard.effect === 'truthtrance' ||
      shrineCards.includes(selectedCard.id));
  if (!g.truthtrance && !isPlay && !a.type.startsWith('truth')) return false;
  check(
    g.status === 'playing' || g.status === 'setup',
    'Truthtrance requires a started game.',
  );
  if (isPlay) {
    check(
      !g.truthtrance || g.truthtrance.stage === 'priority',
      'Answer the current Truthtrance before playing another card.',
    );
    g.truthtrance ??= {
      stage: 'priority',
      queue: [],
      passed: [],
      question: null,
    };
    const w = g.truthtrance;
    check(
      !w.passed.includes(p.id),
      'You already declared or passed in this Truthtrance priority window.',
    );
    const extra = a.cards ?? [];
    check(
      Array.isArray(extra) && extra.length <= p.hand.length,
      'Choose your additional Truthtrance cards.',
    );
    const selected: unknown[] = [a.card, ...extra];
    check(
      new Set(selected).size === selected.length &&
        selected.every(
          (id) =>
            typeof id === 'string' &&
            p.hand.some(
              (card) =>
                card.id === id &&
                canUseAsTruthtranceRole(g, p, card) &&
                (card.effect === 'truthtrance' || shrineCards.includes(id)),
            ),
        ),
      'Each declared Truthtrance must be a different card in your hand.',
    );
    const selectedCards = selected.map((id) =>
      p.hand.find((card) => card.id === id),
    );
    const reservation = selectedCards
      .map((card) => (card ? effects.cardBlock(g, p, card) : null))
      .find((reason): reason is string => !!reason);
    check(
      !reservation,
      reservation ?? 'Choose uncommitted physical cards.',
    );
    check(
      new Set(shrineCards).size === shrineCards.length &&
        shrineCards.every(
          (id) =>
            typeof id === 'string' &&
            selected.includes(id) &&
            p.hand.some((card) => card.id === id && card.effect === 'karama'),
        ),
      'Choose only selected Karama cards for the Shrine conversion.',
    );
    for (const card of selected)
      w.queue.push({
        player: p.id,
        card: card as string,
        ...(shrineCards.includes(card) ? { source: 'shrine' as const } : {}),
      });
    w.passed.push(p.id);
    effects.log(
      g,
      `${p.name} declared Truthtrance. The table checks storm-order priority before a question is asked.`,
    );
  } else {
    const w = g.truthtrance;
    check(w, 'There is no pending Truthtrance.');
    if (w.stage === 'priority') {
      check(
        a.type === 'truthPass' && !w.passed.includes(p.id),
        'Declare Truthtrance or pass its priority window first.',
      );
      w.passed.push(p.id);
    } else {
      const current = w.queue[0];
      check(current, 'No Truthtrance is awaiting resolution.');
      if (a.type === 'truthAsk') {
        check(
          (w.stage === 'ask' || w.stage === 'unknown') &&
            p.id === current.player,
          'Waiting for the Truthtrance holder to ask a question.',
        );
        w.question = parseQuestion(g, p.id, a.question);
        w.stage = 'answer';
        const target = g.players.find(
          (other) => other.id === w.question!.target,
        )!;
        effects.log(
          g,
          `${p.name} asks ${target.name}: ${truthQuestionText(w.question, (id) => (id === CHEAP_HERO_TRAITOR ? 'Cheap Hero / Heroine' : battleLeaderIdentities(g).find((leader) => leader.id === id)!.name))}`,
        );
      } else if (a.type === 'truthSave') {
        check(
          w.stage === 'unknown' && p.id === current.player,
          'Truthtrance can be saved after an answer cannot be known.',
        );
        effects.log(g, `${p.name} saved Truthtrance for later.`);
        nextQuestion(g);
      } else {
        check(
          a.type === 'truthAnswer' &&
            w.stage === 'answer' &&
            w.question?.target === p.id,
          'Waiting for the questioned player to answer Truthtrance.',
        );
        const q = w.question;
        check(
          a.answer === 'yes' || a.answer === 'no' || a.answer === 'unknown',
          'Answer Yes, No, or I don’t know.',
        );
        if (q.kind === 'fact')
          check(
            a.answer === truthFactAnswer(p, q.fact, truthKnowledgeOf(g, p)),
            'Answer this fact question truthfully.',
          );
        if (q.kind === 'shipment') {
          check(
            effects.shipmentAnswers(g, p, q).includes(a.answer),
            'Choose an answer consistent with your available shipment and earlier promises.',
          );
          if (a.answer !== 'unknown')
            effects.bindShipment(g, p, q, a.answer === 'yes', current.player);
        }
        if (q.kind === 'battlePlan') {
          check(
            effects.battleAnswers(g, p, q.claim).includes(a.answer),
            'Choose an answer consistent with your legal plans and previous commitments.',
          );
          if (a.answer !== 'unknown')
            effects.bindBattle(
              g,
              p,
              q.claim,
              a.answer === 'yes',
              current.player,
            );
        }
        // Freeform semantics cannot be certified by a deterministic engine. AI does not invent an answer.
        if (q.kind === 'freeform' && p.bot)
          check(
            a.answer === 'unknown',
            'AI cannot yet interpret freeform questions; ask a structured fact question.',
          );
        (g.truthHistory ??= []).push({
          turn: g.turn,
          phase: g.phase,
          asker: current.player,
          question: q,
          answer: a.answer,
        });
        effects.log(
          g,
          `${p.name} answers Truthtrance: ${a.answer === 'unknown' ? 'I don’t know' : a.answer === 'yes' ? 'Yes' : 'No'}.`,
        );
        if (a.answer === 'unknown') w.stage = 'unknown';
        else effects.completeDefiniteAnswer(g);
      }
    }
  }
  if (
    g.truthtrance?.stage === 'priority' &&
    g.truthtrance.passed.length === g.players.length
  ) {
    const order = [
      ...g.order,
      ...g.players
        .map((other) => other.id)
        .filter((id) => !g.order.includes(id)),
    ];
    g.truthtrance.queue.sort(
      (a, b) => order.indexOf(a.player) - order.indexOf(b.player),
    );
    g.truthtrance.stage = 'ask';
  }
  return true;
}
function nextQuestion(g: Game) {
  const w = g.truthtrance!;
  w.queue.shift();
  if (!w.queue.length) g.truthtrance = null;
  else {
    w.stage = 'ask';
    w.question = null;
  }
}
