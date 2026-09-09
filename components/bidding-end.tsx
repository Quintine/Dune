'use client';

import { useState } from 'react';
import type { Action, GameView } from '@/game/engine';
import {
  biddingEndCanAct,
  biddingEndDiscardChoice,
} from '@/game/bidding-end-options';
import { Button } from '@/components/ui/button';
import { CardInspector } from './card-inspector';

export function BiddingEnd({
  game,
  act,
  busy,
}: {
  game: GameView;
  act: (action: Action) => void;
  busy: boolean;
}) {
  if (!game.biddingEnd) return null;
  return (
    <BiddingEndChoice
      key={game.biddingEnd.event}
      game={game}
      act={act}
      busy={busy}
    />
  );
}

function BiddingEndChoice({
  game: g,
  act,
  busy,
}: {
  game: GameView;
  act: (action: Action) => void;
  busy: boolean;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const end = g.biddingEnd!;
  const me = g.players.find((p) => p.id === g.me)!;
  const canAct = biddingEndCanAct(g);
  const heldSelection = selected.filter((id) =>
    me.hand?.some((card) => card.id === id),
  );
  const choice = biddingEndDiscardChoice(g, heldSelection);
  const market = g.choamMarket?.owner === g.me ? g.choamMarket : null;
  const kaitain = end.kaitain?.owner === g.me;
  const send = (action: Action) =>
    act({ ...action, type: 'biddingEnd', event: end.event });
  return (
    <section aria-label="End of Bidding" className="space-y-3">
      <h3>End of Bidding</h3>
      <p className="fine">
        Optional card actions remain available until everyone below is ready. A
        new action clears readiness so the table can respond to the change.
      </p>
      <ul className="fine">
        {end.owners.map((id) => (
          <li key={id}>
            {g.players.find((p) => p.id === id)?.name}:{' '}
            {end.ready.includes(id) ? 'Ready' : 'Choosing'}
          </li>
        ))}
      </ul>
      {kaitain && (
        <>
          <h3>Kaitain paid discards</h3>
          <p>
            Pay 2 spice per chosen Treachery Card. Discarding a card does not
            play its effect.
          </p>
          {!end.kaitain!.eligible && (
            <p className="fine">
              Kaitain must have high population to use paid discards.
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {me.hand?.map((card) => (
              <div
                key={card.id}
                className="min-w-0 space-y-2 rounded-lg border border-[#414536] p-3"
              >
                <label className="flex min-h-11 items-center gap-2">
                  <input
                    type="checkbox"
                    aria-label={`Discard ${card.name} for 2 spice`}
                    checked={heldSelection.includes(card.id)}
                    disabled={busy || !canAct || !end.kaitain!.eligible}
                    onChange={(event) =>
                      setSelected((old) =>
                        event.target.checked
                          ? [...old.filter((id) => id !== card.id), card.id]
                          : old.filter((id) => id !== card.id),
                      )
                    }
                  />
                  <span>{card.name}</span>
                </label>
                <CardInspector card={card} />
              </div>
            ))}
          </div>
          <p aria-live="polite">
            {heldSelection.length} selected · {choice.cost} spice · You have{' '}
            {me.spice ?? 0} spice.
          </p>
          {choice.blocked && <p className="fine">{choice.blocked}</p>}
          <Button
            className="game-action"
            disabled={busy || !choice.action}
            onClick={() => {
              if (choice.action) {
                setSelected([]);
                act(choice.action);
              }
            }}
          >
            Pay {choice.cost} spice and discard {heldSelection.length}{' '}
            {heldSelection.length === 1 ? 'card' : 'cards'}
          </Button>
        </>
      )}
      {market && (
        <>
          <h3>CHOAM card market</h3>
          <p className="fine">
            Sales reveal the card and give the table a Karama response. Trade
            offers stay private to you and your ally.
          </p>
          {market.worthlessSaleBlocked && (
            <p className="fine">{market.worthlessSaleBlocked}</p>
          )}
          {market.sales?.map((sale) => (
            <Button
              className="game-action"
              key={`${sale.card}-${sale.price}`}
              disabled={busy || !canAct}
              onClick={() =>
                send({
                  type: 'biddingEnd',
                  mode: 'sell',
                  card: sale.card,
                  witness: sale.witness,
                })
              }
            >
              Sell {sale.witness ? 'surplus ' : ''}
              {me.hand?.find((card) => card.id === sale.card)?.name} ·{' '}
              {sale.price} spice
            </Button>
          ))}
          {!market.sales?.length && (
            <p className="fine">No eligible sales remain this phase.</p>
          )}
          {market.canTrade && (
            <>
              <h3>Offer your ally a card</h3>
              {me.hand?.map((card) => (
                <div key={card.id} className="space-y-2">
                  <Button
                    className="game-action"
                    variant="outline"
                    disabled={busy || !canAct}
                    onClick={() =>
                      send({ type: 'biddingEnd', mode: 'trade', card: card.id })
                    }
                  >
                    Offer {card.name}
                  </Button>
                  <CardInspector card={card} />
                </div>
              ))}
            </>
          )}
        </>
      )}
      {end.owners.includes(g.me) && (
        <Button
          className="game-action"
          disabled={busy || !canAct || end.ready.includes(g.me)}
          onClick={() => send({ type: 'biddingEnd', mode: 'ready' })}
        >
          {end.ready.includes(g.me)
            ? 'Ready for Revival'
            : 'Ready for Revival — finish card actions'}
        </Button>
      )}
    </section>
  );
}
