import type { Action, GameView } from './engine';
import { location, splitLocation, validGameLocation } from './board';
import { isDiscoveryTokenId } from './discoveries';
import { validateCohortSelection, type MovementCohort } from './ornithopter';

export type PlanetologistFlight = 'ordinary' | 'range3' | 'twoGroups' | 'discovery';
export type PlanetologistFlightSelection = {
  fields: Partial<Action>;
  rangeOverride?: 3;
  cohort?: MovementCohort;
  blocked: string | null;
};
const fail = (blocked: string): PlanetologistFlightSelection => ({ fields: {}, blocked });
const named = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

/** Select only the current seat's projected physical card or carried token.
 * Range/path, selected forces and action priority are checked by the consumer. */
export function planetologistFlightSelection(game: GameView,
  flight: PlanetologistFlight = 'ordinary'): PlanetologistFlightSelection {
  if (!game.players.some(player => player.id === game.me)) return fail('Choose the current movement owner.');
  if (!['ordinary', 'range3', 'twoGroups', 'discovery'].includes(flight))
    return fail('Choose an available movement transport.');
  const card = game.ornithopter;
  const active = card?.active;
  if (active && card) {
    if (card.blocked) return fail(card.blocked);
    if (flight === 'discovery') return fail('Finish the current physical Ornithopter before using Discovery flight.');
    if (flight !== 'ordinary' && flight !== active.mode)
      return fail('Continue the current Ornithopter mode before selecting another transport.');
    const total = active.mode === 'twoGroups' ? 2 : active.mode === 'range3' ? 1 : 0;
    const played = game.playedOrnithopter;
    if (!named(card?.card?.id) || !named(active.event) || !total ||
      !Number.isSafeInteger(active.completed) || active.completed < 0 ||
      !Number.isSafeInteger(active.remaining) || active.remaining <= 0 ||
      active.completed + active.remaining !== total ||
      (played && (played.player !== game.me || played.card.id !== card.card.id ||
        played.mode !== active.mode || played.completed !== active.completed)))
      return fail('The current Ornithopter frame no longer belongs to this movement.');
    if (!Array.isArray(card.modes) || !card.modes.some(option => option.mode === active.mode))
      return fail('The current Ornithopter mode is no longer offered.');
    if (active.mode === 'twoGroups' && active.completed > 0 && !active.cohort)
      return fail('The original unmoved Ornithopter cohort is unavailable.');
    if (active.cohort) {
      try {
        validateCohortSelection(active.cohort, active.cohort.forces, active.cohort.elites, {}, {});
        const sources = [...Object.keys(active.cohort.forces), ...Object.keys(active.cohort.elites),
          ...(active.cohort.noField ? [active.cohort.noField.from] : [])];
        if (sources.some(from => {
          const point = splitLocation(from);
          return from !== location(point.territory, point.sector) ||
            !validGameLocation(game, point.territory, point.sector);
        })) return fail('The original unmoved Ornithopter cohort has invalid sources.');
      } catch {
        return fail('The original unmoved Ornithopter cohort is no longer valid.');
      }
    }
    return { fields: { ornithopterEvent: active.event },
      ...(active.mode === 'range3' ? { rangeOverride: 3 as const } : {}),
      ...(active.cohort ? { cohort: active.cohort } : {}), blocked: null };
  }
  if (flight === 'ordinary') return { fields: {}, blocked: null };
  if (flight === 'discovery') {
    const offer = game.discoveryOrnithopter;
    if (!offer) return fail('You do not carry an available Discovery Ornithopter.');
    if (offer.blocked) return fail(offer.blocked);
    const held = game.discoveries?.tokens.find(token => token.id === offer.token);
    if (!isDiscoveryTokenId(offer.token) || offer.range !== 3 || !held ||
      game.discoveries?.tokens.filter(token => token.face === 'ornithopter' &&
        token.status === 'carried' && token.owner === game.me).length !== 1 ||
      held.face !== 'ornithopter' || held.status !== 'carried' || held.owner !== game.me ||
      held.acquiredTurn !== offer.acquiredTurn || held.revealedTurn !== offer.acquiredTurn ||
      !Number.isSafeInteger(offer.acquiredTurn) || offer.acquiredTurn < 1 || offer.acquiredTurn >= game.turn)
      return fail('The selected Discovery Ornithopter is no longer carried by you or ready for use.');
    return { fields: { discoveryOrnithopter: offer.token }, rangeOverride: 3, blocked: null };
  }
  if (!card || !named(card.card.id)) return fail('You do not hold an available Ornithopter card.');
  const mode = card.modes?.find(option => option.mode === flight);
  if (!mode) return fail('Choose one of the offered Ornithopter modes.');
  if (card.blocked || mode.blocked) return fail(card.blocked || mode.blocked!);
  return { fields: { movementCard: card.card.id, ornithopter: flight },
    ...(flight === 'range3' ? { rangeOverride: 3 as const } : {}), blocked: null };
}
