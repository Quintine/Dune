export type FactionId =
  | 'atreides'
  | 'harkonnen'
  | 'emperor'
  | 'fremen'
  | 'guild'
  | 'beneGesserit'
  | 'ixians'
  | 'tleilaxu'
  | 'choam'
  | 'richese'
  | 'ecaz'
  | 'moritani';
export const EXPANSIONS = [
  { id: 'ix', name: 'Ixians & Tleilaxu', year: '2020' },
  { id: 'choam', name: 'CHOAM & Richese', year: '2022' },
  { id: 'ecaz', name: 'Ecaz & Moritani', year: '2023' },
] as const;
export const FACTIONS = [
  {
    id: 'atreides',
    name: 'Atreides',
    title: 'The power of prescience',
    color: '#65b38b',
    sigil: 'A',
    spice: 10,
    revival: 2,
    expansion: 'base',
    description: 'Read the auction. Anticipate the enemy. Claim Arrakis.',
  },
  {
    id: 'harkonnen',
    name: 'Harkonnen',
    title: 'Treachery without limit',
    color: '#db7466',
    sigil: 'H',
    spice: 10,
    revival: 2,
    expansion: 'base',
    description: 'Hold four traitors and a larger arsenal of treachery.',
  },
  {
    id: 'emperor',
    name: 'Emperor',
    title: 'Wealth of the Imperium',
    color: '#b792d5',
    sigil: 'E',
    spice: 10,
    revival: 1,
    expansion: 'base',
    description: 'The great houses pay you for their auction victories.',
  },
  {
    id: 'fremen',
    name: 'Fremen',
    title: 'The desert is your home',
    color: '#dfc073',
    sigil: 'F',
    spice: 3,
    revival: 3,
    expansion: 'base',
    description: 'Travel the desert freely and endure the sandworms.',
  },
  {
    id: 'guild',
    name: 'Spacing Guild',
    title: 'All paths lead through you',
    color: '#e69d61',
    sigil: 'G',
    spice: 5,
    revival: 1,
    expansion: 'base',
    description:
      'Collect shipping payments and transport forces at half price.',
  },
  {
    id: 'beneGesserit',
    name: 'Bene Gesserit',
    title: 'Plans within plans',
    color: '#7baed9',
    sigil: 'B',
    spice: 5,
    revival: 1,
    expansion: 'base',
    description: 'Predict the winner and use the Voice to shape battles.',
  },
  {
    id: 'ixians',
    name: 'Ixians',
    title: 'Masters of invention',
    color: '#99bbbf',
    sigil: 'I',
    spice: 10,
    revival: 1,
    expansion: 'ix',
    description: 'Command cyborgs and a hidden mobile stronghold.',
  },
  {
    id: 'tleilaxu',
    name: 'Tleilaxu',
    title: 'Death is only a beginning',
    color: '#aca1ca',
    sigil: 'T',
    spice: 5,
    revival: 2,
    expansion: 'ix',
    description: 'Control revival and replace enemies with face dancers.',
  },
  {
    id: 'choam',
    name: 'CHOAM',
    title: 'An empire of commerce',
    color: '#d6a985',
    sigil: 'C',
    spice: 2,
    revival: 0,
    expansion: 'choam',
    description: 'Manipulate the economy through charity and the spice market.',
  },
  {
    id: 'richese',
    name: 'Richese',
    title: 'The unseen advantage',
    color: '#a1b5d9',
    sigil: 'R',
    spice: 5,
    revival: 2,
    expansion: 'choam',
    description: 'Sell unique technology and conceal your troop strength.',
  },
  {
    id: 'ecaz',
    name: 'Ecaz',
    title: 'The art of diplomacy',
    color: '#93bf76',
    sigil: 'E',
    spice: 12,
    revival: 2,
    expansion: 'ecaz',
    description: 'Place ambassadors and build powerful alliances.',
  },
  {
    id: 'moritani',
    name: 'Moritani',
    title: 'Fear is a weapon',
    color: '#d486a1',
    sigil: 'M',
    spice: 12,
    revival: 2,
    expansion: 'ecaz',
    description: 'Spread terror and assassinate your rivals’ leaders.',
  },
] as const;
export const faction = (id: string) => FACTIONS.find((f) => f.id === id)!;
export const PHASES = [
  'Storm',
  'Spice blow',
  'CHOAM charity',
  'Bidding',
  'Revival',
  'Shipment & movement',
  'Battle',
  'Spice collection',
  'Mentat pause',
];
