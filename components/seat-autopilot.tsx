'use client';

import { useId, useState } from 'react';
import { Bot, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Action, GameView } from '@/game/engine';
import {
  BOT_DESCRIPTIONS,
  DIFFICULTIES,
  type Difficulty,
} from '@/game/bot-profiles';

export type SeatAutopilotProps = {
  game: GameView;
  act: (action: Action) => void;
  busy: boolean;
};

/** Voluntary control of the current human seat; the action never names another player. */
export function SeatAutopilot({ game, act, busy }: SeatAutopilotProps) {
  const id = useId();
  const [difficulty, setDifficulty] = useState<Difficulty>('Medium');
  const own = game.players.find((player) => player.id === game.me);
  if (!own || own.bot || !['setup', 'playing'].includes(game.status))
    return null;

  if (own.autopilot)
    return (
      <section
        className="notice flex min-w-0 flex-wrap items-center gap-4"
        aria-label="Your seat autopilot"
      >
        <div className="flex min-w-0 flex-1 basis-60 flex-col gap-2">
          <output className="flex items-center gap-2 text-base font-semibold text-[#efd9a8]">
            <Bot aria-hidden="true" className="size-5 shrink-0" />
            AI autopilot · {own.autopilot}
          </output>
          <p className="m-0 text-sm leading-6 text-[#e0e4d8]">
            AI is making this seat’s decisions using only its available
            information, with about 1.5 seconds between decisions. You keep the
            seat and its recovery setup. Taking back control stops future AI
            decisions; completed decisions remain in the game.
          </p>
        </div>
        <Button
          variant="outline"
          className="min-h-11 w-full motion-reduce:transition-none sm:w-auto"
          disabled={busy}
          onClick={() => {
            if (!busy) act({ type: 'setAutopilot', difficulty: null });
          }}
        >
          <UserRound aria-hidden="true" />
          Take back control
        </Button>
      </section>
    );

  return (
    <details className="notice min-w-0">
      <summary className="min-h-11 cursor-pointer py-3 text-base font-semibold text-[#efd9a8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ddbc77]">
        Let AI play for me
      </summary>
      <div className="flex min-w-0 flex-col gap-4 pb-2">
        <p id={`${id}-impact`} className="m-0 text-sm leading-6 text-[#e0e4d8]">
          Autopilot makes setup and game decisions for your seat using only
          information that seat can see, with about 1.5 seconds between
          decisions. It may make irreversible decisions, including spending
          spice, moving forces and committing battle plans. You retain your seat
          and recovery setup and can take back control. Completed decisions
          cannot be undone by turning autopilot off.
        </p>
        <div className="flex min-w-0 flex-col gap-2">
          <label htmlFor={`${id}-difficulty`} className="text-sm font-semibold">
            AI difficulty
          </label>
          <select
            id={`${id}-difficulty`}
            value={difficulty}
            disabled={busy}
            aria-describedby={`${id}-difficulty-help`}
            className="min-h-11 w-full min-w-0 rounded-md border border-[#454b3c] bg-[#141814] px-3 text-base text-[#eeeae0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ddbc77] disabled:opacity-50"
            onChange={(event) => {
              const value = event.target.value;
              if (DIFFICULTIES.some((choice) => choice === value))
                setDifficulty(value as Difficulty);
            }}
          >
            {DIFFICULTIES.map((choice) => (
              <option key={choice} value={choice}>
                {choice}
              </option>
            ))}
          </select>
          <p
            id={`${id}-difficulty-help`}
            className="m-0 text-sm leading-6 text-[#c1c5b8]"
          >
            {BOT_DESCRIPTIONS[difficulty]}
          </p>
        </div>
        <Button
          className="min-h-11 w-full motion-reduce:transition-none sm:w-auto sm:self-start"
          disabled={busy}
          aria-describedby={`${id}-impact`}
          onClick={() => {
            if (!busy) act({ type: 'setAutopilot', difficulty });
          }}
        >
          <Bot aria-hidden="true" />
          Start autopilot
        </Button>
      </div>
    </details>
  );
}
