import type { Game } from './engine';
import { HOMEWORLD_CARDS, type HomeworldId } from './homeworld-cards';
import { homeworldContext } from './homeworld-game';
import { homeworldForceGroups, HomeworldCustodyError } from './homeworld-custody';
import { validateHomeworldOccupationHistory } from './homeworld-occupation-history';

export type StableHomeworldOccupationContext = Pick<Game,
  'advanced' | 'turn' | 'players' | 'homeworlds' | 'homeworldOccupationHistory' | 'homeworldOccupationPreview'>;
export type StableHomeworldOccupier = {
  world: string;
  card: HomeworldId;
  native: string;
  occupier: string;
  ally: string | null;
  qualification: string;
  turn: number;
  spice: number;
};
export type StableHomeworldOccupationQuote = {
  entitlement: StableHomeworldOccupier | null;
  blocked: string | null;
};
type SourceWorld = [string, [string, number, number][]];
type HomeworldCard = (typeof HOMEWORLD_CARDS)[number];
type HomeworldWorld = ReturnType<typeof homeworldForceGroups>[number];
type History = NonNullable<Game['homeworldOccupationHistory']>;
type Player = Game['players'][number];

export type StableHomeworldOccupationOptions = {
  /** Basic-only policy selector. `currentSole` is the provisional default used
   * by occupied income, Bidding, defenses and percentage effects. `epoch` keeps
   * the conservative original-epoch gate for Basic Tupile slot leasing while
   * the retention/turnover ruling stays open. Advanced ignores this option. */
  basic?: 'currentSole' | 'epoch';
};

/** Original source history supplies entitlement, never a current-controller
 * shortcut. Advanced uses the authorized supplied rulebook p.22: qualification
 * requires sole foreign presence and survives until that occupier leaves.
 * Basic defaults to a visibly provisional current-sole-controller policy; the
 * sole-foreign-controller entitlement expires immediately on departure,
 * contest or native repopulation. Tupile keeps the conservative Basic epoch
 * gate documented in its own module. Neither mode invents an unobserved event. */
export function quoteStableHomeworldOccupation(
  game: StableHomeworldOccupationContext,
  cardId: HomeworldId,
  options: StableHomeworldOccupationOptions = {},
): StableHomeworldOccupationQuote {
  const none: StableHomeworldOccupationQuote = { entitlement: null, blocked: null };
  if (!game.homeworldOccupationPreview) return none;
  const custody = game.homeworlds?.custody, history = game.homeworldOccupationHistory;
  if (!custody || !history || game.homeworlds?.historyVersion !== 1)
    return { entitlement: null, blocked: 'Occupation benefits require the original fresh Homeworld qualification history.' };
  const context = homeworldContext(game);
  validateHomeworldOccupationHistory(history, context, game.turn);
  const card = HOMEWORLD_CARDS.find(c => c.id === cardId);
  if (!card) throw new HomeworldCustodyError('Unknown occupied Homeworld card.');
  const native = game.players.find(p => p.faction === card.faction);
  if (!native || cardId === 'salusa_secundus' && !game.advanced) return none;
  const world = homeworldForceGroups(context, custody).find(home => home.native === native.id &&
    home.secondary === (cardId === 'salusa_secundus'));
  if (!world) throw new HomeworldCustodyError('The occupied card lost its original native Homeworld.');
  if (game.advanced) {
    let retained: { player: string; event: string } | null = null;
    for (const source of history.sources) {
      const snapshot = JSON.parse(history.snapshots[source.snapshot]) as SourceWorld[];
      const groups = snapshot.find(row => row[0] === world.id)![1]
        .filter(([, normal, elite]) => normal + elite > 0);
      if (retained && !groups.some(([id]) => id === retained!.player)) retained = null;
      if (!retained && source.cause !== 'setup' && groups.length === 1 && groups[0][0] !== native.id)
        retained = { player: groups[0][0], event: source.event };
    }
    const present = Object.entries(world.forces).filter(([, forces]) => forces.normal + forces.elite > 0);
    if (retained && !present.some(([id]) => id === retained!.player)) retained = null;
    if (!retained) {
      // A producer may query between a physical write and its semantic
      // observation; do not invent a new qualifying event from that write.
      return present.length === 1 && present[0][0] !== native.id
        ? { entitlement: null, blocked: 'The original Advanced sole-occupation change must be observed before its benefit settles.' }
        : none;
    }
    const occupier = game.players.find(player => player.id === retained!.player)!;
    const ally = occupier.ally && game.players.some(player => player.id === occupier.ally && player.ally === occupier.id)
      ? occupier.ally : null;
    return { entitlement: { world: world.id, card: cardId, native: native.id, occupier: occupier.id,
      ally, qualification: retained.event, turn: game.turn, spice: card.occupied.spiceIcons }, blocked: null };
  }
  return options.basic === 'epoch'
    ? basicEpochOccupation(game, card, world, native, history)
    : basicCurrentSoleOccupation(game, card, world, native, history);
}

/** Provisional Basic default: the currently present sole foreign faction
 * controls the occupied benefit, expiring immediately on departure, contest or
 * native repopulation. Entitlement still requires an observed qualification;
 * the quote never manufactures one from a physical write. */
function basicCurrentSoleOccupation(
  game: StableHomeworldOccupationContext,
  card: HomeworldCard,
  world: HomeworldWorld,
  native: Player,
  history: History,
): StableHomeworldOccupationQuote {
  if (!history.qualifications.some(f => f.world === world.id)) return { entitlement: null, blocked: null };
  let nativeHigh = false;
  const foreign: string[] = [];
  for (const [id, forces] of Object.entries(world.forces)) {
    const amount = forces.normal + forces.elite;
    if (id === native.id) {
      const population = card.reserveType === 'sardaukar' ? forces.elite : amount;
      if (population >= card.high.reserves.min) nativeHigh = true;
    } else if (amount > 0) foreign.push(id);
  }
  if (nativeHigh || foreign.length !== 1) return { entitlement: null, blocked: null };
  const qualified = history.qualifications.filter(f => f.world === world.id && f.player === foreign[0]).at(-1);
  if (!qualified)
    return { entitlement: null,
      blocked: 'The original Basic sole-occupation change must be observed before its benefit settles.' };
  const occupier = game.players.find(p => p.id === foreign[0])!;
  const ally = occupier.ally && game.players.some(p => p.id === occupier.ally && p.ally === occupier.id)
    ? occupier.ally : null;
  return { entitlement: { world: world.id, card: card.id, native: native.id, occupier: occupier.id,
    ally, qualification: qualified.event, turn: game.turn, spice: card.occupied.spiceIcons }, blocked: null };
}

/** Conservative Basic epoch gate retained for Tupile slot leasing while the
 * retention, composition and turnover ruling is open: the original first
 * qualifier must be alone and have qualified this turn, and departure, contest
 * or native repopulation reports an explicit unresolved reason instead of a
 * silent hand-off. */
function basicEpochOccupation(
  game: StableHomeworldOccupationContext,
  card: HomeworldCard,
  world: HomeworldWorld,
  native: Player,
  history: History,
): StableHomeworldOccupationQuote {
  const none: StableHomeworldOccupationQuote = { entitlement: null, blocked: null };
  const first = history.qualifications.find(f => f.world === world.id);
  if (!first) return none;
  const blocked = (detail: string): StableHomeworldOccupationQuote => ({ entitlement: null,
    blocked: `${card.name} occupied benefits await the pending ${detail} ruling.` });
  let qualifiedThisTurn = false;
  for (const fact of history.qualifications) {
    if (fact.world !== world.id) continue;
    if (fact.player !== first.player) return blocked('competing-occupier');
    if (fact.turn === game.turn) qualifiedThisTurn = true;
  }
  if (!qualifiedThisTurn) return blocked('entitlement/expiry');
  const start = history.sources.findIndex(source => source.event === first.event);
  if (start < 0) throw new HomeworldCustodyError('The occupier lost its original qualifying source.');
  const check = (groups: readonly [string, number, number][]): string | null => {
    let present = false;
    for (const [id, normal, elite] of groups) {
      const amount = normal + elite;
      if (id === native.id) {
        const population = card.reserveType === 'sardaukar' ? elite : amount;
        if (population >= card.high.reserves.min) return 'native-repopulation';
      } else if (amount > 0) {
        if (id !== first.player) return 'contested-occupation';
        present = true;
      }
    }
    return present ? null : 'departure/expiry';
  };
  let previous = -1;
  for (let i = start; i < history.sources.length; i++) {
    const index = history.sources[i].snapshot;
    if (index === previous) continue;
    previous = index;
    const snapshot = JSON.parse(history.snapshots[index]) as SourceWorld[];
    const row = snapshot.find(source => source[0] === world.id)!;
    const reason = check(row[1]);
    if (reason) return blocked(reason);
  }
  // Actions can query an effect after a physical change but before its semantic
  // observation. Never let the last recorded snapshot substitute for now.
  const current = Object.entries(world.forces).map(([id, forces]): [string, number, number] =>
    [id, forces.normal, forces.elite]);
  const reason = check(current);
  if (reason) return blocked(reason);
  const occupier = game.players.find(p => p.id === first.player)!;
  const ally = occupier.ally && game.players.some(p => p.id === occupier.ally && p.ally === occupier.id)
    ? occupier.ally : null;
  return { entitlement: { world: world.id, card: card.id, native: native.id, occupier: occupier.id,
    ally, qualification: first.event, turn: game.turn, spice: card.occupied.spiceIcons }, blocked: null };
}
