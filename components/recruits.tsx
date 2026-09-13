'use client';

import type { Action, GameView } from '@/game/engine';
import { recruitsPlayAction } from '@/game/recruits';
import { faction } from '@/game/catalog';
import { Button } from '@/components/ui/button';

export function Recruits({ game, act, busy }: {
  game: GameView;
  act: (action: Action) => void;
  busy: boolean;
}) {
  const offer = game.recruitsPreview;
  if (!offer || game.status !== 'playing' || game.phase !== 4 || (!offer.active && !offer.play))
    return null;
  const action = recruitsPlayAction(offer);
  return (
    <section className="m-4 space-y-3 rounded-xl border border-[#a88b60] p-4" aria-label="Recruits revival">
      <h3 className="font-serif text-xl">Recruits{offer.active ? ' · Active this turn' : ''}</h3>
      <p className="text-base leading-7">
        {offer.active
          ? 'Free revival rates are doubled for this turn. The ordinary force limit is seven; factions with unlimited revival keep that advantage.'
          : 'Play this card to double every faction’s free revival rate and raise the ordinary force limit to seven for this turn. Factions with unlimited revival keep that advantage.'}
      </p>
      <p className="fine">Already completed revivals still count. Paid forces retain their normal prices, and special-force revival limits still apply.</p>
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Current revival rates</caption>
        <thead><tr><th scope="col" className="pr-3">Faction</th><th scope="col" className="pr-3">Free rate</th><th scope="col">Force limit</th></tr></thead>
        <tbody>{offer.rates.map((rate) => (
          <tr key={rate.player}>
            <th scope="row" className="py-1 pr-3 font-normal">{faction(game.players.find((p) => p.id === rate.player)!.faction).name}</th>
            <td className="pr-3">{rate.freeRate}</td>
            <td>{rate.limit === 20 ? 'Unlimited' : rate.limit}</td>
          </tr>
        ))}</tbody>
      </table>
      {offer.play && (
        <>
          {offer.play.blocked && <p className="notice" id="recruits-unavailable">{offer.play.blocked}</p>}
          <Button className="min-h-11 whitespace-normal" disabled={busy || !action}
            aria-describedby={offer.play.blocked ? 'recruits-unavailable' : undefined}
            onClick={() => { if (!busy && action) act(action); }}>
            Play Recruits · Discard card
          </Button>
        </>
      )}
    </section>
  );
}
