'use client';

import type { Action, GameView } from '@/game/engine';
import {
  planetologistLeader,
  planetologistMovementModeSupported,
  selectedOriginElites,
  planetologistGatherAdvisorEntry,
  type PlanetologistMoveMode,
} from '@/game/planetologist-movement';
import { botGroundMoveAllowed } from '@/game/bot-mobility';
import { isAdvisor } from '@/game/advisors';
import { quoteAdvisorGatherMatching, AdvisorGatherMatchingError } from '@/game/advisor-gather-matching';
import { location, splitLocation, validGameLocation } from '@/game/board';
import { nexusGuildMovementAvailable } from '@/game/nexus-guild-cunning-options';
import { Button } from './ui/button';

type Counts = Record<string, number>;
type Draft = { action: Action | null; blocked: string | null };
const record = (value: unknown): value is Counts =>
  !!value && typeof value === 'object' && !Array.isArray(value);

/** Only the owning seat's current deployed identity is a selectable marker. */
export function planetologistNoFieldMarker(game: GameView) {
  const me = game.players.find(player => player.id === game.me);
  const info = game.richeseNoField;
  if (!me || me.faction !== 'richese' || info?.owner !== me.id) return null;
  const state = info.private;
  const marker = state?.deployed;
  const publicMarker = info.public.deployed;
  if (!state || !marker || marker.controller !== me.id ||
    !publicMarker || publicMarker.controller !== me.id ||
    marker.location.territory !== publicMarker.location.territory ||
    marker.location.sector !== publicMarker.location.sector ||
    marker.tokenId !== state.lastShipped ||
    !state.tokens.some(token => token.id === marker.tokenId) ||
    typeof info.event !== 'string' || !info.event.trim() ||
    !Number.isSafeInteger(marker.location.sector) ||
    !validGameLocation(game, marker.location.territory, marker.location.sector))
    return null;
  return { tokenId: marker.tokenId, event: info.event, location: { ...marker.location } };
}

export function planetologistMoveDraft(
  game: GameView,
  mode: PlanetologistMoveMode,
  destination: string,
  sector: number,
  forces: Counts,
  elites: Counts,
  includeNoField = false,
): Draft {
  const me = game.players.find((player) => player.id === game.me);
  if (!me || !planetologistLeader(game, me.id))
    return { action: null, blocked: 'A living, uncaptured Planetologist is required.' };
  if (!planetologistMovementModeSupported(game))
    return {
      action: null,
      blocked: 'Planetologist movement with expansion factions awaits its movement audit.',
    };
  if (mode !== 'range' && mode !== 'gather')
    return { action: null, blocked: 'Choose a Planetologist movement mode.' };
  if (!Number.isSafeInteger(sector) || !validGameLocation(game, destination, sector))
    return { action: null, blocked: 'Choose an available destination and sector.' };
  if (!record(forces) || !record(elites))
    return { action: null, blocked: 'Choose available whole force counts.' };
  const entered = Object.entries(forces);
  if (entered.some(([from, count]) => {
    const source = splitLocation(from);
    return !Number.isSafeInteger(count) || count < 0 || count > (me.forces[from] ?? 0) ||
      !validGameLocation(game, source.territory, source.sector) ||
      from !== location(source.territory, source.sector);
  })) return { action: null, blocked: 'Choose available whole force counts at exact board locations.' };
  const selected = entered.filter(([, count]) => count > 0);
  for (const [from, count] of selected) {
    const owned = me.forces[from] ?? 0;
    const elite = elites[from] ?? 0;
    const ownedElite = me.elites?.forces[from] ?? 0;
    const minimumElite = Math.max(0, count - (owned - ownedElite));
    if (!Number.isSafeInteger(elite) || elite < minimumElite || elite > Math.min(count, ownedElite))
      return { action: null, blocked: 'Choose an available normal and elite mix for every source.' };
  }
  const marker = includeNoField ? planetologistNoFieldMarker(game) : null;
  if (includeNoField) {
    if (mode !== 'range')
      return { action: null, blocked: 'A concealed No-Field can use extra range, but cannot join a Planetologist gather.' };
    if (!marker)
      return { action: null, blocked: 'Choose your current deployed No-Field.' };
    if (game.homeworldMobility?.noFieldMovementBlocked)
      return { action: null, blocked: game.homeworldMobility.noFieldMovementBlocked };
    if (selected.some(([from]) => splitLocation(from).territory !== marker.location.territory))
      return { action: null, blocked: 'The selected No-Field and physical forces must share one origin territory.' };
  }
  const origins = new Set(selected.map(([from]) => splitLocation(from).territory));
  if (marker) origins.add(marker.location.territory);
  if ((mode === 'range' && origins.size !== 1) || (mode === 'gather' && origins.size !== 2))
    return {
      action: null,
      blocked: mode === 'range'
        ? 'Select forces from one territory, or your deployed No-Field.'
        : 'Select forces from exactly two different territories.',
    };
  const entry = planetologistGatherAdvisorEntry(game, me, [...origins], destination);
  if (entry.blocked) return { action: null, blocked: entry.blocked };
  const target = location(destination, sector);
  const sources = [...selected.map(([from]) => from), ...(marker ? [location(marker.location.territory, marker.location.sector)] : [])];
  if (sources.some(from => !botGroundMoveAllowed(game, me, from, target,
    selectedOriginElites(selected, elites, splitLocation(from).territory), mode)))
    return {
      action: null,
      blocked: mode === 'range'
        ? 'The selected route is beyond the boosted range or is blocked.'
        : 'Each selected source must reach the destination using its normal range.',
    };
  if (mode === 'gather') {
    try {
      quoteAdvisorGatherMatching(game, { owner: me.id, move: me.moved ?? 0, destination, sector,
        advisors: isAdvisor(me, destination), group: Object.fromEntries(selected) });
    } catch (error) {
      if (!(error instanceof AdvisorGatherMatchingError)) throw error;
      return { action: null, blocked: error.message };
    }
  }
  return {
    action: {
      type: 'move', planetologist: mode,
      ...(entry.requiresFlip ? { fighters: true } : {}),
      forces: Object.fromEntries(selected),
      ...(me.elites ? { eliteForces: Object.fromEntries(selected.map(([from]) => [from, elites[from] ?? 0])) } : {}),
      ...(marker ? { noField: marker.tokenId, event: marker.event } : {}),
      territory: destination, sector,
    },
    blocked: null,
  };
}

export function planetologistMovementBlocked(game: GameView, draft: Draft, unavailableReason?: string | null): string | null {
  const me = game.players.find(player => player.id === game.me);
  return unavailableReason ??
    (!me || game.status !== 'playing' || game.phase !== 5 || game.active !== me.id
      ? 'Planetologist movement is available only during your movement turn.'
      : game.ornithopter?.active
        ? 'Finish the current Ornithopter movement first.'
        : game.response || game.decision || game.phaseOpening || game.truthtrance ||
          game.nexusTraitors?.pending || game.nexusCards?.waiting.length
          ? 'Resolve the current response or decision first.'
          : me.autopilot || game.automaticContinuationPending
            ? 'Wait for the current automatic action to finish.'
            : !nexusGuildMovementAvailable(game)
              ? 'No ordinary movement remains this turn.'
              : draft.blocked);
}

export interface PlanetologistMovementActionProps {
  game: GameView;
  mode: PlanetologistMoveMode;
  destination: string;
  sector: number;
  forces: Counts;
  elites: Counts;
  includeNoField?: boolean;
  busy: boolean;
  unavailableReason?: string | null;
  reasonId?: string;
  act: (action: Action) => void;
}

/** Hook-free leaf owns the actual guarded submission callback. */
export function PlanetologistMovementAction({ game, mode, destination, sector, forces, elites,
  includeNoField = false, busy, unavailableReason, reasonId, act }: PlanetologistMovementActionProps) {
  const draft = planetologistMoveDraft(game, mode, destination, sector, forces, elites, includeNoField);
  const blocked = planetologistMovementBlocked(game, draft, unavailableReason);
  const marker = includeNoField ? planetologistNoFieldMarker(game) : null;
  return <Button
    className="min-h-11 whitespace-normal motion-reduce:transition-none"
    data-testid="planetologist-move"
    disabled={busy || !!blocked || !draft.action}
    aria-describedby={blocked ? reasonId : undefined}
    onClick={() => {
      if (busy || blocked || !draft.action) return;
      const current = planetologistMoveDraft(game, mode, destination, sector, forces, elites, includeNoField);
      if (planetologistMovementBlocked(game, current, unavailableReason) || !current.action) return;
      const currentMarker = includeNoField ? planetologistNoFieldMarker(game) : null;
      if (includeNoField && (!marker || !currentMarker || marker.tokenId !== currentMarker.tokenId ||
        marker.event !== currentMarker.event || marker.location.territory !== currentMarker.location.territory ||
        marker.location.sector !== currentMarker.location.sector)) return;
      act(current.action);
    }}
  >Move with Planetologist</Button>;
}
