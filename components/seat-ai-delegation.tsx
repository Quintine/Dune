'use client';
import { randomId } from '@/lib/random-id';

import { useEffect, useId, useRef, useState } from 'react';
import type { GameView } from '@/game/engine';
import { DIFFICULTIES, type Difficulty } from '@/game/bot-profiles';
import { Button } from './ui/button';
import { requestJson, requestMayHaveCompleted } from '@/lib/client-request';
import {
  parseSeatAiDelegateRequest,
  seatAiDelegateStorageKey,
  storeSeatAiDelegateRequest,
  type SeatAiDelegateRequest,
} from '@/lib/seat-ai-delegation';

/** Mounted separately for each authenticated room/seat. No recipient gets a seat key. */
export function SeatAiDelegation({
  game,
  disabled,
  onPending,
  onUncertain,
  onRestored,
}: {
  game: GameView;
  disabled: boolean;
  onPending: (value: boolean) => void;
  onUncertain: (value: boolean) => void;
  onRestored: (view: GameView) => void;
}) {
  const id = useId();
  const pending = useRef(false);
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [now, setNow] = useState(Date.now);
  const [record, setRecord] = useState<SeatAiDelegateRequest | null>(null);
  const [storageProblem, setStorageProblem] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [abandon, setAbandon] = useState(false);
  const [delegateId, setDelegateId] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('Medium');
  const key = seatAiDelegateStorageKey(game.code, game.me);
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(key);
      if (saved !== null) {
        // oxlint-disable-next-line react/react-compiler -- Restore this seat's exact pending request after SSR.
        setRecord(parseSeatAiDelegateRequest(saved));
        setExpanded(true);
      }
    } catch {
      setStorageProblem(true);
      setExpanded(true);
      setMessage(
        'The saved AI permission request could not be read. Restore access to tab storage and reload, or discard the record below.',
      );
    }
    setLoaded(true);
  }, [key]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    onUncertain(!loaded || !!record || storageProblem);
  }, [loaded, record, storageProblem, onUncertain]);
  const own = game.players.find((player) => player.id === game.me);
  const peers = game.players.filter(
    (player) => player.id !== game.me && !player.bot,
  );
  const grants = game.seatAiDelegations ?? [];
  const ownGrant = grants.find((grant) => grant.ownerId === game.me);
  const received = grants.filter((grant) => grant.delegateId === game.me);
  const started = ['setup', 'playing'].includes(game.status);
  const locked = disabled || busy || !loaded;
  const closed = !!game.roomControl?.closed;
  const paused = !!game.roomControl?.paused || closed;
  if (!own || own.bot) return null;

  function store(next: SeatAiDelegateRequest | null) {
    storeSeatAiDelegateRequest(sessionStorage, key, next);
    setRecord(next);
    setStorageProblem(false);
  }
  async function submit(request: SeatAiDelegateRequest) {
    if (locked || pending.current || (closed && !record)) return;
    pending.current = true;
    setBusy(true);
    setExpanded(true);
    setAbandon(false);
    onPending(true);
    let dispatched = false;
    try {
      store(request);
      dispatched = true;
      const result = await requestJson<{ view: GameView }>(
        `/api/rooms/${game.code}/control`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
        },
      );
      if (
        result.view?.code !== game.code ||
        result.view?.me !== game.me ||
        !Number.isSafeInteger(result.view.version) ||
        result.view.version < request.version ||
        !Array.isArray(result.view.players)
      )
        throw new Error(
          'The server did not confirm the AI permission request.',
        );
      onRestored(result.view);
      store(null);
      const confirmedGrant = result.view.seatAiDelegations?.find(
        (grant) => grant.grantId === request.grantId,
      );
      setMessage(
        request.type === 'setSeatAiDelegate'
          ? confirmedGrant &&
            confirmedGrant.usedAt === null &&
            confirmedGrant.expiresAt > Date.now()
            ? 'Permission saved. The named player can start the chosen AI once before its expiry.'
            : 'The original permission request is confirmed. That permission has already been used, expired or invalidated; it was not renewed.'
          : request.type === 'revokeSeatAiDelegate'
            ? 'This permission can no longer start AI. If AI already started, use Take back control. Completed decisions remain.'
            : 'The permission was used. Check the current AI state at the table; the owner keeps the seat and can take back control.',
      );
    } catch (error) {
      const uncertain = dispatched && requestMayHaveCompleted(error);
      if (!dispatched) setStorageProblem(true);
      if (dispatched && !uncertain) {
        try {
          store(null);
        } catch {
          setStorageProblem(true);
        }
      }
      setMessage(
        `${(error as Error).message}${
          uncertain
            ? ' The outcome is uncertain. Retry the exact saved request; it cannot start AI a second time.'
            : dispatched
              ? ' No new attempt will be sent automatically. The current table shows any earlier completed change.'
              : ' No request was sent.'
        }`,
      );
    } finally {
      pending.current = false;
      setBusy(false);
      onPending(false);
    }
  }
  const name = (playerId: string) =>
    game.players.find((player) => player.id === playerId)?.name ?? 'Player';
  return (
    <details
      className="notice min-w-0"
      open={expanded}
      onToggle={(event) => setExpanded(event.currentTarget.open)}
    >
      <summary className="min-h-11 cursor-pointer py-3 text-base font-semibold focus-visible:outline-2 focus-visible:outline-offset-2">
        Let a player start AI for your seat
      </summary>
      <p>
        Choose another human player who may start your chosen AI once, within 24
        hours. They can use this permission even while you are online. They get
        no access to your hand or seat credentials. You keep your seat, recovery
        kit and Take back control button.
      </p>
      <p className="fine">
        AI may spend spice, move forces and commit battle plans. Completed
        decisions cannot be undone. Replacing or revoking permission, changing
        your own AI control, or recovering or transferring either seat
        invalidates unused permission.
      </p>
      {record || storageProblem ? (
        <section
          aria-label="Unconfirmed AI permission request"
          className="flex flex-col gap-3"
        >
          <p>
            Confirm the saved request before granting another permission.
            Refresh keeps the same request in this tab.
          </p>
          {record && (
            <Button
              className="min-h-11 whitespace-normal"
              disabled={locked}
              onClick={() => void submit(record)}
            >
              Retry saved AI permission request
            </Button>
          )}
          <label className="flex min-h-11 items-center gap-3">
            <input
              type="checkbox"
              checked={abandon}
              disabled={locked}
              onChange={(event) => setAbandon(event.target.checked)}
            />
            I understand discarding this record cannot cancel a request that
            reached the server.
          </label>
          <Button
            className="min-h-11 whitespace-normal"
            variant="outline"
            disabled={locked || !abandon}
            onClick={() => {
              try {
                store(null);
                setAbandon(false);
                setMessage(
                  'Retry record discarded. Check the current permission; revoke it or take back control if needed.',
                );
              } catch (error) {
                setMessage((error as Error).message);
              }
            }}
          >
            Discard retry record
          </Button>
        </section>
      ) : (
        <div className="flex min-w-0 flex-col gap-4">
          {ownGrant && (
            <section aria-label="Your AI permission">
              <p>
                {name(ownGrant.delegateId)} · {ownGrant.difficulty} ·{' '}
                {ownGrant.usedAt !== null
                  ? 'Already used'
                  : ownGrant.expiresAt <= now
                    ? 'Expired'
                    : 'Available once'}
                .
              </p>
              <p className="fine">
                Expires {new Date(ownGrant.expiresAt).toLocaleString()}.
              </p>
              {ownGrant.usedAt === null && (
                <Button
                  className="min-h-11 whitespace-normal"
                  variant="outline"
                  disabled={locked || closed}
                  onClick={() =>
                    void submit({
                      type: 'revokeSeatAiDelegate',
                      version: game.version,
                      grantId: ownGrant.grantId,
                    })
                  }
                >
                  Revoke AI permission
                </Button>
              )}
            </section>
          )}
          {closed ? <p>The room is closed. New AI permission changes are stopped; exact saved requests can still confirm earlier completed actions.</p> : paused && <p>The room is paused. New AI permissions and activation will be available after it resumes. Revoking permission and confirming saved requests remain available.</p>}
          {started && !paused && !own.autopilot && peers.length > 0 && (
            <div className="flex min-w-0 flex-col gap-3">
              <label htmlFor={`${id}-player`}>
                Player allowed to start your AI
              </label>
              <select
                id={`${id}-player`}
                className="min-h-11 min-w-0 w-full rounded border border-[#454b3c] bg-[#141814] px-3"
                value={delegateId}
                disabled={locked}
                onChange={(event) => setDelegateId(event.target.value)}
              >
                <option value="">Choose a player</option>
                {peers.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.name}
                  </option>
                ))}
              </select>
              <label htmlFor={`${id}-difficulty`}>
                Authorized AI difficulty
              </label>
              <select
                id={`${id}-difficulty`}
                className="min-h-11 min-w-0 w-full rounded border border-[#454b3c] bg-[#141814] px-3"
                value={difficulty}
                disabled={locked}
                onChange={(event) => {
                  if (
                    DIFFICULTIES.some((choice) => choice === event.target.value)
                  )
                    setDifficulty(event.target.value as Difficulty);
                }}
              >
                {DIFFICULTIES.map((choice) => (
                  <option key={choice}>{choice}</option>
                ))}
              </select>
              <Button
                className="min-h-11 whitespace-normal"
                disabled={
                  locked || !peers.some((player) => player.id === delegateId)
                }
                onClick={() =>
                  void submit({
                    type: 'setSeatAiDelegate',
                    version: game.version,
                    grantId: randomId(),
                    delegateId,
                    difficulty,
                  })
                }
              >
                {ownGrant
                  ? 'Replace AI permission'
                  : 'Allow this player to start AI once'}
              </Button>
            </div>
          )}
          {!started && <p>Permission can be granted after the game starts.</p>}
          {own.autopilot && (
            <p>
              Your seat is assigned to AI{paused ? ', currently paused with the room' : ''}. Use Take back control at the table
              before granting another permission.
            </p>
          )}
          {received.map((grant) => (
            <section
              key={grant.grantId}
              aria-label={`AI permission from ${name(grant.ownerId)}`}
            >
              <p>
                {name(grant.ownerId)} authorized you to start {grant.difficulty}{' '}
                AI for their seat once.
              </p>
              <p className="fine">
                Expires {new Date(grant.expiresAt).toLocaleString()}.
              </p>
              {grant.usedAt !== null ? (
                <p>Permission already used.</p>
              ) : grant.expiresAt <= now ? (
                <p>Permission expired.</p>
              ) : (
                <Button
                  className="min-h-11 whitespace-normal"
                  disabled={
                    locked ||
                    paused ||
                    !started ||
                    !!game.players.find((player) => player.id === grant.ownerId)
                      ?.autopilot
                  }
                  onClick={() =>
                    void submit({
                      type: 'useSeatAiDelegate',
                      version: game.version,
                      ownerId: grant.ownerId,
                      grantId: grant.grantId,
                    })
                  }
                >
                  Start {name(grant.ownerId)}’s authorized AI
                </Button>
              )}
            </section>
          ))}
        </div>
      )}
      {message && <output className="block py-2">{message}</output>}
    </details>
  );
}
