'use client';

import { useId } from 'react';
import { Button } from '@/components/ui/button';
import { BOT_DESCRIPTIONS, DIFFICULTIES } from '@/game/bot-profiles';
import { FACTIONS } from '@/game/catalog';
import type { Action, GameView } from '@/game/engine';
import {
  quoteLobbyBotConfiguration,
  type LobbyBotConfiguration,
} from '@/game/lobby-bot-configuration';
import { PLAYER_CIRCLE_SECTORS } from '@/game/player-positions';

export function LobbyBotControls({
  g,
  target,
  busy,
  act,
}: {
  g: GameView;
  target: string;
  busy: boolean;
  act: (action: Action) => void;
}) {
  const id = useId();
  const player = g.players.find((entry) => entry.id === target);
  if (g.status !== 'lobby' || g.host !== g.me || !player?.bot) return null;
  const current: LobbyBotConfiguration = {
    target,
    difficulty: player.bot,
    faction: player.faction,
    position: g.playerPositions[target],
  };
  const context = { ...g, positions: g.playerPositions };
  const quote = (change: Partial<LobbyBotConfiguration>) =>
    quoteLobbyBotConfiguration(context, g.me, {
      type: 'configureBot',
      ...current,
      ...change,
    });
  const change = (update: Partial<LobbyBotConfiguration>) => {
    const result = quote(update);
    if (!busy && result.ok && result.changed)
      act({ type: 'configureBot', ...result.configuration });
  };

  return (
    <details className="lobby-bot-configuration mt-2 min-w-0 rounded border border-current/20 p-2">
      <summary className="min-h-11 cursor-pointer content-center text-sm">
        Configure {player.name}
      </summary>
      <div className="grid min-w-0 gap-3 pt-2">
        <p id={`${id}-help`} className="fine">
          Changes save immediately. Human players must confirm readiness again.
        </p>
        <label
          htmlFor={`${id}-difficulty`}
          className="grid min-w-0 gap-1 text-sm"
        >
          AI difficulty
          <select
            id={`${id}-difficulty`}
            value={current.difficulty}
            disabled={busy}
            className="min-h-11 w-full min-w-0"
            aria-describedby={`${id}-help ${id}-profile`}
            onChange={(event) => {
              const difficulty = DIFFICULTIES.find(
                (entry) => entry === event.target.value,
              );
              if (difficulty) change({ difficulty });
            }}
          >
            {DIFFICULTIES.map((difficulty) => (
              <option key={difficulty}>{difficulty}</option>
            ))}
          </select>
        </label>
        <p className="fine" id={`${id}-profile`}>
          {BOT_DESCRIPTIONS[current.difficulty]}
        </p>
        <label htmlFor={`${id}-faction`} className="grid min-w-0 gap-1 text-sm">
          AI faction
          <select
            id={`${id}-faction`}
            value={current.faction}
            disabled={busy}
            className="min-h-11 w-full min-w-0"
            aria-describedby={`${id}-help`}
            onChange={(event) => {
              const faction = FACTIONS.find(
                (entry) => entry.id === event.target.value,
              );
              if (faction) change({ faction: faction.id });
            }}
          >
            {FACTIONS.filter(
              (faction) => quote({ faction: faction.id }).ok,
            ).map((faction) => (
              <option key={faction.id} value={faction.id}>
                {faction.name}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor={`${id}-circle`} className="grid min-w-0 gap-1 text-sm">
          AI player circle
          <select
            id={`${id}-circle`}
            value={current.position}
            disabled={busy}
            className="min-h-11 w-full min-w-0"
            aria-describedby={`${id}-help ${id}-circle-help`}
            onChange={(event) =>
              change({ position: Number(event.target.value) })
            }
          >
            {PLAYER_CIRCLE_SECTORS.map((sector, index) => {
              const position = index + 1;
              const result = quote({ position });
              return (
                <option key={position} value={position} disabled={!result.ok}>
                  Circle {position} · Sector {sector}
                  {!result.ok ? ' · occupied' : ''}
                </option>
              );
            })}
          </select>
        </label>
        <p id={`${id}-circle-help`} className="fine">
          Circles determine storm order.
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="min-h-11"
          disabled={busy}
          aria-label={`Remove ${player.name}`}
          onClick={() => act({ type: 'removeBot', target })}
        >
          Remove AI
        </Button>
      </div>
    </details>
  );
}
