import type { Action, GameView } from './engine';
import { location, splitLocation } from './board';
import { botGroundMoveAllowed } from './bot-mobility';
import { planetologistFlightSelection, type PlanetologistFlight } from './planetologist-flight';
import { planetologistLeader, planetologistMovementModeSupported,
  planetologistGatherAdvisorEntry, type PlanetologistMoveMode } from './planetologist-movement';
import { validateCohortSelection } from './ornithopter';
import { nexusGuildMovementAvailable } from './nexus-guild-cunning-options';

type Source = { from: string; elite: number; marker: boolean };

/** Minimal legal participation using only current projected transport and stock.
 * One counter per origin leaves distinct residual groups where available. */
export function botPlanetologistFlightActions(game: GameView,
  targets: readonly { territory: string; sector: number }[],
  transports: readonly PlanetologistFlight[]): Action[] {
  const me = game.players.find(player => player.id === game.me);
  if (!me || game.status !== 'playing' || game.phase !== 5 || game.active !== me.id ||
    game.response || game.decision || game.phaseOpening || game.truthtrance ||
    game.automaticContinuationPending || game.roomControl?.paused || game.roomControl?.closed ||
    !planetologistLeader(game, me.id) || !planetologistMovementModeSupported(game) ||
    (!game.ornithopter?.active && !nexusGuildMovementAvailable(game))) return [];
  const info = game.richeseNoField?.owner === me.id ? game.richeseNoField : null;
  const marker = info?.private?.deployed;
  const result: Action[] = [];
  for (const transport of transports) {
    const flight = planetologistFlightSelection(game, transport);
    if (flight.blocked) continue;
    const sources: Source[] = Object.entries(me.forces).flatMap(([from, total]) => {
      const elite = me.elites?.forces[from] ?? 0;
      const availableElite = Math.min(elite, flight.cohort?.elites[from] ?? elite);
      const availableNormal = Math.min(total - elite, flight.cohort
        ? (flight.cohort.forces[from] ?? 0) - (flight.cohort.elites[from] ?? 0) : total - elite);
      return availableNormal > 0 ? [{ from, elite: 0, marker: false }]
        : availableElite > 0 ? [{ from, elite: 1, marker: false }] : [];
    }).slice(0, 12);
    if (marker?.controller === me.id && info?.event && !game.homeworldMobility?.noFieldMovementBlocked) {
      const from = location(marker.location.territory, marker.location.sector);
      if (!flight.cohort || (flight.cohort.noField?.tokenId === marker.tokenId &&
        flight.cohort.noField.event === info.event && flight.cohort.noField.from === from))
        sources.push({ from, elite: 0, marker: true });
    }
    for (const mode of ['range', 'gather'] as PlanetologistMoveMode[]) {
      const groups: Source[][] = mode === 'range' ? sources.map(source => [source])
        : sources.flatMap((first, index) => sources.slice(index + 1)
          .filter(second => splitLocation(first.from).territory !== splitLocation(second.from).territory)
          .map(second => [first, second]));
      let accepted = 0;
      choices: for (const target of targets) for (const group of groups) {
        const to = location(target.territory, target.sector);
        if (!group.every(source => botGroundMoveAllowed(game, me, source.from, to,
          source.elite, mode, flight.rangeOverride))) continue;
        const entry = planetologistGatherAdvisorEntry(game, me,
          group.map(source => splitLocation(source.from).territory), target.territory);
        if (entry.blocked) continue;
        const forces = Object.fromEntries(group.filter(source => !source.marker).map(source => [source.from, 1]));
        const elites = Object.fromEntries(group.filter(source => !source.marker).map(source => [source.from, source.elite]));
        const selectedMarker = group.some(source => source.marker) && marker && info?.event
          ? { tokenId: marker.tokenId, event: info.event,
            from: location(marker.location.territory, marker.location.sector) } : undefined;
        if (flight.cohort) {
          try { validateCohortSelection(flight.cohort, me.forces, me.elites?.forces ?? {}, forces, elites, selectedMarker); }
          catch { continue; }
        }
        result.push({ type: 'move', planetologist: mode, forces,
          ...(me.elites ? { eliteForces: elites } : {}),
          ...(selectedMarker ? { noField: selectedMarker.tokenId, event: selectedMarker.event } : {}),
          ...(entry.requiresFlip ? { fighters: true } : {}),
          ...flight.fields, territory: target.territory, sector: target.sector });
        if (++accepted === 24) break choices;
      }
    }
  }
  return result;
}
