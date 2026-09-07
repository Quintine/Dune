'use client';
import Link from 'next/link';
import { useState, useEffect, useCallback, useRef } from 'react';
import { GameTable } from '@/components/game-table';
import {
  SeatRecoverySetup,
  SeatRecoveryClaim,
} from '@/components/seat-recovery';
import type { GameView, Action } from '@/game/engine';
import {
  ArrowRight,
  Users,
  BookOpen,
  Globe,
  ChevronRight,
  Shield,
  Orbit,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FACTIONS, EXPANSIONS, faction } from '@/game/catalog';
import {
  ClientRequestError,
  requestJson,
  requestMayHaveCompleted,
} from '@/lib/client-request';

import {
  ROOM_ENTRY_STORAGE_KEY,
  clearRoomEntry,
  createRoomEntry,
  parseRoomEntry,
  roomEntryConfirmed,
  roomEntryRejectedBeforeCommit,
  roomEntryUrl,
  saveRoomEntry,
  type RoomEntryAttempt,
} from '@/lib/room-entry';

// A rejected invitation needs the ordinary join form, not network recovery.
const inviteRejected = (error: unknown) =>
  error instanceof ClientRequestError &&
  error.kind === 'http' &&
  [401, 403, 404, 409].includes(error.status ?? 0);
export default function Home() {
  const activeRoom = useRef<string | null>(null);
  const activeSeat = useRef<string | null>(null);
  const mutationPending = useRef(false);
  const reconnectPending = useRef(false);
  const [checkingConnection, setCheckingConnection] = useState(false);
  const reads = useRef(new Map<string, Promise<GameView>>());
  const knownVersions = useRef(new Map<string, number>());
  const recovery = useRef<{ room: string; epoch: number } | null>(null);
  const epoch = useRef(0);
  const botAttempt = useRef<{ room: string; version: number } | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [restoreFailed, setRestoreFailed] = useState(false);
  const [needsReconcile, setNeedsReconcile] = useState(false);
  const [botRecovery, setBotRecovery] = useState(false);
  const [game, setGame] = useState<GameView | null>(null);
  const [busy, setBusy] = useState(false);
  const [connection, setConnection] = useState('');
  const [selected, setSelected] = useState('atreides');
  const [expansions, setExpansions] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [notice, setNotice] = useState('');
  const seatClaimUncertain = useRef(false);
  const [claimUncertain, setClaimUncertain] = useState(false);
  const pendingEntry = useRef<RoomEntryAttempt | null>(null);
  const [entryAttempt, setEntryAttempt] = useState<RoomEntryAttempt | null>(
    null,
  );
  const [entryProblem, setEntryProblem] = useState('');
  const [showEntryRecovery, setShowEntryRecovery] = useState(false);
  const [abandonAcknowledged, setAbandonAcknowledged] = useState(false);
  const f = faction(selected);
  const roomCode = game?.code;
  // This function is deliberately GET-only, including WebMCP reads and recovery.
  const refresh = useCallback(
    async (room: string, fresh = false): Promise<GameView> => {
      let pending = reads.current.get(room);
      if (pending && !fresh) return pending;
      // Reconciliation must start after previously issued reads have settled.
      while (pending) {
        await pending.catch(() => {});
        pending = reads.current.get(room);
      }
      const readEpoch = epoch.current;
      const request = requestJson<GameView>(`/api/rooms/${room}`, {
        cache: 'no-store',
      })
        .then((data) => {
          if (
            activeRoom.current !== room ||
            readEpoch !== epoch.current ||
            data.version < (knownVersions.current.get(room) ?? -1)
          )
            throw new ClientRequestError(
              'This read belongs to an older table or seat. Read the current table again.',
              'aborted',
            );
          activeSeat.current = data.me;
          knownVersions.current.set(room, data.version);
          setGame((previous) =>
            !previous ||
            previous.code !== data.code ||
            data.version >= previous.version
              ? data
              : previous,
          );
          setConnection('');
          if (
            recovery.current?.room === room &&
            recovery.current.epoch === readEpoch
          ) {
            recovery.current = null;
            setNeedsReconcile(false);
          }
          if (
            botAttempt.current?.room === room &&
            ((!data.botsPending &&
              data.version >= botAttempt.current.version) ||
              data.version > botAttempt.current.version)
          ) {
            botAttempt.current = null;
            setBotRecovery(false);
          }
          return data;
        })
        .finally(() => {
          reads.current.delete(room);
        });
      reads.current.set(room, request);
      return request;
    },
    [],
  );

  const reconcile = useCallback(
    async (room: string) => {
      recovery.current = { room, epoch: ++epoch.current };
      setNeedsReconcile(true);
      try {
        await refresh(room, true);
      } catch {
        if (activeRoom.current === room)
          setConnection(
            'Reconnect to confirm the latest table before taking another action.',
          );
      }
    },
    [refresh],
  );

  const advanceBots = useCallback(
    async (data: GameView, explicit = false) => {
      const room = data.code;
      if (
        !data.botsPending ||
        activeRoom.current !== room ||
        data.me !== activeSeat.current ||
        data.version < (knownVersions.current.get(room) ?? -1) ||
        mutationPending.current ||
        recovery.current
      )
        return;
      if (
        !explicit &&
        botAttempt.current?.room === room &&
        botAttempt.current.version === data.version
      )
        return;
      const seat = activeSeat.current,
        requestEpoch = epoch.current;
      mutationPending.current = true;
      setBusy(true);
      botAttempt.current = { room, version: data.version };
      try {
        const next = await requestJson<GameView>(`/api/rooms/${room}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            version: data.version,
            action: { type: 'advanceBots' },
          }),
        });
        if (
          activeRoom.current === room &&
          activeSeat.current === seat &&
          epoch.current === requestEpoch
        ) {
          knownVersions.current.set(
            room,
            Math.max(next.version, knownVersions.current.get(room) ?? -1),
          );
          setGame((previous) =>
            !previous ||
            previous.code !== room ||
            next.version >= previous.version
              ? next
              : previous,
          );
          botAttempt.current = null;
          setBotRecovery(false);
        }
      } catch (error) {
        if (
          activeRoom.current === room &&
          activeSeat.current === seat &&
          epoch.current === requestEpoch
        ) {
          // A confirmed rejection may be retried from a new read. An uncertain POST is never replayed.
          const rejected =
            error instanceof ClientRequestError &&
            error.kind === 'http' &&
            error.status === 409;
          if (rejected) botAttempt.current = null;
          else setBotRecovery(true);
          await reconcile(room);
        }
      } finally {
        mutationPending.current = false;
        setBusy(false);
      }
    },
    [reconcile],
  );

  useEffect(() => {
    // A saved entry always gets an explicit retry screen. A GET with another
    // seat's cookie cannot prove which create/join operation completed.
    try {
      const saved = window.sessionStorage.getItem(ROOM_ENTRY_STORAGE_KEY);
      if (saved !== null) {
        const attempt = parseRoomEntry(saved);
        pendingEntry.current = attempt;
        // oxlint-disable-next-line react/react-compiler -- Hydrate an external tab-scoped recovery record after SSR.
        setEntryAttempt(attempt);
        setRestoring(false);
        return;
      }
    } catch {
      setEntryProblem(
        'The saved room request could not be read safely. It has not been sent or deleted. Restore access to this tab’s storage and reload, or deliberately abandon it below.',
      );
      setRestoring(false);
      return;
    }
    const room = new URLSearchParams(window.location.search).get('room');
    let live = true;
    if (room && /^[A-Z2-9]{8}$/.test(room)) {
      activeRoom.current = room;
      // oxlint-disable-next-line react/react-compiler -- Restore server-owned state from the external invite URL; refresh awaits the network.
      void refresh(room)
        .catch((error: Error) => {
          if (live && activeRoom.current === room) {
            setCode(room);
            setNotice(error.message);
            if (inviteRejected(error)) activeRoom.current = null;
            else setRestoreFailed(true);
          }
        })
        .finally(() => {
          if (live) setRestoring(false);
        });
    } else {
      // oxlint-disable-next-line react/react-compiler -- The SSR-safe restoration placeholder resolves after checking the browser's invite URL.
      setRestoring(false);
    }
    return () => {
      live = false;
    };
  }, [refresh]);

  useEffect(() => {
    if (!roomCode) return;
    let live = true;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      let nextPollMs = 2000;
      try {
        if (
          live &&
          document.visibilityState === 'visible' &&
          !mutationPending.current
        ) {
          const data = await refresh(roomCode);
          // Authenticated reads resume the persisted queue. Poll often enough to
          // display each paced action without posting redundant wake-up mutations.
          nextPollMs = data.botsPending ? 500 : 2000;
        }
      } catch {
        if (live && activeRoom.current === roomCode)
          setConnection('Connection interrupted. Retrying…');
      } finally {
        // Schedule after completion, so slow requests cannot stack polling cycles.
        if (live) timer = setTimeout(tick, nextPollMs);
      }
    };
    timer = setTimeout(tick, 2000);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [roomCode, refresh]);

  async function dispatchEntry(
    attempt: RoomEntryAttempt,
    firstDispatch = false,
  ) {
    if (
      mutationPending.current ||
      recovery.current ||
      pendingEntry.current !== attempt ||
      seatClaimUncertain.current
    )
      return;
    const requestEpoch = ++epoch.current;
    mutationPending.current = true;
    setNotice('');
    setBusy(true);
    try {
      const data = await requestJson<GameView>(roomEntryUrl(attempt), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: attempt.bodyText,
      });
      if (requestEpoch !== epoch.current || pendingEntry.current !== attempt)
        return;
      if (
        !roomEntryConfirmed(attempt, data, firstDispatch) ||
        data.version < (knownVersions.current.get(data.code) ?? -1)
      )
        throw new ClientRequestError(
          'The response did not confirm this saved room request. Its proof is retained; retry the same request or deliberately abandon it.',
          'invalid-response',
        );
      try {
        clearRoomEntry(window.sessionStorage);
        pendingEntry.current = null;
        setEntryAttempt(null);
        setEntryProblem('');
      } catch {
        setNotice(
          'Your seat is confirmed, but this tab could not confirm removal of its private retry proof. Review the saved request when storage is available.',
        );
      }
      activeRoom.current = data.code;
      activeSeat.current = data.me;
      knownVersions.current.set(data.code, data.version);
      recovery.current = null;
      botAttempt.current = null;
      setBotRecovery(false);
      setNeedsReconcile(false);
      setShowEntryRecovery(false);
      setAbandonAcknowledged(false);
      setGame(data);
      window.history.replaceState(null, '', `/?room=${data.code}`);
    } catch (error) {
      if (requestEpoch === epoch.current && pendingEntry.current === attempt) {
        if (roomEntryRejectedBeforeCommit(firstDispatch, error)) {
          try {
            clearRoomEntry(window.sessionStorage);
            pendingEntry.current = null;
            setEntryAttempt(null);
            setEntryProblem('');
            setNotice((error as Error).message);
            return;
          } catch {
            setNotice(
              `${(error as Error).message} Nothing was committed by this request, but removal of its saved proof could not be confirmed. Restore browser storage and reload, or explicitly abandon the saved request.`,
            );
            return;
          }
        }
        const uncertain = requestMayHaveCompleted(error);
        setNotice(
          uncertain
            ? `${(error as Error).message} The request may have completed. Use the explicit retry to send its exact saved proof; it has not been sent again automatically.`
            : `${(error as Error).message} The saved request is retained. Retry it unchanged, or deliberately abandon it before changing your details.`,
        );
      }
    } finally {
      mutationPending.current = false;
      setBusy(false);
    }
  }

  async function enter(join = false) {
    if (
      mutationPending.current ||
      recovery.current ||
      pendingEntry.current ||
      seatClaimUncertain.current ||
      entryProblem
    )
      return;
    let attempt: RoomEntryAttempt;
    try {
      attempt = createRoomEntry(
        { name, faction: selected, expansions, advanced: false },
        join ? code : undefined,
      );
    } catch {
      setNotice(
        'Check your name, room code and faction before trying again. Nothing was sent.',
      );
      return;
    }
    try {
      // Storage must succeed before dispatch. Never overwrite an unresolved proof.
      saveRoomEntry(window.sessionStorage, attempt);
    } catch {
      setEntryProblem(
        'The request could not be safely saved in this tab. Nothing was sent. A saved record may still be present; restore access to browser storage and reload, or explicitly abandon the record below.',
      );
      return;
    }
    pendingEntry.current = attempt;
    setEntryAttempt(attempt);
    setAbandonAcknowledged(false);
    await dispatchEntry(attempt, true);
  }

  function exitTable() {
    if (
      mutationPending.current ||
      reconnectPending.current ||
      seatClaimUncertain.current
    )
      return;
    activeRoom.current = null;
    activeSeat.current = null;
    ++epoch.current;
    recovery.current = null;
    botAttempt.current = null;
    setNeedsReconcile(false);
    setBotRecovery(false);
    setConnection('');
    setGame(null);
    setNotice('');
    window.history.replaceState(null, '', '/');
  }

  function abandonEntry() {
    if (
      mutationPending.current ||
      seatClaimUncertain.current ||
      !abandonAcknowledged
    )
      return;
    try {
      clearRoomEntry(window.sessionStorage);
      pendingEntry.current = null;
      setEntryAttempt(null);
      setEntryProblem('');
      setShowEntryRecovery(false);
      setAbandonAcknowledged(false);
      setNotice(
        'The saved retry proof was removed. This did not cancel a room or seat already created on the server.',
      );
    } catch {
      setNotice(
        'Removal of the saved proof could not be confirmed. Restore access to this tab’s storage before abandoning this request.',
      );
    }
  }

  async function send(action: Action) {
    if (!game || mutationPending.current || recovery.current) return;
    const room = game.code,
      seat = game.me,
      requestEpoch = epoch.current;
    mutationPending.current = true;
    setBusy(true);
    setNotice('');
    try {
      const data = await requestJson<GameView>(`/api/rooms/${room}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: game.version, action }),
      });
      if (
        activeRoom.current === room &&
        activeSeat.current === seat &&
        epoch.current === requestEpoch
      ) {
        knownVersions.current.set(
          room,
          Math.max(data.version, knownVersions.current.get(room) ?? -1),
        );
        setGame((previous) =>
          !previous ||
          previous.code !== room ||
          data.version >= previous.version
            ? data
            : previous,
        );
      }
    } catch (error) {
      if (
        activeRoom.current === room &&
        activeSeat.current === seat &&
        epoch.current === requestEpoch
      ) {
        const uncertain = requestMayHaveCompleted(error);
        setNotice(
          uncertain
            ? `${(error as Error).message} Your action may have completed. It has not been sent again; check the refreshed table.`
            : (error as Error).message,
        );
        await reconcile(room);
      }
    } finally {
      mutationPending.current = false;
      setBusy(false);
    }
  }

  async function reconnect(resumeBots = false) {
    const room = activeRoom.current;
    if (!room || mutationPending.current || reconnectPending.current) return;
    reconnectPending.current = true;
    setCheckingConnection(true);
    setConnection('Checking the latest table…');
    try {
      const data = await refresh(room, true);
      if (restoreFailed && activeRoom.current === room) {
        setRestoreFailed(false);
        setNotice('');
      }
      if (resumeBots) await advanceBots(data, true);
    } catch (error) {
      if (activeRoom.current === room) {
        if (restoreFailed && inviteRejected(error)) {
          activeRoom.current = null;
          setRestoreFailed(false);
          setCode(room);
          setNotice((error as Error).message);
          setConnection('');
        } else
          setConnection(
            'Could not reconnect. Try again when the server is available.',
          );
      }
    } finally {
      reconnectPending.current = false;
      setCheckingConnection(false);
    }
  }
  function controlUncertain(uncertain: boolean) {
    seatClaimUncertain.current = uncertain;
    setClaimUncertain(uncertain);
  }

  function controlPending(pending: boolean) {
    mutationPending.current = pending;
    setBusy(pending);
  }

  function restoredSeat(view: GameView, claim = false) {
    if (
      !claim &&
      (activeRoom.current !== view.code || activeSeat.current !== view.me)
    )
      return;
    if (claim) {
      activeRoom.current = view.code;
      activeSeat.current = view.me;
      ++epoch.current;
      botAttempt.current = null;
      setBotRecovery(false);
      window.history.replaceState(null, '', `/?room=${view.code}`);
    }
    knownVersions.current.set(
      view.code,
      Math.max(view.version, knownVersions.current.get(view.code) ?? -1),
    );
    setGame((previous) =>
      claim ||
      !previous ||
      previous.code !== view.code ||
      view.version >= previous.version
        ? view
        : previous,
    );
    recovery.current = null;
    setNeedsReconcile(false);
    setRestoreFailed(false);
    setConnection('');
    setNotice('');
  }
  useEffect(() => {
    const ctx = (
      document as Document & {
        modelContext?: {
          registerTool: (tool: unknown, options: unknown) => Promise<void>;
        };
      }
    ).modelContext;
    if (!ctx) return;
    const lifecycle = new AbortController();
    try {
      Promise.resolve(
        ctx.registerTool(
          {
            name: 'read_dune_table',
            description:
              'Read the current Dune table, including only information visible to this player.',
            inputSchema: {
              type: 'object',
              properties: {},
              additionalProperties: false,
            },
            annotations: { readOnlyHint: true, untrustedContentHint: true },
            execute: () =>
              roomCode ? refresh(roomCode) : { status: 'not_seated' },
          },
          { signal: lifecycle.signal },
        ),
      ).catch(() => {});
    } catch {}
    return () => lifecycle.abort();
  }, [roomCode, refresh]);
  if (game)
    return (
      <>
        <GameTable
          game={game}
          send={send}
          busy={busy || needsReconcile}
          onExit={exitTable}
        />
        <div className="table-shell">
          {(entryAttempt || entryProblem) && (
            <section className="notice">
              <p>
                A previous room request still has private retry proof saved in
                this tab. Opening this seat did not remove it.
              </p>
              <Button
                variant="outline"
                disabled={busy || checkingConnection}
                onClick={exitTable}
              >
                Review saved room request
              </Button>
            </section>
          )}
          <SeatRecoverySetup
            key={`${game.code}:${game.me}`}
            game={game}
            disabled={busy || needsReconcile || checkingConnection}
            onPending={controlPending}
            onRestored={(view) => restoredSeat(view)}
          />
        </div>
        {(notice || connection || needsReconcile || botRecovery) && (
          <output className="floating-notice">
            {notice && <span>{notice}</span>}
            {connection && <span>{connection}</span>}
            {needsReconcile && (
              <span>Actions paused until the current table is confirmed.</span>
            )}
            {(connection || needsReconcile) && (
              <Button
                variant="outline"
                disabled={busy || checkingConnection}
                onClick={() => void reconnect()}
              >
                Reconnect
              </Button>
            )}
            {botRecovery && (
              <>
                <span>
                  AI progress was not confirmed. Check the table before
                  resuming.
                </span>
                <Button
                  variant="outline"
                  disabled={busy || checkingConnection || needsReconcile}
                  onClick={() => void reconnect(true)}
                >
                  Check and resume AI
                </Button>
              </>
            )}
            <button onClick={() => setNotice('')} aria-label="Dismiss message">
              ×
            </button>
          </output>
        )}
      </>
    );
  if (restoring || restoreFailed)
    return (
      <main className="table-shell" aria-busy={restoring || checkingConnection}>
        <header className="masthead">
          <div className="wordmark">
            DUNE<span>ARRAKIS TABLE</span>
          </div>
        </header>
        <section className="notice">
          <h1>
            {restoring
              ? 'Restoring your table'
              : 'Your table could not be restored'}
          </h1>
          <output aria-live="polite">
            {restoring
              ? 'Checking your saved seat and the latest game state…'
              : connection || notice}
          </output>
          {restoreFailed && !restoring && (
            <>
              <p>
                Retry to check your saved seat and current game. This does not
                join a new seat or take a game action.
              </p>
              <Button
                disabled={checkingConnection}
                onClick={() => void reconnect()}
              >
                Retry restoration
              </Button>
              <Button
                variant="outline"
                disabled={checkingConnection}
                onClick={() => {
                  activeRoom.current = null;
                  setRestoreFailed(false);
                  setConnection('');
                  setNotice('');
                }}
              >
                Open join form
              </Button>
            </>
          )}
        </section>
      </main>
    );
  if (entryAttempt || entryProblem)
    return (
      <main className="table-shell" aria-busy={busy}>
        <header className="masthead">
          <div className="wordmark">
            DUNE<span>ARRAKIS TABLE</span>
          </div>
        </header>
        <section className="notice room-entry-panel">
          <h1>
            {entryAttempt
              ? `Saved ${entryAttempt.kind === 'create' ? 'room creation' : 'room join'} request`
              : 'Saved request needs attention'}
          </h1>
          {entryAttempt && (
            <p>
              {entryAttempt.kind === 'join'
                ? `Room ${entryAttempt.roomCode}. `
                : ''}
              Prepared {new Date(entryAttempt.createdAt).toLocaleString()}.
            </p>
          )}
          <p>
            This tab keeps your retry details through refresh. Keep it open
            until the request is resolved; closing it or clearing browser data
            can remove those details.
          </p>
          <p>
            A response may have been lost after the server created a room or
            seat. Retry sends the exact same request and private proof. It does
            not start a new attempt. No request is retried automatically.
          </p>
          {entryProblem && <p role="alert">{entryProblem}</p>}
          {notice && <output aria-live="polite">{notice}</output>}
          {entryAttempt && (
            <Button
              disabled={busy || claimUncertain}
              onClick={() => void dispatchEntry(entryAttempt)}
            >
              Retry same {entryAttempt.kind === 'create' ? 'create' : 'join'}{' '}
              request
            </Button>
          )}
          <p>
            Keep this proof until the request is resolved. Abandoning removes
            only this tab’s retry proof; it cannot undo a room or seat already
            created. You may lose access without a saved recovery kit, and a new
            attempt can create a duplicate room or seat.
          </p>
          <label>
            <input
              type="checkbox"
              checked={abandonAcknowledged}
              disabled={busy || claimUncertain}
              onChange={(event) => setAbandonAcknowledged(event.target.checked)}
            />{' '}
            I understand that abandoning can lose access to a completed request.
          </label>
          <Button
            variant="outline"
            disabled={busy || claimUncertain || !abandonAcknowledged}
            onClick={abandonEntry}
          >
            Abandon saved request
          </Button>
          <p>
            A previously saved seat recovery kit can still be used. This keeps
            the room-entry proof; the recovered seat may be different.
          </p>
          <Button
            variant="outline"
            disabled={busy || claimUncertain}
            onClick={() => setShowEntryRecovery((shown) => !shown)}
          >
            {showEntryRecovery
              ? 'Hide saved-kit recovery'
              : 'Use a saved recovery kit'}
          </Button>
          {claimUncertain && (
            <output>
              Seat recovery may have completed. Retry the current recovery
              request below first. Room-entry retry, abandonment and navigation
              are paused to preserve its exact recovery details.
            </output>
          )}
          {(showEntryRecovery || claimUncertain) && (
            <SeatRecoveryClaim
              initialCode={entryAttempt?.roomCode ?? undefined}
              disabled={busy || checkingConnection}
              onPending={controlPending}
              onUncertain={controlUncertain}
              onRestored={(view) => restoredSeat(view, true)}
            />
          )}
        </section>
      </main>
    );
  return (
    <main className="table-shell">
      <header className="masthead">
        <div className="wordmark">
          DUNE<span>ARRAKIS TABLE</span>
        </div>
        <div className="masthead-right">
          <span className="status-dot" /> Multiplayer table{' '}
          <Link href="/rules">
            <BookOpen size={17} />
            Rulebook
          </Link>
        </div>
      </header>
      <div className="lobby-grid">
        <aside className="faction-sidebar">
          <div className="eyebrow">01 / CHOOSE YOUR FACTION</div>
          <h1>
            A seat in the
            <br />
            Imperium.
          </h1>
          <div className="faction-list">
            {FACTIONS.filter(
              (x) => x.expansion === 'base' || expansions.includes(x.expansion),
            ).map((x) => (
              <button
                className={`faction-choice ${selected === x.id ? 'selected' : ''}`}
                key={x.id}
                disabled={busy || claimUncertain}
                onClick={() => setSelected(x.id)}
                style={{ '--faction-color': x.color } as React.CSSProperties}
              >
                <span className="sigil">{x.sigil}</span>
                <span>
                  <strong>{x.name}</strong>
                  <small>{x.title}</small>
                </span>
                <ChevronRight size={17} />
              </button>
            ))}
          </div>
        </aside>
        <section className="planet-stage">
          <div className="stage-top">
            <span>ARRAKIS</span>
            <span>89.04° N / IMPERIAL SURVEY</span>
          </div>
          <div className="planet-preview" aria-label="Schematic of Arrakis">
            <div className="orbital-ring ring-one" />
            <div className="orbital-ring ring-two" />
            <div className="planet-core">
              <Orbit size={86} strokeWidth={0.65} />
              <span>POLAR SINK</span>
            </div>
            {[
              'Arrakeen',
              'Carthag',
              'Tuek’s Sietch',
              'Habbanya Sietch',
              'Sietch Tabr',
            ].map((t, i) => (
              <div key={t} className={`map-point point-${i}`}>
                <Shield size={19} />
                <span>{t}</span>
              </div>
            ))}
            <div className="storm-line" />
            <span className="north-label">N</span>
          </div>
          <div
            className="faction-feature"
            style={{ '--faction-color': f.color } as React.CSSProperties}
          >
            <span className="eyebrow">YOUR HOUSE</span>
            <h2>{f.name}</h2>
            <p>{f.description}</p>
            <div className="feature-stats">
              <span>
                <b>{f.spice}</b>Starting spice
              </span>
              <span>
                <b>20</b>Forces
              </span>
              <span>
                <b>{f.revival}</b>Free revival
              </span>
            </div>
          </div>
          <div className="stage-bottom">
            <span>THE SPICE MUST FLOW</span>
            <span>CLASSIC / 2019</span>
          </div>
        </section>
        <aside className="setup-panel">
          <div className="eyebrow">02 / ASSEMBLE THE TABLE</div>
          <h2>Begin a game</h2>
          <p className="muted">
            Invite your rivals. Decide the fate of Arrakis.
          </p>
          <label htmlFor="name">Your name</label>
          <Input
            id="name"
            disabled={busy || claimUncertain}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your name"
            maxLength={32}
          />
          <div className="setting-title">
            <span>Rules</span>
            <span className="pill">BASIC</span>
          </div>
          <p className="fine">2–6 players · up to 10 turns</p>
          <div className="setting-title">
            <span>Expansions</span>
            <span className="fine">Optional modules</span>
          </div>
          <div className="expansion-list">
            {EXPANSIONS.map((x) => (
              <label className="expansion" key={x.id}>
                <input
                  type="checkbox"
                  disabled={busy || claimUncertain}
                  checked={expansions.includes(x.id)}
                  onChange={(e) => {
                    setExpansions(
                      e.target.checked
                        ? [...expansions, x.id]
                        : expansions.filter((v) => v !== x.id),
                    );
                    setSelected('atreides');
                  }}
                />
                <span>{x.name}</span>
              </label>
            ))}
          </div>
          <Button
            className="primary-action"
            disabled={busy || claimUncertain || needsReconcile || !name.trim()}
            onClick={() => void enter()}
          >
            <Users size={17} />
            Create a room
            <ArrowRight size={17} />
          </Button>
          <div className="join-divider">OR JOIN YOUR FRIENDS</div>
          <label htmlFor="code">Room code</label>
          <div className="join-row">
            <Input
              id="code"
              disabled={busy || claimUncertain}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABCD2345"
              maxLength={8}
            />
            <Button
              variant="outline"
              disabled={
                busy ||
                claimUncertain ||
                needsReconcile ||
                !name.trim() ||
                code.length !== 8
              }
              onClick={() => void enter(true)}
              aria-label="Join room"
            >
              <ArrowRight size={19} />
            </Button>
          </div>
          <SeatRecoveryClaim
            initialCode={code || undefined}
            disabled={busy || needsReconcile || checkingConnection}
            onPending={controlPending}
            onUncertain={controlUncertain}
            onRestored={(view) => restoredSeat(view, true)}
          />
          {claimUncertain && (
            <output className="notice">
              Seat recovery may have completed. Retry the current recovery
              request before creating or joining a room; keep this page open to
              preserve its exact details.
            </output>
          )}
          {notice && <output className="notice">{notice}</output>}
          <div className="table-note">
            <Globe size={18} />
            <span>
              Private hands. Shared board.
              <br />
              Every decision matters.
            </span>
          </div>
          <p className="development-note">
            In development · Rules verification in progress.
          </p>
        </aside>
      </div>
      <footer>
        <span>Unofficial fan implementation</span>
        <span>Dune · A game of conquest, diplomacy & betrayal</span>
      </footer>
    </main>
  );
}
