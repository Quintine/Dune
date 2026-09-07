import type { LeaderArt } from './leader-art';

/** Special-disc artwork is separate from ordinary rosters and traitor inventories. */
export const SPECIAL_LEADER_ART: Readonly<Record<string, LeaderArt>> =
  Object.freeze({
    'choam-auditor': Object.freeze({
      id: 'choam-auditor',
      name: 'Auditor',
      src: '/art/leaders/choam-auditor-v1.png',
      objectPosition: '50% 50%',
    }),
    'duke-vidal': Object.freeze({
      id: 'duke-vidal',
      name: 'Duke Prad Vidal',
      src: '/art/leaders/duke-vidal-v1.png',
      objectPosition: '50% 50%',
    }),
  });

/** Resolve only an exact identity already supplied by the authorized public view. */
export function specialLeaderArt(
  id: string | undefined,
  name: string,
): LeaderArt | undefined {
  if (!id || !Object.hasOwn(SPECIAL_LEADER_ART, id)) return undefined;
  const art = SPECIAL_LEADER_ART[id];
  return art.name === name ? art : undefined;
}
