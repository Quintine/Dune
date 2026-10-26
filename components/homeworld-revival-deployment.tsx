'use client';

import { useState } from 'react';
import type { Action, GameView } from '@/game/engine';
import {
  homeworldRevivalDeploymentCanAct,
  homeworldRevivalDeploymentChoice,
  homeworldRevivalDeploymentQuantities,
} from '@/game/homeworld-revival-deployment-options';
import { Button } from './ui/button';

type Props = {
  game: GameView;
  act: (action: Action) => void;
  busy: boolean;
};

export function HomeworldRevivalDeployment({ game, act, busy }: Props) {
  if (
    !game.homeworldRevivalDeployment ||
    game.homeworldRevivalDeployment.player !== game.me ||
    game.decision?.kind !== 'homeworldRevivalDeployment' ||
    game.decision.player !== game.me
  )
    return null;
  return (
    <DeploymentChoice
      key={game.homeworldRevivalDeployment.event}
      game={game}
      act={act}
      busy={busy}
    />
  );
}

function DeploymentChoice({ game, act, busy }: Props) {
  const offer = game.homeworldRevivalDeployment!;
  const [destination, setDestination] = useState(
    offer.destinations.find((target) => !target.blocked)?.id ?? '',
  );
  const [amount, setAmount] = useState(offer.allocation !== undefined ? 1 : offer.normal + offer.elite);
  const canAct = homeworldRevivalDeploymentCanAct(game);
  const quantities = homeworldRevivalDeploymentQuantities(game);
  const choice = homeworldRevivalDeploymentChoice(game, destination, amount);
  const allocation = offer.allocation;
  return (
    <section aria-label="Revival deployment" className="space-y-3">
      <h3>
        {offer.kind === 'fedaykin'
          ? 'Place revived Fedaykin'
          : 'Place revived forces'}
      </h3>
      {allocation !== undefined ? <>
        <p>Choose how many remaining starred forces to place now. After this placement&apos;s native arrival effects finish,
          you may place another portion at a different legal destination, or leave all remaining stars in reserves.
          The eligible batch is fixed by this one original revival.</p>
        <p className="notice">Provisional per-star interpretation: Southern&apos;s face says &ldquo;forces&rdquo;;
          the individual allocation has no publisher clarification.</p>
        {allocation && <p className="fine" aria-label="Southern revival allocation">
          {allocation.remaining} starred remaining of {allocation.total} · {allocation.placed} placed · {allocation.kept} kept in reserves
        </p>}
      </> : <p>
        Place the entire eligible revived group in one destination, or leave it
        in reserves.
      </p>}
      <p className="fine">
        {offer.normal} ordinary · {offer.elite} starred · {offer.normal + offer.elite} total
      </p>
      <p className="fine">
        {offer.kind === 'fedaykin'
          ? 'Southern placement uses a sector outside the storm.'
          : 'Tleilax placement keeps the storm restriction.'}
        {game.players.some(player => player.faction === 'ixians') && (offer.kind === 'fedaykin'
          ? ' It does not grant the Force Movement route needed to enter the Hidden Mobile Stronghold.'
          : ' It does not grant the Ixian route directly into the Hidden Mobile Stronghold.')}
      </p>
      {game.players.some(player => player.faction === 'beneGesserit') && <p className="fine">
        {offer.kind === 'tleilax'
          ? 'Arrakis placement is followed by the normal Bene Gesserit free-force choice.'
          : 'In Advanced play, entry into Bene Gesserit fighters permits Intrusion.'}
        {' '}The revived group is already placed before those responses. Preventing
        a Bene Gesserit power does not undo your revival or use your ordinary shipment.
      </p>}
      {game.players.some(player => player.faction === 'moritani') && <p className="fine">
        Entry into an eligible Terror territory gives Moritani its normal choice
        after the group is placed. Your original revival waits for that effect
        and any Ambassador reaction; no ordinary shipment is used.
      </p>}
      <label className="block space-y-1">
        <span>Revival destination</span>
        <select
          aria-label="Revival destination"
          className="w-full"
          value={destination}
          disabled={busy || !canAct || !!offer.blocked}
          onChange={(event) => setDestination(event.target.value)}
        >
          {!offer.destinations.some((target) => !target.blocked) && (
            <option value="">No legal revival destination</option>
          )}
          {offer.destinations.map((target) => (
            <option
              key={target.id}
              value={target.id}
              disabled={!!target.blocked}
            >
              {target.name}
              {target.blocked ? ` — ${target.blocked}` : ''}
            </option>
          ))}
        </select>
      </label>
      {allocation !== undefined && <label className="block space-y-1">
        <span>Starred forces to place now</span>
        <select aria-label="Starred forces to place now" className="w-full" value={amount}
          disabled={busy || !canAct || quantities.length === 0} onChange={event => {
            const next = Number(event.target.value);
            if (quantities.includes(next)) setAmount(next);
          }}>
          {quantities.length === 0 && <option value="">No current placement quantity</option>}
          {quantities.map(quantity => <option key={quantity} value={quantity}>{quantity}</option>)}
        </select>
      </label>}
      {choice.blocked && (
        <p className="fine" aria-live="polite">
          {choice.blocked}
        </p>
      )}
      <HomeworldRevivalDeploymentButtons game={game} act={act} busy={busy} destination={destination} amount={amount} />
    </section>
  );
}

/** Submit the current native choice only; the engine owns arrival and allocation. */
export function HomeworldRevivalDeploymentButtons(props: Props & { destination: string; amount: number }) {
  const { game, destination, amount } = props;
  const offer = game.homeworldRevivalDeployment, event = offer?.event, actor = game.me, act = props.act;
  const signature = JSON.stringify(offer);
  const current = () => !props.busy && props.game === game && props.act === act && game.me === actor &&
    !!offer && game.homeworldRevivalDeployment === offer && offer.event === event && JSON.stringify(offer) === signature &&
    homeworldRevivalDeploymentCanAct(game);
  const choice = homeworldRevivalDeploymentChoice(game, destination, amount);
  return <div className="flex flex-wrap gap-2">
        <Button
          className="game-action"
          data-revival-deployment-action="place"
          disabled={!current() || !choice.action}
          onClick={() => {
            if (!current()) return;
            const fresh = homeworldRevivalDeploymentChoice(game, destination, amount);
            if (fresh.action) props.act(fresh.action);
          }}
        >
          Place {amount} revived {amount === 1 ? 'force' : 'forces'}
        </Button>
        <Button
          className="game-action"
          data-revival-deployment-action="reserves"
          variant="outline"
          disabled={!current()}
          onClick={() => { if (current()) props.act({ type: 'decision', event, decline: true }); }}
        >
          {offer?.allocation !== undefined ? 'Leave all remaining in reserves' : 'Leave in reserves'}
        </Button>
      </div>;
}
