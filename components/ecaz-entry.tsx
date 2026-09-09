'use client';

import { useId, useState } from 'react';
import type { Action, GameView } from '@/game/engine';
import { AMBASSADOR_REFERENCE } from '@/game/ambassador-reference';
import { territory } from '@/game/board';
import { faction } from '@/game/catalog';
import { leaderStrengthLabel } from '@/game/cards';
import { CHEAP_HERO_TRAITOR } from '@/game/traitors';
import { Button } from './ui/button';
import { CardInspector, CardRules } from './card-inspector';
import { LeaderInspector } from './leader-inspector';
import { AmbassadorInspector, AMBASSADOR_COVERAGE } from './ecaz-ambassadors';
import { AmbassadorMovement } from './ambassador-movement';
import { AmbassadorShipment } from './ambassador-shipment';

const buttonClass = 'min-h-11 whitespace-normal motion-reduce:transition-none';

export function EcazEntry({
  game,
  act,
  busy,
}: {
  game: GameView;
  act: (action: Action) => void;
  busy: boolean;
}) {
  const id = useId();
  const [selected, setSelected] = useState<string[]>([]);
  const entry = game.ambassadorEntry;
  if (
    !entry ||
    game.decision?.kind !== 'ecazAmbassador' ||
    game.decision.player !== game.me ||
    !['offer', 'allianceReply', 'copy', 'cards', 'move', 'ship'].includes(
      entry.stage,
    )
  )
    return null;
  const me = game.players.find((p) => p.id === game.me)!;
  const guide = AMBASSADOR_REFERENCE[entry.effect];
  const token = game.ambassadors?.tokens.find((t) => t.effect === entry.effect);
  const send = (fields: Omit<Action, 'type'>) => {
    if (!busy) act({ type: 'decision', event: entry.event, ...fields });
  };
  const choices = entry.cards.flatMap((option) => {
    const card = me.hand?.find((card) => card.id === option.card);
    return card ? [{ card, blocked: option.blocked }] : [];
  });
  const chosen = choices.filter(
    (choice) => !choice.blocked && selected.includes(choice.card.id),
  );
  const legalSelection = entry.effect === 'choam' || chosen.length === 1;
  const dukeBlock =
    entry.dukeAcquisition?.blocked ??
    (entry.dukeAcquisition
      ? null
      : 'Duke acquisition is unavailable for this opportunity.');
  const allianceBlock =
    entry.allianceOffer?.blocked ??
    (entry.allianceOffer ? null : 'This alliance opportunity is unavailable.');
  const duke = game.dukeVidal?.leader;
  return (
    <section
      className="notice flex min-w-0 flex-col gap-4"
      aria-label="Ecaz Ambassador entry decision"
    >
      <h3 className="m-0 font-serif text-xl">
        {guide.name} Ambassador · {territory(entry.territory).name}
      </h3>
      <p className="m-0 text-sm leading-6">
        {game.players.find((p) => p.id === entry.entrant)?.name} entered this
        stronghold. {guide.gameplay}
      </p>
      {token && <AmbassadorInspector token={token} />}
      {entry.stage === 'offer' ? (
        <>
          {entry.effect === 'ecaz' ? (
            <>
              <p className="m-0 text-sm leading-6">
                Acquire Duke Vidal for Ecaz. The Ambassador returns to your
                supply. Ecaz keeps Duke until battle use or until Moritani takes
                him.
              </p>
              {duke && (
                <LeaderInspector
                  identity={{
                    id: duke.id,
                    name: duke.name,
                    factionName: faction(duke.faction).name,
                    strength: leaderStrengthLabel(duke),
                  }}
                />
              )}
              <Button
                className={buttonClass}
                disabled={busy || !!dukeBlock}
                aria-describedby={dukeBlock ? `${id}-duke-block` : undefined}
                onClick={() => {
                  if (!dukeBlock)
                    send({
                      trigger: true,
                      beneficiary: entry.owner,
                      choice: 'duke',
                    });
                }}
              >
                Acquire Duke Vidal for Ecaz
              </Button>
              {dukeBlock && (
                <p id={`${id}-duke-block`} className="m-0 text-sm leading-6">
                  {dukeBlock}
                </p>
              )}
              <Button
                className={buttonClass}
                disabled={busy || !!allianceBlock}
                aria-describedby={
                  allianceBlock ? `${id}-alliance-block` : undefined
                }
                onClick={() => {
                  if (!allianceBlock)
                    send({
                      trigger: true,
                      beneficiary: entry.owner,
                      choice: 'alliance',
                    });
                }}
              >
                Offer alliance to{' '}
                {game.players.find((p) => p.id === entry.entrant)?.name}
              </Button>
              {allianceBlock && (
                <p
                  id={`${id}-alliance-block`}
                  className="m-0 text-sm leading-6"
                >
                  {allianceBlock}
                </p>
              )}
              <p className="m-0 text-sm leading-6">
                Both factions must be unallied. The entrant chooses whether to
                accept. The triggered Ambassador returns to supply even if the
                offer is refused. Duke loans remain unfinished.
              </p>
            </>
          ) : (
            <>
              <p className="m-0 text-sm leading-6">
                Trigger the Ambassador for yourself or an eligible ally, or
                leave it in place. Triggering commits the token before the
                beneficiary resolves its effect.
              </p>
              {entry.effect === 'richese' && (
                <p className="m-0 text-sm leading-6">
                  Triggering automatically spends 3 spice from the selected
                  beneficiary and draws a card if the purchase can be completed.
                  Otherwise no spice is spent and no card is drawn. The token is
                  used either way; there is no later purchase choice.
                </p>
              )}
              {entry.beneficiaries.map((option) => (
                <div key={option.player} className="flex flex-col gap-2">
                  <Button
                    className={buttonClass}
                    disabled={busy || !!option.blocked}
                    onClick={() =>
                      send({ trigger: true, beneficiary: option.player })
                    }
                  >
                    Trigger for{' '}
                    {option.player === game.me
                      ? 'yourself'
                      : game.players.find((p) => p.id === option.player)?.name}
                  </Button>
                  {option.blocked && (
                    <p className="m-0 text-sm leading-6">{option.blocked}</p>
                  )}
                </div>
              ))}
            </>
          )}
          <Button
            variant="outline"
            className={buttonClass}
            disabled={busy}
            onClick={() => send({ decline: true })}
          >
            Leave Ambassador in place
          </Button>
        </>
      ) : entry.stage === 'allianceReply' ? (
        <>
          <p className="m-0 text-sm leading-6">
            {game.players.find((p) => p.id === entry.owner)?.name} offers you an
            alliance. Accepting activates both factions’ alliance abilities
            immediately. Duke Vidal is not included in this offer. Your
            remaining actions resume after your reply.
          </p>
          <Button
            className={buttonClass}
            disabled={busy}
            onClick={() => send({ accept: true })}
          >
            Accept alliance
          </Button>
          <Button
            variant="outline"
            className={buttonClass}
            disabled={busy}
            onClick={() => send({ accept: false })}
          >
            Refuse alliance
          </Button>
        </>
      ) : entry.stage === 'copy' ? (
        <>
          <p className="m-0 text-sm leading-6">
            Choose an effect outside the original supply for this group. The
            Bene Gesserit token has already been permanently removed.
          </p>
          {entry.copies.map((option) => {
            const copied = AMBASSADOR_REFERENCE[option.effect];
            const face = game.ambassadors?.tokens.find(
              (t) => t.effect === option.effect,
            );
            return (
              <article
                key={option.effect}
                className="flex min-w-0 flex-col gap-2 rounded-lg border border-[#485542] p-3"
              >
                <h4 className="m-0 font-serif text-lg">{copied.name}</h4>
                <p className="m-0 text-sm leading-6">{copied.gameplay}</p>
                {option.effect === 'richese' && (
                  <p className="m-0 text-sm leading-6">
                    This automatically spends 3 of your spice and draws a card
                    if the purchase can be completed. Otherwise no spice is
                    spent and no card is drawn. The Bene Gesserit token remains
                    removed.
                  </p>
                )}
                {face && <AmbassadorInspector token={face} />}
                {option.blocked && (
                  <p className="m-0 text-sm leading-6">{option.blocked}</p>
                )}
                <Button
                  className={buttonClass}
                  disabled={busy || !!option.blocked}
                  onClick={() => send({ effect: option.effect })}
                >
                  Use {copied.name} effect
                </Button>
              </article>
            );
          })}
        </>
      ) : entry.stage === 'ship' ? (
        <AmbassadorShipment
          key={entry.event}
          game={game}
          act={act}
          busy={busy}
        />
      ) : entry.stage === 'move' ? (
        <AmbassadorMovement
          key={entry.event}
          game={game}
          act={act}
          busy={busy}
        />
      ) : (
        <>
          <p className="m-0 text-sm leading-6">
            {entry.effect === 'choam'
              ? 'Choose any number of available cards, including none. Each discarded card earns three spice.'
              : 'Choose exactly one available card to discard and draw its replacement.'}
          </p>
          <fieldset
            className="flex min-w-0 flex-col gap-3 border-0 p-0"
            disabled={busy}
          >
            <legend className="mb-2 text-sm font-semibold">
              Your cards available for this effect
            </legend>
            {choices.map(({ card, blocked }) => (
              <article
                key={card.id}
                className="flex min-w-0 flex-col gap-2 rounded-lg border border-[#485542] p-3"
              >
                <label
                  htmlFor={`${id}-${card.id}`}
                  className="flex min-h-11 cursor-pointer items-center gap-3 text-base"
                >
                  <input
                    id={`${id}-${card.id}`}
                    type={entry.effect === 'ixians' ? 'radio' : 'checkbox'}
                    name={`${id}-discard`}
                    checked={!blocked && selected.includes(card.id)}
                    disabled={busy || !!blocked}
                    onChange={(event) =>
                      setSelected((current) =>
                        entry.effect === 'ixians'
                          ? [card.id]
                          : event.target.checked
                            ? [...current, card.id]
                            : current.filter((value) => value !== card.id),
                      )
                    }
                  />
                  {card.name}
                </label>
                <CardRules card={card} />
                <CardInspector card={card} />
                {blocked && <p className="m-0 text-sm leading-6">{blocked}</p>}
              </article>
            ))}
          </fieldset>
          <Button
            className={buttonClass}
            disabled={busy || !legalSelection}
            onClick={() => {
              if (legalSelection)
                send({ cards: chosen.map((choice) => choice.card.id) });
            }}
          >
            {entry.effect === 'choam'
              ? `Discard ${chosen.length} cards · gain ${chosen.length * 3} spice`
              : 'Discard selected card and draw replacement'}
          </Button>
        </>
      )}
      <p className="m-0 text-xs leading-5">{AMBASSADOR_COVERAGE}</p>
    </section>
  );
}

/** Only recipient-projected snapshots are read. Local disclosures never send a game action. */
export function AmbassadorInsights({ game }: { game: GameView }) {
  const snapshots = game.ambassadorInsights.filter(
    (entry) => entry.viewer === game.me,
  );
  if (!snapshots.length) return null;
  return (
    <section
      className="notice flex min-w-0 flex-col gap-3"
      aria-label="Your private Ambassador inspection history"
    >
      <h3 className="m-0 font-serif text-xl">Private Ambassador inspections</h3>
      <p className="m-0 text-sm leading-6">
        These are snapshots of what you inspected at that moment, not a live
        view of another hand. Only you receive them. Opening or closing an
        inspection does not take a game action.
      </p>
      {snapshots.map((snapshot, index) => {
        const target = game.players.find((p) => p.id === snapshot.target);
        const leader = game.allLeaders.find((l) => l.id === snapshot.traitor);
        const cheapHero = snapshot.traitor === CHEAP_HERO_TRAITOR;
        return (
          <details
            key={snapshot.event}
            open={index === snapshots.length - 1}
            className="min-w-0 rounded-lg border border-[#485542] p-3"
          >
            <summary className="min-h-11 cursor-pointer py-2 text-base focus-visible:outline-2 focus-visible:outline-offset-2">
              Turn {snapshot.turn} · {target?.name ?? 'Player'} ·{' '}
              {snapshot.effect === 'atreides'
                ? 'Treachery hand'
                : target?.faction === 'tleilaxu'
                  ? 'Face Dancer identity'
                  : 'Traitor identity'}
            </summary>
            {snapshot.effect === 'atreides' ? (
              <div className="grid min-w-0 gap-3 pt-3 sm:grid-cols-2">
                {!snapshot.cards.length && (
                  <p className="text-sm leading-6">
                    The inspected hand was empty.
                  </p>
                )}
                {snapshot.cards.map((card) => (
                  <article
                    key={card.id}
                    className="flex min-w-0 flex-col gap-2 rounded-lg border border-[#485542] p-3"
                  >
                    <h4 className="m-0 font-serif text-lg">{card.name}</h4>
                    <CardRules card={card} />
                    <CardInspector card={card} />
                  </article>
                ))}
              </div>
            ) : cheapHero || leader ? (
              <div className="pt-3">
                <LeaderInspector
                  kind={
                    target?.faction === 'tleilaxu' ? 'faceDancer' : 'traitor'
                  }
                  identity={
                    cheapHero
                      ? {
                          name: 'Cheap Hero / Heroine',
                          factionName: 'Any faction',
                          cheapHero: true,
                          strength: 0,
                        }
                      : {
                          id: leader!.id,
                          name: leader!.name,
                          factionName: faction(leader!.faction).name,
                          strength: leaderStrengthLabel(leader!),
                        }
                  }
                />
              </div>
            ) : (
              <p className="text-sm leading-6">
                Recorded identity: {snapshot.traitor ?? 'None'}
              </p>
            )}
          </details>
        );
      })}
    </section>
  );
}
