'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { Action, GameView } from '@/game/engine';
export function ChoamCashIn({
  game: g,
  act,
  busy,
}: {
  game: GameView;
  act: (a: Action) => void;
  busy: boolean;
}) {
  const [activation, setActivation] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const cash = g.choamCashIn;
  if (!cash?.karamas.length) return null;
  const card = cash.karamas.find((c) => c.id === activation) ?? cash.karamas[0];
  const choices = cash.cards.filter((c) => c.id !== card.id);
  const cards = selected.filter((id) => choices.some((c) => c.id === id));
  return (
    <section className="notice">
      <h3>CHOAM special Karama</h3>
      <p>
        Once per game, spend Karama and discard other cards for three spice
        each. Committed battle cards are excluded. The activating Karama earns
        no spice.
      </p>
      <label>
        Karama to spend{' '}
        <select value={card.id} onChange={(e) => setActivation(e.target.value)}>
          {cash.karamas.map((c, i) => (
            <option key={c.id} value={c.id}>
              Karama {i + 1}
            </option>
          ))}
        </select>
      </label>
      {choices.map((c) => (
        <label key={c.id}>
          <input
            type="checkbox"
            checked={cards.includes(c.id)}
            onChange={(e) =>
              setSelected(
                e.target.checked
                  ? [...selected, c.id]
                  : selected.filter((id) => id !== c.id),
              )
            }
          />
          {c.name} · 3 spice
        </label>
      ))}
      <Button
        className="game-action"
        disabled={busy || !!g.truthtrance || cards.length === 0}
        onClick={() =>
          act({ type: 'card', mode: 'special', card: card.id, cards })
        }
      >
        Spend Karama · gain {cards.length * 3} spice
      </Button>
    </section>
  );
}
