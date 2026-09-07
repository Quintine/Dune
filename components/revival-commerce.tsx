'use client';
import { controlsLeader, nativeAvailable } from '@/game/leader-control';
import { useState } from 'react';
import type { Action, GameView } from '@/game/engine';
import { Button } from './ui/button';
import { Input } from './ui/input';
export function RevivalCommerce({
  game: g,
  act,
  busy,
}: {
  game: GameView;
  act: (action: Action) => void;
  busy: boolean;
}) {
  const me = g.players.find((p) => p.id === g.me)!;
  const tleilaxu = g.players.find((p) => p.faction === 'tleilaxu');
  const [selection, setSelection] = useState('');
  const [prices, setPrices] = useState<Record<string, number>>({});
  if (!tleilaxu) return null;
  const name = (id: string) =>
    id === 'kwisatz'
      ? 'Kwisatz Haderach'
      : (g.allLeaders.find((l) => l.id === id)?.name ?? id);
  if (me.id === tleilaxu.id)
    return (
      <div className="notice">
        <h3>Revival commerce</h3>
        <p>
          Allow another faction to revive five forces. Your ally pays for their
          own revivals; you may offer half price.
        </p>
        {g.advanced && (
          <div>
            <h4>Foreign gholas</h4>
            <p>
              Fill your active leader pool up to five. A ghola keeps its traitor
              identity and can be sold back only after it dies.
            </p>
            {g.players
              .filter((p) => p.id !== me.id)
              .flatMap((p) => p.leaders)
              .filter(
                (l) =>
                  l.faction !== me.faction &&
                  l.dead &&
                  !l.capturedBy &&
                  l.name !== 'Auditor',
              )
              .map((l) => {
                const cost = g.revival.discount
                  ? Math.ceil(l.strength / 2)
                  : l.strength;
                return (
                  <Button
                    key={l.id}
                    variant="outline"
                    disabled={
                      busy ||
                      cost > (me.spice ?? 0) ||
                      me.gholaBlocked?.includes(l.id) ||
                      me.leaders.filter(
                        (leader) => !leader.dead && controlsLeader(me, leader),
                      ).length >= 5
                    }
                    onClick={() =>
                      act({ type: 'reviveForeignGhola', leader: l.id })
                    }
                  >
                    Revive {l.name} as a ghola · {cost} spice
                  </Button>
                );
              })}
          </div>
        )}
        {g.players
          .filter((p) => p.id !== me.id)
          .map((p) => (
            <div key={p.id}>
              <span>
                {p.name} · {p.tanks} forces in the tanks{' '}
              </span>
              <Button
                variant="outline"
                disabled={
                  busy ||
                  g.revivalRules.limitBlocked ||
                  g.revivalRules.expanded.includes(p.id)
                }
                onClick={() =>
                  act({ type: 'tleilaxuRevivalLimit', target: p.id })
                }
              >
                Allow five revivals
              </Button>
            </div>
          ))}
        {me.ally && (
          <Button
            disabled={
              busy ||
              g.revivalRules.discountBlocked ||
              g.revivalRules.allyDiscount === me.ally
            }
            onClick={() => act({ type: 'tleilaxuAllyDiscount' })}
          >
            Offer ally half-price revival
          </Button>
        )}
        {Object.entries(g.revivalRequests).map(([id, request]) => (
          <div key={id}>
            <p>
              {g.players.find((p) => p.id === id)?.name} requests{' '}
              {name(request.leader)}.
            </p>
            <label htmlFor={`revival-price-${id}`}>
              Price in spice
              <Input
                id={`revival-price-${id}`}
                type="number"
                min={0}
                max={1000000}
                value={prices[id] ?? 0}
                onChange={(e) =>
                  setPrices({ ...prices, [id]: Number(e.target.value) })
                }
              />
            </label>
            <Button
              disabled={busy}
              onClick={() =>
                act({
                  type: 'quoteLeaderRevival',
                  target: id,
                  amount: prices[id] ?? 0,
                })
              }
            >
              Quote this price
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => act({ type: 'declineLeaderRevival', target: id })}
            >
              Decline request
            </Button>
            <p className="fine">
              {request.declined
                ? 'Declined'
                : request.price === null
                  ? 'No quote yet'
                  : `Current quote: ${request.price} spice`}
            </p>
          </div>
        ))}
      </div>
    );
  const request = g.revivalRequests[me.id];
  const deadNative = me.leaders.filter(
    (l) => l.faction === me.faction && l.dead && !l.capturedBy,
  );
  const hasNative = me.leaders.some(
    (l) => l.faction === me.faction && nativeAvailable(l),
  );
  const eligible = deadNative.filter((l) => hasNative || l.gholaBy);
  const canRequest =
    !g.revival.prevented &&
    !me.leaderRevived &&
    (hasNative || eligible.some((l) => l.gholaBy));
  return (
    <div className="notice">
      <h3>Request a leader revival or ghola buyback</h3>
      <p>
        A request and its quoted price are visible only to you and Tleilaxu. No
        spice is paid until you accept and the response resolves.
      </p>
      {request ? (
        <>
          <p>
            {name(request.leader)} ·{' '}
            {request.declined
              ? 'Request declined'
              : request.price === null
                ? 'Awaiting a quote'
                : `${request.price} spice`}
          </p>
          {request.price !== null && !request.declined && (
            <Button
              disabled={busy || request.price > (me.spice ?? 0)}
              onClick={() => act({ type: 'acceptLeaderRevival' })}
            >
              Accept revival price
            </Button>
          )}
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => act({ type: 'cancelLeaderRequest' })}
          >
            Withdraw request
          </Button>
        </>
      ) : canRequest && (eligible.length > 0 || me.kwisatz?.dead) ? (
        <>
          <label htmlFor="revival-request-leader">
            Leader
            <select
              id="revival-request-leader"
              value={selection}
              onChange={(e) => setSelection(e.target.value)}
            >
              <option value="">Choose a dead leader</option>
              {eligible.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                  {l.gholaBy ? ' · ghola buyback' : ''}
                </option>
              ))}
              {me.kwisatz?.dead && (
                <option value="kwisatz">Kwisatz Haderach</option>
              )}
            </select>
          </label>
          <Button
            disabled={busy || !selection}
            onClick={() =>
              act({ type: 'requestLeaderRevival', leader: selection })
            }
          >
            Request a quote
          </Button>
        </>
      ) : (
        <p className="fine">
          Early revival needs an available native leader. A dead foreign ghola
          requires a buyback agreement; other leaders use ordinary revival when
          all are unavailable.
        </p>
      )}
    </div>
  );
}
