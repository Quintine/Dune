import type { Action, GameView } from './engine';
import { gameDistance, gameTerritories, location, splitLocation, validGameLocation } from './board';
import { isAdvisor } from './advisors';
import { presenceAt } from './force-presence';
import { strongholdPathBlocked, territoryEntryBlock } from './occupancy';
import { botEntryAllowed, botMovementRange, botGroundMoveAllowed } from './bot-mobility';
import { planetologistLeader, planetologistMovementModeSupported, planetologistGatherAdvisorEntry,
  selectedOriginElites } from './planetologist-movement';
import { quoteAdvisorGatherMatching, AdvisorGatherMatchingError } from './advisor-gather-matching';
import { nexusGuildMovementAvailable } from './nexus-guild-cunning-options';
import { validateCohortSelection } from './ornithopter';

const whole = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
type Quote = { action: Action | null; blocked: string | null };

/** One projected selection shared by the human control and every bot profile.
 * The server binds its own canonical order and receipt when this action arrives. */
export function discoveryFlightMove(game: GameView, move: Action | null): Quote {
  const fail = (blocked: string): Quote => ({ action: null, blocked });
  const me = game.players.find(player => player.id === game.me), offer = game.discoveryOrnithopter;
  if (!me || !offer) return fail('You do not carry a Discovery Ornithopter.');
  if (offer.blocked) return fail(offer.blocked);
  if (!nexusGuildMovementAvailable(game)) return fail('No movement is currently available.');
  const held = game.discoveries?.tokens.find(token => token.id === offer.token);
  if (!held || held.face !== 'ornithopter' || held.status !== 'carried' || held.owner !== me.id ||
    held.acquiredTurn !== offer.acquiredTurn || held.acquiredTurn >= game.turn)
    return fail('This carried token is no longer available.');
  if (!move || move.type !== 'move') return fail('Select a movement group and destination above.');
  const skill = move.planetologist;
  if (skill !== undefined && ((skill !== 'range' && skill !== 'gather') ||
    !planetologistLeader(game, me.id) || !planetologistMovementModeSupported(game)))
    return fail('Choose a current living Planetologist and movement alternative.');
  if (skill && (game.ornithopter?.active || move.movementCard !== undefined || move.ornithopterEvent !== undefined))
    return fail('Choose one Ornithopter flight source for this Planetologist movement.');
  if (typeof move.territory !== 'string' || !whole(move.sector) ||
    !validGameLocation(game, move.territory, move.sector))
    return fail('Select an available destination and sector.');
  const destination = location(move.territory, move.sector);
  const entries = move.forces !== undefined
    ? object(move.forces) ? Object.entries(move.forces) : null
    : typeof move.from === 'string' ? [[move.from, move.amount] as const] : null;
  if (!entries) return fail('Select forces from one territory.');
  const forces: Record<string, number> = {}, elites: Record<string, number> = {};
  let origin: string | undefined;
  const origins = new Set<string>();
  for (const [key, count] of entries) {
    const source = splitLocation(key);
    if (!validGameLocation(game, source.territory, source.sector) ||
      !whole(count) || count > (me.forces[key] ?? 0))
      return fail('The selected forces are no longer available.');
    if (!count) continue;
    origins.add(source.territory);
    if (origins.size > (skill === 'gather' ? 2 : 1)) return fail('Select forces from one territory, or exactly two with Planetologist gathering.');
    origin ??= source.territory;
    const availableElite = me.elites?.forces[key] ?? 0;
    const selectedElite = move.forces !== undefined
      ? object(move.eliteForces) ? move.eliteForces[key] : undefined : move.elite;
    const elite = selectedElite ?? Math.max(0, count - ((me.forces[key] ?? 0) - availableElite));
    if (!whole(elite) || elite > Math.min(count, availableElite) ||
      count - elite > (me.forces[key] ?? 0) - availableElite)
      return fail('Choose an available normal and elite force allocation.');
    forces[key] = count;
    elites[key] = elite;
  }
  const deployed = game.richeseNoField?.owner === me.id
    ? game.richeseNoField.private?.deployed : undefined;
  const marker = move.noField === undefined ? undefined : deployed &&
    deployed.tokenId === move.noField && game.richeseNoField?.event === move.event
    ? { tokenId: deployed.tokenId, event: String(move.event),
      from: location(deployed.location.territory, deployed.location.sector) } : null;
  if (marker === null) return fail('Choose the current deployed No-Field.');
  if (marker) {
    const markerOrigin = splitLocation(marker.from).territory;
    origins.add(markerOrigin);
    if (origins.size > (skill === 'gather' ? 2 : 1)) return fail('The selected No-Field and forces must share a territory.');
    origin ??= markerOrigin;
  }
  if (!origin) return fail('Select at least one force or the deployed No-Field.');
  const sources = [...Object.keys(forces), ...(marker ? [marker.from] : [])];
  if (sources.some(key => key === destination)) return fail('Choose a different destination.');
  if (skill) {
    if (origins.size !== (skill === 'gather' ? 2 : 1)) return fail('Choose the correct number of Planetologist origins.');
    if (marker && game.homeworldMobility?.noFieldMovementBlocked)
      return fail(game.homeworldMobility.noFieldMovementBlocked);
    const entry = planetologistGatherAdvisorEntry(game, me, [...origins], move.territory);
    if (entry.blocked) return fail(entry.blocked);
    if (sources.some(from => !botGroundMoveAllowed(game, me, from, destination,
      selectedOriginElites(Object.entries(forces), elites, splitLocation(from).territory), skill, 3)))
      return fail('This route is blocked or more than three territories away.');
    if (skill === 'gather') {
      try { quoteAdvisorGatherMatching(game, { owner: me.id, move: me.moved ?? 0,
        destination: move.territory, sector: move.sector, advisors: isAdvisor(me, move.territory), group: forces }); }
      catch (error) { if (!(error instanceof AdvisorGatherMatchingError)) throw error; return fail(error.message); }
    }
    return { action: { ...move, ...(entry.requiresFlip ? { fighters: true } : {}),
      discoveryOrnithopter: offer.token }, blocked: null };
  }
  if (!botEntryAllowed(game, me, move.territory, move.sector, 'move', origin))
    return fail('The selected destination is unavailable to this group.');
  if (origin !== move.territory && game.balisetRestrictions.some(b =>
    b.player === me.id && b.territory === move.territory) && game.players.some(p =>
    p.faction === 'choam' && presenceAt(p, String(move.territory))))
    return fail('Baliset prevents movement into this CHOAM territory.');
  const advisors = isAdvisor(me, origin);
  if (move.fighters === true && advisors) {
    if (me.advisors?.[origin]?.lockedTurn === game.turn || presenceAt(me, move.territory) ||
      territoryEntryBlock(game.players, me.id, move.territory, false))
      return fail('These advisors cannot flip to fighters on arrival.');
  }
  if (sources.some(from => gameDistance(game, from, destination, key => {
    const source = splitLocation(key);
    return (source.sector !== 0 && source.sector === game.storm) ||
      strongholdPathBlocked(game.players, me.id, source.territory, advisors);
  }) > 3)) return fail('This route is blocked or more than three territories away.');
  const flight = game.ornithopter?.active;
  if (flight && advisors) return fail('Advanced advisor use of the active movement card awaits its ruling.');
  if (flight?.cohort) {
    try { validateCohortSelection(flight.cohort, me.forces, me.elites?.forces ?? {}, forces, elites, marker); }
    catch { return fail('Choose original forces that have not moved with the active card.'); }
  }
  return {
    action: { ...move, discoveryOrnithopter: offer.token,
      ...(flight ? { ornithopterEvent: flight.event } : {}) },
    blocked: null,
  };
}

/** Spend the token only when its fixed range opens a route ordinary movement
 * cannot reach. Destination preference remains with the existing bot policy. */
export function discoveryFlightBotActions(game: GameView,
  targets = gameTerritories(game).flatMap(t => t.sectors.map(sector => ({ territory: t.id, sector }))),
): Action[] {
  const me = game.players.find(player => player.id === game.me);
  if (!me || !game.discoveryOrnithopter || game.discoveryOrnithopter.blocked ||
    !nexusGuildMovementAvailable(game)) return [];
  const actions: Action[] = [];
  for (const target of targets) for (const [from, amount] of Object.entries(me.forces)) {
    if (amount <= 0) continue;
    const elite = me.elites?.forces[from] ?? 0;
    const advisors = isAdvisor(me, splitLocation(from).territory);
    const distance = gameDistance(game, from, location(target.territory, target.sector), key => {
      const source = splitLocation(key);
      return (source.sector !== 0 && source.sector === game.storm) ||
        strongholdPathBlocked(game.players, me.id, source.territory, advisors);
    });
    if (distance <= botMovementRange(game, me, elite) || distance > 3) continue;
    const quote = discoveryFlightMove(game, { type: 'move', from, amount, elite, ...target });
    if (quote.action) actions.push(quote.action);
  }
  return actions;
}
