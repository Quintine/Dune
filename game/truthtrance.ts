import { shipmentAvailable } from './shipment-opportunity';
import type { ShipmentClaim } from './shipment-promises';
import { TERRITORIES } from './board';
import {
  parseCardCountFact,
  cardCountFactMatches,
  cardCountFactText,
  type CardCountFact,
} from './truthtrance-card-count';
import { richeseCards } from './richese-cards';
import {
  parsePlanClaim,
  planClaimText,
  type PlanClaim,
} from './battle-promises';
import { territory } from './board';
import type { Action, Game, Player } from './engine';
import { treacheryDeck } from './cards';
import { CHEAP_HERO_TRAITOR } from './traitors';
import { DUKE_VIDAL_ID } from './duke-vidal';

export type TruthFact =
  | CardCountFact
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
export type TruthWindow = {
  stage: 'priority' | 'ask' | 'answer' | 'unknown';
  queue: { player: string; card: string }[];
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
  depth = 0,
  budget = { remaining: 16 },
): TruthFact {
  check(
    depth <= 4 && budget.remaining-- > 0,
    'Truthtrance supports at most 16 clauses and four levels of grouping.',
  );
  const v = record(value);
  if (v.kind === 'handCount') {
    try {
      return parseCardCountFact(v, TRUTH_CARD_NAMES);
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
    terms: v.terms.map((term) => parseFact(g, term, depth + 1, budget)),
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
      !g.advanced &&
        !g.expansions.length &&
        g.status === 'playing' &&
        g.phase === 5 &&
        g.active === v.target &&
        shipmentAvailable(g,g.players.find((p) => p.id === v.target)!) &&
        !g.response &&
        !g.decision &&
        !g.phaseOpening &&
        !g.pendingShipment,
      'Automatic shipment promises currently support the active unused shipment in the Basic game without expansions. Finish any pending decision first.',
    );
    check(
      typeof v.territory === 'string' &&
        TERRITORIES.some((t) => t.id === v.territory),
      'Choose a printed destination territory.',
    );
    check(
      typeof v.minimum === 'number' &&
        Number.isSafeInteger(v.minimum) &&
        v.minimum >= 1 &&
        v.minimum <= 20,
      'Choose a minimum of one to twenty physical forces.',
    );
    return {
      kind: 'shipment',
      target: v.target,
      territory: v.territory,
      minimum: v.minimum,
    };
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
    return { kind: 'fact', target: v.target, fact: parseFact(g, v.fact) };
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
/** Revalidate the only new persisted future-action question before any write or projection. */
export function validateSavedShipmentQuestion(g: Game) {
  const window = g.truthtrance;
  if (window?.question?.kind !== 'shipment') return;
  check(
    (window.stage === 'answer' || window.stage === 'unknown') &&
      Array.isArray(window.queue) &&
      window.queue.length > 0 &&
      new Set(window.queue.map((entry) => entry?.card)).size ===
        window.queue.length &&
      window.queue.every(
        (entry) =>
          entry &&
          typeof entry.player === 'string' &&
          typeof entry.card === 'string' &&
          g.players
            .find((p) => p.id === entry.player)
            ?.hand.filter(
              (c) => c.id === entry.card && c.effect === 'truthtrance',
            ).length === 1,
      ),
    'The saved shipment question must retain each physical Truthtrance in its holder’s hand.',
  );
  parseQuestion(g, window.queue[0].player, window.question);
}
/** A fact answer never returns which disjunct matched or any underlying private cards. */
export function truthFactAnswer(
  p: Pick<Player, 'hand' | 'traitors' | 'traitorChoices' | 'spice'>,
  fact: TruthFact,
): TruthAnswer {
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
  const answers = fact.terms.map((term) => truthFactAnswer(p, term));
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
    return `Will you ship at least ${q.minimum} physical forces from your reserves to ${territory(q.territory).name} this turn?`;
  if (q.kind === 'battlePlan')
    return `In this battle in ${territory(q.territory).name}, will it be true that ${planClaimText(q.claim, leaderName)}?`;
  const clause = (f: TruthFact): string => {
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
  },
): boolean {
  const isPlay =
    a.type === 'card' &&
    !a.mode &&
    p.hand.some((c) => c.id === a.card && c.effect === 'truthtrance');
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
            p.hand.some((c) => c.id === id && c.effect === 'truthtrance'),
        ),
      'Each declared Truthtrance must be a different card in your hand.',
    );
    for (const card of selected)
      w.queue.push({ player: p.id, card: card as string });
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
            a.answer === truthFactAnswer(p, q.fact),
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
