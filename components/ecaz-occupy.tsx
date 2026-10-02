'use client';

import type { Action, GameView } from '@/game/engine';
import { ecazOccupyLeadOptions, ecazOccupyPlanControl } from '@/game/ecaz-occupy-options';
import { Button } from './ui/button';

export function EcazOccupyLeadChoice({ game, act, busy }: {
  game: GameView;
  act: (action: Action) => void;
  busy: boolean;
}) {
  const options = ecazOccupyLeadOptions(game);
  const occupy = game.battle?.ecazOccupy;
  if (!occupy || !options.length) return null;
  const ecaz = game.players.find((player) => player.id === occupy.ecaz)?.name ?? 'Ecaz';
  const ally = game.players.find((player) => player.id === occupy.ally)?.name ?? 'Ecaz’s ally';
  return <section aria-label="Ecaz combined-army lead" className="space-y-3">
    <p>
      {ecaz} chooses who forms the plan. The lead uses their own leaders,
      Treachery cards and spice. With Occupy active, {ally} supplies the variable
      dialed army regardless of who leads; Ecaz’s contribution is mandatory and free.
    </p>
    <p className="fine">
      Karama may cancel Occupy after this choice, before battle powers and plans.
      The chosen lead then dials only their own army; the other ally contributes zero.
    </p>
    {options.map((option) => <div key={option.lead}>
      <Button className="game-action min-h-11 whitespace-normal"
        disabled={busy || !!option.blocked}
        onClick={() => { if (!busy && !option.blocked) act(option.action); }}>
        {option.label} leads · their leaders, cards and spice
      </Button>
      {option.blocked && <p className="fine">{option.blocked}</p>}
    </div>)}
  </section>;
}

/** Public owner labels belong above the existing native plan/power editor. */
export function EcazOccupyBattleSummary({ game }: { game: GameView }) {
  const occupy = game.battle?.ecazOccupy;
  const profile = occupy?.profile;
  if (!occupy || !profile) return null;
  const lead = game.players.find((player) => player.id === profile.planOwner)?.name ?? profile.planOwner;
  const forceOwner = game.players.find((player) => player.id === profile.forceOwner)?.name ?? profile.forceOwner;
  const other = game.players.find((player) => player.id ===
    (profile.lead === profile.ecaz ? profile.ally : profile.ecaz))?.name ?? 'The other ally';
  return <section aria-label="Ecaz battle army and plan owners" className="notice space-y-2">
    <p><strong>{lead}</strong> forms the plan, chooses their leaders and cards, and pays any spice support.</p>
    {profile.canceled ? <p>
      Occupy canceled: {forceOwner} dials their own army. {other} contributes zero;
      there is no fixed Ecaz strength. Co-occupancy permission is unchanged.
    </p> : <p>
      The variable dial uses <strong>{forceOwner}’s army</strong>, including its native force properties.
      The total dial must include <strong>{profile.fixedEcazDial} fixed Ecaz strength</strong> at full strength,
      with no spice cost, plus the chosen variable army strength.
    </p>}
    {game.response?.kind === 'ecazOccupy' && <p className="fine">
      Allow this power to keep the combined army, or use an eligible Karama below.
      Cancellation keeps {lead} as lead and replaces the variable army with {lead}’s own forces before planning.
    </p>}
  </section>;
}

/** Render next to the native total wheel/support input, not a second plan editor. */
export function EcazOccupyDialExplanation({ game, dial, support }: {
  game: GameView;
  dial: number;
  support: number;
}) {
  const control = ecazOccupyPlanControl(game, dial, support);
  if (!control) return null;
  const forceOwner = game.players.find((player) => player.id === control.profile.forceOwner)?.name ?? control.profile.forceOwner;
  return <div aria-label="Ecaz total dial and payment" className="space-y-2">
    <p className="fine">
      Total dial {dial} = fixed Ecaz {control.fixedEcazDial} + {forceOwner}’s variable strength{' '}
      {control.variableDial ?? '—'}. Spice support applies only to the variable army.
      Your personal spice: {control.personalSpice}. Current legal support budget: {control.supportMaximum}.
    </p>
    {control.blocked && <output className="notice">{control.blocked}</output>}
  </div>;
}
