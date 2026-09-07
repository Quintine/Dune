'use client';

import { useId } from 'react';
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
import { HELP } from '@/game/reference';
import { LeaderPortrait } from './leader-portrait';

/** Supply only identity information this viewer is entitled to inspect. */
export type LeaderDisplayIdentity = Readonly<
  { id?: string; name: string; factionName: string } & (
    | { cheapHero: true; strength: 0 }
    | { cheapHero?: false; strength: number | string }
  )
>;
export type LeaderInspectorProps = {
  identity: LeaderDisplayIdentity;
  kind?: 'leader' | 'traitor' | 'faceDancer';
};

/** An original geometric medallion, not a portrait or a printed component reproduction. */
function IdentityMedallion({ traitor }: { traitor: boolean }) {
  const gradient = `${useId()}-seal`;
  return (
    <svg
      viewBox="0 0 200 200"
      className="mx-auto my-5 w-40 max-w-full sm:w-48"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient id={gradient} cx="38%" cy="30%" r="75%">
          <stop offset="0" stopColor={traitor ? '#563e38' : '#414c3b'} />
          <stop offset="1" stopColor="#151a15" />
        </radialGradient>
      </defs>
      <circle
        cx="100"
        cy="100"
        r="92"
        fill={`url(#${gradient})`}
        stroke="#c3a365"
        strokeWidth="2"
      />
      <circle
        cx="100"
        cy="100"
        r="84"
        fill="none"
        stroke="#bfa46e"
        strokeOpacity="0.55"
      />
      <circle
        cx="100"
        cy="100"
        r="66"
        fill="none"
        stroke="#bfa46e"
        strokeOpacity="0.25"
      />
      {Array.from({ length: 16 }, (_, index) => (
        <path
          key={index}
          d="M 100 12 V 20"
          stroke="#ddc48c"
          strokeWidth={index % 4 === 0 ? 3 : 1}
          transform={`rotate(${index * 22.5} 100 100)`}
        />
      ))}
      <path
        d="M 100 40 L 139 100 L 100 160 L 61 100 Z"
        fill="none"
        stroke="#e3c787"
        strokeWidth="2"
      />
      <path
        d={
          traitor
            ? 'M 100 56 L 108 103 L 100 119 L 92 103 Z M 80 120 H 120 M 100 120 V 144'
            : 'M 77 76 L 88 93 L 100 68 L 112 93 L 123 76 L 116 112 H 84 Z M 85 125 H 115'
        }
        fill="none"
        stroke="#f1dba8"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <circle cx="36" cy="100" r="3" fill="#c3a365" />
      <circle cx="164" cy="100" r="3" fill="#c3a365" />
    </svg>
  );
}

/** Read-only: no game, catalog lookup, deck, session or action callback is accepted. */
export function LeaderInspector({
  identity,
  kind = 'leader',
}: LeaderInspectorProps) {
  const traitor = kind === 'traitor';
  const faceDancer = kind === 'faceDancer';
  const label = faceDancer ? 'Face Dancer' : kind;
  const cheapHero = identity.cheapHero === true;
  const description = faceDancer
    ? cheapHero
      ? 'This Face Dancer identity matches either Cheap Hero or Cheap Heroine used as the winning battle leader, regardless of the hero card’s name or the player’s faction.'
      : 'This Face Dancer identity matches the named winning leader. Tleilaxu can reveal an unrevealed match after that battle and its rewards are settled.'
    : traitor
      ? cheapHero
        ? 'This traitor identity matches either Cheap Hero or Cheap Heroine used as a battle leader, regardless of the hero card’s name or the player’s faction.'
        : 'This traitor card identifies the named leader. Holding it does not add that leader to your available battle leaders.'
      : cheapHero
        ? 'A Cheap Hero or Heroine can stand in for a leader in a battle plan. Its leader strength is zero.'
        : 'This identity shows the leader’s faction and strength. Battle powers can change the strength used in a battle.';
  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button
            variant="outline"
            className="min-h-11 min-w-11 motion-reduce:transition-none"
          />
        }
        aria-label={`Inspect ${label}: ${identity.name}`}
      >
        <Eye aria-hidden="true" />
        Inspect {label}
      </DialogTrigger>
      <DialogPortal>
        <DialogOverlay className="bg-black/75 motion-reduce:animate-none motion-reduce:transition-none" />
        <DialogPrimitive.Popup className="fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-[#8e7952] bg-[#141814] text-[#eeeae0] shadow-2xl outline-none duration-150 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 motion-reduce:animate-none motion-reduce:transition-none sm:max-h-[calc(100dvh-3rem)] sm:w-[calc(100%-3rem)]">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#414536] px-4 py-3">
            <span className="text-xs font-semibold tracking-[0.16em] text-[#ddbc77] uppercase">
              {label} inspection
            </span>
            <DialogClose
              render={
                <Button
                  variant="outline"
                  className="min-h-11 min-w-11 motion-reduce:transition-none"
                />
              }
            >
              <X aria-hidden="true" />
              Close
            </DialogClose>
          </div>
          <div className="min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6">
            <div className="grid items-start gap-6 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <article
                className={`min-w-0 rounded-xl border border-[#a58b5c] bg-gradient-to-br ${faceDancer ? 'from-[#43374b] via-[#2e2835]' : traitor ? 'from-[#482e2b] via-[#2e2721]' : 'from-[#344432] via-[#292f25]'} to-[#171b17] p-5 shadow-lg sm:p-6`}
              >
                <p className="m-0 break-words text-sm font-semibold tracking-wider text-[#f1d79f] uppercase">
                  {identity.factionName}
                </p>
                <LeaderPortrait
                  identityId={cheapHero ? undefined : identity.id}
                  name={identity.name}
                  className="mx-auto my-5 size-40 max-w-full sm:size-48"
                  sizes="(min-width: 640px) 192px, 160px"
                  fallback={<IdentityMedallion traitor={traitor} />}
                />
                <DialogTitle className="break-words font-serif text-3xl leading-tight text-[#fff3d6] sm:text-4xl">
                  {identity.name}
                </DialogTitle>
                <dl className="mt-5 border-y border-[#b59a64]/40 py-4">
                  <dt className="text-sm font-medium text-[#d6c9ad]">
                    Leader strength
                  </dt>
                  <dd className="m-0 mt-1 break-words font-serif text-5xl leading-tight text-[#f6e4b9]">
                    {identity.strength}
                  </dd>
                </dl>
                <p className="mt-4 mb-0 text-xs tracking-wider text-[#cebea0] uppercase">
                  {faceDancer
                    ? 'Face Dancer identity'
                    : traitor
                      ? 'Traitor identity'
                      : 'Leader identity'}{' '}
                  · gameplay guide
                </p>
              </article>
              <section
                className="flex min-w-0 flex-col gap-5"
                aria-label={`${faceDancer ? 'Face Dancer' : traitor ? 'Traitor' : 'Leader'} guidance`}
              >
                <DialogDescription className="m-0 text-base leading-7 text-[#eee5d2]">
                  {description}
                </DialogDescription>
                {identity.id === 'choam-auditor' && (
                  <div className="space-y-4 text-base leading-7 text-[#e0e4d8]">
                    <p>
                      Advanced CHOAM has this additional strength-2 leader and
                      its matching traitor identity. It remains separate from
                      the five ordinary leaders.
                    </p>
                    <p>
                      After using the Auditor in battle, CHOAM may inspect two
                      random opposing hand cards if it survived, or one if it
                      died. Exclude cards used in that battle. The opponent may
                      pay CHOAM one spice per card actually available to cancel
                      the entire inspection; partial cancellation is
                      unavailable. Karama can prevent the audit.
                    </p>
                    <p>
                      The Auditor may use CHOAM’s one normal leader revival
                      without waiting for all other leaders to enter the Tanks.
                      It cannot be captured by Harkonnen, acquired as a Tleilaxu
                      foreign ghola, or receive a leader skill. CHOAM may revive
                      it with its own Ghola card.
                    </p>
                  </div>
                )}
                {faceDancer ? (
                  <>
                    <p className="m-0 text-base leading-7 text-[#e0e4d8]">
                      Inspection does not reveal a Face Dancer or replace
                      forces. Use the table’s Face Dancer decision after another
                      faction’s winning battle, losses, card choices and rewards
                      have been resolved.
                    </p>
                    <p className="m-0 text-base leading-7 text-[#e0e4d8]">
                      Return the winner’s surviving forces to reserves. Tleilaxu
                      may replace up to that many with their own forces from
                      reserves or the board. Send the winning leader to the
                      tanks without another leader bounty; an already dead
                      leader does not die again.
                    </p>
                    <p className="m-0 text-base leading-7 text-[#e0e4d8]">
                      Kwisatz Haderach does not protect the accompanying leader
                      from Face Dancing. Karama cannot cancel this reveal or the
                      replacement forces.
                    </p>
                    <p className="m-0 text-base leading-7 text-[#e0e4d8]">
                      Keep a revealed Face Dancer face up until all three have
                      been used, then shuffle them back into the unused deck and
                      draw three new identities. During Mentat Pause, one
                      unrevealed Face Dancer may instead be exchanged once per
                      turn; that exchange has a Karama response.
                    </p>
                    {cheapHero && (
                      <p className="m-0 text-base leading-7 text-[#e0e4d8]">
                        Either hero can be the winning identity for Face
                        Dancing. Its leader strength is zero; the hero treachery
                        card and this Face Dancer identity remain separate
                        components.
                      </p>
                    )}
                  </>
                ) : traitor ? (
                  <>
                    <p className="m-0 text-base leading-7 text-[#e0e4d8]">
                      Inspection is not a traitor call and does not reveal this
                      identity to other players. After the battle plans are
                      revealed, use the table’s traitor decision to make a legal
                      call.
                    </p>
                    <p className="m-0 text-base leading-7 text-[#e0e4d8]">
                      Keep the identity after revealing it; it can match again
                      in later battles. A matching identity alone does not
                      bypass battle protections such as Kwisatz Haderach.
                    </p>
                    {!cheapHero && (
                      <p className="m-0 text-base leading-7 text-[#e0e4d8]">
                        Keeping your own leader as a traitor can prevent another
                        player from holding that traitor.
                      </p>
                    )}
                    {cheapHero && (
                      <p className="m-0 text-base leading-7 text-[#e0e4d8]">
                        This is the expansion traitor identity, separate from
                        the hero treachery cards. It can match any Cheap Hero or
                        Heroine used as a battle leader. The hero has zero
                        leader strength and grants no leader bounty.
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <p className="m-0 text-base leading-7 text-[#e0e4d8]">
                      {HELP.leader}
                    </p>
                    <p className="m-0 text-base leading-7 text-[#e0e4d8]">
                      Inspection does not choose or commit a leader. Close this
                      view to review the available leaders in your battle plan.
                    </p>
                    {cheapHero && (
                      <p className="m-0 text-base leading-7 text-[#e0e4d8]">
                        The hero treachery card is discarded after use. The
                        separate Cheap Hero traitor identity can match either
                        hero.
                      </p>
                    )}
                  </>
                )}
                {identity.strength === 'X' && (
                  <p className="m-0 rounded-lg border border-[#454b3c] bg-[#1d221b] p-4 text-base leading-7 text-[#e0e4d8]">
                    X marks variable strength. Use the faction’s battle rule to
                    determine its value against the opposing leader.
                  </p>
                )}
              </section>
            </div>
          </div>
        </DialogPrimitive.Popup>
      </DialogPortal>
    </Dialog>
  );
}
