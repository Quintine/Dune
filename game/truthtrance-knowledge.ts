import { FACTIONS, type FactionId } from './catalog';
import { leaders, SPICE_CARDS } from './cards';
import { territory } from './board';
import { TRUTH_CARD_NAMES } from './truthtrance-card-names';
import { battleCategoryInspectionValue } from './battle-card-slots';
import type { Game, Player } from './engine';

type Comparison = 'eq' | 'gte' | 'lte';
/** Publicly selectable identities; a territory names a blow, including a
 * Discovery card at that same printed territory. No deck contents enter here. */
export const SPICE_PEEK_VALUES: readonly string[] = [
  'worm', 'sandtrout', ...SPICE_CARDS.map(([id]) => id),
];
/** Public printed choices, independent of the private inspected result. */
export const PRESCIENCE_LEADER_NAMES: readonly string[] = [
  ...new Set([...FACTIONS.flatMap(f => leaders(f.id).map(leader => leader.name)),
    'Cheap Hero', 'Cheap Heroine', 'Auditor', 'Duke Prad Vidal', 'Kwisatz Haderach']),
].sort();
type PresciencePeekFact =
  | { kind: 'presciencePeek'; field: 'leader' | 'weapon' | 'defense'; name: string }
  | { kind: 'presciencePeek'; field: 'dial'; value: number };
export type KnowledgeFact =
  | PresciencePeekFact
  | { kind: 'prediction'; field: 'faction'; faction: FactionId }
  | { kind: 'prediction'; field: 'turn'; compare: Comparison; value: number }
  | { kind: 'spicePeek'; value: string }
  | { kind: 'auctionPeek'; name: string }
  | { kind: 'ixPoolPeek'; name: string }
  | { kind: 'stormDial' | 'stormForecast'; compare: Comparison; value: number };

/** Only values already chosen or actually known by this respondent. */
export type TruthKnowledge = {
  prediction: { faction: FactionId; turn: number } | null;
  stormDial: number | null;
  stormForecast: number | null;
  spicePeek: string | null;
  auctionPeek: string | null;
  /** The authorized respondent's recorded Ixian group, not remaining lots. */
  ixPoolPeek?: readonly string[] | null;
  presciencePeek?: { field: 'leader' | 'weapon' | 'defense' | 'dial'; value: string | number } | null;
};

export function isKnowledgeFact(value: unknown): value is KnowledgeFact {
  if (!value || typeof value !== 'object') return false;
  const kind = (value as { kind?: unknown }).kind;
  return kind === 'prediction' || kind === 'stormDial' || kind === 'stormForecast' || kind === 'spicePeek' || kind === 'auctionPeek' || kind === 'ixPoolPeek' || kind === 'presciencePeek';
}

export function knowledgeFactInputError(value: unknown): string | null {
  if (!isKnowledgeFact(value)) return 'Choose a stored prediction, storm dial or known forecast.';
  if (value.kind === 'presciencePeek') {
    if (value.field === 'dial') return typeof value.value === 'number' && Number.isFinite(value.value) && value.value >= 0
      ? null : 'Choose a nonnegative finite dial value.';
    if (value.field !== 'leader' && value.field !== 'weapon' && value.field !== 'defense')
      return 'Choose the observed battle plan field.';
    const names = value.field === 'leader' ? PRESCIENCE_LEADER_NAMES : TRUTH_CARD_NAMES;
    return typeof value.name === 'string' && (value.name === 'None' || names.includes(value.name))
      ? null : 'Choose a known printed face or None.';
  }
  if (value.kind === 'auctionPeek' || value.kind === 'ixPoolPeek')
    return typeof value.name === 'string' && TRUTH_CARD_NAMES.includes(value.name)
      ? null : 'Choose a known Treachery Card name.';
  if (value.kind === 'spicePeek')
    return typeof value.value === 'string' && SPICE_PEEK_VALUES.includes(value.value)
      ? null : 'Choose a printed Spice Blow territory, a sandworm, or Sandtrout.';
  if (value.kind === 'prediction') {
    if (value.field === 'faction')
      return FACTIONS.some((faction) => faction.id === value.faction)
        ? null : 'Choose a known faction for the recorded prediction.';
    if (value.field !== 'turn') return 'Choose the prediction faction or turn.';
  }
  if (value.compare !== 'eq' && value.compare !== 'gte' && value.compare !== 'lte')
    return 'Compare the stored value using exactly, at least, or at most.';
  const minimum = value.kind === 'stormDial' ? 0 : 1;
  const maximum = value.kind === 'prediction' ? 10 : value.kind === 'stormDial' ? 20 : 6;
  return Number.isSafeInteger(value.value) && value.value >= minimum && value.value <= maximum
    ? null : `Choose a whole ${value.kind === 'prediction' ? 'prediction turn' : value.kind === 'stormDial' ? 'storm dial' : 'forecast distance'} from ${minimum} to ${maximum}.`;
}

export function parseKnowledgeFact(value: unknown): KnowledgeFact {
  const error = knowledgeFactInputError(value);
  if (error || !isKnowledgeFact(value)) throw new Error(error ?? 'Choose a valid private-knowledge question.');
  if (value.kind === 'presciencePeek') return value.field === 'dial'
    ? { kind: value.kind, field: value.field, value: value.value }
    : { kind: value.kind, field: value.field, name: value.name };
  if (value.kind === 'auctionPeek' || value.kind === 'ixPoolPeek') return { kind: value.kind, name: value.name };
  if (value.kind === 'spicePeek') return { kind: value.kind, value: value.value };
  if (value.kind === 'prediction' && value.field === 'faction')
    return { kind: value.kind, field: value.field, faction: value.faction };
  if (value.kind === 'prediction')
    return { kind: value.kind, field: value.field, compare: value.compare, value: value.value };
  return { kind: value.kind, compare: value.compare, value: value.value };
}

export function truthKnowledgeOf(
  g: Pick<Game, 'phase' | 'turn' | 'advanced' | 'stormDials' | 'stormDialers' | 'stormCard' | 'stormCardKnown' | 'spicePeekKnown' | 'spiceDeck' | 'auction' | 'richeseAuction' | 'ixAuction' | 'ixAuctionKnown' | 'homeworldOccupationPreview' | 'battle' | 'players' | 'dukeVidal'>,
  p: Pick<Player, 'id' | 'faction' | 'prediction'>,
): TruthKnowledge {
  const dial = g.stormDials[p.id];
  const peek = g.phase === 5 && p.faction === 'atreides' && g.spicePeekKnown
    ? g.spiceDeck[0] : undefined;
  const lot = g.phase === 3 && p.faction === 'atreides' && !g.richeseAuction && !g.ixAuction ? g.auction : null;
  // The private lot is read only after the same inspection entitlement used by
  // the ordinary auction view has resolved successfully for this faction.
  const lotName = lot?.peekKnown ? lot.cards[lot.index]?.name : undefined;
  // Basic native Ixians may answer from their own successful inspection. The
  // record describes a known group, not the currently unsold auction cards.
  const ixKnown = g.phase === 3 && !g.advanced && p.faction === 'ixians'
    ? g.ixAuctionKnown : null;
  const ixPool = ixKnown && ixKnown.turn === g.turn &&
    (ixKnown.controller === undefined || ixKnown.controller === p.id) &&
    (!g.homeworldOccupationPreview || ixKnown.controller === p.id)
    ? ixKnown.cards.map(card => card.name) : null;
  const peekFace = peek && 'worm' in peek && peek.worm === true ? 'worm'
    : peek && 'sandtrout' in peek && peek.sandtrout === true ? 'sandtrout'
      : peek && 'territory' in peek && typeof peek.territory === 'string' && SPICE_PEEK_VALUES.includes(peek.territory)
        ? peek.territory : null;
  // Match the existing battle.insight audience and inspection normalization.
  // Never inspect the selected value before verifying the viewer is entitled.
  const battle = g.phase === 6 ? g.battle : null;
  const prescience = battle?.prescience;
  let presciencePeek: TruthKnowledge['presciencePeek'] = null;
  if (battle && prescience && (prescience.player === p.id || [battle.attacker, battle.defender].includes(p.id)) &&
      Object.hasOwn(prescience, 'value')) {
    const target = g.players.find(seat => seat.id === (prescience.player === battle.attacker ? battle.defender : battle.attacker));
    if (target) {
      const field = prescience.field;
      const raw = prescience.value;
      const card = (field === 'weapon' || field === 'defense') && typeof raw === 'string'
        ? target.hand.find(item => item.id === raw) : undefined;
      const value = battleCategoryInspectionValue(field, raw, card);
      if (value === null) presciencePeek = { field, value: 'None' };
      else if (field === 'dial' && typeof value === 'number' && Number.isFinite(value) && value >= 0)
        presciencePeek = { field, value };
      else if (field !== 'dial' && typeof value === 'string') {
        const face = g.players.flatMap(seat => [...seat.leaders, ...seat.hand])
          .concat(g.dukeVidal ? [g.dukeVidal.leader] : []).find(item => item.id === value);
        if (face) presciencePeek = { field, value: face.name };
      }
    }
  }
  return {
    prediction: p.faction === 'beneGesserit' && p.prediction
      ? { ...p.prediction } : null,
    stormDial: g.phase === 0 && g.stormDialers.includes(p.id) &&
      Number.isSafeInteger(dial) && dial >= (g.turn === 1 ? 0 : 1) && dial <= (g.turn === 1 ? 20 : 3)
      ? dial : null,
    stormForecast: p.faction === 'fremen' && g.advanced && g.stormCardKnown &&
      Number.isSafeInteger(g.stormCard) && g.stormCard! >= 1 && g.stormCard! <= 6
      ? g.stormCard : null,
    spicePeek: peekFace,
    auctionPeek: typeof lotName === 'string' && lotName.length > 0 ? lotName : null,
    ixPoolPeek: ixPool,
    presciencePeek,
  };
}

export function knowledgeFactAnswer(
  fact: KnowledgeFact,
  knowledge?: TruthKnowledge,
): 'yes' | 'no' | 'unknown' {
  const error = knowledgeFactInputError(fact);
  if (error) throw new Error(error);
  if (!knowledge) return 'unknown';
  if (fact.kind === 'presciencePeek') {
    const known = knowledge.presciencePeek;
    if (!known || known.field !== fact.field) return 'unknown';
    const expected = fact.field === 'dial' ? fact.value : fact.name;
    return known.value === expected ? 'yes' : 'no';
  }
  if (fact.kind === 'auctionPeek')
    return knowledge.auctionPeek == null ? 'unknown'
      : knowledge.auctionPeek === fact.name ? 'yes' : 'no';
  if (fact.kind === 'ixPoolPeek')
    return knowledge.ixPoolPeek == null ? 'unknown'
      : knowledge.ixPoolPeek.includes(fact.name) ? 'yes' : 'no';
  if (fact.kind === 'spicePeek')
    return knowledge.spicePeek === null || knowledge.spicePeek === undefined ? 'unknown'
      : knowledge.spicePeek === fact.value ? 'yes' : 'no';
  if (fact.kind === 'prediction' && fact.field === 'faction')
    return knowledge.prediction === null ? 'unknown'
      : knowledge.prediction.faction === fact.faction ? 'yes' : 'no';
  const actual = fact.kind === 'prediction' ? knowledge.prediction?.turn
    : fact.kind === 'stormDial' ? knowledge.stormDial : knowledge.stormForecast;
  if (actual === null || actual === undefined) return 'unknown';
  return (fact.compare === 'eq' ? actual === fact.value
    : fact.compare === 'gte' ? actual >= fact.value : actual <= fact.value) ? 'yes' : 'no';
}

export function knowledgeFactText(fact: KnowledgeFact): string {
  if (fact.kind === 'presciencePeek')
    return `the ${fact.field} you observed through battle Prescience is ${fact.field === 'dial' ? fact.value : fact.name}`;
  if (fact.kind === 'auctionPeek')
    return `the current auction card you inspected as Atreides is ${fact.name}`;
  if (fact.kind === 'ixPoolPeek')
    return `your recorded Ixian auction group includes ${fact.name}`;
  if (fact.kind === 'spicePeek') {
    const face = fact.value === 'worm' ? 'a sandworm' : fact.value === 'sandtrout' ? 'Sandtrout'
      : `a Spice Blow at ${territory(fact.value).name}`;
    return `the next Spice Card currently known to you as Atreides is ${face}`;
  }
  if (fact.kind === 'prediction' && fact.field === 'faction')
    return `your recorded Bene Gesserit prediction names ${FACTIONS.find((f) => f.id === fact.faction)!.name}`;
  const comparison = fact.compare === 'eq' ? 'exactly' : fact.compare === 'gte' ? 'at least' : 'at most';
  return fact.kind === 'prediction'
    ? `the turn in your recorded Bene Gesserit prediction is ${comparison} ${fact.value}`
    : fact.kind === 'stormDial'
      ? `your submitted storm dial for this turn is ${comparison} ${fact.value}`
      : `the storm card currently known to you as Fremen shows ${comparison} ${fact.value} sectors`;
}
