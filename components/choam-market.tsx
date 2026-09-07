'use client';
import type { Action, GameView } from '@/game/engine';
import { Button } from '@/components/ui/button';
export function ChoamMarket({
  game: g,
  act,
  busy,
}: {
  game: GameView;
  act: (action: Action) => void;
  busy: boolean;
}) {
  const me = g.players.find((p) => p.id === g.me)!;
  const market = g.choamMarket!;
  if (g.decision?.kind === 'choamTradeReply')
    return (
      <>
        <p>
          CHOAM offers{' '}
          <strong>
            {market.offered?.name ?? 'a card no longer available'}
          </strong>
          . Choose one card to return. CHOAM will confirm before either hand
          changes.
        </p>
        {me.hand?.map((c) => (
          <Button
            className="game-action"
            key={c.id}
            disabled={busy || !market.offered}
            onClick={() => act({ type: 'decision', card: c.id })}
          >
            Return {c.name}
          </Button>
        ))}
        <Button
          className="game-action"
          variant="outline"
          disabled={busy}
          onClick={() => act({ type: 'decision', decline: true })}
        >
          Decline trade
        </Button>
      </>
    );
  if (g.decision?.kind === 'choamTradeConfirm')
    return (
      <>
        <p>
          Give <strong>{market.offered?.name ?? 'an unavailable card'}</strong>{' '}
          and receive{' '}
          <strong>{market.returned?.name ?? 'an unavailable card'}</strong>.
          Both cards move together. This uses your one trade for the turn.
        </p>
        <Button
          className="game-action"
          disabled={busy || !market.offered || !market.returned}
          onClick={() => act({ type: 'decision', accept: true })}
        >
          Confirm exchange
        </Button>
        <Button
          className="game-action"
          variant="outline"
          disabled={busy}
          onClick={() => act({ type: 'decision', decline: true })}
        >
          Decline trade
        </Button>
      </>
    );
  return (
    <>
      <p>
        The phase is ending. Sell a Worthless card for two spice or a surplus
        exact duplicate for three. A sale reveals the card and gives the table a
        Karama response.
      </p>
      {market.sales?.map((sale) => (
        <Button
          className="game-action"
          key={`${sale.card}-${sale.price}`}
          disabled={busy}
          onClick={() =>
            act({
              type: 'decision',
              mode: 'sell',
              card: sale.card,
              witness: sale.witness,
            })
          }
        >
          Sell {sale.witness ? 'surplus ' : ''}
          {me.hand?.find((c) => c.id === sale.card)?.name} · {sale.price} spice
        </Button>
      ))}
      {!market.sales?.length && (
        <p className="fine">No eligible sales remain this phase.</p>
      )}
      {market.canTrade && (
        <>
          <h3>Offer your ally a card</h3>
          <p className="fine">
            Your ally chooses a return card; you confirm the exchange. Offers
            stay private to the two of you.
          </p>
          {me.hand?.map((c) => (
            <Button
              className="game-action"
              variant="outline"
              key={c.id}
              disabled={busy}
              onClick={() =>
                act({ type: 'decision', mode: 'trade', card: c.id })
              }
            >
              Offer {c.name}
            </Button>
          ))}
        </>
      )}
      <Button
        className="game-action"
        disabled={busy}
        onClick={() => act({ type: 'decision', done: true })}
      >
        Finish this phase
      </Button>
    </>
  );
}
