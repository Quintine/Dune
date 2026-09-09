'use client';

import { useState } from 'react';
import type { Action, GameView } from '@/game/engine';
import { faction } from '@/game/catalog';
import { HOMEWORLD_CARDS } from '@/game/homeworld-cards';
import type { NativeReserveSelections } from '@/game/homeworld-native-reserves';
import { HomeworldFace } from './homeworld-cards';
import { EcazPoisonIncome } from './ecaz-poison-income';
import { Button } from './ui/button';
import { Input } from './ui/input';

export function HomeworldTable({ game: g }: { game: GameView }) {
  const worlds = g.homeworlds?.worlds;
  if (!worlds) return null;
  return (
    <section aria-label="Homeworld forces" className="space-y-4 p-4">
      <h3 className="font-serif text-xl">Homeworlds</h3>
      <p className="fine">
        Native forces here are your reserves. Salusa Secundus counts Sardaukar
        for its population.
      </p>
      <EcazPoisonIncome game={g} />
      <div className="grid gap-3 sm:grid-cols-2">
        {worlds.map((world) => {
          const card = HOMEWORLD_CARDS.find((c) => c.id === world.card)!;
          const owner = g.players.find((p) => p.id === world.native)!;
          return (
            <article
              key={world.id}
              className="min-w-0 rounded-lg border border-[#a88b60]/50 p-3"
              style={{ borderTop: `3px solid ${faction(owner.faction).color}` }}
            >
              <div className="flex flex-wrap justify-between gap-2">
                <strong>{card.name}</strong>
                <span className="capitalize">
                  {world.side} population · {world.population}
                </span>
              </div>
              <p className="fine">
                {faction(owner.faction).name} · {owner.name}
              </p>
              {Object.entries(world.forces).map(([id, forces]) => (
                <p key={id} className="text-base! leading-7!">
                  {id === world.native
                    ? 'Native reserves'
                    : g.players.find((p) => p.id === id)?.name}
                  : {forces.normal} normal
                  {forces.elite > 0
                    ? ` + ${forces.elite} ${owner.faction === 'emperor' && id === owner.id ? 'Sardaukar' : 'special'}`
                    : ''}
                </p>
              ))}
              <details>
                <summary className="cursor-pointer py-2">
                  {card.name} card
                </summary>
                <HomeworldFace card={card} />
              </details>
            </article>
          );
        })}
      </div>
    </section>
  );
}

/** The complementary Kaitain allocation is explicit in the submitted order. */
export function NativeShipmentChoice({
  game: g,
  amount,
  elite,
  sources,
  onChange,
  busy,
}: {
  game: GameView;
  amount: number;
  elite: number;
  sources: NativeReserveSelections | null;
  onChange: (sources: NativeReserveSelections) => void;
  busy: boolean;
}) {
  const homes = g.homeworlds?.worlds?.filter((w) => w.native === g.me);
  if (!homes || homes.length !== 2 || !sources) return null;
  const salusa = homes.find((w) => w.secondary)!;
  const kaitain = homes.find((w) => !w.secondary)!;
  const chosen = sources[salusa.id];
  const requested = { normal: amount - elite, elite };
  return (
    <fieldset
      disabled={busy}
      className="space-y-3 rounded-lg border border-[#a88b60]/50 p-3"
    >
      <legend>Shipment sources</legend>
      <p className="fine">
        Choose the counters leaving Salusa. The remainder leaves Kaitain in the
        same shipment.
      </p>
      {(['normal', 'elite'] as const).map((kind) => {
        const minimum = Math.max(
          0,
          requested[kind] - kaitain.forces[g.me][kind],
        );
        const maximum = Math.min(requested[kind], salusa.forces[g.me][kind]);
        return (
          <label key={kind} className="block space-y-1">
            <span>
              {kind === 'normal' ? 'Normal forces' : 'Sardaukar'} from Salusa (
              {minimum}–{maximum})
            </span>
            <Input
              type="number"
              min={minimum}
              max={maximum}
              step={1}
              value={chosen[kind]}
              onChange={(e) => {
                const count = Number(e.target.value);
                onChange({
                  ...sources,
                  [salusa.id]: { ...chosen, [kind]: count },
                  [kaitain.id]: {
                    ...sources[kaitain.id],
                    [kind]: requested[kind] - count,
                  },
                });
              }}
            />
          </label>
        );
      })}
      <p className="fine">
        Kaitain: {sources[kaitain.id].normal} normal +{' '}
        {sources[kaitain.id].elite} Sardaukar. Salusa: {chosen.normal} normal +{' '}
        {chosen.elite} Sardaukar.
      </p>
    </fieldset>
  );
}

export function EmperorHomeworldMovement({
  game: g,
  act,
  busy,
}: {
  game: GameView;
  act: (action: Action) => void;
  busy: boolean;
}) {
  const [origin, setOrigin] = useState('homeworld:emperor');
  const [normal, setNormal] = useState(0);
  const [elite, setElite] = useState(0);
  const option = g.homeworldMove;
  const homes = g.homeworlds?.worlds?.filter((w) => w.native === g.me);
  if (!option || !homes || homes.length !== 2) return null;
  const source = homes.find((w) => w.id === origin)!;
  const destination = homes.find((w) => w.id !== origin)!;
  const available = source.forces[g.me];
  const name = (id: string) =>
    id === 'homeworld:emperor' ? 'Kaitain' : 'Salusa Secundus';
  const invalid =
    !Number.isSafeInteger(normal) ||
    !Number.isSafeInteger(elite) ||
    normal < 0 ||
    elite < 0 ||
    normal > available.normal ||
    elite > available.elite ||
    normal + elite === 0;
  return (
    <details className="rounded-lg border border-[#a88b60]/50 p-3">
      <summary className="cursor-pointer py-2">
        Move between Imperial Homeworlds
      </summary>
      <p className="fine">
        Move normal forces or Sardaukar between Kaitain and Salusa Secundus.
        Costs one movement and no spice. Moving first passes your unused
        shipment.
      </p>
      {option.blocked && (
        <output className="notice block">{option.blocked}</output>
      )}
      <fieldset disabled={busy || !!option.blocked} className="space-y-3">
        <label className="block">
          From
          <select
            value={origin}
            onChange={(e) => {
              setOrigin(e.target.value);
              setNormal(0);
              setElite(0);
            }}
            className="w-full"
          >
            {homes.map((home) => (
              <option key={home.id} value={home.id}>
                {name(home.id)}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          Normal forces (0–{available.normal})
          <Input
            type="number"
            min={0}
            max={available.normal}
            step={1}
            value={normal}
            onChange={(e) => setNormal(Number(e.target.value))}
          />
        </label>
        <label className="block">
          Sardaukar (0–{available.elite})
          <Input
            type="number"
            min={0}
            max={available.elite}
            step={1}
            value={elite}
            onChange={(e) => setElite(Number(e.target.value))}
          />
        </label>
        <p className="fine">
          {option.remaining} movement{option.remaining === 1 ? '' : 's'}{' '}
          remaining.
        </p>
        <Button
          className="game-action"
          disabled={invalid || busy || !!option.blocked}
          onClick={() =>
            act({
              type: 'emperorHomeworldMove',
              event: option.event,
              origin,
              normal,
              elite,
            })
          }
        >
          Move to {name(destination.id)}
        </Button>
      </fieldset>
    </details>
  );
}
