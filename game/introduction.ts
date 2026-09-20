import { baseDeck, leaders } from './cards';
import { reserveShipmentCost } from './shipment-price';
import { quoteBattleResolution, type ResolutionCombatant } from './battle-resolution-quote';
import { quoteSpiceCollection } from './board-resolution-quote';

/** Fixed teaching examples, never a room, seat or multiplayer save. */
export const INTRODUCTION_STORAGE_KEY = 'dune-introduction-v1';
export const INTRODUCTION_STEPS = [
  { title: 'Your place at the table', topic: 'setup' },
  { title: 'Ship within your budget', topic: 'movement' },
  { title: 'Seal a battle plan', topic: 'battle' },
  { title: 'Collect the spice', topic: 'collection' },
  { title: 'Join a table', topic: 'privacy' },
] as const;
export type IntroductionState = {
  version: 1;
  step: number;
  shipment: number;
  destination: 'stronghold' | 'sand';
  shipped: boolean;
  dial: number;
  defense: 'shield' | 'snooper';
  revealed: boolean;
  collectors: number;
  city: boolean;
  collected: boolean;
};
export function newIntroduction(): IntroductionState {
  return { version: 1, step: 0, shipment: 4, destination: 'sand', shipped: false,
    dial: 2, defense: 'shield', revealed: false, collectors: 3, city: false, collected: false };
}
const integer = (value: unknown, min: number, max: number): value is number =>
  Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;
export function restoreIntroduction(raw: string | null): IntroductionState | null {
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as IntroductionState;
    if (!s || s.version !== 1 || !integer(s.step, 0, INTRODUCTION_STEPS.length - 1) ||
      !integer(s.shipment, 1, 6) || !['stronghold', 'sand'].includes(s.destination) ||
      !integer(s.dial, 0, 6) || !['shield', 'snooper'].includes(s.defense) ||
      !integer(s.collectors, 0, 6) ||
      ![s.shipped, s.revealed, s.city, s.collected].every(v => typeof v === 'boolean') ||
      (s.shipped && introductionShipment(s).cost > 8)) return null;
    // Whitelist fields; never retain credentials or arbitrary imported properties.
    return { version: 1, step: s.step, shipment: s.shipment, destination: s.destination,
      shipped: s.shipped, dial: s.dial, defense: s.defense, revealed: s.revealed,
      collectors: s.collectors, city: s.city, collected: s.collected };
  } catch { return null; }
}
export function introductionShipment(s: Pick<IntroductionState, 'shipment' | 'destination'>) {
  const cost = reserveShipmentCost({ faction: 'atreides', halfRate: false }, s.destination, s.shipment);
  return { cost, remaining: 8 - cost, affordable: cost <= 8 };
}
export const INTRODUCTION_CARDS = {
  shield: baseDeck().find(c => c.kind === 'shield')!,
  snooper: baseDeck().find(c => c.kind === 'snooper')!,
  weapon: baseDeck().find(c => c.kind === 'projectile')!,
};
export const INTRODUCTION_LEADERS = { you: leaders('atreides')[0], opponent: leaders('guild')[0] };
export function introductionBattle(s: Pick<IntroductionState, 'dial' | 'defense'>) {
  const side = (you: boolean): ResolutionCombatant => {
    const leader = you ? INTRODUCTION_LEADERS.you : INTRODUCTION_LEADERS.opponent;
    const card = you ? INTRODUCTION_CARDS[s.defense] : INTRODUCTION_CARDS.weapon;
    return { id: you ? 'you' : 'opponent', faction: you ? 'atreides' : 'guild', spice: 0,
      hand: [card], leader, plan: { dial: you ? s.dial : 3, support: 0, leader: leader.id,
        weapon: you ? null : card.id, defense: you ? card.id : null },
      forces: { normal: 6, elite: 0, eliteStrength: 1, freeSupport: true } };
  };
  return quoteBattleResolution({ advanced: false, turn: 2, territory: 'wind_pass',
    attacker: side(true), defender: side(false),
    voters: ['you', 'opponent'].map(id => ({ id, beneficiary: id, called: false, traitors: [] })),
    participants: [{ id: 'you', faction: 'atreides' }, { id: 'opponent', faction: 'guild' }],
    physicalCards: baseDeck(), pendingAuditorPresent: false, pendingRetentionPresent: false });
}
export function introductionCollection(s: Pick<IntroductionState, 'collectors' | 'city'>) {
  const forces: Record<string, number> = { 'wind_pass:14': s.collectors };
  if (s.city) forces['arrakeen:10'] = 1;
  const quote = quoteSpiceCollection({ advanced: false, storm: 18, order: ['you'],
    players: [{ id: 'you', faction: 'atreides', ally: null, forces, spice: 0 }],
    spice: { 'wind_pass:14': 8 } });
  return { amount: quote.receipts[0].collected, remaining: quote.spice['wind_pass:14'] };
}
