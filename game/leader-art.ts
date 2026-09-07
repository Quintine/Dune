/** Original portrait assets. This registry grants no access to an identity. */
export type LeaderArt = Readonly<{
  id: string;
  name: string;
  src: string;
  objectPosition: string;
}>;

export const LEADER_ART: Readonly<Record<string, LeaderArt>> = Object.freeze({
  'atreides-0': {
    id: 'atreides-0',
    name: 'Thufir Hawat',
    src: '/art/leaders/atreides-0-v1.png',
    objectPosition: '50% 50%',
  },
  'atreides-1': {
    id: 'atreides-1',
    name: 'Lady Jessica',
    src: '/art/leaders/atreides-1-v1.png',
    objectPosition: '50% 50%',
  },
  'atreides-2': {
    id: 'atreides-2',
    name: 'Gurney Halleck',
    src: '/art/leaders/atreides-2-v1.png',
    objectPosition: '50% 50%',
  },
  'atreides-3': {
    id: 'atreides-3',
    name: 'Duncan Idaho',
    src: '/art/leaders/atreides-3-v1.png',
    objectPosition: '50% 50%',
  },
  'atreides-4': {
    id: 'atreides-4',
    name: 'Dr. Yueh',
    src: '/art/leaders/atreides-4-v1.png',
    objectPosition: '50% 50%',
  },
  'harkonnen-0': {
    id: 'harkonnen-0',
    name: 'Feyd-Rautha',
    src: '/art/leaders/harkonnen-0-v1.png',
    objectPosition: '50% 50%',
  },
  'harkonnen-1': {
    id: 'harkonnen-1',
    name: 'Beast Rabban',
    src: '/art/leaders/harkonnen-1-v1.png',
    objectPosition: '50% 50%',
  },
  'harkonnen-2': {
    id: 'harkonnen-2',
    name: 'Piter de Vries',
    src: '/art/leaders/harkonnen-2-v1.png',
    objectPosition: '50% 50%',
  },
  'harkonnen-3': {
    id: 'harkonnen-3',
    name: 'Captain Iakin Nefud',
    src: '/art/leaders/harkonnen-3-v1.png',
    objectPosition: '50% 50%',
  },
  'harkonnen-4': {
    id: 'harkonnen-4',
    name: 'Umman Kudu',
    src: '/art/leaders/harkonnen-4-v1.png',
    objectPosition: '50% 50%',
  },
  'emperor-0': {
    id: 'emperor-0',
    name: 'Hasimir Fenring',
    src: '/art/leaders/emperor-0-v1.png',
    objectPosition: '50% 50%',
  },
  'emperor-1': {
    id: 'emperor-1',
    name: 'Captain Aramsham',
    src: '/art/leaders/emperor-1-v1.png',
    objectPosition: '50% 50%',
  },
  'emperor-2': {
    id: 'emperor-2',
    name: 'Caid',
    src: '/art/leaders/emperor-2-v1.png',
    objectPosition: '50% 50%',
  },
  'emperor-3': {
    id: 'emperor-3',
    name: 'Burseg',
    src: '/art/leaders/emperor-3-v1.png',
    objectPosition: '50% 50%',
  },
  'emperor-4': {
    id: 'emperor-4',
    name: 'Bashar',
    src: '/art/leaders/emperor-4-v1.png',
    objectPosition: '50% 50%',
  },
  'fremen-0': {
    id: 'fremen-0',
    name: 'Stilgar',
    src: '/art/leaders/fremen-0-v2.png',
    objectPosition: '50% 50%',
  },
  'fremen-1': {
    id: 'fremen-1',
    name: 'Chani',
    src: '/art/leaders/fremen-1-v2.png',
    objectPosition: '50% 50%',
  },
  'fremen-2': {
    id: 'fremen-2',
    name: 'Otheym',
    src: '/art/leaders/fremen-2-v2.png',
    objectPosition: '50% 50%',
  },
  'fremen-3': {
    id: 'fremen-3',
    name: 'Shadout Mapes',
    src: '/art/leaders/fremen-3-v2.png',
    objectPosition: '50% 50%',
  },
  'fremen-4': {
    id: 'fremen-4',
    name: 'Jamis',
    src: '/art/leaders/fremen-4-v2.png',
    objectPosition: '50% 50%',
  },
  'guild-0': {
    id: 'guild-0',
    name: 'Staban Tuek',
    src: '/art/leaders/guild-0-v1.png',
    objectPosition: '50% 50%',
  },
  'guild-1': {
    id: 'guild-1',
    name: 'Master Bewt',
    src: '/art/leaders/guild-1-v1.png',
    objectPosition: '50% 50%',
  },
  'guild-2': {
    id: 'guild-2',
    name: 'Esmar Tuek',
    src: '/art/leaders/guild-2-v1.png',
    objectPosition: '50% 50%',
  },
  'guild-3': {
    id: 'guild-3',
    name: 'Soo-Soo Sook',
    src: '/art/leaders/guild-3-v1.png',
    objectPosition: '50% 50%',
  },
  'guild-4': {
    id: 'guild-4',
    name: 'Guild Representative',
    src: '/art/leaders/guild-4-v1.png',
    objectPosition: '50% 50%',
  },
  'beneGesserit-0': {
    id: 'beneGesserit-0',
    name: 'Alia',
    src: '/art/leaders/beneGesserit-0-v1.png',
    objectPosition: '50% 50%',
  },
  'beneGesserit-1': {
    id: 'beneGesserit-1',
    name: 'Wanna Marcus',
    src: '/art/leaders/beneGesserit-1-v1.png',
    objectPosition: '50% 50%',
  },
  'beneGesserit-2': {
    id: 'beneGesserit-2',
    name: 'Princess Irulan',
    src: '/art/leaders/beneGesserit-2-v1.png',
    objectPosition: '50% 50%',
  },
  'beneGesserit-3': {
    id: 'beneGesserit-3',
    name: 'Reverend Mother Ramallo',
    src: '/art/leaders/beneGesserit-3-v1.png',
    objectPosition: '50% 50%',
  },
  'beneGesserit-4': {
    id: 'beneGesserit-4',
    name: 'Margot Lady Fenring',
    src: '/art/leaders/beneGesserit-4-v1.png',
    objectPosition: '50% 50%',
  },
  'ixians-0': {
    id: 'ixians-0',
    name: 'Dominic Vernius',
    src: '/art/leaders/ixians-0-v1.png',
    objectPosition: '50% 50%',
  },
  'ixians-1': {
    id: 'ixians-1',
    name: 'C’tair Pilru',
    src: '/art/leaders/ixians-1-v1.png',
    objectPosition: '50% 50%',
  },
  'ixians-2': {
    id: 'ixians-2',
    name: 'Tessia Vernius',
    src: '/art/leaders/ixians-2-v1.png',
    objectPosition: '50% 50%',
  },
  'ixians-3': {
    id: 'ixians-3',
    name: 'Kailea Vernius',
    src: '/art/leaders/ixians-3-v1.png',
    objectPosition: '50% 50%',
  },
  'ixians-4': {
    id: 'ixians-4',
    name: 'Cammar Pilru',
    src: '/art/leaders/ixians-4-v1.png',
    objectPosition: '50% 50%',
  },
  'tleilaxu-0': {
    id: 'tleilaxu-0',
    name: 'Zoal',
    src: '/art/leaders/tleilaxu-0-v1.png',
    objectPosition: '50% 50%',
  },
  'tleilaxu-1': {
    id: 'tleilaxu-1',
    name: 'Hidar Fen Ajidica',
    src: '/art/leaders/tleilaxu-1-v1.png',
    objectPosition: '50% 50%',
  },
  'tleilaxu-2': {
    id: 'tleilaxu-2',
    name: 'Master Zaaf',
    src: '/art/leaders/tleilaxu-2-v1.png',
    objectPosition: '50% 50%',
  },
  'tleilaxu-3': {
    id: 'tleilaxu-3',
    name: 'Wykk',
    src: '/art/leaders/tleilaxu-3-v1.png',
    objectPosition: '50% 50%',
  },
  'tleilaxu-4': {
    id: 'tleilaxu-4',
    name: 'Blin',
    src: '/art/leaders/tleilaxu-4-v1.png',
    objectPosition: '50% 50%',
  },
  'choam-0': {
    id: 'choam-0',
    name: 'Frankos Aru',
    src: '/art/leaders/choam-0-v1.png',
    objectPosition: '50% 50%',
  },
  'choam-1': {
    id: 'choam-1',
    name: 'Lady Jalma',
    src: '/art/leaders/choam-1-v1.png',
    objectPosition: '50% 50%',
  },
  'choam-2': {
    id: 'choam-2',
    name: 'Rajiv Londine',
    src: '/art/leaders/choam-2-v1.png',
    objectPosition: '50% 50%',
  },
  'choam-3': {
    id: 'choam-3',
    name: 'Duke Verdun',
    src: '/art/leaders/choam-3-v1.png',
    objectPosition: '50% 50%',
  },
  'choam-4': {
    id: 'choam-4',
    name: 'Viscount Tull',
    src: '/art/leaders/choam-4-v1.png',
    objectPosition: '50% 50%',
  },
  'richese-0': {
    id: 'richese-0',
    name: 'Ein Calimar',
    src: '/art/leaders/richese-0-v1.png',
    objectPosition: '50% 50%',
  },
  'richese-1': {
    id: 'richese-1',
    name: 'Lady Helena',
    src: '/art/leaders/richese-1-v1.png',
    objectPosition: '50% 50%',
  },
  'richese-2': {
    id: 'richese-2',
    name: 'Flinto Kinnis',
    src: '/art/leaders/richese-2-v1.png',
    objectPosition: '50% 50%',
  },
  'richese-3': {
    id: 'richese-3',
    name: 'Haloa Rund',
    src: '/art/leaders/richese-3-v1.png',
    objectPosition: '50% 50%',
  },
  'richese-4': {
    id: 'richese-4',
    name: 'Talis Balt',
    src: '/art/leaders/richese-4-v1.png',
    objectPosition: '50% 50%',
  },
  'ecaz-0': {
    id: 'ecaz-0',
    name: 'Sanya Ecaz',
    src: '/art/leaders/ecaz-0-v1.png',
    objectPosition: '50% 50%',
  },
  'ecaz-1': {
    id: 'ecaz-1',
    name: 'Whitmore Bludd',
    src: '/art/leaders/ecaz-1-v1.png',
    objectPosition: '50% 50%',
  },
  'ecaz-2': {
    id: 'ecaz-2',
    name: 'Ilesa Ecaz',
    src: '/art/leaders/ecaz-2-v1.png',
    objectPosition: '50% 50%',
  },
  'ecaz-3': {
    id: 'ecaz-3',
    name: 'Rivvy Dinari',
    src: '/art/leaders/ecaz-3-v1.png',
    objectPosition: '50% 50%',
  },
  'ecaz-4': {
    id: 'ecaz-4',
    name: 'Bindikk Narvi',
    src: '/art/leaders/ecaz-4-v1.png',
    objectPosition: '50% 50%',
  },
  'moritani-0': {
    id: 'moritani-0',
    name: 'Lupino Ord',
    src: '/art/leaders/moritani-0-v1.png',
    objectPosition: '50% 50%',
  },
  'moritani-1': {
    id: 'moritani-1',
    name: 'Grieu Kronos',
    src: '/art/leaders/moritani-1-v1.png',
    objectPosition: '50% 50%',
  },
  'moritani-2': {
    id: 'moritani-2',
    name: 'Hiih Resser',
    src: '/art/leaders/moritani-2-v1.png',
    objectPosition: '50% 50%',
  },
  'moritani-3': {
    id: 'moritani-3',
    name: 'Trin Kronos',
    src: '/art/leaders/moritani-3-v1.png',
    objectPosition: '50% 50%',
  },
  'moritani-4': {
    id: 'moritani-4',
    name: 'Vando Terboli',
    src: '/art/leaders/moritani-4-v1.png',
    objectPosition: '50% 50%',
  },
});

/** Require an exact supplied identity; never guess from a faction or hidden index. */
export function leaderArt(
  id: string | undefined,
  name: string,
): LeaderArt | undefined {
  if (!id || !Object.hasOwn(LEADER_ART, id)) return undefined;
  const art = LEADER_ART[id];
  return art.name === name ? art : undefined;
}
