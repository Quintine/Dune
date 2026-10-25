'use client';

import type { Action, GameView } from '@/game/engine';
import {
  quoteSandmasterMovement, sandmasterActionOrder, sandmasterCollectionPiles, sandmasterDefaultChoice,
  type SandmasterChoice,
} from '@/game/sandmaster-movement';
import {
  planetologistFlightSelection as movementFlightSelection,
  type PlanetologistFlight as MovementFlight,
} from '@/game/planetologist-flight';
import { nexusGuildMovementAvailable } from '@/game/nexus-guild-cunning-options';
import { Button } from './ui/button';

export type { PlanetologistFlight as MovementFlight } from '@/game/planetologist-flight';
const flightFields = ['movementCard', 'ornithopter', 'ornithopterEvent', 'discoveryOrnithopter'] as const;

/** Apply only the currently projected selected transport to the parent's group. */
export function sandmasterMovementSelection(game: GameView, move: Action | null, flight?: MovementFlight) {
  const movementMode = move?.ornithopter;
  const selectedFlight: MovementFlight = flight ?? (move?.discoveryOrnithopter !== undefined ? 'discovery'
    : movementMode === 'range3' || movementMode === 'twoGroups' ? movementMode : 'ordinary');
  const transport = movementFlightSelection(game, selectedFlight);
  const fail = (blocked: string) => ({ move: null, flight: selectedFlight, transport, blocked });
  if (!move || move.type !== 'move') return fail('Select a current movement group and destination.');
  if (move.planetologist !== undefined) return fail('Use Sandmaster without combining it with Planetologist.');
  if (transport.blocked) return fail(transport.blocked);
  if (flightFields.some(key => move[key] !== undefined && move[key] !== transport.fields[key]))
    return fail('Choose one current flight source, card mode or active movement event.');
  const selected: Action = { ...move, ...transport.fields };
  delete selected.sandmaster;
  return { move: selected, flight: selectedFlight, transport, blocked: null };
}

export function sandmasterMoveDraft(game: GameView, move: Action,
  routes?: Record<string, string[]>, declined: readonly string[] = [], flight?: MovementFlight): {
    action: Action | null; choice: SandmasterChoice | null; collectible: string[]; blocked: string | null;
  } {
  const selected = sandmasterMovementSelection(game, move, flight);
  if (!selected.move) return { action: null, choice: null, collectible: [], blocked: selected.blocked };
  const defaults = sandmasterDefaultChoice(game, game.me, selected.move);
  const order = sandmasterActionOrder(game, game.me, selected.move);
  if (!defaults || !order) return { action: null, choice: null, collectible: [],
    blocked: 'Sandmaster needs a current legal force or owned marker group, route and living native trainer.' };
  const selectedRoutes = routes ?? defaults.routes;
  const offered = sandmasterCollectionPiles(game, selectedRoutes);
  const collectible = Object.values(offered).flat();
  const choice = { routes: selectedRoutes,
    collect: Object.values(offered).map(piles => piles.find(key => !declined.includes(key)))
      .filter((key): key is string => key !== undefined) };
  try {
    quoteSandmasterMovement(game, game.me, order, choice);
    return { action: { ...selected.move, sandmaster: choice }, choice, collectible, blocked: null };
  } catch (error) {
    return { action: null, choice, collectible,
      blocked: error instanceof Error ? error.message : 'Choose a legal Sandmaster route.' };
  }
}

export function sandmasterMovementBlocked(game: GameView,
  draft: ReturnType<typeof sandmasterMoveDraft>, unavailableReason?: string | null,
  flight: MovementFlight = 'ordinary'): string | null {
  const me = game.players.find(player => player.id === game.me);
  const transport = movementFlightSelection(game, flight);
  const currentCard = !transport.blocked && typeof transport.fields.ornithopterEvent === 'string';
  return unavailableReason ||
    (!me || game.status !== 'playing' || game.phase !== 5 || game.active !== me.id
      ? 'Sandmaster movement is available only during your movement turn.'
      : game.response || game.decision || game.phaseOpening || game.truthtrance ||
        game.nexusTraitors?.pending || game.nexusCards?.waiting.length
        ? 'Resolve the current response or decision first.'
        : me.autopilot || game.automaticContinuationPending
          ? 'Wait for the current automatic action to finish.'
          : transport.blocked
            ? transport.blocked
            : !currentCard && !nexusGuildMovementAvailable(game)
              ? 'No movement remains this turn.' : draft.blocked);
}

export interface SandmasterMovementActionProps {
  game: GameView;
  move: Action | null;
  routes?: Record<string, string[]>;
  declined?: readonly string[];
  flight?: MovementFlight;
  busy: boolean;
  unavailableReason?: string | null;
  reasonId?: string;
  act: (action: Action) => void;
}

function receipt(game: GameView, draft: ReturnType<typeof sandmasterMoveDraft>) {
  if (!draft.action || !draft.choice) return null;
  const order = sandmasterActionOrder(game, game.me, draft.action);
  if (!order) return null;
  try { return JSON.stringify(quoteSandmasterMovement(game, game.me, order, draft.choice)); }
  catch { return null; }
}

/** Hook-free actual submit leaf, including current route/pile/frame proof. */
export function SandmasterMovementAction({ game, move, routes, declined = [], flight,
  busy, unavailableReason, reasonId, act }: SandmasterMovementActionProps) {
  const selected = sandmasterMovementSelection(game, move, flight);
  const draft = move ? sandmasterMoveDraft(game, move, routes, declined, flight)
    : { action: null, choice: null, collectible: [], blocked: selected.blocked };
  const blocked = sandmasterMovementBlocked(game, draft, unavailableReason, selected.flight);
  const snapshot = receipt(game, draft);
  return <Button
    className="min-h-11 whitespace-normal motion-reduce:transition-none"
    data-testid="sandmaster-move"
    disabled={busy || !!blocked || !draft.action || !snapshot}
    aria-describedby={blocked ? reasonId : undefined}
    onClick={() => {
      if (busy || blocked || !move || !draft.action || !snapshot) return;
      const current = sandmasterMoveDraft(game, move, routes, declined, flight);
      if (sandmasterMovementBlocked(game, current, unavailableReason, selected.flight) || !current.action) return;
      const next = sandmasterMovementSelection(game, move, flight);
      if (JSON.stringify(next.transport.fields) !== JSON.stringify(selected.transport.fields) ||
        receipt(game, current) !== snapshot) return;
      act(current.action);
    }}
  >Move with Sandmaster</Button>;
}
