'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { faction, type FactionId } from '@/game/catalog';
import type { Action, GameView, PlanField } from '@/game/engine';
import { HOMEWORLD_CARDS } from '@/game/homeworld-cards';
import { nexusCardMode, type NexusCardMode } from '@/game/nexus-cards';
import type { NexusCardChoice } from '@/game/nexus-card-phase';
import { nexusCardAction } from '@/game/nexus-card-options';
import { NEXUS_CARD_REFERENCE, NEXUS_PANEL_NAMES, nexusCardReference } from '@/game/nexus-card-reference';
import { Button } from './ui/button';
import { Dialog, DialogClose, DialogDescription, DialogOverlay, DialogPortal, DialogTitle, DialogTrigger } from './ui/dialog';

const panels: NexusCardMode[] = ['betrayal', 'cunning', 'secretAlly'];

/** Only an authorized projected card may be passed as a private held card. */
export function NexusCardFace({ card, mode, enlarged = false }: {
  card: FactionId; mode?: NexusCardMode; enlarged?: boolean;
}) {
  const identity = faction(card);
  const reference = nexusCardReference(card);
  const world = HOMEWORLD_CARDS.find((candidate) => candidate.faction === card)!;
  return (
    <article aria-label={`${identity.name} Nexus card`} className="min-w-0 overflow-hidden rounded-xl border border-[#a88b60] bg-[#20271f] text-[#f2e8d3] shadow-lg">
      <header className="px-4 py-3" style={{ borderTop: `4px solid ${identity.color}` }}>
        <p className="m-0 text-xs uppercase tracking-widest">Nexus card</p>
        <h3 className="m-0 break-words font-serif text-2xl">{identity.name}</h3>
      </header>
      <Image src={`/art/homeworlds/${world.id}-v1.png`} alt="" width={1536} height={768} unoptimized loading="lazy" className="block max-h-32 w-full object-cover" />
      <div className="divide-y divide-[#a88b60]/40 px-4">
        {panels.map((panel) => (
          <section key={panel} aria-label={NEXUS_PANEL_NAMES[panel]} className="space-y-1 py-3">
            <h4 className="m-0 flex flex-wrap items-center gap-2 font-serif text-lg">
              {NEXUS_PANEL_NAMES[panel]}
              {mode === panel && <span className="rounded border border-[#e4c887] px-2 py-0.5 font-sans text-xs text-[#ffe5a8]">Your applicable mode</span>}
            </h4>
            <p className="m-0 text-xs text-[#c9baa0]">
              {panel === 'cunning' ? `${identity.name} player only` : panel === 'betrayal' ? `Another player controls ${identity.name}` : `${identity.name} is not in this game`}
            </p>
            <p className={enlarged ? 'm-0 text-xl! leading-8!' : 'm-0 text-base! leading-7!'}>{reference[panel]}</p>
          </section>
        ))}
      </div>
      {!enlarged && (
        <div className="px-4 pb-4">
          <Dialog>
            <DialogTrigger render={<Button variant="outline" className="min-h-11 w-full whitespace-normal" />} aria-label={`Inspect ${identity.name} Nexus card`}>
              Inspect card
            </DialogTrigger>
            <DialogPortal>
              <DialogOverlay className="bg-black/75 motion-reduce:animate-none" />
              <DialogPrimitive.Popup className="fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-[#a88b60] bg-[#171d18] text-[#f2e8d3] shadow-2xl outline-none motion-reduce:animate-none">
                <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#a88b60]/40 px-4 py-3">
                  <DialogTitle>{identity.name} Nexus card</DialogTitle>
                  <DialogClose render={<Button variant="outline" className="min-h-11 min-w-16" />}>Close</DialogClose>
                </div>
                <DialogDescription className="sr-only">All three Nexus effects and their faction requirements. Atreides actions appear when available; other card effects are not playable yet.</DialogDescription>
                <div className="min-h-0 overflow-y-auto overscroll-contain p-3 sm:p-5"><NexusCardFace card={card} mode={mode} enlarged /></div>
              </DialogPrimitive.Popup>
            </DialogPortal>
          </Dialog>
        </div>
      )}
      <footer className="border-t border-[#a88b60]/40 px-4 py-2 text-xs text-[#c9baa0]">Ecaz &amp; Moritani · Original Nexus effects</footer>
    </article>
  );
}

export function NexusCardGallery() {
  return <div aria-label="All twelve Nexus cards" className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">{NEXUS_CARD_REFERENCE.map((card) => <NexusCardFace key={card.faction} card={card.faction} />)}</div>;
}

/** The server supplies current choices. The client binds the exact offered
 * turn and held identity; it neither infers an opponent's card nor draws one. */
export function nexusCardChoiceAction(game: GameView, choice: NexusCardChoice, ownRedraws: 0 | 1 | 2 = 0): Action | null {
  const offer = game.nexusCards;
  if (!offer || game.status !== 'playing' || game.phase !== 1 || offer.turn !== game.turn ||
      !offer.waiting.includes(game.me) || !offer.choices.includes(choice) || ![0, 1, 2].includes(ownRedraws)) return null;
  const owner = game.players.find((player) => player.id === game.me);
  if (!owner || (choice === 'draw' && offer.card !== null) ||
      (choice === 'replace' && offer.card === null)) return null;
  return nexusCardAction(game, choice, ownRedraws);
}

/** The server's private offer defines current fields and timing; no other
 * player's hand or sealed plan participates in client eligibility. */
export function nexusAtreidesAction(game: GameView, field?: PlanField): Action | null {
  const offer = game.nexusAtreides;
  if (!offer || offer.blocked || game.status !== 'playing' || game.phase !== 6 ||
    game.nexusCards?.card !== 'atreides') return null;
  const owner = game.players.find((player) => player.id === game.me);
  if (!owner || nexusCardMode('atreides', owner.faction, game.players.map((player) => player.faction)) !== offer.mode) return null;
  const battle = game.battle;
  if (!battle || battle.event !== offer.event || battle.revealed) return null;
  if (offer.mode === 'betrayal')
    return field === undefined ? { type: 'nexusAtreides', event: offer.event, mode: offer.mode } : null;
  if (!field || !offer.fields.includes(field) || ![battle.attacker, battle.defender].includes(game.me) || battle.submitted.includes(game.me)) return null;
  return { type: 'nexusAtreides', event: offer.event, mode: offer.mode, field };
}

export function NexusCards({ game, act, busy }: { game: GameView; act: (action: Action) => void; busy: boolean }) {
  const [ownRedraws, setOwnRedraws] = useState<0 | 1 | 2>(0);
  const offer = game.nexusCards;
  if (!offer) return null;
  const owner = game.players.find((player) => player.id === game.me);
  if (!owner) return null;
  const mode = offer.card ? nexusCardMode(offer.card, owner.faction, game.players.map((player) => player.faction)) : undefined;
  const labels: Record<NexusCardChoice, string> = {
    draw: 'Draw a Nexus card', replace: 'Discard and replace',
    keep: offer.card ? 'Keep this card' : 'Skip this draw',
  };
  const waiting = offer.waiting.filter((id) => id !== game.me)
    .map((id) => game.players.find((player) => player.id === id)?.name).filter(Boolean);
  return (
    <section aria-label="Nexus cards" className="space-y-4 rounded-lg border border-[#a88b60]/50 p-3">
      <div>
        <h3>Nexus cards</h3>
        <p className="fine">{offer.deckCount} in deck · {offer.discardCount} discarded · {Object.values(offer.held).filter((held) => held === true).length} held</p>
        <p>Atreides Nexus actions are available at their battle timing; other card effects are not playable yet.</p>
      </div>
      {game.nexusAtreides && offer.card === 'atreides' && (
        <div aria-label="Atreides Nexus effect" className="space-y-2">
          <h4>{NEXUS_PANEL_NAMES[game.nexusAtreides.mode]}</h4>
          {game.nexusAtreides.blocked ? <p className="fine">{game.nexusAtreides.blocked}</p> : (
            <>
              <p className="fine">{game.nexusAtreides.mode === 'betrayal'
                ? 'Discard this Nexus card to cancel the pending Atreides inspection.'
                : game.nexusAtreides.mode === 'cunning'
                  ? 'Discard this Nexus card to inspect a second, different element of your opponent’s plan.'
                  : 'Discard this Nexus card to inspect one element of your opponent’s plan.'}</p>
              <div className="flex flex-wrap gap-2">
                {(game.nexusAtreides.mode === 'betrayal' ? [undefined] : game.nexusAtreides.fields).map((field) => {
                  const action = nexusAtreidesAction(game, field);
                  return <Button key={field ?? 'betrayal'} className="game-action min-h-11 whitespace-normal" disabled={busy || !action}
                    onClick={() => { if (!busy && action) act(action); }}>
                    {field ? `Use ${NEXUS_PANEL_NAMES[game.nexusAtreides!.mode]}: inspect ${field}` : 'Use Betrayal'}
                  </Button>;
                })}
              </div>
            </>
          )}
        </div>
      )}
      <div aria-label="Your private Nexus card" className="max-w-xl">
        {offer.card ? <NexusCardFace card={offer.card} mode={mode} /> : <p>You do not hold a Nexus card.</p>}
      </div>
      {(offer.choices.includes('draw') || offer.choices.includes('replace')) && (
        <label className="block max-w-xl space-y-1">
          <span>If I draw my faction</span>
          <select aria-label="If I draw my faction" className="min-h-11 w-full" value={ownRedraws} disabled={busy}
            onChange={(event) => setOwnRedraws(Number(event.target.value) as 0 | 1 | 2)}>
            <option value={0}>Keep it</option>
            <option value={1}>Redraw once</option>
            <option value={2}>Redraw whenever it appears</option>
          </select>
          <span className="fine block">Your choice applies privately during the draw, in Basic or Advanced play.</span>
        </label>
      )}
      <div className="flex flex-wrap gap-2">
        {[...offer.choices].sort((a, b) => Number(a === 'keep') - Number(b === 'keep')).map((choice) => {
          const action = nexusCardChoiceAction(game, choice, ownRedraws);
          return <Button key={choice} className="game-action min-h-11 whitespace-normal" disabled={busy || !action} onClick={() => { if (!busy && action) act(action); }}>{labels[choice]}</Button>;
        })}
      </div>
      {!!waiting.length && <p className="fine" aria-live="polite">Waiting for Nexus choices: {waiting.join(', ')}.</p>}
      <details className="space-y-3">
        <summary className="min-h-11 cursor-pointer py-2">View all 12 Nexus cards</summary>
        <p className="fine">This reference includes every faction. Other players’ held card identities stay secret.</p>
        <NexusCardGallery />
      </details>
    </section>
  );
}
