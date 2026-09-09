import type { FactionId } from './catalog';
import type { NexusCardMode } from './nexus-cards';

/** Faithful English rules summaries of all 36 original printed panels, rather
 * than the changed effects in tournament compilations. See NEXUS_CARD_RULES.md.
 * Reference availability does not enable an effect in the runtime. */
export type NexusCardReference = {
  faction: FactionId;
  betrayal: string;
  cunning: string;
  secretAlly: string;
};
export const NEXUS_PANEL_NAMES: Record<NexusCardMode, string> = {
  betrayal: 'Betrayal', cunning: 'Cunning', secretAlly: 'Secret Ally',
};
export const NEXUS_CARD_SOURCE = 'https://boardgamegeek.com/image/7767032/dune-ecaz-and-moritani';
export const NEXUS_CARD_REFERENCE: readonly NexusCardReference[] = [
  {
    faction: 'atreides',
    betrayal: 'Stop Atreides from inspecting one element of a Battle Plan with their battle advantage.',
    cunning: 'Require your battle opponent to disclose a second element of their Battle Plan.',
    secretAlly: 'In your battle, inspect one opposing Battle Plan element of your choice: leader, weapon, defense or number dialed.',
  },
  {
    faction: 'beneGesserit',
    betrayal: 'Prevent the Bene Gesserit from using Voice.',
    cunning: 'During your Shipment and Movement turn, you may convert any selected groups of advisors into fighters. Every territory must finish with all your forces in the same stance.',
    secretAlly: 'In your battle, use Voice to require or forbid a Treachery Card in your opponent’s plan.',
  },
  {
    faction: 'emperor',
    betrayal: 'During Bidding, require Emperor to pay for the ally’s Treachery purchase, covering at least the necessary spice. Alternatively, while Battle Plans are being made, suppress Emperor’s Sardaukar advantage.',
    cunning: 'Before making your Battle Plan, you may treat five of your forces as Sardaukar if you have no Sardaukar in that battle.',
    secretAlly: 'On a Treachery purchase, retain your spice after showing that you hold the required amount. Alternatively, during Revival, revive three extra forces free beyond the revival limit.',
  },
  {
    faction: 'fremen',
    betrayal: 'Stop Fremen worm riding for this turn, or prevent their two-territory movement during Shipment and Movement.',
    cunning: 'When a sandworm appears in a territory containing no forces, your forces from one desert territory may ride to any territory, respecting storm and occupancy restrictions.',
    secretAlly: 'Avoid losing your forces to a sandworm, or revive three forces free during Revival.',
  },
  {
    faction: 'harkonnen',
    betrayal: 'Cancel a revealed Harkonnen traitor and shuffle that card into the Traitor Deck. Harkonnen draws a replacement during Mentat Pause.',
    cunning: 'At any time, draw a Traitor Card into your hand, then choose one of your held Traitor Cards and shuffle it into the Traitor Deck.',
    secretAlly: 'During Mentat Pause, draw two Traitor Cards into your hand, then choose two held Traitor Cards and shuffle them into the Traitor Deck.',
  },
  {
    faction: 'guild',
    betrayal: 'Take one whole shipment payment otherwise going to the Spacing Guild or Spice Bank, including your own payment. This overrides the income of a faction occupying Junction.',
    cunning: 'Immediately after your Shipment and Movement, make a second shipment. Its forces cannot move unless you play Hajr.',
    secretAlly: 'Use Guild shipping prices. Your shipping action may instead cross-ship on the planet or return forces to your reserves.',
  },
  {
    faction: 'ixians',
    betrayal: 'Prevent either the Ixian Bidding advantage or the Technology advantage. This card cannot prevent both.',
    cunning: 'Before making your Battle Plan, you may give all your Suboids full strength without spice support in every battle for the rest of this turn.',
    secretAlly: 'Discard a Treachery Card you have just purchased during Bidding, then draw the next Treachery deck card.',
  },
  {
    faction: 'tleilaxu',
    betrayal: 'Cancel a revealed Face Dancer. That card stays revealed until Tleilaxu has revealed every Face Dancer.',
    cunning: 'Set your revealed Face Dancers aside and secretly draw replacements. Then shuffle the set-aside cards into the Traitor Deck.',
    secretAlly: 'During Revival, revive one of your leaders free and up to five of your forces for one spice each.',
  },
  {
    faction: 'choam',
    betrayal: 'Make CHOAM discard a random card from its hand without receiving spice for that discard.',
    cunning: 'Discard any Treachery Card to obtain a Worthless Card special effect of your choice.',
    secretAlly: 'During Spice Collection, discard a Worthless Card for two spice. Alternatively, after winning a battle, inspect a random card in your opponent’s hand that was not used in that battle.',
  },
  {
    faction: 'richese',
    betrayal: 'Stop Richese from buying a Richese Treachery Card: discard that card without payment. Alternatively, send the payment for a card Richese sells to the Spice Bank instead.',
    cunning: 'Use two No-Field tokens in a single shipment, still charged as one force. Immediately reveal one token and place it in front of your shield.',
    secretAlly: 'Instead of normal shipping, send up to five forces from reserves for the shipping price of one force.',
  },
  {
    faction: 'ecaz',
    betrayal: 'Before Shipment and Movement, choose a territory shared by Ecaz and its ally. Require the ally to return its forces from that territory to reserves.',
    cunning: 'Take Duke Vidal for this turn, including from capture, the Tanks or Ghola custody, overriding Moritani. Set him aside normally at the end of the turn.',
    secretAlly: 'Require one player to disclose whether any of your leaders are among their traitors, without identifying which leaders.',
  },
  {
    faction: 'moritani',
    betrayal: 'Return a Terror token from the board to Moritani without revealing it.',
    cunning: 'When placing a Terror token, you may choose any Arrakis territory, including one that already has a Terror token.',
    secretAlly: 'After losing a battle that has a winner, keep one Treachery Card you played which you could have kept if you had won.',
  },
];

export function nexusCardReference(id: FactionId): NexusCardReference {
  const card = NEXUS_CARD_REFERENCE.find((candidate) => candidate.faction === id);
  if (!card) throw new Error('Unknown Nexus reference card.');
  return card;
}
