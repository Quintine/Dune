'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { GameView } from '@/game/engine';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { requestJson } from '@/lib/client-request';
import {
  HANDOVER_CLAIM_STORAGE_KEY,
  clearHandoverClaim,
  createHandoverClaim,
  createHandoverKit,
  handoverClaimConfirmed,
  handoverOwnerStorageKey,
  parseHandoverClaim,
  parseHandoverKit,
  saveHandoverClaim,
  serializeHandoverKit,
  type SavedHandoverClaim,
  type SeatHandoverKit,
} from '@/lib/seat-handover';

type OwnerRecord = {
  kit: SeatHandoverKit;
  expiresAt: number | null;
  operation: 'create' | 'revoke' | null;
};
type ViewCallback = (view: GameView) => void;

/** Mount by room + seat, so a browser never carries one owner's kit into another seat. */
export function SeatHandoverSetup({
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
  onRestored: ViewCallback;
}) {
  const id = useId(),
    pending = useRef(false);
  const storageKey = handoverOwnerStorageKey(game.code, game.me);
  const [record, setRecord] = useState<OwnerRecord | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [initialRequestPending, setInitialRequestPending] = useState(false);
  const [replaceAcknowledged, setReplaceAcknowledged] = useState(false);
  const closed = !!game.roomControl?.closed;
  const own = game.players.find((player) => player.id === game.me);
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved !== null) {
        const value: unknown = JSON.parse(saved);
        if (!value || typeof value !== 'object') throw new Error();
        const stored = value as OwnerRecord,
          kit = parseHandoverKit(JSON.stringify(stored.kit));
        if (
          kit.roomCode !== game.code ||
          kit.playerId !== game.me ||
          (stored.expiresAt !== null &&
            (!Number.isSafeInteger(stored.expiresAt) ||
              stored.expiresAt < 0)) ||
          ![null, 'create', 'revoke'].includes(stored.operation)
        )
          throw new Error();
        // oxlint-disable-next-line react/react-compiler -- Restore this seat's private tab-scoped offer after SSR.
        setRecord({
          kit,
          expiresAt: stored.expiresAt,
          operation: stored.operation,
        });
      }
    } catch {
      setMessage(
        'The saved offer could not be read. Creating a replacement will invalidate any previous offer when confirmed.',
      );
    }
    setLoaded(true);
  }, [storageKey, game.code, game.me]);
  useEffect(() => {
    onUncertain(!loaded || !!record?.operation);
  }, [loaded, record, onUncertain]);
  if (!own) return null;

  function store(next: OwnerRecord | null) {
    const text = next ? JSON.stringify(next) : null;
    if (text === null) sessionStorage.removeItem(storageKey);
    else sessionStorage.setItem(storageKey, text);
    if (sessionStorage.getItem(storageKey) !== text)
      throw new Error('The offer details could not be saved in this tab.');
    setRecord(next);
  }
  async function submit(operation: 'create' | 'revoke', kit: SeatHandoverKit) {
    if (disabled || pending.current || (closed && !record?.operation)) return;
    pending.current = true;
    setReplaceAcknowledged(false);
    setBusy(true);
    setInitialRequestPending(!record?.operation);
    onPending(true);
    try {
      store({ kit, expiresAt: record?.expiresAt ?? null, operation });
      const result = await requestJson<{
        view: GameView;
        expiresAt?: number;
        revoked?: true;
      }>(`/api/rooms/${game.code}/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          operation === 'create'
            ? {
                type: 'createSeatHandover',
                version: game.version,
                offerId: kit.offerId,
                handoverSecret: kit.handoverSecret,
              }
            : {
                type: 'revokeSeatHandover',
                version: game.version,
                offerId: kit.offerId,
              },
        ),
      });
      if (
        result.view?.code !== kit.roomCode ||
        result.view?.me !== kit.playerId ||
        (operation === 'create'
          ? !Number.isSafeInteger(result.expiresAt)
          : result.revoked !== true)
      )
        throw new Error('The server did not confirm the offer.');
      store(
        operation === 'create'
          ? { kit, expiresAt: result.expiresAt!, operation: null }
          : null,
      );
      onRestored(result.view);
      setMessage(
        operation === 'create'
          ? 'Handover ready. Share this complete kit privately with the intended new player.'
          : 'Handover cancelled. This kit can no longer transfer your seat.',
      );
    } catch (error) {
      setMessage(
        `${(error as Error).message} Keep this tab open. Retry the same operation to confirm its outcome; no retry is automatic.`,
      );
    } finally {
      pending.current = false;
      setInitialRequestPending(false);
      setBusy(false);
      onPending(false);
    }
  }
  return (
    <details className="notice">
      <summary className="cursor-pointer text-base font-semibold">
        Pass your seat to another player
      </summary>
      <p>
        Create a private, one-time handover for {own.name}. The recipient keeps
        this faction, its private hand and all progress. Acceptance revokes your
        browser sessions and recovery kits for this seat. The new owner should
        protect their saved seat with a new recovery kit.
      </p>
      <p className="fine">
        The offer expires after 24 hours. You can keep playing until it is
        accepted. Recovering your seat invalidates its pending handover. Only
        share the kit with the intended recipient.
      </p>
      {closed && <p>The room is closed. New handovers and cancellations are stopped; exact saved requests can still confirm a completed change.</p>}
      {initialRequestPending ? <output className="block">Saving handover…</output> : !record ? (
        <Button
          variant="outline"
          disabled={disabled || closed || busy || !loaded}
          onClick={() => {
            try {
              void submit('create', createHandoverKit(game.code, game.me));
            } catch (error) {
              setMessage((error as Error).message);
            }
          }}
        >
          Create private handover
        </Button>
      ) : (
        <div className="space-y-3">
          {record.operation ? (
            <>
              <p>
                {record.operation === 'create'
                  ? 'Offer creation is not confirmed. Confirm it before sharing the kit.'
                  : 'Cancellation is not confirmed. The kit may still be usable.'}
              </p>
              <Button
                disabled={disabled || busy}
                onClick={() => void submit(record.operation!, record.kit)}
              >
                Retry same{' '}
                {record.operation === 'create' ? 'offer' : 'cancellation'}
              </Button>
            </>
          ) : (
            <>
              <label htmlFor={`${id}-kit`}>
                Private handover kit for room {game.code}
              </label>
              <Textarea
                id={`${id}-kit`}
                readOnly
                value={serializeHandoverKit(record.kit)}
                rows={9}
                spellCheck={false}
                autoComplete="off"
                className="font-mono text-sm"
              />
              <p className="fine">
                Expires: {new Date(record.expiresAt!).toLocaleString()}. Send
                the complete kit privately. The recipient can choose “Accept a
                seat handover” on the home page.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() =>
                    void navigator.clipboard
                      .writeText(serializeHandoverKit(record.kit))
                      .then(() => setMessage('Private handover kit copied.'))
                      .catch(() =>
                        setMessage(
                          'Select and copy the complete kit manually.',
                        ),
                      )
                  }
                >
                  Copy handover kit
                </Button>
                <Button
                  variant="outline"
                  disabled={disabled || closed || busy}
                  onClick={() => void submit('revoke', record.kit)}
                >
                  Cancel handover
                </Button>
              </div>
            </>
          )}
          {record.operation && (
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={replaceAcknowledged}
                disabled={disabled || busy}
                onChange={(event) =>
                  setReplaceAcknowledged(event.target.checked)
                }
              />
              I understand a confirmed replacement invalidates the previous kit.
              It cannot undo a handover already accepted.
            </label>
          )}
          <Button
            variant="outline"
            disabled={
              disabled || closed || busy || (!!record.operation && !replaceAcknowledged)
            }
            onClick={() => {
              try {
                void submit('create', createHandoverKit(game.code, game.me));
              } catch (error) {
                setMessage((error as Error).message);
              }
            }}
          >
            Replace with a new handover
          </Button>
          <p className="fine">
            A confirmed replacement invalidates the older kit. This tab keeps
            the private offer details across refresh; closing the tab can remove
            them.
          </p>
        </div>
      )}
      {message && (
        <output className="block text-sm" aria-live="polite">
          {message}
        </output>
      )}
    </details>
  );
}

/** A dedicated screen prevents room entry/recovery from competing with a saved claim. */
export function SeatHandoverClaim({
  onRestored,
  onCancel,
}: {
  onRestored: ViewCallback;
  onCancel: () => void;
}) {
  const id = useId(),
    pending = useRef(false);
  const [kitText, setKitText] = useState('');
  const [claim, setClaim] = useState<SavedHandoverClaim | null>(null);
  const [stored, setStored] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [initialRequestPending, setInitialRequestPending] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(HANDOVER_CLAIM_STORAGE_KEY);
      if (saved !== null) {
        // oxlint-disable-next-line react/react-compiler -- Hydrate exact private retry proof after SSR.
        setStored(true);
        setClaim(parseHandoverClaim(saved));
        setMessage(
          'A saved handover request is waiting. Retry it with the same details to confirm the result.',
        );
      }
    } catch {
      setStored(true);
      setMessage(
        'The saved handover request could not be read. It has not been sent or deleted. Restore access to this tab’s storage and reload, or deliberately abandon it below.',
      );
    }
    setLoaded(true);
  }, []);
  async function accept() {
    if (!claim || pending.current) return;
    pending.current = true;
    setBusy(true);
    setInitialRequestPending(!stored);
    try {
      saveHandoverClaim(sessionStorage, claim);
      setStored(true);
      const response = await requestJson<unknown>(
        `/api/rooms/${claim.kit.roomCode}/control`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(claim.attempt),
        },
      );
      const view = await requestJson<unknown>(
        `/api/rooms/${claim.kit.roomCode}`,
        { cache: 'no-store' },
      );
      if (!handoverClaimConfirmed(claim, response, view))
        throw new Error(
          'The browser session did not confirm the transferred seat.',
        );
      // Retain the room locator before deleting the only durable retry record.
      // If storage cleanup fails, the same request remains available on reload.
      window.history.replaceState(null, '', `/?room=${view.code}`);
      clearHandoverClaim(sessionStorage);
      setStored(false);
      setClaim(null);
      setKitText('');
      onRestored(view);
    } catch (error) {
      setMessage(
        `${(error as Error).message} Acceptance may already have completed. Keep this tab open and retry this same request. Refresh retains its private retry details when tab storage is available.`,
      );
    } finally {
      pending.current = false;
      setInitialRequestPending(false);
      setBusy(false);
    }
  }
  return (
    <section className="notice space-y-4" aria-label="Accept a seat handover">
      <h1>Accept a seat handover</h1>
      <p>
        Use the private kit given to you by the current owner. Accepting takes
        over their faction, including private information and existing
        decisions, and revokes their access. Keep this tab open until acceptance
        is confirmed.
      </p>
      {!claim && !stored && (
        <>
          <label htmlFor={`${id}-kit`}>Paste your private handover kit</label>
          <Input
            id={`${id}-kit`}
            type="password"
            autoComplete="off"
            spellCheck={false}
            maxLength={4096}
            disabled={busy || !loaded}
            value={kitText}
            onChange={(event) => setKitText(event.target.value)}
          />
          <Button
            variant="outline"
            disabled={!kitText.trim() || busy || !loaded}
            onClick={() => {
              try {
                setClaim(createHandoverClaim(parseHandoverKit(kitText)));
                setKitText('');
                setMessage(
                  'Kit read. Review the room and confirm you intend to take this seat.',
                );
              } catch (error) {
                setMessage((error as Error).message);
              }
            }}
          >
            Read handover kit
          </Button>
        </>
      )}
      {claim && (
        <>
          <p>
            Room: <strong>{claim.kit.roomCode}</strong>
          </p>
          <p className="break-all text-sm">Seat: {claim.kit.playerId}</p>
          <Button disabled={busy || !loaded} onClick={() => void accept()}>
            {busy
              ? 'Confirming handover…'
              : stored
                ? 'Retry same handover request'
                : 'Accept this seat'}
          </Button>
          {!stored && (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setClaim(null)}
            >
              Use a different kit
            </Button>
          )}
        </>
      )}
      {stored && !initialRequestPending && (
        <>
          <p>
            Abandoning removes this tab’s exact retry proof. It cannot undo a
            completed handover. If its successful response was lost, you may
            lose access to the seat because the one-time kit has already been
            used.
          </p>
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              disabled={busy}
              checked={acknowledged}
              onChange={(event) => setAcknowledged(event.target.checked)}
            />
            I understand abandoning may lose access and does not cancel the
            handover.
          </label>
          <Button
            variant="outline"
            disabled={busy || !acknowledged}
            onClick={() => {
              try {
                clearHandoverClaim(sessionStorage);
                setStored(false);
                setClaim(null);
                onCancel();
              } catch (error) {
                setMessage((error as Error).message);
              }
            }}
          >
            Abandon handover request
          </Button>
        </>
      )}
      {!stored && (
        <Button variant="outline" disabled={busy || !loaded} onClick={onCancel}>
          Back to home
        </Button>
      )}
      <p className="fine">
        Private retry details are saved only in this tab before sending. They
        are removed after the handover and browser session are confirmed. Once
        seated, create your own recovery kit.
      </p>
      {message && (
        <output className="block" aria-live="polite">
          {message}
        </output>
      )}
    </section>
  );
}
