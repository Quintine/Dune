import { FACTIONS, type FactionId } from './catalog';
import type { Game, Player } from './engine';

type Comparison = 'eq' | 'gte' | 'lte';
export type KnowledgeFact =
  | { kind: 'prediction'; field: 'faction'; faction: FactionId }
  | { kind: 'prediction'; field: 'turn'; compare: Comparison; value: number }
  | { kind: 'stormDial' | 'stormForecast'; compare: Comparison; value: number };

/** Only values already chosen or actually known by this respondent. */
export type TruthKnowledge = {
  prediction: { faction: FactionId; turn: number } | null;
  stormDial: number | null;
  stormForecast: number | null;
};

export function isKnowledgeFact(value: unknown): value is KnowledgeFact {
  if (!value || typeof value !== 'object') return false;
  const kind = (value as { kind?: unknown }).kind;
  return kind === 'prediction' || kind === 'stormDial' || kind === 'stormForecast';
}

export function knowledgeFactInputError(value: unknown): string | null {
  if (!isKnowledgeFact(value)) return 'Choose a stored prediction, storm dial or known forecast.';
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
  if (value.kind === 'prediction' && value.field === 'faction')
    return { kind: value.kind, field: value.field, faction: value.faction };
  if (value.kind === 'prediction')
    return { kind: value.kind, field: value.field, compare: value.compare, value: value.value };
  return { kind: value.kind, compare: value.compare, value: value.value };
}

export function truthKnowledgeOf(
  g: Pick<Game, 'phase' | 'turn' | 'advanced' | 'stormDials' | 'stormDialers' | 'stormCard' | 'stormCardKnown'>,
  p: Pick<Player, 'id' | 'faction' | 'prediction'>,
): TruthKnowledge {
  const dial = g.stormDials[p.id];
  return {
    prediction: p.faction === 'beneGesserit' && p.prediction
      ? { ...p.prediction } : null,
    stormDial: g.phase === 0 && g.stormDialers.includes(p.id) &&
      Number.isSafeInteger(dial) && dial >= (g.turn === 1 ? 0 : 1) && dial <= (g.turn === 1 ? 20 : 3)
      ? dial : null,
    stormForecast: p.faction === 'fremen' && g.advanced && g.stormCardKnown &&
      Number.isSafeInteger(g.stormCard) && g.stormCard! >= 1 && g.stormCard! <= 6
      ? g.stormCard : null,
  };
}

export function knowledgeFactAnswer(
  fact: KnowledgeFact,
  knowledge?: TruthKnowledge,
): 'yes' | 'no' | 'unknown' {
  const error = knowledgeFactInputError(fact);
  if (error) throw new Error(error);
  if (!knowledge) return 'unknown';
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
  if (fact.kind === 'prediction' && fact.field === 'faction')
    return `your recorded Bene Gesserit prediction names ${FACTIONS.find((f) => f.id === fact.faction)!.name}`;
  const comparison = fact.compare === 'eq' ? 'exactly' : fact.compare === 'gte' ? 'at least' : 'at most';
  return fact.kind === 'prediction'
    ? `the turn in your recorded Bene Gesserit prediction is ${comparison} ${fact.value}`
    : fact.kind === 'stormDial'
      ? `your submitted storm dial for this turn is ${comparison} ${fact.value}`
      : `the storm card currently known to you as Fremen shows ${comparison} ${fact.value} sectors`;
}
