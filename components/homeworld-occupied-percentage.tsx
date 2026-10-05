'use client';

import { useState } from 'react';
import type { Action, GameView } from '@/game/engine';
import { homeworldCard } from '@/game/homeworld-cards';
import { HomeworldFace } from './homeworld-cards';
import { Button } from './ui/button';
import { Input } from './ui/input';

type Props = { game: GameView; act: (action: Action) => void; busy: boolean };
type Offer = NonNullable<GameView['homeworldOccupiedPercentage']>;

export function HomeworldOccupiedPercentage({ game, act, busy }: Props) {
  const offer = game.homeworldOccupiedPercentage;
  if (!offer) return null;
  const authorized = game.decision?.kind === 'homeworldOccupiedPercentage' &&
    game.decision.player === game.me && game.decision.event === offer.event && offer.owner === game.me;
  if (!authorized && !offer.blocked) return null;
  return <PercentageChoice key={offer.event} offer={offer} game={game} act={act} busy={busy || !authorized} />;
}

function PercentageChoice({ offer, game, act, busy }: Props & { offer: Offer }) {
  const [ownAmount, setOwnAmount] = useState(offer.maxOwnAmount);
  const valid = Number.isSafeInteger(ownAmount) && ownAmount >= offer.minOwnAmount && ownAmount <= offer.maxOwnAmount;
  const source = game.homeworlds?.worlds?.find((world) => world.id === offer.world);
  const card = source ? homeworldCard(source.card) : undefined;
  return (
    <section aria-label="Occupied Homeworld percentage income" className="space-y-3">
      <h3>{offer.name} · occupied percentage income</h3>
      <p>
        Allocate {offer.amount} spice from the actual completed payment or Collection income.
        {offer.allyName ? ` Keep it or immediately share any portion with ${offer.allyName}.` : ' You have no reciprocal ally to share with.'}
      </p>
      <p className="fine">
        This is the actual occupied portion, not a printed Bank icon award or a bribe from your personal spice.
        The printed Homeworld effect cannot be canceled by Karama; ordinary native advantages remain separate.
      </p>
      <p className="notice">
        Development preview · Advanced occupation benefits are retained until your last occupying force leaves. Basic lifecycle and unresolved competing-owner cases remain guarded. Not complete or certified Homeworld rules.
      </p>
      {card && (
        <details className="rounded-lg border border-[#a88b60]/50 p-3">
          <summary className="cursor-pointer py-2">Inspect {offer.name} source card</summary>
          <HomeworldFace card={card} />
        </details>
      )}
      {offer.blocked ? <output className="notice block">{offer.blocked}</output> : (
        <form className="space-y-3" onSubmit={(event) => {
          event.preventDefault();
          if (!busy && valid) act({ type: 'decision', event: offer.event, ownAmount });
        }}>
          {offer.ally && (
            <>
              <label className="block space-y-1">
                <span>Spice to keep · {offer.minOwnAmount}–{offer.maxOwnAmount}</span>
                <Input aria-label="Occupied percentage spice to keep" type="number"
                  min={offer.minOwnAmount} max={offer.maxOwnAmount} step={1}
                  value={Number.isNaN(ownAmount) ? '' : ownAmount} disabled={busy}
                  onChange={(event) => setOwnAmount(event.target.value === '' ? Number.NaN : Number(event.target.value))} />
              </label>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" disabled={busy || offer.amount < offer.minOwnAmount || offer.amount > offer.maxOwnAmount}
                  onClick={() => setOwnAmount(offer.amount)}>Keep all</Button>
                <Button type="button" variant="outline" disabled={busy || offer.minOwnAmount > 0}
                  onClick={() => setOwnAmount(0)}>Give all to {offer.allyName}</Button>
              </div>
            </>
          )}
          <output className="notice block" aria-live="polite">
            {valid
              ? `Credits: ${offer.ownerName} ${ownAmount}${offer.allyName ? ` · ${offer.allyName} ${offer.amount - ownAmount}` : ''}. Total ${offer.amount}.`
              : `Keep a whole number from ${offer.minOwnAmount} through ${offer.maxOwnAmount}.`}
          </output>
          <Button type="submit" className="game-action" disabled={busy || !valid}>Settle {offer.name} percentage income</Button>
        </form>
      )}
    </section>
  );
}
