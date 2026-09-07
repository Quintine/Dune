import type { AmbassadorEffect } from './ecaz-ambassadors';

/** Original gameplay guide based on GF9 Ecaz & Moritani, printed pp.7–8.
 * Descriptions are not a claim that these effects are implemented or printed-face reproductions.
 */
export const AMBASSADOR_REFERENCE: Readonly<
  Record<AmbassadorEffect, { name: string; gameplay: string }>
> = Object.freeze({
  ecaz: Object.freeze({
    name: 'Ecaz',
    gameplay:
      'Take control of Duke Vidal until he is used in a battle or Moritani acquires him, provided he is neither in the Tanks, captured, nor a ghola. Alternatively, offer an alliance to the faction that triggered this Ambassador if both factions are currently unallied. The other faction must agree. If that alliance forms, you may lend Duke Vidal to your new ally for this turn. The Ecaz Ambassador returns to your supply after its effect.',
  }),
  atreides: Object.freeze({
    name: 'Atreides',
    gameplay:
      'Inspect the Treachery Cards in the hand of the faction that triggered this Ambassador.',
  }),
  beneGesserit: Object.freeze({
    name: 'Bene Gesserit',
    gameplay:
      'Use the effect of an Ambassador that was not part of your supply. After that effect, remove the Bene Gesserit Ambassador permanently from the game. It still counts as a triggered token when completing your current group of five random Ambassadors.',
  }),
  choam: Object.freeze({
    name: 'CHOAM',
    gameplay:
      'Choose any Treachery Cards from your hand to discard. Receive three spice from the bank for each card you discard this way.',
  }),
  emperor: Object.freeze({
    name: 'Emperor',
    gameplay: 'Receive five spice from the bank.',
  }),
  fremen: Object.freeze({
    name: 'Fremen',
    gameplay:
      'Choose a group of your forces already on the board and move it to any territory. The destination and move remain subject to storm and occupancy restrictions.',
  }),
  harkonnen: Object.freeze({
    name: 'Harkonnen',
    gameplay:
      'Inspect one randomly chosen Traitor Card held by the faction that triggered this Ambassador.',
  }),
  ixians: Object.freeze({
    name: 'Ixian',
    gameplay:
      'Discard a Treachery Card from your hand, then draw a replacement from the Treachery Deck.',
  }),
  richese: Object.freeze({
    name: 'Richese',
    gameplay:
      'If your hand has room for another Treachery Card, pay three spice to the bank and take the top card of the Treachery Deck. Emperor receives another faction’s card payment through its normal advantage. A Harkonnen buyer can receive its usual bonus card.',
  }),
  guild: Object.freeze({
    name: 'Spacing Guild',
    gameplay:
      'Immediately ship up to four of your reserve forces to a territory outside the storm for free, or send no forces. The beneficiary chooses the destination and any elite forces included. This independent shipment does not spend ordinary shipment or movement.',
  }),
  tleilaxu: Object.freeze({
    name: 'Tleilaxu',
    gameplay:
      'Revive one of your leaders, or revive as many as four of your forces. This revival costs no spice.',
  }),
});

export const AMBASSADOR_COMMON_GUIDANCE: readonly string[] = Object.freeze([
  'At the end of Revival, place Ambassadors from your supply in strongholds outside the storm that have no Ambassador. The first placement in a turn costs one spice; each subsequent placement that turn costs one more spice.',
  'When a faction enters the stronghold, Ecaz may trigger its Ambassador. Ecaz itself, its ally, advisors, and a faction matching the Ambassador do not trigger it. Ecaz may choose for its ally to receive a triggered effect.',
  'Set a triggered random Ambassador aside. After all five Ambassadors in that random group have triggered, return them to the unused pool and draw a new random group of five. A permanently removed Bene Gesserit Ambassador does not return to the pool. The reusable Ecaz Ambassador is separate from that group.',
  'Storm or explosion destruction returns an Ambassador to the supply. Destruction does not count as triggering its effect.',
]);
