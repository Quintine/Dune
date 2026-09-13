'use client';

import { useState } from 'react';
import type { Action, GameView } from '@/game/engine';
import { territory } from '@/game/board';
import { DISCOVERY_TOKEN_BY_ID, type DiscoveryTokenFace } from '@/game/discoveries';
import { discoveryAction, discoveryDiscardAction } from '@/game/discovery-options';
import { CardInspector } from './card-inspector';
import { Button } from './ui/button';

type Props = { game: GameView; act: (action: Action) => void; busy: boolean };

/** Authored gameplay guidance from the component contract, never hidden state. */
const tokenRules: Record<DiscoveryTokenFace, string> = {
  'jacurutu-sietch': 'Jacurutu Sietch counts as a normal stronghold. After winning a battle here, receive one spice for each opposing undialed force sent to the Tanks.',
  cistern: 'During Spice Collection, an occupant of Cistern receives two spice from the bank.',
  'ecological-testing-station': 'An occupant may increase or decrease storm movement by one during the Storm phase. This ability does not change movement set by Weather Control.',
  shrine: 'An occupant of Shrine may use a Truthtrance card as Karama, or a Karama card as Truthtrance.',
  'orgiz-processing-station': 'During Spice Collection, an occupant takes one spice from each spice blow that is collected.',
  'treachery-card-stash': 'Receive one Treachery Card, then remove this token. If your hand is already full, take the new card first and then choose any card in your hand to discard, including the new card.',
  'spice-stash': 'Receive seven spice from the bank, then remove this token.',
  ornithopter: 'Take this token. On a later turn, you may spend it to move up to three territories instead of your usual allowance for one movement action. Remove the token after that action.',
};

function DiscoveryRules({ face }: { face: DiscoveryTokenFace }) {
  const definition = DISCOVERY_TOKEN_BY_ID[face];
  return (
    <details className="rounded-lg border border-[#a88b60]/40 bg-[#171d18]">
      <summary className="min-h-11 cursor-pointer px-3 py-3 font-semibold text-[#efd9a8] focus-visible:outline-2 focus-visible:outline-offset-2">
        Read {definition.name} rules
      </summary>
      <div className="space-y-3 border-t border-[#a88b60]/40 px-3 py-4 text-base leading-7 text-[#eee5d2]">
        <p>{tokenRules[face]}</p>
        {definition.kind === 'location' && (
          <>
            <p>This location is a separate territory inside the surrounding territory. Revealing it leaves it empty. Normal ground movement enters the surrounding territory before entering the location; shipment uses stronghold prices.</p>
            <p>At most two factions may occupy the location. Forces inside are protected from storms and sandworms.</p>
            <p>At the start of the turn after this location is revealed, before the storm and the mobile stronghold move, factions in the surrounding territory may move some or all of their non-advisor forces inside.</p>
          </>
        )}
      </div>
    </details>
  );
}

export function DiscoveryPanel({ game, act, busy }: Props) {
  const offer = game.discoveries;
  if (!offer) return null;
  const disabled = busy || !!game.players.find(player => player.id === game.me)?.autopilot;
  return (
    <section aria-label="Discovery tokens" className="space-y-4 rounded-lg border border-[#a88b60]/50 p-3">
      <div>
        <h3>Discoveries</h3>
        <p className="fine">{offer.supplyCount} tokens remain in the supply.</p>
        <p>During Spice Collection, non-advisor forces in a token’s surrounding territory can inspect it privately and choose whether to reveal it. Fremen can always see placed Hiereg faces; the Guild can always see placed Smuggler faces.</p>
      </div>
      {offer.blocked && <p className="notice">{offer.blocked}</p>}
      {!offer.tokens.length && <p>No Discovery tokens have been placed.</p>}
      <div className="grid items-start gap-3 lg:grid-cols-2">
        {offer.tokens.map(token => {
          const definition = token.face ? DISCOVERY_TOKEN_BY_ID[token.face] : null;
          const typeName = token.type === 'hiereg' ? 'Hiereg' : 'Smuggler';
          const name = definition?.name ?? `${typeName} discovery`;
          const inspect = discoveryAction(game, token.id, false);
          const reveal = discoveryAction(game, token.id, true);
          const owner = game.players.find(player => player.id === token.owner);
          const status = token.status === 'removed' ? 'Resolved and removed' : token.status === 'carried'
            ? `Carried by ${token.owner === game.me ? 'you' : owner?.name ?? 'another faction'}`
            : token.revealedTurn === null ? token.face ? 'Face down · known to you' : 'Face down · unknown to you'
              : `Revealed on turn ${token.revealedTurn}`;
          return (
            <article key={token.id} aria-label={name} className="min-w-0 space-y-3 rounded-xl border border-[#a88b60]/50 bg-[#20271f] p-4 text-[#f2e8d3]">
              <div className="flex items-start gap-3">
                <div aria-hidden="true" className="flex size-14 shrink-0 items-center justify-center rounded-full border-2 border-[#a88b60] bg-[#171d18] font-serif text-2xl text-[#ddbc77]">{token.face ? '◇' : '?'}</div>
                <div className="min-w-0">
                  <p className="fine m-0">{typeName} token</p>
                  <h4 className="m-0 break-words font-serif text-xl">{name}</h4>
                  <p className="fine m-0">{status}</p>
                </div>
              </div>
              {token.territory && <p>In {territory(token.territory).name} · sector {token.sector}</p>}
              {token.face && <DiscoveryRules face={token.face} />}
              {(inspect || reveal) && (
                <div className="flex flex-wrap gap-2">
                  {inspect && <Button className="game-action min-h-11 whitespace-normal" disabled={disabled}
                    onClick={() => { if (!disabled) act(inspect); }}>Inspect {typeName} token privately</Button>}
                  {reveal && <Button className="game-action min-h-11 whitespace-normal" disabled={disabled}
                    onClick={() => { if (!disabled) act(reveal); }}>Reveal {name} to everyone</Button>}
                </div>
              )}
            </article>
          );
        })}
      </div>
      <p className="fine">Inspection and reveal are optional. Location abilities, next-turn free entry and Ornithopter use are still in development.</p>
    </section>
  );
}

export function DiscoveryDiscardDecision({ game, act, busy }: Props) {
  const [selected, select] = useState('');
  const decision = game.decision;
  if (decision?.kind !== 'discoveryDiscard' || decision.player !== game.me) return null;
  const me = game.players.find(player => player.id === game.me);
  const hand = me?.hand ?? [];
  const card = hand.find(held => held.id === selected) ?? hand.find(held => held.kind === 'worthless') ?? hand[0];
  const action = card ? discoveryDiscardAction(game, card.id) : null;
  const disabled = busy || !!me?.autopilot;
  return (
    <section aria-label="Discovery stash card discard" className="space-y-3 rounded-lg border border-[#a88b60]/50 p-3">
      <h3>Treachery Card Stash · choose a discard</h3>
      <p>The new card is already in your hand. Choose any one of your cards to discard, including the card you just received.</p>
      <label className="block space-y-1">
        <span>Card to discard</span>
        <select className="min-h-11 w-full" value={card?.id ?? ''} disabled={disabled || !action}
          onChange={event => select(event.target.value)}>
          {hand.map(held => <option key={held.id} value={held.id}>{held.name}</option>)}
        </select>
      </label>
      {card && <CardInspector card={card} />}
      <Button className="game-action min-h-11 whitespace-normal" disabled={disabled || !action}
        onClick={() => { if (!disabled && action) act(action); }}>Discard {card?.name ?? 'a card'}</Button>
    </section>
  );
}
