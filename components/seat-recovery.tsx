'use client';

import { useId, useRef, useState } from 'react';
import { Copy, Eye, EyeOff, KeyRound } from 'lucide-react';
import type { GameView } from '@/game/engine';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { requestJson, requestMayHaveCompleted } from '@/lib/client-request';
import {
  createRecoveryAttempt,
  createRecoveryKit,
  parseRecoveryKit,
  serializeRecoveryKit,
  type SeatRecoveryAttempt,
  type SeatRecoveryKit,
} from '@/lib/seat-recovery';

type Restored = (view: GameView) => void;
type SetupResponse = { view: GameView; recoveryConfigured: true };
type ClaimResponse = { view: GameView; recovered: true; replayed: boolean };

/** Mount with key={`${game.code}:${game.me}`} to separate private owner contexts. */
export function SeatRecoverySetup({
  game,
  onRestored,
  onPending,
  disabled = false,
}: {
  game: GameView;
  onRestored: Restored;
  onPending?: (pending: boolean) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const pending = useRef(false);
  const [draft, setDraft] = useState<SeatRecoveryKit | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [message, setMessage] = useState('');
  const own = game.players.find((player) => player.id === game.me);
  const kit =
    draft?.roomCode === game.code && draft.playerId === game.me ? draft : null;
  if (!own) return null;

  async function copyKit() {
    if (!kit) return;
    try {
      await navigator.clipboard.writeText(serializeRecoveryKit(kit));
      setMessage(
        'Private kit copied. Save it somewhere secure before continuing.',
      );
    } catch {
      setMessage(
        'Copy was unavailable. Select the complete kit below and copy it manually.',
      );
    }
  }

  async function saveKey() {
    if (!kit || !saved || confirmed || disabled || pending.current) return;
    let confirmedView: GameView | undefined;
    pending.current = true;
    setBusy(true);
    onPending?.(true);
    setMessage('Saving your recovery key…');
    try {
      const result = await requestJson<SetupResponse>(
        `/api/rooms/${kit.roomCode}/control`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'setRecoveryKey',
            version: game.version,
            recoverySecret: kit.recoverySecret,
          }),
        },
      );
      if (
        result.recoveryConfigured !== true ||
        result.view.code !== kit.roomCode ||
        result.view.me !== kit.playerId
      )
        throw new Error('The server did not confirm this seat’s recovery key.');
      setConfirmed(true);
      setUncertain(false);
      setMessage(
        'Recovery key saved. Keep your private kit; it is needed if this browser loses its seat.',
      );
      confirmedView = result.view;
    } catch (error) {
      const mayHaveSaved = requestMayHaveCompleted(error);
      setUncertain(mayHaveSaved);
      setMessage(
        mayHaveSaved
          ? 'Saving was not confirmed and may have completed. Keep this same kit. Retry saving to confirm it; no retry has been sent automatically.'
          : `${(error as Error).message} Your kit remains below. Review the current table and retry when ready.`,
      );
    } finally {
      pending.current = false;
      setBusy(false);
      onPending?.(false);
    }
    if (confirmedView) onRestored(confirmedView);
  }

  return (
    <details className="notice">
      <summary className="cursor-pointer text-base font-semibold">
        Protect your saved seat
      </summary>
      <p>
        Create or replace a private recovery key for {own.name}. Anyone with the
        kit can recover this seat, revealing its private information and
        revoking its old browser sessions. Keep it separate from the public
        invitation.
      </p>
      <p className="fine">
        This restores your own seat after cookie loss. A replacement key
        invalidates the previous kit. The kit stays in memory here; save it
        before refreshing or closing this page.
      </p>
      {!kit ? (
        <Button
          variant="outline"
          disabled={disabled || busy}
          onClick={() => {
            try {
              setDraft(createRecoveryKit(game.code, game.me));
              setSaved(false);
              setConfirmed(false);
              setUncertain(false);
              setMessage('Save this kit before enabling its recovery key.');
            } catch (error) {
              setMessage((error as Error).message);
            }
          }}
        >
          <KeyRound aria-hidden="true" />
          Generate private recovery kit
        </Button>
      ) : (
        <div className="space-y-3">
          <label htmlFor={`${id}-kit`}>
            Private recovery kit for room {kit.roomCode}
          </label>
          <Textarea
            id={`${id}-kit`}
            readOnly
            value={serializeRecoveryKit(kit)}
            rows={8}
            spellCheck={false}
            autoComplete="off"
            className="font-mono text-sm"
            aria-describedby={`${id}-privacy`}
          />
          <p id={`${id}-privacy`} className="fine">
            This contains a secret key. Save the entire kit privately; do not
            put it in chat or the invitation.
          </p>
          <Button variant="outline" onClick={() => void copyKit()}>
            <Copy aria-hidden="true" />
            Copy private kit
          </Button>
          <label className="flex items-start gap-2" htmlFor={`${id}-saved`}>
            <input
              id={`${id}-saved`}
              type="checkbox"
              checked={saved}
              disabled={disabled || busy}
              onChange={(event) => setSaved(event.target.checked)}
            />
            I have saved the complete private kit outside this page.
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={disabled || busy || !saved || confirmed}
              onClick={() => void saveKey()}
            >
              {confirmed
                ? 'Recovery key confirmed'
                : busy
                  ? 'Saving…'
                  : uncertain
                    ? 'Retry saving this key'
                    : 'Enable this recovery key'}
            </Button>
            {!uncertain && (
              <Button
                variant="outline"
                disabled={disabled || busy}
                onClick={() => {
                  setDraft(null);
                  setSaved(false);
                  setConfirmed(false);
                  setMessage(
                    confirmed
                      ? 'Saved kit hidden. Keep your private copy for recovery.'
                      : 'Unsaved kit discarded.',
                  );
                }}
              >
                {confirmed ? 'Done — hide saved kit' : 'Discard unsaved kit'}
              </Button>
            )}
          </div>
        </div>
      )}
      {message && (
        <output className="block text-sm leading-relaxed" aria-live="polite">
          {message}
        </output>
      )}
    </details>
  );
}

export function SeatRecoveryClaim({
  initialCode,
  onRestored,
  onPending,
  onUncertain,
  disabled = false,
}: {
  initialCode?: string;
  onRestored: Restored;
  onPending?: (pending: boolean) => void;
  onUncertain?: (uncertain: boolean) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const pending = useRef(false);
  const [kitText, setKitText] = useState('');
  const [showKit, setShowKit] = useState(false);
  const [prepared, setPrepared] = useState<{
    room: string;
    attempt: SeatRecoveryAttempt;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [abandonAcknowledged, setAbandonAcknowledged] = useState(false);
  const [message, setMessage] = useState('');

  function inspectKit() {
    if (disabled || pending.current) return;
    try {
      const kit = parseRecoveryKit(kitText);
      setPrepared({ room: kit.roomCode, attempt: createRecoveryAttempt(kit) });
      setAttempted(false);
      setUncertain(false);
      setShowKit(false);
      setMessage('Kit read. Review the room and seat before recovering.');
    } catch (error) {
      setMessage((error as Error).message);
    }
  }

  async function recover() {
    if (!prepared || disabled || pending.current) return;
    let confirmedView: GameView | undefined;
    pending.current = true;
    setBusy(true);
    onPending?.(true);
    setAttempted(true);
    setAbandonAcknowledged(false);
    setMessage('Recovering your seat…');
    try {
      const result = await requestJson<ClaimResponse>(
        `/api/rooms/${prepared.room}/control`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          // The prepared UUID and session token are retained unchanged after a timeout.
          body: JSON.stringify(prepared.attempt),
        },
      );
      if (
        result.recovered !== true ||
        result.view.code !== prepared.room ||
        result.view.me !== prepared.attempt.playerId
      )
        throw new Error('The server did not confirm the recovered seat.');
      setKitText('');
      setPrepared(null);
      setShowKit(false);
      setAttempted(false);
      setUncertain(false);
      onUncertain?.(false);
      setMessage(
        'Seat recovered in this browser. Previous browser sessions for this seat have been revoked.',
      );
      confirmedView = result.view;
    } catch (error) {
      // A later rejection cannot prove that an earlier ambiguous attempt failed.
      // Retain that exact receipt until a response confirms this recovered seat.
      const mayHaveRecovered = uncertain || requestMayHaveCompleted(error);
      setUncertain(mayHaveRecovered);
      onUncertain?.(mayHaveRecovered);
      setMessage(
        mayHaveRecovered
          ? 'Recovery was not confirmed and may have completed. Retry this same request below. Keep this page open to preserve its exact retry details; no retry is automatic.'
          : `${(error as Error).message} You can retry the same request or inspect a different saved kit.`,
      );
    } finally {
      pending.current = false;
      setBusy(false);
      onPending?.(false);
    }
    if (confirmedView) onRestored(confirmedView);
  }

  return (
    <details className="notice">
      <summary className="cursor-pointer text-base font-semibold">
        Recover a saved seat
      </summary>
      <p>
        Use the private kit saved before this browser lost its seat. Recovery
        restores that seat’s private information and revokes its previous
        browser sessions.
      </p>
      {initialCode && (
        <p className="fine">
          Invitation room: {initialCode}. The saved kit determines which room
          and seat you recover.
        </p>
      )}
      <label htmlFor={`${id}-claim`}>Paste your private recovery kit</label>
      <div className="flex flex-wrap gap-2">
        <Input
          id={`${id}-claim`}
          type={showKit ? 'text' : 'password'}
          value={kitText}
          readOnly={!!prepared}
          disabled={disabled || busy}
          onChange={(event) => setKitText(event.target.value)}
          maxLength={4096}
          autoComplete="off"
          spellCheck={false}
          aria-describedby={`${id}-claim-help`}
          className="min-w-0 flex-1"
        />
        <Button
          variant="outline"
          aria-pressed={showKit}
          aria-controls={`${id}-claim`}
          onClick={() => setShowKit(!showKit)}
        >
          {showKit ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
          {showKit ? 'Hide kit' : 'Show kit'}
        </Button>
      </div>
      <p id={`${id}-claim-help`} className="fine">
        Keep this kit private. Reading it checks its format; Recover this seat
        submits it to restore your browser session.
      </p>
      {!prepared ? (
        <Button
          variant="outline"
          disabled={disabled || !kitText.trim() || busy}
          onClick={inspectKit}
        >
          Read recovery kit
        </Button>
      ) : (
        <div className="space-y-3">
          <dl className="text-sm">
            <dt>Room to recover</dt>
            <dd className="font-mono">{prepared.room}</dd>
            <dt>Saved seat identifier</dt>
            <dd className="break-all font-mono">{prepared.attempt.playerId}</dd>
          </dl>
          <div className="flex flex-wrap gap-2">
            <Button disabled={disabled || busy} onClick={() => void recover()}>
              {busy
                ? 'Recovering…'
                : attempted
                  ? 'Retry same recovery request'
                  : 'Recover this seat'}
            </Button>
            {!uncertain && (
              <Button
                variant="outline"
                disabled={disabled || busy}
                onClick={() => {
                  setPrepared(null);
                  setAttempted(false);
                  setMessage('Paste or inspect your saved kit.');
                }}
              >
                Use a different kit
              </Button>
            )}
          </div>
          {uncertain && (
            <div className="space-y-3">
              <p>
                If this exact retry can no longer succeed, you can deliberately
                abandon its retry details. This does not cancel a completed
                recovery; previous browser sessions may already have been
                revoked. You need a saved recovery kit to recover again.
              </p>
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={abandonAcknowledged}
                  disabled={disabled || busy}
                  onChange={(event) =>
                    setAbandonAcknowledged(event.target.checked)
                  }
                />
                <span>
                  I understand that abandoning drops the exact retry details and
                  does not undo recovery.
                </span>
              </label>
              <Button
                variant="outline"
                disabled={disabled || busy || !abandonAcknowledged}
                onClick={() => {
                  if (disabled || pending.current || !abandonAcknowledged)
                    return;
                  setPrepared(null);
                  setAttempted(false);
                  setUncertain(false);
                  setAbandonAcknowledged(false);
                  setShowKit(false);
                  onUncertain?.(false);
                  setMessage(
                    'Recovery retry details abandoned. The private kit remains in the input; read it again or paste a newer saved kit before starting another recovery.',
                  );
                }}
              >
                Abandon recovery attempt
              </Button>
            </div>
          )}
        </div>
      )}
      {message && (
        <output className="block text-sm leading-relaxed" aria-live="polite">
          {message}
        </output>
      )}
    </details>
  );
}
