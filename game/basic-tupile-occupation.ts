import { homeworldForceGroups, HomeworldCustodyError } from './homeworld-custody';
import { HOMEWORLD_CARDS } from './homeworld-cards';
import { homeworldContext } from './homeworld-game';
import { liveHomeworldOccupationPresence, type StableHomeworldOccupationContext } from './homeworld-stable-occupation';
import { homeworldOccupationSnapshotPresence, readHomeworldOccupationSnapshot } from './homeworld-occupation-history';

export type BasicTupileActivation = {
  event: string;
  signature: string;
  occupier: string;
};

/** The caller validates the original occupation history before replaying it.
 * Qualifications establish eligibility; subsequent observed eligible intervals
 * identify slot activations even when same-turn qualification rows deduplicate.
 * Continuous control, including a turn boundary, keeps the original activation.
 * This is the provisional Basic current-sole policy, not Advanced retention. */
export function basicTupileActivations(game: StableHomeworldOccupationContext): {
  epochs: BasicTupileActivation[];
  current: BasicTupileActivation | null;
  blocked: string | null;
} {
  const native = game.players.find(player => player.faction === 'choam');
  const history = game.homeworldOccupationHistory;
  if (game.advanced || !native || !history || !game.homeworlds?.custody)
    throw new HomeworldCustodyError('Basic Tupile activation requires its original Basic occupation history.');
  const high = HOMEWORLD_CARDS.find(card => card.id === 'tupile')!.high.reserves.min;
  type Group = [string, number, number];
  const eligible = (groups: readonly Group[], presence: readonly string[]): string | null => {
    const nativeGroup = groups.find(([id]) => id === native.id);
    if (!nativeGroup || nativeGroup[1] + nativeGroup[2] >= high) return null;
    const foreign = presence.filter(id => id !== native.id);
    return foreign.length === 1 ? foreign[0] : null;
  };
  const qualifications = new Map<string, string[]>();
  for (const fact of history.qualifications) if (fact.world === 'homeworld:choam') {
    const players = qualifications.get(fact.event) ?? [];
    players.push(fact.player);
    qualifications.set(fact.event, players);
  }
  const qualified = new Set<string>(), epochs: BasicTupileActivation[] = [];
  let activeIndex: number | null = null;
  for (const observation of history.sources) {
    for (const player of qualifications.get(observation.event) ?? []) qualified.add(player);
    const snapshot = readHomeworldOccupationSnapshot(history.snapshots[observation.snapshot], homeworldContext(game));
    const groups = snapshot.groups.find(([world]) => world === 'homeworld:choam');
    if (!groups) throw new HomeworldCustodyError('The original Basic Tupile observation lost its native world.');
    const candidate = eligible(groups[1], homeworldOccupationSnapshotPresence(snapshot, 'homeworld:choam'));
    if (activeIndex !== null && epochs[activeIndex].occupier !== candidate) activeIndex = null;
    if (activeIndex === null && candidate && qualified.has(candidate) && observation.cause !== 'setup') {
      activeIndex = epochs.length;
      epochs.push({ event: observation.event, signature: observation.signature, occupier: candidate });
    }
  }
  const world = homeworldForceGroups(homeworldContext(game), game.homeworlds.custody)
    .find(world => world.id === 'homeworld:choam')!;
  const current = activeIndex === null ? null : epochs[activeIndex];
  const actual = eligible(Object.entries(world.forces).map(([id, forces]): Group => [id, forces.normal, forces.elite]),
    liveHomeworldOccupationPresence(game, 'homeworld:choam'));
  if (actual !== current?.occupier) {
    return { epochs, current: null, blocked: actual && qualified.has(actual)
      ? 'The current Basic Tupile activation must be observed before its benefit settles.' : null };
  }
  return { epochs, current, blocked: null };
}
