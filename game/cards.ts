import type { FactionId } from './catalog';
export type Card = {
  id: string;
  name: string;
  kind:
    | 'projectile'
    | 'poison'
    | 'lasgun'
    | 'shield'
    | 'snooper'
    | 'poisonBlade'
    | 'shieldSnooper'
    | 'weirdingWay'
    | 'chemistry'
    | 'poisonTooth'
    | 'artillery'
    | 'worthless'
    | 'hero'
    | 'special';
  effect?: string;
};
/** Implemented Ix battle cards; the complete expansion deck is assembled separately. */
export function ixBattleCards(): Card[] {
  return [
    { id: 'ix-poison-tooth', name: 'Poison Tooth', kind: 'poisonTooth' },
    { id: 'ix-artillery', name: 'Artillery Strike', kind: 'artillery' },
    { id: 'ix-poison-blade', name: 'Poison Blade', kind: 'poisonBlade' },
    { id: 'ix-shield-snooper', name: 'Shield Snooper', kind: 'shieldSnooper' },
    { id: 'ix-weirding-way', name: 'Weirding Way', kind: 'weirdingWay' },
    { id: 'ix-chemistry', name: 'Chemistry', kind: 'chemistry' },
  ];
}
export function ixSpecialCards(): Card[] {
  return [
    { id: 'ix-thumper', name: 'Thumper', kind: 'special', effect: 'thumper' },
    { id: 'ix-amal', name: 'Amal', kind: 'special', effect: 'amal' },
  ];
}
/** Remaining Ix cards use the ordinary base-game rule types, with separate physical identities. */
export function ixStandardCards(): Card[] {
  return [
    { id: 'ix-hunter-seeker', name: 'Hunter Seeker', kind: 'projectile' },
    { id: 'ix-basilia-weapon', name: 'Basilia Weapon', kind: 'poison' },
    { id: 'ix-shield', name: 'Shield', kind: 'shield' },
    { id: 'ix-snooper', name: 'Snooper', kind: 'snooper' },
    {
      id: 'ix-harvester',
      name: 'Harvester',
      kind: 'special',
      effect: 'harvester',
    },
    { id: 'ix-kull-wahad', name: 'Kull Wahad', kind: 'worthless' },
  ];
}
export function ixDeck(): Card[] {
  return [...ixBattleCards(), ...ixSpecialCards(), ...ixStandardCards()];
}
/** Complete currently implemented deck sets. Other expansion decks remain gated. */
export function treacheryDeck(expansions: readonly string[] = []): Card[] {
  if (expansions.some((id) => id !== 'ix'))
    throw new Error('This expansion treachery deck is not implemented yet.');
  return [...baseDeck(), ...(expansions.includes('ix') ? ixDeck() : [])];
}
export type Leader = {
  /** Explicit projected custody for a shared disc; null means set aside. */
  controller?: string | null;
  id: string;
  name: string;
  strength: number;
  faction: FactionId;
  dead: boolean;
  deaths: number;
  usedAt?: string;
  capturedBy?: string;
  gholaBy?: string;
  concealed?: {
    captor: string;
    controller?: string;
    dead: boolean;
    deaths: number;
    usedAt?: string;
  };
};
const leaderLists: Partial<Record<FactionId, [string, number][]>> = {
  atreides: [
    ['Thufir Hawat', 5],
    ['Lady Jessica', 5],
    ['Gurney Halleck', 4],
    ['Duncan Idaho', 2],
    ['Dr. Yueh', 1],
  ],
  harkonnen: [
    ['Feyd-Rautha', 6],
    ['Beast Rabban', 4],
    ['Piter de Vries', 3],
    ['Captain Iakin Nefud', 2],
    ['Umman Kudu', 1],
  ],
  emperor: [
    ['Hasimir Fenring', 6],
    ['Captain Aramsham', 5],
    ['Caid', 3],
    ['Burseg', 3],
    ['Bashar', 2],
  ],
  fremen: [
    ['Stilgar', 7],
    ['Chani', 6],
    ['Otheym', 5],
    ['Shadout Mapes', 3],
    ['Jamis', 2],
  ],
  guild: [
    ['Staban Tuek', 5],
    ['Master Bewt', 3],
    ['Esmar Tuek', 3],
    ['Soo-Soo Sook', 2],
    ['Guild Representative', 1],
  ],
  tleilaxu: [
    ['Zoal', 3],
    ['Hidar Fen Ajidica', 4],
    ['Master Zaaf', 3],
    ['Wykk', 2],
    ['Blin', 1],
  ],
  ixians: [
    ['Dominic Vernius', 4],
    ['C’tair Pilru', 5],
    ['Tessia Vernius', 5],
    ['Kailea Vernius', 2],
    ['Cammar Pilru', 1],
  ],
  // Printed ordinary discs: CHOAM & Richese rulebook p. 3; see docs/CHOAM_RICHESE_LEADERS.md.
  // The strength-2 Auditor is an additional advanced disc, outside CHOAM's ordinary five.
  choam: [
    ['Frankos Aru', 4],
    ['Lady Jalma', 4],
    ['Rajiv Londine', 3],
    ['Duke Verdun', 3],
    ['Viscount Tull', 2],
  ],
  richese: [
    ['Ein Calimar', 5],
    ['Lady Helena', 4],
    ['Flinto Kinnis', 3],
    ['Haloa Rund', 2],
    ['Talis Balt', 2],
  ],
  // Printed ordinary discs: Ecaz & Moritani rulebook p. 3; see docs/MORITANI_TERROR_RULES.md.
  // Duke Prad Vidal is a separate shared disc with no traitor card, not part of this roster.
  ecaz: [
    ['Sanya Ecaz', 4],
    ['Whitmore Bludd', 4],
    ['Ilesa Ecaz', 3],
    ['Rivvy Dinari', 3],
    ['Bindikk Narvi', 2],
  ],
  moritani: [
    ['Lupino Ord', 5],
    ['Grieu Kronos', 4],
    ['Hiih Resser', 4],
    ['Trin Kronos', 2],
    ['Vando Terboli', 1],
  ],
  beneGesserit: [
    ['Alia', 5],
    ['Wanna Marcus', 5],
    ['Princess Irulan', 5],
    ['Reverend Mother Ramallo', 5],
    ['Margot Lady Fenring', 5],
  ],
};
export function leaders(f: FactionId): Leader[] {
  return (leaderLists[f] ?? []).map(([name, strength], i) => ({
    id: `${f}-${i}`,
    name,
    strength,
    faction: f,
    dead: false,
    deaths: 0,
  }));
}
/** Extra Advanced CHOAM disc; printed CHOAM & Richese rulebook pp. 3 and 8. */
export const CHOAM_AUDITOR_ID = 'choam-auditor';

export function isAuditorLeader(leader: { id: string }): boolean {
  return leader.id === CHOAM_AUDITOR_ID;
}

/** Kept separate from the five ordinary discs and their ordinary setup pool. */
export function createAuditorLeader(): Leader {
  return {
    id: CHOAM_AUDITOR_ID,
    name: 'Auditor',
    strength: 2,
    faction: 'choam',
    dead: false,
    deaths: 0,
  };
}
export function baseDeck(): Card[] {
  const cards: Omit<Card, 'id'>[] = [];
  const add = (
    name: string,
    kind: Card['kind'],
    count = 1,
    effect?: string,
  ) => {
    for (let i = 0; i < count; i++)
      cards.push({ name, kind, ...(effect ? { effect } : {}) });
  };
  ['Crysknife', 'Maula Pistol', 'Slip Tip', 'Stunner'].forEach((n) =>
    add(n, 'projectile'),
  );
  ['Chaumas', 'Chaumurky', 'Gom Jabbar', 'Ellaca Drug'].forEach((n) =>
    add(n, 'poison'),
  );
  add('Lasgun', 'lasgun');
  add('Shield', 'shield', 4);
  add('Snooper', 'snooper', 4);
  ['Baliset', 'Jubba Cloak', 'Kulon', 'La La La', 'Trip to Gamont'].forEach(
    (n) => add(n, 'worthless'),
  );
  add('Cheap Hero', 'hero');
  add('Cheap Heroine', 'hero');
  [
    ['Family Atomics', 'atomics'],
    ['Weather Control', 'weather'],
    ['Hajr', 'hajr'],
    ['Tleilaxu Ghola', 'ghola'],
    ['Harvester', 'harvester'],
  ].forEach(([n, e]) => add(n, 'special', 1, e));
  add('Karama', 'special', 2, 'karama');
  add('Truthtrance', 'special', 2, 'truthtrance');
  return cards.map((c, i) => ({ ...c, id: `treachery-${i}` }));
}
export const SPICE_CARDS = [
  ['broken_land', 8, 12],
  ['red_chasm', 8, 7],
  ['habbanya_erg', 8, 16],
  ['oh_gap', 6, 10],
  ['wind_pass_north', 6, 17],
  ['south_mesa', 10, 5],
  ['rock_outcroppings', 6, 13],
  ['the_minor_erg', 8, 8],
  ['cielago_south', 12, 2],
  ['cielago_north', 8, 3],
  ['funeral_plain', 6, 15],
  ['the_great_flat', 10, 15],
  ['hagga_basin', 6, 12],
  ['habbanya_ridge_flat', 10, 18],
  ['sihaya_ridge', 6, 9],
] as const;
export type SpiceCard =
  | { territory: string; amount: number; sector: number }
  | { worm: true; suppressed?: true; thumper?: true }
  | { sandtrout: true };
export function spiceDeck(includeSandtrout = false): SpiceCard[] {
  return [
    ...SPICE_CARDS.map(([territory, amount, sector]) => ({
      territory,
      amount,
      sector,
    })),
    ...Array.from({ length: 6 }, () => ({ worm: true as const })),
    ...(includeSandtrout ? [{ sandtrout: true as const }] : []),
  ];
}

/** Zoal's printed X copies the opposing disc, excluding KH. His ordinary revival value is three. */
export function battleLeaderStrength(
  leader: Pick<Leader, 'id' | 'strength'> | undefined,
  opponent: Pick<Leader, 'strength'> | undefined,
) {
  return leader?.id === 'tleilaxu-0'
    ? (opponent?.strength ?? 0)
    : (leader?.strength ?? 0);
}
export function leaderStrengthLabel(leader: Pick<Leader, 'id' | 'strength'>) {
  return leader.id === 'tleilaxu-0' ? 'X' : String(leader.strength);
}

/** Old persisted windows use `harvested` for either a played card or destroyed fresh spice. */
export function harvesterAvailable(
  blow:
    | {
        harvested: boolean;
        harvesters?: number;
        harvesterClosed?: boolean;
      }
    | null
    | undefined,
): boolean {
  return (
    !!blow &&
    !blow.harvesterClosed &&
    (!blow.harvested || (blow.harvesters ?? 0) > 0)
  );
}
export function normalizeLegacyCardNames(cards: Card[]) {
  for (const card of cards)
    if (card.id === 'treachery-7' && card.name === 'Basilia Weapon')
      card.name = 'Ellaca Drug';
}
