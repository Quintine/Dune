'use client';

import { useId, useState } from 'react';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { Eye, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import type { Action, GameView } from '@/game/engine';
import { territory } from '@/game/board';
import {
  TERROR_COMMON_GAMEPLAY,
  TERROR_DEFINITIONS,
  TERROR_STRONGHOLDS,
  type TerrorKind,
  type TerrorToken,
} from '@/game/moritani-terror';

type ProjectedToken = NonNullable<GameView['moritaniTerror']>['tokens'][number];

/** Original vector marks. A hidden token always uses the same face and geometry. */
function TerrorArt({
  kind,
  large = false,
}: {
  kind?: TerrorKind;
  large?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 120 120"
      className={large ? 'mx-auto my-6 size-40 max-w-full' : 'size-16 shrink-0'}
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="60" cy="63" r="55" fill="#080e0f" />
      <circle
        cx="60"
        cy="58"
        r="54"
        fill="#173a40"
        stroke="#d2b77b"
        strokeWidth="2"
      />
      <circle cx="60" cy="58" r="46" fill="#10282d" stroke="#688987" />
      <path
        d="M 60 8 L 63 14 L 60 20 L 57 14 Z M 60 96 L 63 102 L 60 108 L 57 102 Z M 10 58 H 18 M 102 58 H 110"
        fill="#ddc690"
        stroke="#ddc690"
      />
      <g
        fill="none"
        stroke="#f1dfb4"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {kind === 'assassination' ? (
          <>
            <path d="M 68 26 L 75 33 L 53 66 L 42 75 L 45 61 Z M 40 65 L 54 76 M 47 72 L 37 88" />
            <circle cx="77" cy="78" r="10" strokeWidth="1.5" />
          </>
        ) : kind === 'atomics' ? (
          <>
            <circle cx="60" cy="58" r="9" fill="#b59a64" />
            <path d="M 60 25 V 40 M 60 76 V 91 M 27 58 H 42 M 78 58 H 93 M 36 34 L 47 45 M 73 71 L 84 82 M 36 82 L 47 71 M 73 45 L 84 34" />
            <circle cx="60" cy="58" r="25" strokeWidth="1" />
          </>
        ) : kind === 'extortion' ? (
          <>
            <path d="M 38 38 H 82 V 82 H 38 Z M 47 38 V 30 H 73 V 38 M 38 50 H 82" />
            <path d="M 60 58 L 66 65 L 60 74 L 54 65 Z" fill="#b59a64" />
          </>
        ) : kind === 'robbery' ? (
          <>
            <path d="M 33 46 Q 60 29 87 46 L 80 70 Q 60 83 40 70 Z" />
            <path d="M 43 50 L 54 54 L 44 59 M 77 50 L 66 54 L 76 59 M 55 70 H 65" />
          </>
        ) : kind === 'sabotage' ? (
          <>
            <path d="M 53 28 H 67 L 70 39 L 81 41 L 87 54 L 79 63 L 81 76 L 67 84 L 58 76 L 45 79 L 36 65 L 43 55 L 40 41 L 52 38 Z" />
            <path
              d="M 68 39 L 53 57 L 67 59 L 52 79"
              stroke="#d59a80"
              strokeWidth="4"
            />
          </>
        ) : kind === 'sneakAttack' ? (
          <>
            <path d="M 25 47 L 60 57 L 95 47 L 73 65 L 60 88 L 47 65 Z M 60 31 V 57 M 46 35 L 60 44 L 74 35" />
          </>
        ) : (
          <>
            <path d="M 60 27 L 83 42 V 61 Q 81 78 60 89 Q 39 78 37 61 V 42 Z" />
            <path d="M 49 59 V 52 A 11 11 0 0 1 71 52 V 59 M 47 59 H 73 V 75 H 47 Z" />
            <path d="M 60 64 V 69" />
          </>
        )}
      </g>
    </svg>
  );
}

function tokenContext(token: ProjectedToken) {
  if (token.status === 'placed' && token.location)
    return `Placed · ${territory(token.location).name}`;
  if (token.status === 'extortion') return 'Revealed · awaiting Mentat';
  if (token.status === 'removed') return 'Revealed · removed from play';
  return 'Private supply';
}

function TokenInspector({
  token,
  owner,
}: {
  token: ProjectedToken;
  owner: boolean;
}) {
  const revealed = token.status === 'removed' || token.status === 'extortion';
  // Defense in depth: even an accidentally over-broad projection cannot render
  // an opponent's hidden face. Never derive a secret kind from a physical ID.
  const kind = (owner || revealed) && 'kind' in token ? token.kind : undefined;
  const definition = kind ? TERROR_DEFINITIONS[kind] : undefined;
  const title = definition?.name ?? 'Hidden Terror';
  const context = tokenContext(token);
  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button
            variant="outline"
            className="h-auto min-h-11 min-w-0 flex-col gap-2 whitespace-normal border-[#66796a] bg-[#172624] px-2 py-3 text-[#f2dfb9] motion-reduce:transition-none"
          />
        }
        aria-label={`Inspect ${title}: ${context}`}
      >
        <TerrorArt kind={kind} />
        <span className="break-words font-serif text-base leading-tight">
          {title}
        </span>
        <span className="break-words text-xs leading-5 text-[#c4cabc]">
          {context}
        </span>
        <span className="inline-flex items-center gap-1 text-xs text-[#dfc78e]">
          <Eye aria-hidden="true" /> Inspect
        </span>
      </DialogTrigger>
      <DialogPortal>
        <DialogOverlay className="bg-black/75 motion-reduce:animate-none motion-reduce:transition-none" />
        <DialogPrimitive.Popup className="fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-[#8e7952] bg-[#141814] text-[#eeeae0] shadow-2xl outline-none">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#414536] px-4 py-3">
            <span className="text-xs font-semibold tracking-[0.16em] text-[#ddbc77] uppercase">
              Moritani · Terror
            </span>
            <DialogClose
              render={
                <Button
                  variant="outline"
                  className="min-h-11 min-w-11 motion-reduce:transition-none"
                />
              }
            >
              <X aria-hidden="true" /> Close
            </DialogClose>
          </div>
          <div className="min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6">
            <div className="grid items-start gap-6 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
              <article className="min-w-0 rounded-xl border border-[#a58b5c] bg-gradient-to-br from-[#294b4b] via-[#1c302d] to-[#171b17] p-5">
                <p className="m-0 text-xs font-semibold tracking-widest text-[#e0cd9f] uppercase">
                  {context}
                </p>
                <TerrorArt kind={kind} large />
                <DialogTitle className="break-words font-serif text-3xl leading-tight text-[#fff3d6] sm:text-4xl">
                  {title}
                </DialogTitle>
                <p className="mt-5 mb-0 text-sm leading-6 text-[#d3daca]">
                  {kind
                    ? 'Original token illustration · gameplay guide'
                    : 'This placed token remains face down. Its identity is visible only to Moritani.'}
                </p>
              </article>
              <section
                className="min-w-0 space-y-4"
                aria-label="Terror token guidance"
              >
                <DialogDescription className="m-0 text-base leading-7 text-[#f1dfb4]">
                  {definition?.summary ??
                    'A hidden Terror token marks this stronghold. Inspecting it does not reveal its identity or trigger an effect.'}
                </DialogDescription>
                {(definition?.gameplay ?? TERROR_COMMON_GAMEPLAY).map(
                  (paragraph) => (
                    <p
                      key={paragraph}
                      className="m-0 text-sm leading-7 text-[#e0e4d8]"
                    >
                      {paragraph}
                    </p>
                  ),
                )}
                <p className="border-t border-[#414536] pt-4 text-sm leading-6 text-[#c9c2ae]">
                  Robbery, Sabotage, Sneak Attack and ordinary native-leader
                  Assassination have controls for supported entry reactions.
                  Enemy of My Enemy has partial alliance controls. Atomics and
                  Extortion remain under implementation, and complete Moritani
                  games remain unavailable. Inspection explains the rules; it
                  does not reveal a token or activate an effect.
                </p>
              </section>
            </div>
          </div>
        </DialogPrimitive.Popup>
      </DialogPortal>
    </Dialog>
  );
}

export function MoritaniTerrorSupply({ game }: { game: GameView }) {
  const titleId = useId();
  const view = game.moritaniTerror;
  if (!view) return null;
  const owner =
    game.players.find((p) => p.id === game.me)?.faction === 'moritani';
  const tokens = view.tokens.filter(
    (token) => owner || token.status !== 'available',
  );
  return (
    <section
      className="min-w-0 rounded-xl border border-[#58624e] bg-[#161e19] p-3"
      aria-labelledby={titleId}
    >
      <h3 id={titleId} className="m-0 font-serif text-xl text-[#f1dfb4]">
        Moritani Terror
      </h3>
      <p className="mt-2 mb-3 text-sm leading-6 text-[#c4cabc]">
        {owner
          ? 'Your supply and placed tokens. Inspect a face without revealing it to the table.'
          : 'Placed tokens stay hidden. Revealed tokens can be inspected by everyone.'}
      </p>
      {tokens.length ? (
        <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {tokens.map((token) => (
            <TokenInspector key={token.id} token={token} owner={owner} />
          ))}
        </div>
      ) : (
        <p className="m-0 text-sm text-[#c4cabc]">No public Terror tokens.</p>
      )}
    </section>
  );
}

export function MoritaniPlacement({
  game,
  act,
  busy,
}: {
  game: GameView;
  act: (action: Action) => void;
  busy: boolean;
}) {
  const formId = useId();
  const [selectedToken, setSelectedToken] = useState('');
  const [selectedTerritory, setSelectedTerritory] = useState('');
  const decision = game.decision;
  if (
    decision?.kind !== 'moritaniPlacement' ||
    decision.player !== game.me ||
    game.players.find((p) => p.id === game.me)?.faction !== 'moritani' ||
    !game.moritaniTerror
  )
    return null;
  const tokens = game.moritaniTerror.tokens.filter(
    (token): token is TerrorToken =>
      'kind' in token &&
      (token.status === 'available' || token.status === 'placed'),
  );
  const token =
    tokens.find((candidate) => candidate.id === selectedToken) ?? tokens[0];
  const destinations = TERROR_STRONGHOLDS.filter(
    (to) =>
      to !== token?.location &&
      !game.moritaniTerror!.tokens.some(
        (candidate) =>
          candidate.status === 'placed' && candidate.location === to,
      ),
  );
  const destination = destinations.includes(selectedTerritory)
    ? selectedTerritory
    : destinations[0];
  const waiting = Boolean(game.response);
  const disabled = busy || waiting;
  return (
    <section className="notice min-w-0" aria-labelledby={`${formId}-title`}>
      <h3 id={`${formId}-title`}>Place or relocate Terror</h3>
      <p className="text-sm leading-6">
        Choose one token and a stronghold without a Terror token for this Mentat
        Pause. Storm does not prevent placement. Choose privately; the token’s
        face stays hidden from opponents.
      </p>
      <div className="flex min-w-0 flex-col gap-3">
        <label htmlFor={`${formId}-token`} className="text-sm font-medium">
          Your Terror token
        </label>
        <select
          id={`${formId}-token`}
          className="min-h-11 w-full min-w-0 max-w-full"
          disabled={disabled || !tokens.length}
          value={token?.id ?? ''}
          onChange={(event) => setSelectedToken(event.target.value)}
        >
          {!tokens.length && <option value="">No available token</option>}
          {tokens.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {TERROR_DEFINITIONS[candidate.kind].name} ·{' '}
              {candidate.location
                ? territory(candidate.location).name
                : 'Supply'}
            </option>
          ))}
        </select>
        <label htmlFor={`${formId}-territory`} className="text-sm font-medium">
          Destination stronghold
        </label>
        <select
          id={`${formId}-territory`}
          className="min-h-11 w-full min-w-0 max-w-full"
          disabled={disabled || !destinations.length || !token}
          value={destination ?? ''}
          onChange={(event) => setSelectedTerritory(event.target.value)}
        >
          {!destinations.length && (
            <option value="">No empty stronghold</option>
          )}
          {destinations.map((to) => (
            <option key={to} value={to}>
              {territory(to).name}
            </option>
          ))}
        </select>
        <output className="m-0 text-sm leading-6">
          {waiting
            ? 'Waiting for the table’s Karama response. The token has not moved.'
            : 'The table may use Karama before your placement or relocation takes effect.'}
        </output>
        <Button
          className="h-auto min-h-11 whitespace-normal motion-reduce:transition-none"
          disabled={disabled || !token || !destination}
          onClick={() => {
            if (token && destination)
              act({
                type: 'decision',
                token: token.id,
                territory: destination,
              });
          }}
        >
          {token?.status === 'placed'
            ? 'Declare relocation'
            : 'Declare placement'}
        </Button>
        <Button
          variant="outline"
          className="h-auto min-h-11 whitespace-normal motion-reduce:transition-none"
          disabled={disabled}
          onClick={() => act({ type: 'decision', decline: true })}
        >
          Pass this Mentat opportunity
        </Button>
      </div>
    </section>
  );
}

export function MoritaniEntry({
  game,
  act,
  busy,
}: {
  game: GameView;
  act: (action: Action) => void;
  busy: boolean;
}) {
  const formId = useId();
  const [selectedCard, setSelectedCard] = useState('');
  const [selectedAmount, setSelectedAmount] = useState(0);
  const entry = game.terrorEntry;
  const me = game.players.find((player) => player.id === game.me);
  if (
    game.decision?.kind !== 'moritaniTerror' ||
    game.decision.player !== game.me ||
    !entry ||
    !me
  )
    return null;

  const disabled = busy || Boolean(game.response) || Boolean(game.truthtrance);
  const controlClass =
    'h-auto min-h-11 whitespace-normal motion-reduce:transition-none';

  // This entrant branch must precede every private kind, definition and token lookup.
  if (entry.stage === 'allianceReply') {
    if (entry.entrant !== game.me) return null;
    const moritani = game.players.find(
      (player) => player.faction === 'moritani',
    );
    if (!moritani) return null;
    return (
      <section className="notice min-w-0" aria-labelledby={`${formId}-title`}>
        <h3 id={`${formId}-title`}>Enemy of My Enemy</h3>
        <p className="text-sm leading-6">
          {moritani.name} offers you an alliance after your arrival in{' '}
          {territory(entry.territory).name}. The Terror token remains hidden.
        </p>
        <p className="text-sm leading-6">
          Accepting forms your alliance with Moritani, ends any existing
          alliances either of you has, and returns the token to Moritani’s
          supply without revealing it. Refusing requires the token to be
          revealed and its effect to resolve.
        </p>
        {[me, moritani]
          .filter((player) => player.ally)
          .map((player) => {
            const formerPartner = game.players.find(
              (partner) => partner.id === player.ally,
            );
            return (
              <p key={player.id} className="text-sm leading-6">
                {player.name}’s alliance with{' '}
                {formerPartner?.name ?? 'their current ally'} will end if you
                accept.
              </p>
            );
          })}
        <div className="flex min-w-0 flex-col gap-3">
          <Button
            className={controlClass}
            disabled={disabled}
            onClick={() => act({ type: 'decision', accept: true })}
          >
            Accept alliance
          </Button>
          <Button
            variant="outline"
            className={controlClass}
            disabled={disabled}
            onClick={() => act({ type: 'decision', accept: false })}
          >
            Refuse alliance
          </Button>
        </div>
      </section>
    );
  }

  if (me.faction !== 'moritani' || !('kind' in entry) || !entry.kind)
    return null;

  const definition = TERROR_DEFINITIONS[entry.kind];
  const token = game.moritaniTerror?.tokens.find(
    (candidate) => 'kind' in candidate && candidate.kind === entry.kind,
  );
  const entrant = game.players.find((player) => player.id === entry.entrant);
  const hand = me.hand ?? [];
  const selected = hand.find((card) => card.id === selectedCard);
  const discardCard = selected ?? hand[0];
  const giving = entry.stage === 'gift';
  const sneak = entry.sneakAttack;
  const maximum = sneak?.maximum ?? 0;
  const amount = selectedAmount <= maximum ? selectedAmount : 0;
  const arrival = {
    shipment: 'by shipment',
    movement: 'by movement',
    guildTransport: 'by Guild transport',
    advisor: 'as an accompanying advisor',
    wormRide: 'by worm ride',
    ambassador: 'through the Fremen Ambassador',
  }[entry.cause];

  return (
    <section className="notice min-w-0" aria-labelledby={`${formId}-title`}>
      <h3 id={`${formId}-title`} className="break-words">
        {definition.name} · Terror reaction
      </h3>
      <p className="text-sm leading-6">
        {entrant?.name ?? 'Another faction'} entered{' '}
        {territory(entry.territory).name}, sector {entry.sector}, {arrival}.
      </p>
      {token && (
        <div className="mb-4 grid grid-cols-1">
          <TokenInspector token={token} owner />
        </div>
      )}
      <div className="flex min-w-0 flex-col gap-3">
        {entry.stage === 'offer' && (
          <>
            <p className="m-0 text-sm leading-6">
              You may reveal this token against the entrant, or leave it hidden
              and continue their action. Inspection keeps its face private.
            </p>
            {entry.kind === 'assassination' && entry.canReveal && (
              <p className="m-0 text-sm leading-6">
                Revealing Assassination immediately selects a random eligible
                native leader. You do not choose the victim.
              </p>
            )}
            {entry.kind === 'sneakAttack' && sneak && (
              <div className="space-y-2 text-sm leading-6">
                <p className="m-0">
                  Up to {maximum} of your reserve forces are available.
                  {sneak.blocked
                    ? ` Positive entry is blocked: ${sneak.blocked}`
                    : ' They may enter this territory and sector for free.'}
                </p>
                <p className="m-0">
                  You may leave this token hidden, or reveal it and choose how
                  many forces to send. Revealing spends the token even if you
                  send no forces; zero remains available when entry is blocked.
                </p>
              </div>
            )}
            {entry.canOfferAlliance ? (
              <div className="flex flex-col gap-3 border-y border-current/20 py-3">
                <p className="m-0 text-sm leading-6">
                  Enemy of My Enemy lets you offer an alliance before revealing
                  this token. Acceptance ends both existing alliances and
                  returns the token hidden. Refusal requires its effect to
                  resolve. The table’s Karama response comes before the entrant
                  decides.
                </p>
                <Button
                  variant="outline"
                  className={controlClass}
                  disabled={disabled}
                  onClick={() => act({ type: 'decision', alliance: true })}
                >
                  Offer alliance
                </Button>
              </div>
            ) : entry.allianceBlockedReason ? (
              <p className="m-0 text-sm leading-6">
                Enemy of My Enemy: {entry.allianceBlockedReason}
              </p>
            ) : null}
            {entry.canReveal ? (
              <Button
                className={controlClass}
                disabled={disabled}
                onClick={() => act({ type: 'decision', reveal: true })}
              >
                Reveal {definition.name}
              </Button>
            ) : (
              <p className="m-0 text-sm leading-6">
                {entry.revealBlocked ??
                  `${definition.name} is still under implementation.`}{' '}
                Leave the token hidden to continue this arrival.
              </p>
            )}
            <Button
              variant="outline"
              className={controlClass}
              disabled={disabled}
              onClick={() => act({ type: 'decision', decline: true })}
            >
              Leave token hidden
            </Button>
            <p className="m-0 text-sm leading-6">
              Robbery, Sabotage, Sneak Attack and ordinary native-leader
              Assassination support eligible arrivals. Enemy of My Enemy has
              partial alliance controls. Atomics and Extortion are not yet
              available; complete Moritani games remain unavailable.
            </p>
          </>
        )}
        {entry.stage === 'robbery' && (
          <>
            <p className="m-0 text-sm leading-6">
              Take half the entrant’s spice, rounded up, or draw the top
              Treachery Card. A draw above your hand limit requires you to
              choose a card to discard afterward.
            </p>
            <Button
              className={controlClass}
              disabled={disabled}
              onClick={() => act({ type: 'decision', choice: 'spice' })}
            >
              Take half their spice
            </Button>
            <Button
              variant="outline"
              className={controlClass}
              disabled={disabled}
              onClick={() => act({ type: 'decision', choice: 'card' })}
            >
              Draw a Treachery Card
            </Button>
          </>
        )}
        {entry.stage === 'sneakAttack' && (
          <>
            <p className="m-0 text-sm leading-6">
              Send forces from your reserves into{' '}
              {territory(entry.territory).name}, sector {entry.sector}, for
              free. This entry does not use your ordinary shipment or movement
              turn. You may send no forces.
            </p>
            <label htmlFor={`${formId}-amount`} className="text-sm font-medium">
              Forces from your reserves
            </label>
            <select
              id={`${formId}-amount`}
              className="min-h-11 w-full min-w-0 max-w-full"
              disabled={disabled}
              value={amount}
              aria-describedby={`${formId}-entry-limit`}
              onChange={(event) =>
                setSelectedAmount(Number(event.target.value))
              }
            >
              {Array.from({ length: maximum + 1 }, (_, count) => (
                <option key={count} value={count}>
                  {count}
                  {count === 0 ? ' · no forces' : ''}
                </option>
              ))}
            </select>
            <p id={`${formId}-entry-limit`} className="m-0 text-sm leading-6">
              {sneak?.blocked ??
                `Up to ${maximum} forces are available for this entry.`}
            </p>
            <Button
              className={controlClass}
              disabled={
                disabled || !sneak || amount <= 0 || Boolean(sneak.blocked)
              }
              onClick={() => {
                if (sneak && amount > 0 && !sneak.blocked)
                  act({ type: 'decision', amount });
              }}
            >
              Send selected forces
            </Button>
            <Button
              variant="outline"
              className={controlClass}
              disabled={disabled}
              onClick={() => act({ type: 'decision', amount: 0 })}
            >
              Send no forces
            </Button>
          </>
        )}
        {(entry.stage === 'discard' || giving) && (
          <>
            <p className="m-0 text-sm leading-6">
              {giving
                ? 'Sabotage’s random discard has resolved where possible. You may now give the entrant one of your own cards, or keep your hand.'
                : 'Your Robbery draw exceeded your hand limit. Choose one of your own cards to discard, including the card just drawn.'}
            </p>
            <label htmlFor={`${formId}-card`} className="text-sm font-medium">
              {giving ? 'Card to give (optional)' : 'Your card to discard'}
            </label>
            <select
              id={`${formId}-card`}
              className="min-h-11 w-full min-w-0 max-w-full"
              disabled={disabled || !hand.length}
              value={giving ? (selected?.id ?? '') : (discardCard?.id ?? '')}
              onChange={(event) => setSelectedCard(event.target.value)}
            >
              {giving && <option value="">None · keep my hand</option>}
              {!giving && !hand.length && (
                <option value="">No available card</option>
              )}
              {hand.map((card) => (
                <option key={card.id} value={card.id}>
                  {card.name}
                </option>
              ))}
            </select>
            <Button
              className={controlClass}
              disabled={disabled || (!giving && !discardCard)}
              onClick={() => {
                if (giving && !selected)
                  act({ type: 'decision', decline: true });
                else {
                  const card = giving ? selected : discardCard;
                  if (card) act({ type: 'decision', card: card.id });
                }
              }}
            >
              {giving
                ? selected
                  ? 'Give selected card'
                  : 'Keep my hand'
                : 'Discard selected card'}
            </Button>
          </>
        )}
      </div>
    </section>
  );
}
