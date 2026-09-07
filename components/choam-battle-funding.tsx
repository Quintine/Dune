'use client';
import { useState } from 'react';
import { HelpTip } from './help-tip';
import { Button } from '@/components/ui/button';
import type { Action, GameView } from '@/game/engine';
export function ChoamBattleFunding({
  game: g,
  act,
  busy,
}: {
  game: GameView;
  act: (a: Action) => void;
  busy: boolean;
}) {
  const me = g.players.find((p) => p.id === g.me)!;
  const [amount, setAmount] = useState(g.aid.pledged);
  const deciding = g.decision?.kind === 'choamBattleFunding';
  if (!g.advanced || g.phase !== 6 || !me.ally || me.faction !== 'choam')
    return null;
  return (
    <section className="notice">
      <h3>
        Fund your ally’s battle forces <HelpTip topic="choamCombat" />
      </h3>
      <p>
        Set aside spice for your ally’s combat support. Your ally chooses how
        much to use with each plan. Sealed payments stay reserved; unspent funds
        return at the end of Battle.
      </p>
      <p>Your current unspent pledge: {g.aid.pledged} spice.</p>
      {g.battle?.choamAidBlocked && (
        <p>
          Karama prevents using your funding in this battle. Your pledge remains
          available for later battles.
        </p>
      )}
      <label>
        New unspent pledge{' '}
        <input
          type="number"
          min={0}
          max={(me.spice ?? 0) + g.aid.pledged}
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
        />
      </label>
      <Button
        disabled={busy}
        onClick={() =>
          act({ type: deciding ? 'decision' : 'pledgeAid', amount })
        }
      >
        {deciding ? 'Confirm battle funding' : 'Update battle funding'}
      </Button>
      {deciding && (
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => act({ type: 'decision', amount: g.aid.pledged })}
        >
          Keep current pledge
        </Button>
      )}
    </section>
  );
}
