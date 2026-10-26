import { parseTravelActionClaim, type TravelClaim } from './travel-expression-promises';
import { parseTurnActionLeaf, TURN_ACTION_MAX_DEPTH, TURN_ACTION_MAX_LEAVES,
  type TurnActionClaim } from './turn-action-promises';
import { parseTraitorActionClaim, type MixedTraitorClaim } from './mixed-traitor-question';
import { parseBattleActionClaim, MIXED_BATTLE_MAX_NODES, MIXED_BATTLE_MAX_TERMS, MIXED_BATTLE_MAX_DEPTH,
  MIXED_BATTLE_MAX_LEAVES, type MixedBattleClaim } from './mixed-battle-question';
import { parseAllianceExpressionClaim, allianceExpressionText, type AllianceExpressionClaim } from './alliance-expression-promises';
import { parseAllianceActionClaim, type MixedAllianceClaim } from './mixed-alliance-question';
import { parseBidActionClaim, MIXED_BID_MAX_DEPTH, MIXED_BID_MAX_LEAVES, type MixedBidClaim } from './mixed-bid-question';
import { parseRevivalActionClaim, type MixedRevivalClaim } from './mixed-revival-question';
import { parseBribePaymentClaim, type MixedBribeClaim } from './mixed-bribe-question';
import { parseMixedActionExpression, mixedActionExpressionText, type MixedActionExpression } from './mixed-action-question';
import { parseMovementExpressionClaim, movementExpressionText, type MovementExpressionClaim } from './movement-expression-promises';
import { parseBribeExpressionClaim, bribeExpressionRecipients, bribeExpressionText,
  type BribeExpressionClaim } from './bribe-expression-promises';
import { parseRevivalExpressionClaim, revivalExpressionText, revivalExpressionPromiseModeSupported, type RevivalExpressionClaim } from './revival-expression-promises';
import { parseLeaderRevivalClaim, leaderRevivalClaimText, leaderRevivalPromiseModeSupported, type LeaderRevivalClaim } from './leader-revival-promises';
import { parseAllianceClaim, allianceClaimText, alliancePromiseModeSupported, type AllianceClaim } from './alliance-promises';
import { parseBribeClaim, bribeClaimText, bribePromiseModeSupported, type BribeClaim } from './bribe-promises';
import { parseRevivalClaim, revivalClaimText, revivalPromiseModeSupported, type RevivalClaim } from './revival-promises';
import { parseMovementClaim, movementClaimText, movementPromiseTargetAvailable, MovementClaimError, type MovementClaim } from './movement-promises';
import { shipmentAvailable } from './shipment-opportunity';
import type { ShipmentClaim } from './shipment-promises';
import {
  shipmentPromiseModeSupported,
  shipmentPromiseTurnAvailable,
  parseShipmentClaim,
  shipmentClaimText,
  ShipmentClaimError,
} from './shipment-promises';
import {
  parseMixedShipmentExpression,
  compileMixedShipmentExpression,
  mixedShipmentExpressionText,
  type MixedShipmentExpression,
} from './mixed-shipment-question';
import {
  parseCardCountFact,
  cardCountFactMatches,
  cardCountFactText,
  type CardCountFact,
} from './truthtrance-card-count';
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
import { gameTerritories } from './board';
import { leaders } from './cards';
import { combatLocationName } from './combat-location';
import { parseForceCountFact, forceCountFactMatches, forceCountFactText, forceCountCounterError, type ForceCountFact, type ForceCountPlayer } from './truthtrance-force-count';
import type { Action, Game, Player } from './engine';
import { TRUTH_CARD_NAMES } from './truthtrance-card-names';
import { CHEAP_HERO_TRAITOR } from './traitors';
import {
  TRUTH_FACT_MAX_NODES, TRUTH_FACT_MAX_DEPTH, TRUTH_FACT_MAX_TERMS,
  TRUTH_FACT_SIZE_ERROR, TRUTH_FACT_GROUP_ERROR,
} from './truth-fact-expression';
import { DUKE_VIDAL_ID } from './duke-vidal';
import { canUseAsTruthtranceRole } from './shrine';
import { isKnowledgeFact, parseKnowledgeFact, knowledgeFactAnswer, knowledgeFactText, truthKnowledgeOf, type KnowledgeFact, type TruthKnowledge } from './truthtrance-knowledge';
import { parseNoFieldValueFact, noFieldValueFactMatches, noFieldValueFactText, type NoFieldValueFact } from './truthtrance-no-field-value';
import { parseFaceDancerFact, faceDancerFactMatches, faceDancerFactText, type FaceDancerFact } from './truthtrance-face-dancer';
import { parseBidClaim, bidClaimText, bidPromiseModeSupported, type BidClaim } from './bid-promises';

export type TruthFact =
  | KnowledgeFact
  | CardCountFact
  | HandInventoryFact
  | ForceCountFact
  | NoFieldValueFact
  | FaceDancerFact
  | { kind: 'hand'; name: string }
  | { kind: 'traitor'; leader: string }
  | { kind: 'spice'; compare: 'eq' | 'gte' | 'lte'; value: number }
  | { kind: 'and' | 'or'; terms: TruthFact[] };
export type MixedMovementClaim = { turn: number; mixed: MixedActionExpression<MovementClaim> };
export type TruthQuestion =
  | ({ kind: 'turnActions'; target: string } & TurnActionClaim)
  | ({ kind: 'travel'; target: string } & TravelClaim)
  | ({ kind: 'mixedTraitorCall'; target: string } & MixedTraitorClaim)
  | ({ kind: 'mixedBattlePlan'; target: string } & MixedBattleClaim)
  | ({ kind: 'allianceExpression'; target: string } & AllianceExpressionClaim)
  | ({ kind: 'mixedAlliance'; target: string } & MixedAllianceClaim)
  | ({ kind: 'mixedBid'; target: string } & MixedBidClaim)
  | ({ kind: 'mixedRevival'; target: string } & MixedRevivalClaim)
  | ({ kind: 'mixedBribe'; target: string } & MixedBribeClaim)
  | ({ kind: 'mixedMovement'; target: string } & MixedMovementClaim)
  | ({ kind: 'movementExpression'; target: string } & MovementExpressionClaim)
  | ({ kind: 'bribeExpression'; target: string } & BribeExpressionClaim)
  | ({ kind: 'revivalExpression'; target: string } & RevivalExpressionClaim)
  | ({ kind: 'leaderRevival'; target: string } & LeaderRevivalClaim)
  | ({ kind: 'alliance'; target: string } & AllianceClaim)
  | ({ kind: 'bribe'; target: string } & BribeClaim)
  | ({ kind: 'revival'; target: string } & RevivalClaim)
  | ({ kind: 'bid'; target: string } & BidClaim)
  | { kind: 'traitorCall'; target: string; battle: string; territory: string }
  | ({ kind: 'movement'; target: string } & MovementClaim)
  | ({ kind: 'shipment'; target: string } & ShipmentClaim)
  | { kind: 'mixedShipment'; target: string; mixed: MixedShipmentExpression }
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
  budget = { remaining: TRUTH_FACT_MAX_NODES },
): TruthFact {
  check(
    depth <= TRUTH_FACT_MAX_DEPTH && budget.remaining-- > 0,
    TRUTH_FACT_SIZE_ERROR,
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
  if (v.kind === 'noFieldValue') {
    try { return parseNoFieldValueFact(v); }
    catch (error) { throw new TruthError(error instanceof Error ? error.message : String(error)); }
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
  if (v.kind === 'faceDancer') {
    try {
      // Candidate identities are public printed components, independent of the
      // respondent's private cards or the status of any particular Face Dancer.
      return parseFaceDancerFact(v, [CHEAP_HERO_TRAITOR,
        ...g.players.flatMap(player => player.leaders.map(leader => leader.id))]);
    } catch (error) {
      throw new TruthError(error instanceof Error ? error.message : String(error));
    }
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
      v.terms.length <= TRUTH_FACT_MAX_TERMS,
    TRUTH_FACT_GROUP_ERROR,
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
  if (v.kind === 'mixedRevival') {
    check(Object.keys(v).sort().join(',') === 'kind,mixed,target,turn' && v.turn === g.turn &&
      revivalExpressionPromiseModeSupported(g) && g.status === 'playing' && g.phase >= 0 && g.phase <= 4 &&
      !g.response && !g.decision && !g.phaseOpening && !g.pendingRevival && !g.pendingKarama && !g.pendingTreacheryDiscard,
      'Supply the current turn, complete mixed Revival question and a quiet supported native window.');
    const respondent = g.players.find(player => player.id === v.target)!;
    return { kind: 'mixedRevival', target: v.target as string, turn: g.turn,
      mixed: parseMixedActionExpression(v.mixed, fact => parseFact(g, fact, respondent), parseRevivalActionClaim) };
  }
  if (v.kind === 'revivalExpression') {
    check(Object.keys(v).sort().join(',') === 'claim,kind,target,turn', 'Supply the current turn, full revival expression and respondent.');
    const claim = parseRevivalExpressionClaim({ turn: v.turn, claim: v.claim });
    check(revivalExpressionPromiseModeSupported(g) && g.status === 'playing' && g.phase >= 0 && g.phase <= 4 &&
      !g.response && !g.decision && !g.phaseOpening && !g.pendingRevival && !g.pendingKarama &&
      !g.pendingTreacheryDiscard && claim.turn === g.turn,
    'Choose a supported current-turn revival expression in a quiet window.');
    return { kind: 'revivalExpression', target: v.target, ...claim };
  }
  if (v.kind === 'leaderRevival') {
    check(Object.keys(v).sort().join(',') === 'kind,leader,target,turn',
      'Supply the current turn, exact named leader and respondent.');
    const claim = parseLeaderRevivalClaim(v);
    check(leaderRevivalPromiseModeSupported(g) && g.status === 'playing' && g.phase >= 0 && g.phase <= 4 &&
      !g.response && !g.decision && !g.phaseOpening && !g.pendingRevival && !g.pendingKarama &&
      !g.pendingTreacheryDiscard && claim.turn === g.turn,
    'Choose a supported current-turn ordinary leader-revival question in a quiet window.');
    return { kind: 'leaderRevival', target: v.target, ...claim };
  }
  if (v.kind === 'allianceExpression' || v.kind === 'mixedAlliance') {
    check(Object.keys(v).sort().join(',') === (v.kind === 'allianceExpression' ? 'claim,kind,target,turn' : 'kind,mixed,target,turn'),
      'Supply the current Nexus turn, complete alliance expression and respondent.');
    check(alliancePromiseModeSupported(g) && g.status === 'playing' && g.phase === 1 && g.nexus &&
      !g.spiceWindow && !g.spiceResolution && !g.response && !g.decision && !g.phaseOpening &&
      !g.pendingTreacheryDiscard && !g.pendingKarama && v.turn === g.turn,
    'Choose the current ordinary Nexus in a quiet supported window.');
    if (v.kind === 'allianceExpression') return { kind: 'allianceExpression', target: v.target as string,
      ...parseAllianceExpressionClaim({ turn: v.turn, claim: v.claim }) };
    const respondent = g.players.find(player => player.id === v.target)!;
    return { kind: 'mixedAlliance', target: v.target as string, turn: g.turn,
      mixed: parseMixedActionExpression(v.mixed, fact => parseFact(g, fact, respondent), parseAllianceActionClaim) };
  }
  if (v.kind === 'alliance') {
    check(Object.keys(v).sort().join(',') === 'kind,partner,target,turn',
      'Supply the current Nexus turn, named alliance partner and respondent.');
    const claim = parseAllianceClaim(v);
    check(alliancePromiseModeSupported(g) && g.status === 'playing' && g.phase === 1 && g.nexus &&
      !g.spiceWindow && !g.spiceResolution && !g.response && !g.decision && !g.phaseOpening &&
      !g.pendingTreacheryDiscard && !g.pendingKarama && claim.turn === g.turn &&
      claim.partner !== v.target && g.players.some(player => player.id === claim.partner),
    'Choose the current ordinary Nexus and another named partner in a supported table.');
    return { kind: 'alliance', target: v.target, ...claim };
  }
  if (v.kind === 'mixedBribe') {
    check(Object.keys(v).sort().join(',') === 'kind,mixed,target,turn' && v.turn === g.turn &&
      bribePromiseModeSupported(g) && g.status === 'playing' && g.phase >= 0 && g.phase <= 8 &&
      !g.response && !g.decision && !g.phaseOpening && !g.pendingTreacheryDiscard && !g.pendingKarama,
      'Supply the current turn, complete mixed bribe question and a supported quiet native window.');
    const respondent = g.players.find(player => player.id === v.target)!;
    const mixed = parseMixedActionExpression(v.mixed, fact => parseFact(g, fact, respondent), input => {
      const action = parseBribePaymentClaim(input);
      check(action.recipient !== respondent.id && action.recipient !== respondent.ally &&
        g.players.some(player => player.id === action.recipient), 'Choose another current non-allied ordinary bribe recipient.');
      return action;
    });
    return { kind: 'mixedBribe', target: v.target as string, turn: g.turn, mixed };
  }
  if (v.kind === 'bribeExpression') {
    check(Object.keys(v).sort().join(',') === 'claim,kind,target,turn',
      'Supply the current turn, complete bribe expression and respondent.');
    const claim = parseBribeExpressionClaim({ turn: v.turn, claim: v.claim });
    const respondent = g.players.find(player => player.id === v.target)!;
    check(bribePromiseModeSupported(g) && g.status === 'playing' && g.phase >= 0 && g.phase <= 8 &&
      claim.turn === g.turn && bribeExpressionRecipients(claim.claim).every(recipient =>
        recipient !== respondent.id && recipient !== respondent.ally && g.players.some(player => player.id === recipient)) &&
      !g.response && !g.decision && !g.phaseOpening && !g.pendingTreacheryDiscard && !g.pendingKarama,
    'Choose current-turn ordinary bribe statements to non-allied participants in a supported table.');
    return { kind: 'bribeExpression', target: v.target, ...claim };
  }
  if (v.kind === 'bribe') {
    check(Object.keys(v).sort().join(',') === 'kind,minimum,recipient,target,turn',
      'Supply the current turn, named bribe recipient, minimum and respondent.');
    const claim = parseBribeClaim(v), respondent = g.players.find(player => player.id === v.target)!;
    check(bribePromiseModeSupported(g) && g.status === 'playing' && g.phase >= 0 && g.phase <= 8 &&
      claim.turn === g.turn && claim.recipient !== respondent.id && claim.recipient !== respondent.ally &&
      g.players.some(player => player.id === claim.recipient) && !g.response && !g.decision && !g.phaseOpening &&
      !g.pendingTreacheryDiscard && !g.pendingKarama,
    'Choose a current-turn ordinary bribe to another non-allied participant in a supported table.');
    return { kind: 'bribe', target: v.target, ...claim };
  }
  if (v.kind === 'revival') {
    check(Object.keys(v).sort().join(',') === 'counter,kind,minimum,target,turn',
      'Supply the current Revival turn, physical counter type, minimum and respondent.');
    const claim = parseRevivalClaim(v);
    check(revivalPromiseModeSupported(g) && g.status === 'playing' && g.phase >= 0 && g.phase <= 4 &&
      claim.turn === g.turn && (g.phase < 4 || !g.ready.includes(v.target as string) &&
      (!g.revivalOrder || g.revivalOrder.remaining.includes(v.target as string))) &&
      !g.pendingRevival && !g.response && !g.decision && !g.phaseOpening &&
      !g.pendingKarama && !g.pendingTreacheryDiscard,
    'Choose a remaining native Revival opportunity this turn in a supported table and finish pending decisions.');
    return { kind: 'revival', target: v.target, ...claim };
  }
  if (v.kind === 'mixedBid') {
    check(Object.keys(v).sort().join(',') === 'kind,lot,mixed,target,turn',
      'Supply the current ordinary lot, turn, complete mixed bid question and respondent.');
    const claim = parseBidClaim({ turn: v.turn, lot: v.lot, minimum: 1 });
    check(bidPromiseModeSupported(g) && g.status === 'playing' && g.phase === 3 && g.auction &&
      !g.currentAuctionSale && !g.richeseAuction && !g.ixAuction && !g.response && !g.decision &&
      !g.phaseOpening && !g.pendingKarama && !g.pendingTreacheryDiscard && claim.turn === g.turn &&
      claim.lot === g.auction.index + 1, 'Choose the current ordinary lot in a quiet supported window.');
    const respondent = g.players.find(player => player.id === v.target)!;
    return { kind: 'mixedBid', target: v.target as string, turn: claim.turn, lot: claim.lot,
      mixed: parseMixedActionExpression(v.mixed, fact => parseFact(g, fact, respondent), parseBidActionClaim,
        { maxLeaves: MIXED_BID_MAX_LEAVES, maxDepth: MIXED_BID_MAX_DEPTH }) };
  }
  if (v.kind === 'bid') {
    check(Object.keys(v).sort().join(',') === 'kind,lot,minimum,target,turn',
      'Supply the current ordinary lot, turn, bid minimum and respondent.');
    const claim = parseBidClaim(v);
    check(bidPromiseModeSupported(g) && g.status === 'playing' && g.phase === 3 && g.auction &&
      !g.currentAuctionSale && !g.richeseAuction && !g.ixAuction && !g.response && !g.decision &&
      !g.phaseOpening && !g.pendingKarama && !g.pendingTreacheryDiscard &&
      claim.turn === g.turn && claim.lot === g.auction.index + 1,
    'Choose the current ordinary bid lot in a supported table and finish pending decisions.');
    return { kind: 'bid', target: v.target, ...claim };
  }
  if (v.kind === 'turnActions') {
    check(Object.keys(v).sort().join(',') === 'kind,mixed,target,turn' && v.turn === g.turn &&
      bribePromiseModeSupported(g) && g.status === 'playing' && Number.isInteger(g.phase) && g.phase >= 0 && g.phase <= 8 &&
      !g.response && !g.decision && !g.phaseOpening && !g.pendingTreacheryDiscard && !g.pendingKarama,
    'Supply the current turn, complete turn-action question and a supported quiet native window.');
    const respondent = g.players.find(player => player.id === v.target)!;
    const mixed = parseMixedActionExpression(v.mixed, fact => parseFact(g, fact, respondent), input => {
      const action = parseTurnActionLeaf(input);
      if (action.kind === 'battlePlan' || action.kind === 'traitorCall') {
        const battle = g.battle;
        check(g.phase === 6 && battle && typeof battle.event === 'string' && battle.event.length > 0 &&
          action.battle === battle.event && action.territory === battle.territory,
        'Choose this original current battle event and territory.');
        if (action.kind === 'battlePlan') {
          check([battle.attacker, battle.defender].includes(respondent.id), 'Ask an actual combatant about their own current native plan.');
          action.claim = parseBattleActionClaim(action.claim, battleLeaderIdentities(g).map(leader => leader.id));
        } else {
          const voters = [battle.attacker, battle.defender];
          if (battle.ecazOccupy?.lead) for (const id of [battle.ecazOccupy.ecaz, battle.ecazOccupy.ally])
            if (!voters.includes(id)) voters.push(id);
          const harkonnen = g.players.find(player => player.faction === 'harkonnen');
          if (harkonnen?.ally && voters.includes(harkonnen.ally) && !voters.includes(harkonnen.id)) voters.push(harkonnen.id);
          check(battle.revealed && voters.includes(respondent.id) && battle.traitorCalls[respondent.id] === undefined,
            'Choose an actual current revealed, unsubmitted native Traitor voter.');
        }
      }
      if (action.kind === 'payment') check(action.recipient !== respondent.id && action.recipient !== respondent.ally &&
        g.players.some(player => player.id === action.recipient), 'Choose another current non-allied ordinary bribe recipient.');
      if (action.kind === 'bid') check(bidPromiseModeSupported(g) && g.phase === 3 && g.auction &&
        !g.currentAuctionSale && !g.richeseAuction && !g.ixAuction && action.lot === g.auction.index + 1,
      'Choose the current ordinary bid lot in a supported native auction.');
      if (action.kind === 'leader') check(leaders(respondent.faction).some(leader => leader.id === action.leader) ||
        action.leader === 'kwisatz' && g.advanced && respondent.faction === 'atreides',
      'Choose a personal native faction leader, or the Advanced Atreides Kwisatz Haderach.');
      if (action.kind === 'alliance') check(alliancePromiseModeSupported(g) && g.phase === 1 && g.nexus &&
        !g.spiceWindow && !g.spiceResolution && action.partner !== respondent.id &&
        g.players.some(player => player.id === action.partner),
      'Choose another seated final alliance partner in the current quiet native Nexus.');
      return action;
    }, { requireFact: false, maxDepth: TURN_ACTION_MAX_DEPTH, maxLeaves: TURN_ACTION_MAX_LEAVES });
    return { kind: 'turnActions', target: v.target as string, turn: g.turn, mixed };
  }
  if (v.kind === 'travel') {
    check(Object.keys(v).sort().join(',') === 'kind,mixed,target,turn' && g.status === 'playing' &&
      Number.isInteger(g.phase) && g.phase >= 0 && g.phase <= 5 && v.turn === g.turn,
    'Choose this turn’s upcoming or active Shipment and Movement for this combined travel question.');
    const respondent = g.players.find(player => player.id === v.target)!;
    return { kind: 'travel', target: v.target as string, turn: g.turn,
      mixed: parseMixedActionExpression(v.mixed, fact => parseFact(g, fact, respondent), parseTravelActionClaim,
        { requireFact: false }) };
  }
  if (v.kind === 'mixedTraitorCall') {
    check(Object.keys(v).sort().join(',') === 'battle,kind,mixed,target,territory' &&
      g.status === 'playing' && g.phase === 6 && g.battle?.revealed && typeof v.battle === 'string' &&
      v.battle.length > 0 && v.battle === g.battle.event && v.territory === g.battle.territory &&
      g.battle.traitorCalls[v.target as string] === undefined,
    'Choose the current revealed battle and an original unsubmitted Traitor decision.');
    const respondent = g.players.find(player => player.id === v.target)!;
    return { kind: 'mixedTraitorCall', target: v.target as string, battle: v.battle,
      territory: v.territory as string,
      mixed: parseMixedActionExpression(v.mixed, fact => parseFact(g, fact, respondent), parseTraitorActionClaim) };
  }
  if (v.kind === 'traitorCall') {
    check(Object.keys(v).sort().join(',') === 'battle,kind,target,territory' &&
      g.status === 'playing' && g.phase === 6 && g.battle?.revealed &&
      typeof v.battle === 'string' && v.battle === g.battle.event &&
      v.territory === g.battle.territory && g.battle.traitorCalls[v.target as string] === undefined,
    'Choose the current revealed battle and a still-unsubmitted Traitor decision.');
    return { kind: 'traitorCall', target: v.target as string, battle: v.battle, territory: v.territory as string };
  }
  if (v.kind === 'mixedMovement') {
    check(Object.keys(v).sort().join(',') === 'kind,mixed,target,turn' && v.turn === g.turn &&
      movementPromiseTargetAvailable(g, v.target as string),
      'Supply the current turn, complete mixed movement question and supported unused respondent.');
    const respondent = g.players.find(player => player.id === v.target)!;
    const mixed = parseMixedActionExpression(v.mixed, fact => parseFact(g, fact, respondent), action => {
      check(action && typeof action === 'object' && !Array.isArray(action) &&
        Object.keys(action).sort().join(',') === 'minimum,territory', 'Supply only a printed movement destination and physical minimum.');
      return parseMovementClaim(action);
    });
    return { kind: 'mixedMovement', target: v.target as string, turn: g.turn, mixed };
  }
  if (v.kind === 'movementExpression') {
    check(Object.keys(v).sort().join(',') === 'claim,kind,target,turn',
      'Supply the current turn, complete movement expression and respondent.');
    const claim = parseMovementExpressionClaim({ turn: v.turn, claim: v.claim });
    check(claim.turn === g.turn && movementPromiseTargetAvailable(g, v.target as string),
      'Choose a supported unused ground-movement opportunity with pending decisions finished.');
    return { kind: 'movementExpression', target: v.target as string, ...claim };
  }
  if (v.kind === 'movement') {
    check(Object.keys(v).sort().join(',') === 'kind,minimum,target,territory',
      'Supply one ground-movement destination, minimum and respondent.');
    check(movementPromiseTargetAvailable(g, v.target as string),
      'Ground-movement promises need a supported unused opportunity this round under Basic or Advanced rules with declared native families and pending decisions finished. Optional modules remain unfinished.');
    try { return { kind: 'movement', target: v.target as string, ...parseMovementClaim(v) }; }
    catch (error) { if (error instanceof MovementClaimError) throw new TruthError(error.message); throw error; }
  }
  if (v.kind === 'shipment' || v.kind === 'mixedShipment') {
    check(
      shipmentPromiseModeSupported(g, v.target) &&
        shipmentPromiseTurnAvailable(g, v.target, shipmentAvailable(
          g, g.players.find((p) => p.id === v.target)!,
        )) &&
        !g.response &&
        !g.decision &&
        !g.phaseOpening &&
        !g.pendingShipment,
      'Structured shipment promises require a supported unused shipment this turn. During Shipment and Movement the respondent must be active or still waiting. Finish pending decisions first.',
    );
    try {
      if (v.kind === 'mixedShipment') {
        check(Object.keys(v).sort().join(',') === 'kind,mixed,target',
          'Supply only the mixed question and its respondent.');
        const respondent = g.players.find(p => p.id === v.target)!;
        return {kind:'mixedShipment',target:v.target,mixed:parseMixedShipmentExpression(v.mixed,
          fact => parseFact(g,fact,respondent))};
      }
      return { kind: 'shipment', target: v.target, ...parseShipmentClaim(v) };
    } catch (error) {
      if (error instanceof ShipmentClaimError)
        throw new TruthError(error.message);
      throw error;
    }
  }
  if (v.kind === 'mixedBattlePlan') {
    check(Object.keys(v).sort().join(',') === 'battle,kind,mixed,target,territory' &&
      g.phase === 6 && g.battle && [g.battle.attacker, g.battle.defender].includes(v.target) &&
      v.territory === g.battle.territory && (typeof v.battle === 'string' && v.battle.length > 0 || v.battle === null) &&
      v.battle === (g.battle.event ?? null), 'Choose the exact current battle and another seated combatant.');
    const respondent = g.players.find(player => player.id === v.target)!;
    const mixed = parseMixedActionExpression(v.mixed, fact => parseFact(g, fact, respondent),
      value => parseBattleActionClaim(value, battleLeaderIdentities(g).map(leader => leader.id)),
      { maxLeaves: MIXED_BATTLE_MAX_LEAVES, maxDepth: MIXED_BATTLE_MAX_DEPTH,
        maxNodes: MIXED_BATTLE_MAX_NODES, maxTerms: MIXED_BATTLE_MAX_TERMS });
    // Older active battles lacked an event. Initialize only in this explicit
    // Ask transaction, preserving passive views and every physical choice.
    g.battle.event ??= crypto.randomUUID();
    return { kind: 'mixedBattlePlan', target: v.target as string, battle: g.battle.event,
      territory: g.battle.territory, mixed };
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
  if (window?.question?.kind === 'fact' || window?.question?.kind === 'movement' || window?.question?.kind === 'traitorCall') {
    check((window.stage === 'answer' || window.stage === 'unknown') && window.queue.length > 0,
      'The saved fact question must retain its asking player and answer stage.');
    check(JSON.stringify(parseQuestion(g, window.queue[0].player, window.question)) === JSON.stringify(window.question),
      'The saved fact question no longer matches its recorded form.');
    return;
  }
  if (window?.question?.kind !== 'shipment' && window?.question?.kind !== 'mixedShipment') return;
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
  p: Pick<Player, 'hand' | 'traitors' | 'traitorChoices' | 'spice' | 'noField' | 'faceDancers'> & Partial<ForceCountPlayer>,
  fact: TruthFact,
  knowledge?: TruthKnowledge,
): TruthAnswer {
  if (isKnowledgeFact(fact)) return knowledgeFactAnswer(fact, knowledge);
  if (fact.kind === 'noFieldValue')
    return noFieldValueFactMatches(p.noField, fact) ? 'yes' : 'no';
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
  if (fact.kind === 'faceDancer')
    return faceDancerFactMatches(p, fact) ? 'yes' : 'no';
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
/** Resolve current clauses only for the respondent's private feasibility or definite answer. */
export function truthShipmentClaim(
  g: Game,
  p: Player,
  question: Extract<TruthQuestion,{kind:'shipment'|'mixedShipment'}>,
): ShipmentClaim {
  return question.kind === 'shipment' ? question : {
    claim: compileMixedShipmentExpression(question.mixed,
      fact => truthFactAnswer(p,fact,truthKnowledgeOf(g,p))),
  };
}
export function truthQuestionText(
  q: TruthQuestion,
  leaderName: (id: string) => string,
  locationName: (id: string) => string,
  playerName: (id: string) => string = id => id,
): string {
  if (q.kind === 'freeform') return q.text;
  if (q.kind === 'revivalExpression') return `Will you ${revivalExpressionText(q.claim, id => id === 'kwisatz' ? 'Kwisatz Haderach' : leaderName(id))} from now until your Revival opportunity ends this turn?`;
  if (q.kind === 'leaderRevival') return `Will you ${leaderRevivalClaimText(q, id => id === 'kwisatz' ? 'Kwisatz Haderach' : leaderName(id))}?`;
  if (q.kind === 'allianceExpression') return `Is it true that you ${allianceExpressionText(q.claim, playerName)}?`;
  if (q.kind === 'alliance') return `Will you ${allianceClaimText(q, playerName)}?`;
  if (q.kind === 'bribeExpression') return `Will you ${bribeExpressionText(q.claim, playerName)} from now until this turn ends?`;
  if (q.kind === 'bribe') return `Will you ${bribeClaimText(q, playerName)}?`;
  if (q.kind === 'revival') return `Will you ${revivalClaimText(q)}?`;
  if (q.kind === 'bid') return `Will you ${bidClaimText(q)}?`;
  if (q.kind === 'traitorCall') return `In this revealed battle in ${locationName(q.territory)}, will you declare the opposing leader a Traitor?`;
  if (q.kind === 'movementExpression') return `Will you ${movementExpressionText(q.claim)} before your Shipment and Movement turn ends?`;
  if (q.kind === 'movement') return `Will you ${movementClaimText(q)} before your Shipment and Movement turn ends?`;
  if (q.kind === 'shipment')
    return `Will you ${shipmentClaimText(q)} this turn?`;
  if (q.kind === 'battlePlan')
    return `In this battle in ${locationName(q.territory)}, will it be true that ${planClaimText(q.claim, leaderName)}?`;
  const clause = (f: TruthFact): string => {
    if (isKnowledgeFact(f)) return knowledgeFactText(f);
    if (f.kind === 'noFieldValue') return noFieldValueFactText(f);
    if (f.kind === 'forceCount') return forceCountFactText(f);
    if (f.kind === 'handInventory') return handInventoryFactText(f);
    if (f.kind === 'handCount') return cardCountFactText(f);
    if (f.kind === 'hand') return `you hold ${f.name}`;
    if (f.kind === 'traitor') return `${leaderName(f.leader)} is your traitor`;
    if (f.kind === 'faceDancer') return faceDancerFactText(f, leaderName);
    if (f.kind === 'spice')
      return `you currently hold ${f.compare === 'eq' ? 'exactly' : f.compare === 'gte' ? 'at least' : 'at most'} ${f.value} spice`;
    return `(${f.terms.map(clause).join(f.kind === 'and' ? ' AND ' : ' OR ')})`;
  };
  if (q.kind === 'turnActions') return `Is it true that ${mixedActionExpressionText(q.mixed, clause,
    action => {
      if (action.kind === 'cardPlay') return `you play ${action.effect === 'hajr' ? 'Hajr' : 'Tleilaxu Ghola'} in its printed role after this answer this turn`;
      if (action.kind === 'payment') return `you ${bribeClaimText({ turn: q.turn, ...action }, playerName)}`;
      if (action.kind === 'bid') return `you ${bidClaimText({ turn: q.turn, ...action })}`;
      if (action.kind === 'battlePlan') return `in your own native plan in this original battle in ${locationName(action.territory)}, ${planClaimText(action.claim, leaderName)}`;
      if (action.kind === 'traitorCall') return `you actually declare ${action.call ? 'Reveal' : 'Decline'} in this original battle in ${locationName(action.territory)} (later prevention does not change the declaration)`;
      if (action.kind === 'alliance') return `you will ${allianceClaimText({ turn: q.turn, partner: action.partner }, playerName)} (final membership; temporary offers or pairs do not settle this clause)`;
      if (action.kind === 'forces' || action.kind === 'leader') return `you ${revivalExpressionText(action,
        id => id === 'kwisatz' ? 'Kwisatz Haderach' : leaderName(id))} from now until your ordinary Revival opportunity ends this turn`;
      return `you ${action.kind === 'ship' ? shipmentClaimText(action) : movementClaimText(action)} before your Shipment and Movement turn ends`;
    })}?`;
  if (q.kind === 'travel') return `Is it true that ${mixedActionExpressionText(q.mixed, clause,
    action => `you ${action.kind === 'ship' ? shipmentClaimText(action) : movementClaimText(action)}`)} this turn?`;
  if (q.kind === 'mixedTraitorCall') return `Is it true that ${mixedActionExpressionText(q.mixed, clause,
    action => action.call ? 'you declare the opposing leader a Traitor in this battle'
      : 'you decline to declare the opposing leader a Traitor in this battle')}?`;
  if (q.kind === 'mixedBattlePlan') return `Is it true that ${mixedActionExpressionText(q.mixed, clause,
    action => `${planClaimText(action, leaderName)} in this battle`)}?`;
  if (q.kind === 'mixedAlliance') return `Is it true that ${mixedActionExpressionText(q.mixed, clause,
    action => `you ${allianceClaimText({ turn: q.turn, partner: action.partner }, playerName)}`)}?`;
  if (q.kind === 'mixedBid') return `Is it true that ${mixedActionExpressionText(q.mixed, clause,
    action => `you ${bidClaimText({ turn: q.turn, lot: q.lot, minimum: action.minimum })}`)}?`;
  if (q.kind === 'mixedRevival') return `Is it true that ${mixedActionExpressionText(q.mixed, clause,
    action => `you ${revivalExpressionText(action, id => id === 'kwisatz' ? 'Kwisatz Haderach' : leaderName(id))} before your Revival opportunity ends`)}?`;
  if (q.kind === 'mixedBribe') return `Is it true that ${mixedActionExpressionText(q.mixed, clause,
    action => `you ${bribeExpressionText({ kind: 'payment', ...action }, playerName)} from now until this turn ends`)}?`;
  if (q.kind === 'mixedMovement') return `Is it true that ${mixedActionExpressionText(q.mixed, clause,
    action => `you ${movementClaimText(action)} before your Movement opportunity ends`)}?`;
  return `Is it true that ${q.kind === 'mixedShipment'
    ? mixedShipmentExpressionText(q.mixed,clause) : clause(q.fact)}?`;
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
      mixed?: MixedShipmentExpression,
    ) => void;
    mixedMovementAnswers?: (g: Game, p: Player, claim: MixedMovementClaim) => TruthAnswer[];
    bindMixedMovement?: (g: Game, p: Player, claim: MixedMovementClaim, answer: boolean, asker: string) => void;
    movementExpressionAnswers?: (g: Game, p: Player, claim: MovementExpressionClaim) => TruthAnswer[];
    bindMovementExpression?: (g: Game, p: Player, claim: MovementExpressionClaim, answer: boolean, asker: string) => void;
    movementAnswers?: (g: Game, p: Player, claim: MovementClaim) => TruthAnswer[];
    bindMovement?: (g: Game, p: Player, claim: MovementClaim, answer: boolean, asker: string) => void;
    allianceExpressionAnswers?: (g: Game, p: Player, claim: AllianceExpressionClaim) => TruthAnswer[];
    bindAllianceExpression?: (g: Game, p: Player, claim: AllianceExpressionClaim, answer: boolean, asker: string) => void;
    mixedAllianceAnswers?: (g: Game, p: Player, claim: MixedAllianceClaim) => TruthAnswer[];
    bindMixedAlliance?: (g: Game, p: Player, claim: MixedAllianceClaim, answer: boolean, asker: string) => void;
    allianceAnswers?: (g: Game, p: Player, claim: AllianceClaim) => TruthAnswer[];
    bindAlliance?: (g: Game, p: Player, claim: AllianceClaim, answer: boolean, asker: string) => void;
    mixedBribeAnswers?: (g: Game, p: Player, claim: MixedBribeClaim) => TruthAnswer[];
    bindMixedBribe?: (g: Game, p: Player, claim: MixedBribeClaim, answer: boolean, asker: string) => void;
    bribeExpressionAnswers?: (g: Game, p: Player, claim: BribeExpressionClaim) => TruthAnswer[];
    bindBribeExpression?: (g: Game, p: Player, claim: BribeExpressionClaim, answer: boolean, asker: string) => void;
    bribeAnswers?: (g: Game, p: Player, claim: BribeClaim) => TruthAnswer[];
    bindBribe?: (g: Game, p: Player, claim: BribeClaim, answer: boolean, asker: string) => void;
    mixedRevivalAnswers?: (g: Game, p: Player, claim: MixedRevivalClaim) => TruthAnswer[];
    bindMixedRevival?: (g: Game, p: Player, claim: MixedRevivalClaim, answer: boolean, asker: string) => void;
    revivalExpressionAnswers?: (g: Game, p: Player, claim: RevivalExpressionClaim) => TruthAnswer[];
    bindRevivalExpression?: (g: Game, p: Player, claim: RevivalExpressionClaim, answer: boolean, asker: string) => void;
    leaderRevivalAnswers?: (g: Game, p: Player, claim: LeaderRevivalClaim) => TruthAnswer[];
    bindLeaderRevival?: (g: Game, p: Player, claim: LeaderRevivalClaim, answer: boolean, asker: string) => void;
    revivalAnswers?: (g: Game, p: Player, claim: RevivalClaim) => TruthAnswer[];
    bindRevival?: (g: Game, p: Player, claim: RevivalClaim, answer: boolean, asker: string) => void;
    mixedBidAnswers?: (g: Game, p: Player, claim: MixedBidClaim) => TruthAnswer[];
    bindMixedBid?: (g: Game, p: Player, claim: MixedBidClaim, answer: boolean, asker: string) => void;
    bidAnswers?: (g: Game, p: Player, claim: BidClaim) => TruthAnswer[];
    bindBid?: (g: Game, p: Player, claim: BidClaim, answer: boolean, asker: string) => void;
    travelAnswers?: (g: Game, p: Player, claim: TravelClaim) => TruthAnswer[];
    bindTravel?: (g: Game, p: Player, claim: TravelClaim, answer: boolean, asker: string) => void;
    turnActionAnswers?: (g: Game, p: Player, claim: TurnActionClaim) => TruthAnswer[];
    bindTurnAction?: (g: Game, p: Player, claim: TurnActionClaim, answer: boolean, asker: string) => void;
    mixedTraitorAnswers?: (g: Game, p: Player, claim: MixedTraitorClaim) => TruthAnswer[];
    bindMixedTraitor?: (g: Game, p: Player, claim: MixedTraitorClaim, answer: boolean, asker: string) => void;
    traitorAnswers?: (g: Game, p: Player) => TruthAnswer[];
    bindTraitor?: (g: Game, p: Player, answer: boolean, asker: string) => void;
    mixedBattleAnswers?: (g: Game, p: Player, claim: MixedBattleClaim) => TruthAnswer[];
    bindMixedBattle?: (g: Game, p: Player, claim: MixedBattleClaim, answer: boolean, asker: string) => void;
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
        if (w.question.kind === 'mixedBattlePlan')
          check(effects.mixedBattleAnswers?.(g, g.players.find(other => other.id === w.question!.target)!, w.question).length,
            'Choose a whole mixed battle-plan question compatible with this battle.');
        if (w.question.kind === 'mixedRevival')
          check(effects.mixedRevivalAnswers?.(g, g.players.find(other => other.id === w.question!.target)!, w.question).length,
            'Choose a mixed current-fact and ordinary-return question compatible with the native opportunity.');
        if (w.question.kind === 'revivalExpression')
          check(effects.revivalExpressionAnswers?.(g, g.players.find(other => other.id === w.question!.target)!, w.question).length,
            'Choose a whole revival expression with a compatible native completion.');
        if (w.question.kind === 'leaderRevival')
          check(effects.leaderRevivalAnswers?.(g, g.players.find(other => other.id === w.question!.target)!, w.question).length,
            'Choose a named leader question with a compatible native completion.');
        if (w.question.kind === 'allianceExpression')
          check(effects.allianceExpressionAnswers?.(g, g.players.find(other => other.id === w.question!.target)!, w.question).length,
            'Choose a whole final-alliance question compatible with the current Nexus.');
        if (w.question.kind === 'mixedAlliance')
          check(effects.mixedAllianceAnswers?.(g, g.players.find(other => other.id === w.question!.target)!, w.question).length,
            'Choose a mixed fact/final-alliance question compatible with the current Nexus.');
        if (w.question.kind === 'alliance')
          check(effects.allianceAnswers?.(g, g.players.find(other => other.id === w.question!.target)!, w.question).length,
            'Choose a current Nexus question with a compatible answer.');
        if (w.question.kind === 'mixedMovement')
          check(effects.mixedMovementAnswers?.(g, g.players.find(other => other.id === w.question!.target)!, w.question).length,
            'Choose a supported mixed current-fact and ground-movement question.');
        if (w.question.kind === 'movementExpression')
          check(effects.movementExpressionAnswers?.(g, g.players.find(other => other.id === w.question!.target)!, w.question).length,
            'Choose a supported whole ground-movement question.');
        if (w.question.kind === 'mixedBribe')
          check(effects.mixedBribeAnswers?.(g, g.players.find(other => other.id === w.question!.target)!, w.question).length,
            'Choose a mixed current-fact and ordinary-payment question compatible with earlier answers.');
        if (w.question.kind === 'bribeExpression')
          check(effects.bribeExpressionAnswers?.(g, g.players.find(other => other.id === w.question!.target)!, w.question).length,
            'Choose a whole bribe expression compatible with earlier answers.');
        if (w.question.kind === 'bribe')
          check(effects.bribeAnswers?.(g, g.players.find(other => other.id === w.question!.target)!, w.question).length,
            'Choose a current bribe question compatible with earlier answers.');
        if (w.question.kind === 'revival')
          check(effects.revivalAnswers?.(g, g.players.find(other => other.id === w.question!.target)!, w.question).length,
            'Choose a respondent with a remaining native Revival opportunity.');
        if (w.question.kind === 'mixedBid')
          check(effects.mixedBidAnswers?.(g, g.players.find(other => other.id === w.question!.target)!, w.question).length,
            'Choose a mixed current-fact and bid question with an available ordinary-lot opportunity.');
        if (w.question.kind === 'bid')
          check(effects.bidAnswers?.(g, g.players.find(other => other.id === w.question!.target)!, w.question).length,
            'Choose a bidder with a remaining ordinary opportunity in this lot.');
        if (w.question.kind === 'travel')
          check(effects.travelAnswers?.(g, g.players.find(other => other.id === w.question!.target)!, w.question).length,
            'Choose an unused or active native Shipment and Movement opportunity.');
        if (w.question.kind === 'turnActions')
          check(effects.turnActionAnswers?.(g, g.players.find(other => other.id === w.question!.target)!, w.question).length,
            'Choose a whole turn-action question compatible with native opportunities and earlier answers.');
        if (w.question.kind === 'mixedTraitorCall')
          check(effects.mixedTraitorAnswers?.(g, g.players.find(other => other.id === w.question!.target)!, w.question).length,
            'Choose a whole mixed Traitor question for an actual current voter.');
        if (w.question.kind === 'traitorCall')
          check(effects.traitorAnswers?.(g, g.players.find(other => other.id === w.question!.target)!).length,
            'Choose an actual unsubmitted native Traitor voter.');
        w.stage = 'answer';
        const target = g.players.find(
          (other) => other.id === w.question!.target,
        )!;
        effects.log(
          g,
          `${p.name} asks ${target.name}: ${truthQuestionText(w.question, (id) => (id === CHEAP_HERO_TRAITOR ? 'Cheap Hero / Heroine' : battleLeaderIdentities(g).find((leader) => leader.id === id)!.name), id => combatLocationName(g, id), id => g.players.find(player => player.id === id)!.name)}`,
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
        if (q.kind === 'shipment' || q.kind === 'mixedShipment') {
          const claim = truthShipmentClaim(g,p,q);
          check(
            effects.shipmentAnswers(g, p, claim).includes(a.answer),
            'Choose an answer consistent with your available shipment and earlier promises.',
          );
          if (a.answer !== 'unknown')
            effects.bindShipment(g, p, claim, a.answer === 'yes', current.player,
              q.kind === 'mixedShipment' ? q.mixed : undefined);
        }
        if (q.kind === 'mixedMovement') {
          check(effects.mixedMovementAnswers && effects.bindMixedMovement &&
            effects.mixedMovementAnswers(g, p, q).includes(a.answer), 'Choose a compatible whole mixed-movement answer.');
          if (a.answer !== 'unknown') effects.bindMixedMovement(g, p, q, a.answer === 'yes', current.player);
        }
        if (q.kind === 'movementExpression') {
          check(effects.movementExpressionAnswers && effects.bindMovementExpression &&
            effects.movementExpressionAnswers(g, p, q).includes(a.answer),
            'Choose a whole movement answer compatible with owned actions and earlier promises.');
          if (a.answer !== 'unknown') effects.bindMovementExpression(g, p, q, a.answer === 'yes', current.player);
        }
        if (q.kind === 'movement') {
          check(effects.movementAnswers && effects.bindMovement && effects.movementAnswers(g, p, q).includes(a.answer),
            'Choose an answer consistent with legal ground movement and earlier promises.');
          if (a.answer !== 'unknown') effects.bindMovement(g, p, q, a.answer === 'yes', current.player);
        }
        if (q.kind === 'mixedRevival') {
          check(effects.mixedRevivalAnswers && effects.bindMixedRevival && effects.mixedRevivalAnswers(g, p, q).includes(a.answer),
            'Choose a whole mixed-Revival answer compatible with current facts and owned native returns.');
          if (a.answer !== 'unknown') effects.bindMixedRevival(g, p, q, a.answer === 'yes', current.player);
        }
        if (q.kind === 'revivalExpression') {
          check(effects.revivalExpressionAnswers && effects.bindRevivalExpression && effects.revivalExpressionAnswers(g, p, q).includes(a.answer),
            'Choose a whole revival answer compatible with native returns and earlier promises.');
          if (a.answer !== 'unknown') effects.bindRevivalExpression(g, p, q, a.answer === 'yes', current.player);
        }
        if (q.kind === 'leaderRevival') {
          check(effects.leaderRevivalAnswers && effects.bindLeaderRevival && effects.leaderRevivalAnswers(g, p, q).includes(a.answer),
            'Choose a named leader-revival answer compatible with native eligibility and earlier promises.');
          if (a.answer !== 'unknown') effects.bindLeaderRevival(g, p, q, a.answer === 'yes', current.player);
        }
        if (q.kind === 'allianceExpression') {
          check(effects.allianceExpressionAnswers && effects.bindAllianceExpression && effects.allianceExpressionAnswers(g, p, q).includes(a.answer),
            'Choose a whole alliance answer compatible with original consent and earlier answers.');
          if (a.answer !== 'unknown') effects.bindAllianceExpression(g, p, q, a.answer === 'yes', current.player);
        }
        if (q.kind === 'mixedAlliance') {
          check(effects.mixedAllianceAnswers && effects.bindMixedAlliance && effects.mixedAllianceAnswers(g, p, q).includes(a.answer),
            'Choose a mixed alliance answer compatible with the whole question and original consent.');
          if (a.answer !== 'unknown') effects.bindMixedAlliance(g, p, q, a.answer === 'yes', current.player);
        }
        if (q.kind === 'alliance') {
          check(effects.allianceAnswers && effects.bindAlliance && effects.allianceAnswers(g, p, q).includes(a.answer),
            'Choose an answer consistent with actual alliance consent and earlier commitments.');
          if (a.answer !== 'unknown') effects.bindAlliance(g, p, q, a.answer === 'yes', current.player);
        }
        if (q.kind === 'mixedBribe') {
          check(effects.mixedBribeAnswers && effects.bindMixedBribe && effects.mixedBribeAnswers(g, p, q).includes(a.answer),
            'Choose a whole mixed-bribe answer compatible with current facts, funds and earlier commitments.');
          if (a.answer !== 'unknown') effects.bindMixedBribe(g, p, q, a.answer === 'yes', current.player);
        }
        if (q.kind === 'bribeExpression') {
          check(effects.bribeExpressionAnswers && effects.bindBribeExpression && effects.bribeExpressionAnswers(g, p, q).includes(a.answer),
            'Choose a whole bribe answer consistent with actual funding and earlier promises.');
          if (a.answer !== 'unknown') effects.bindBribeExpression(g, p, q, a.answer === 'yes', current.player);
        }
        if (q.kind === 'bribe') {
          check(effects.bribeAnswers && effects.bindBribe && effects.bribeAnswers(g, p, q).includes(a.answer),
            'Choose an answer consistent with actual ordinary bribe funding and earlier promises.');
          if (a.answer !== 'unknown') effects.bindBribe(g, p, q, a.answer === 'yes', current.player);
        }
        if (q.kind === 'revival') {
          check(effects.revivalAnswers && effects.bindRevival && effects.revivalAnswers(g, p, q).includes(a.answer),
            'Choose an answer consistent with native force revivals and earlier answers.');
          if (a.answer !== 'unknown') effects.bindRevival(g, p, q, a.answer === 'yes', current.player);
        }
        if (q.kind === 'mixedBid') {
          check(effects.mixedBidAnswers && effects.bindMixedBid && effects.mixedBidAnswers(g, p, q).includes(a.answer),
            'Choose a whole mixed-bid answer compatible with current facts and native ordinary declarations.');
          if (a.answer !== 'unknown') effects.bindMixedBid(g, p, q, a.answer === 'yes', current.player);
        }
        if (q.kind === 'bid') {
          check(effects.bidAnswers && effects.bindBid && effects.bidAnswers(g, p, q).includes(a.answer),
            'Choose an answer consistent with this lot, your legal bids and earlier answers.');
          if (a.answer !== 'unknown') effects.bindBid(g, p, q, a.answer === 'yes', current.player);
        }
        if (q.kind === 'travel') {
          check(effects.travelAnswers && effects.bindTravel && effects.travelAnswers(g, p, q).includes(a.answer),
            'Choose a whole travel answer compatible with native actions and earlier commitments.');
          if (a.answer !== 'unknown') effects.bindTravel(g, p, q, a.answer === 'yes', current.player);
        }
        if (q.kind === 'turnActions') {
          check(effects.turnActionAnswers && effects.bindTurnAction && effects.turnActionAnswers(g, p, q).includes(a.answer),
            'Choose a whole turn-action answer compatible with current facts, native actions and earlier commitments.');
          if (a.answer !== 'unknown') effects.bindTurnAction(g, p, q, a.answer === 'yes', current.player);
        }
        if (q.kind === 'mixedTraitorCall') {
          check(effects.mixedTraitorAnswers && effects.bindMixedTraitor && effects.mixedTraitorAnswers(g, p, q).includes(a.answer),
            'Choose an aggregate answer compatible with this mixed question and current native declaration.');
          if (a.answer !== 'unknown') effects.bindMixedTraitor(g, p, q, a.answer === 'yes', current.player);
        }
        if (q.kind === 'traitorCall') {
          check(effects.traitorAnswers && effects.bindTraitor && effects.traitorAnswers(g, p).includes(a.answer),
            'Choose an answer compatible with your current legal Traitor declaration and earlier answers.');
          if (a.answer !== 'unknown') effects.bindTraitor(g, p, a.answer === 'yes', current.player);
        }
        if (q.kind === 'mixedBattlePlan') {
          check(effects.mixedBattleAnswers && effects.bindMixedBattle && effects.mixedBattleAnswers(g, p, q).includes(a.answer),
            'Choose a mixed battle-plan answer compatible with the complete fact/plan question.');
          if (a.answer !== 'unknown') effects.bindMixedBattle(g, p, q, a.answer === 'yes', current.player);
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
