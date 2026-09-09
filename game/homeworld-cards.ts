import type { FactionId } from './catalog';

/** Original English E3 component facts. This catalog does not enable Homeworlds
 * or execute threshold changes, payments, occupation or faction effects.
 * Physical sources and discrepancies: docs/HOMEWORLD_COMPONENT_AUDIT.md. */
export type HomeworldId =
  | 'caladan'
  | 'giedi_prime'
  | 'southern_hemisphere'
  | 'junction'
  | 'wallach_ix'
  | 'kaitain'
  | 'salusa_secundus'
  | 'ix'
  | 'tleilax'
  | 'tupile'
  | 'richese'
  | 'ecaz'
  | 'grumman';
export type HomeworldSide = Readonly<{
  /** Inclusive range printed on this face; Salusa's printed ranges overlap. */
  reserves: Readonly<{ min: number; max: number }>;
  /** Native dial addition and native force losses in a Lasgun/Shield explosion. */
  battleStrength: number;
  gameplay: readonly string[];
}>;
export type HomeworldCard = Readonly<{
  id: HomeworldId;
  name: string;
  faction: FactionId;
  reserveType: 'faction' | 'sardaukar';
  high: HomeworldSide;
  low: HomeworldSide;
  occupied: Readonly<{
    gameplay: readonly string[];
    /** One bank spice per printed icon during Spice Collection, additional to
     * any payment-sharing effect described in the occupied text. */
    spiceIcons: number;
  }>;
}>;
const lowBonuses = [
  'Gain one additional free revival.',
  'When collecting CHOAM Charity, gain one extra spice directly from the Spice Bank.',
] as const;
function card(
  id: HomeworldId,
  name: string,
  faction: FactionId,
  minimum: number,
  highStrength: number,
  lowStrength: number,
  high: string[],
  low: string[],
  occupied: string[],
  spiceIcons: number,
): HomeworldCard {
  const sardaukar = id === 'salusa_secundus';
  const side = (
    min: number,
    max: number,
    battleStrength: number,
    gameplay: readonly string[],
  ): HomeworldSide =>
    Object.freeze({
      reserves: Object.freeze({ min, max }),
      battleStrength,
      gameplay: Object.freeze([...gameplay]),
    });
  return Object.freeze({
    id,
    name,
    faction,
    reserveType: sardaukar ? 'sardaukar' : 'faction',
    high: side(minimum, sardaukar ? 5 : 20, highStrength, high),
    low: side(
      0,
      sardaukar ? 2 : minimum - 1,
      lowStrength,
      sardaukar ? low : [...low, ...lowBonuses],
    ),
    occupied: Object.freeze({
      gameplay: Object.freeze([...occupied]),
      spiceIcons,
    }),
  });
}

export const HOMEWORLD_CARDS: readonly HomeworldCard[] = Object.freeze([
  card(
    'caladan',
    'Caladan',
    'atreides',
    6,
    2,
    2,
    [
      'After winning a battle, you may add one reserve force to the territory or homeworld where it occurred, provided you already have a force there.',
    ],
    ['You cannot use your Movement advantage to inspect the next Spice Blow.'],
    ['The occupier shares your Bidding advantage.'],
    2,
  ),
  card(
    'giedi_prime',
    'Giedi Prime',
    'harkonnen',
    7,
    2,
    2,
    [
      'Collect 2 spice from the Spice Bank if you collect spice from any desert territories or homeworlds during this turn’s Spice Collection.',
    ],
    ['No additional penalty.'],
    [
      'When you buy Treachery Cards, the occupier or their ally gains your extra free Treachery Card, provided the recipient’s hand is not full.',
    ],
    2,
  ),
  card(
    'southern_hemisphere',
    'Southern Hemisphere',
    'fremen',
    3,
    2,
    2,
    [
      'When a starred Fedaykin force is revived, you may immediately place it in any territory where you already have forces.',
    ],
    ['No additional penalty.'],
    [
      'Give the occupier half of all spice you collect during Spice Collection, rounded down.',
    ],
    2,
  ),
  card(
    'junction',
    'Junction',
    'guild',
    5,
    2,
    2,
    [
      'You may offer other factions cross-planet shipment at half or full price as part of their Shipping action, including to or from homeworlds—even their own.',
    ],
    ['You receive only half of shipping payments, rounded up.'],
    [
      'The occupier receives the other half of shipping payments made by other players, rounded down.',
    ],
    2,
  ),
  card(
    'wallach_ix',
    'Wallach IX',
    'beneGesserit',
    11,
    3,
    2,
    [
      'When another faction’s shipment lets you send spiritual advisors to Polar Sink, you may send two.',
    ],
    ['You cannot send spiritual advisors.'],
    ['The occupier and their ally are immune to Voice.'],
    1,
  ),
  card(
    'kaitain',
    'Kaitain',
    'emperor',
    5,
    2,
    3,
    [
      'At the end of Bidding, you may pay 2 spice per card to discard Treachery Cards from your hand.',
    ],
    ['You receive only half of Treachery Card payments, rounded up.'],
    [
      'The occupier receives the other half of Treachery Card payments you receive, rounded down.',
    ],
    2,
  ),
  card(
    'salusa_secundus',
    'Salusa Secundus',
    'emperor',
    2,
    3,
    2,
    ['Your Sardaukar count at full strength without spice support.'],
    ['Your Sardaukar cannot be revived for free.'],
    ['Your Sardaukar lose their Sardaukar advantage.'],
    0,
  ),
  card(
    'ix',
    'Ix',
    'ixians',
    5,
    2,
    2,
    ['When you pay to revive a Cyborg, you also receive two Suboids for free.'],
    ['You cannot move the Hidden Mobile Stronghold.'],
    ['The occupier controls your Bidding advantage.'],
    2,
  ),
  card(
    'tleilax',
    'Tleilax',
    'tleilaxu',
    9,
    2,
    2,
    [
      'When taking Free Revival, you may send those forces from reserves for free to any one territory or homeworld, subject to storm and occupancy restrictions.',
    ],
    [
      'If you start the Revival phase at low threshold, you receive no spice when other factions take Free Revival.',
    ],
    ['You cannot reveal Face Dancers against the occupier or their ally.'],
    2,
  ),
  card(
    'tupile',
    'Tupile',
    'choam',
    11,
    2,
    2,
    [
      'You cannot discard Worthless Cards for spice, except through Advanced Karama.',
    ],
    [
      'Once per faction, when you are on another homeworld or another faction is on Tupile, you may require that faction to disclose its spice and how many weapons or defenses it holds.',
    ],
    [
      'The occupier and their ally each gain one hand slot. When they no longer occupy Tupile, discard down to the normal hand limit. CHOAM loses its low-threshold advantage.',
    ],
    2,
  ),
  card(
    'richese',
    'Richese',
    'richese',
    10,
    2,
    2,
    ['You may ship reserve forces along with a No-Field token.'],
    ['You cannot move a No-Field token.'],
    [
      'The occupier chooses which Richese Treachery Card is sold during bidding and receives half of the payment you receive, rounded down.',
    ],
    1,
  ),
  card(
    'ecaz',
    'Ecaz',
    'ecaz',
    7,
    2,
    2,
    [
      'Whenever a poison weapon is discarded, collect 3 spice from the Spice Bank.',
      'Your alliance can win by jointly occupying at least one stronghold and occupying two other factions’ homeworlds.',
    ],
    [
      'When you and your ally are both in a battle against another faction, your opponent chooses which of you fights.',
    ],
    [
      'The occupier or their ally gains Duke Vidal and may revive him from the Tanks. This overrides the Ecaz and Moritani Duke Vidal advantage.',
    ],
    2,
  ),
  card(
    'grumman',
    'Grumman',
    'moritani',
    8,
    2,
    2,
    [
      'During Spice Collection, you may add a Terror token to a stronghold that already has one, or remove a Terror token from the board, then gain 4 spice from the Spice Bank.',
    ],
    [
      'You cannot reveal a Terror token unless at least three forces enter its territory.',
    ],
    [
      'You cannot reveal a Terror token when the occupier or their ally enters a territory containing one.',
    ],
    2,
  ),
]);

/** Unknown identities remain missing rather than silently selecting a faction's
 * first card: Emperor has two distinct physical worlds. */
export function homeworldCard(id: string): HomeworldCard | undefined {
  return HOMEWORLD_CARDS.find((definition) => definition.id === id);
}
