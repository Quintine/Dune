'use client';
import { useEffect, useId, useRef, useState } from 'react';
import type { GameView } from '@/game/engine';
import { faction } from '@/game/catalog';
import { Button } from './ui/button';
import { requestJson, requestMayHaveCompleted } from '@/lib/client-request';
import {
  TALK_LIMIT,
  clearTalkDraft,
  mergeTalkPages,
  restoreTalkDraft,
  talkDraftKey,
  type TalkDraft,
  type TalkPage,
} from '@/lib/table-talk';

/** Remount on room/seat changes. Messages belong to seats, never browser identities. */
export function TableTalk({ game }: { game: GameView }) {
  const field = useId();
  const [open, setOpen] = useState(false);
  const [recipient, setRecipient] = useState('');
  const [text, setText] = useState('');
  const [record, setRecord] = useState<TalkDraft | null>(null);
  const [pageChannel, setPageChannel] = useState<string | null>(null);
  const [page, setPage] = useState<TalkPage>({ messages: [], before: null });
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [readError, setReadError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const sending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const olderPending = useRef(false);
  const readingHistory = useRef(false);
  const [history, setHistory] = useState(false);
  const channelGeneration = useRef(0);
  const key = talkDraftKey(game.code, game.me);
  const peers = game.players.filter(
    (player) => player.id !== game.me && !player.bot,
  );
  const target = peers.find((player) => player.id === recipient);
  const own = game.players.find((player) => player.id === game.me);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(key);
      const saved = restoreTalkDraft(raw);
      if (saved) {
        // oxlint-disable-next-line react/react-compiler -- Restore the exact pending message after SSR.
        setRecord(saved);
        setRecipient(saved.recipientId ?? '');
        setText(saved.text);
        setOpen(true);
        setNotice(
          'A message may have been sent. Retry this exact message to confirm it without a duplicate.',
        );
      } else if (raw) {
        setOpen(true);
        setNotice(
          'The saved message could not be read. No message was sent from that record.',
        );
      }
      setReady(true);
    } catch {
      setNotice(
        'Allow tab storage and reload to send messages with safe retry.',
      );
    }
  }, [key]);
  const endpoint = `/api/rooms/${game.code}/messages`;
  function pageUrl(before?: string) {
    const query = new URLSearchParams();
    if (recipient) query.set('recipient', recipient);
    if (before) query.set('before', before);
    return `${endpoint}?${query}`;
  }
  const url = pageUrl();
  const shownPage = pageChannel === url ? page : { messages: [], before: null };
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const generation = ++channelGeneration.current;
    let timer: ReturnType<typeof setTimeout>;
    async function read() {
      if (readingHistory.current) {
        timer = setTimeout(read, 5000);
        return;
      }
      try {
        const result = await requestJson<TalkPage>(url, {
          signal: controller.signal,
        });
        if (
          !controller.signal.aborted &&
          generation === channelGeneration.current &&
          !readingHistory.current
        ) {
          setPage(result);
          setPageChannel(url);
          setReadError('');
        }
      } catch {
        if (!controller.signal.aborted)
          setReadError(
            'Messages could not be refreshed. The table is still available.',
          );
      } finally {
        if (!controller.signal.aborted) timer = setTimeout(read, 5000);
      }
    }
    // A conversation change clears the old recipient's text before any new read.
    readingHistory.current = false;
    // oxlint-disable-next-line react/react-compiler -- Reset saved-history browsing when the external conversation subscription changes.
    setHistory(false);
    setPage({ messages: [], before: null });
    void read();
    return () => {
      controller.abort();
      clearTimeout(timer);
      channelGeneration.current = generation + 1;
    };
  }, [url, open, refresh]);

  async function older() {
    if (!shownPage.before || olderPending.current) return;
    olderPending.current = true;
    readingHistory.current = true;
    setHistory(true);
    setLoading(true);
    const generation = channelGeneration.current;
    try {
      const result = await requestJson<TalkPage>(pageUrl(shownPage.before));
      if (generation === channelGeneration.current)
        setPage((current) => ({
          before: result.before,
          messages: mergeTalkPages(result.messages, current.messages),
        }));
    } catch {
      if (generation === channelGeneration.current)
        setReadError('Older messages could not be loaded. Try again.');
    } finally {
      olderPending.current = false;
      setLoading(false);
    }
  }
  async function submit() {
    if (sending.current || !ready) return;
    const draft = record ?? {
      id: crypto.randomUUID(),
      recipientId: recipient || null,
      text,
    };
    const wasRetry = !!record;
    sending.current = true;
    setBusy(true);
    let dispatched = false;
    try {
      sessionStorage.setItem(key, JSON.stringify(draft));
      setRecord(draft);
      dispatched = true;
      const receipt = await requestJson<{ id: string; replayed: boolean }>(
        endpoint,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(draft),
        },
      );
      if (!mounted.current) return;
      if (receipt.id !== draft.id)
        throw new Error('Message receipt did not match.');
      clearTalkDraft(sessionStorage, key, draft);
      setRecord(null);
      setText('');
      setNotice(
        receipt.replayed
          ? 'The original message is saved. No duplicate was sent.'
          : 'Message sent.',
      );
      setRefresh((value) => value + 1);
    } catch (error) {
      if (!mounted.current) return;
      if (dispatched && (wasRetry || requestMayHaveCompleted(error))) {
        setNotice(
          'Message not confirmed. Retry the exact message, or check the conversation before discarding its retry details.',
        );
      } else {
        try {
          clearTalkDraft(sessionStorage, key, draft);
          setRecord(null);
        } catch {}
        setNotice(
          error instanceof Error ? error.message : 'Message could not be sent.',
        );
      }
    } finally {
      sending.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  if (!own || own.bot) return null;
  return (
    <section
      className="table-talk"
      id="table-discussion"
      aria-labelledby={`${field}-title`}
    >
      <h2 id={`${field}-title`}>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`${field}-content`}
          onClick={() => setOpen((value) => !value)}
        >
          Table discussion <span aria-hidden="true">{open ? '−' : '+'}</span>
        </button>
      </h2>
      {open && (
        <div id={`${field}-content`} className="table-talk-content">
          <p className="muted">
            Talk through plans and offers. Use game controls to transfer spice,
            form alliances or make a Truthtrance commitment. Messages do not
            perform game actions.
          </p>
          <label htmlFor={`${field}-recipient`}>Conversation</label>
          <select
            id={`${field}-recipient`}
            value={recipient}
            disabled={busy || !!record}
            onChange={(event) => {
              setRecipient(event.target.value);
              setText('');
              setNotice('');
            }}
          >
            <option value="">Everyone at the table</option>
            {peers.map((player) => (
              <option key={player.id} value={player.id}>
                Private · {player.name} · {faction(player.faction).name}
              </option>
            ))}
            {recipient && !target && (
              <option value={recipient}>Previous seat</option>
            )}
          </select>
          <p className="fine">
            {recipient
              ? `Only your seat and ${target?.name ?? 'the addressed seat'} can read this conversation. A seat's next owner inherits its messages.`
              : 'Public messages are visible to everyone who joins this room.'}{' '}
            AI opponents do not read or answer messages yet.
          </p>
          {readError && (
            <output>
              {readError}{' '}
              <Button
                variant="outline"
                onClick={() => setRefresh((value) => value + 1)}
              >
                Refresh messages
              </Button>
            </output>
          )}
          {history && (
            <p className="fine">
              Browsing saved history.{' '}
              <Button
                variant="outline"
                onClick={() => setRefresh((value) => value + 1)}
              >
                Return to latest messages
              </Button>
            </p>
          )}
          {shownPage.before && (
            <Button
              variant="outline"
              disabled={loading}
              onClick={() => void older()}
            >
              {loading ? 'Loading…' : 'Load older messages'}
            </Button>
          )}
          <ol
            className="table-talk-messages"
            aria-label={
              recipient
                ? 'Private seat conversation'
                : 'Public table conversation'
            }
            aria-live="polite"
            aria-relevant="additions"
          >
            {shownPage.messages.map((message) => (
              <li key={message.id}>
                <div className="table-talk-author">
                  <strong>
                    <bdi>{message.senderName}</bdi>
                  </strong>
                  <time dateTime={new Date(message.createdAt).toISOString()}>
                    {new Date(message.createdAt).toLocaleString()}
                  </time>
                </div>
                <p dir="auto">{message.text}</p>
              </li>
            ))}
          </ol>
          {shownPage.messages.length === 0 && (
            <p className="muted">No messages loaded in this conversation.</p>
          )}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <label htmlFor={`${field}-message`}>
              {recipient
                ? `Message to ${target?.name ?? 'the addressed seat'}`
                : 'Message to everyone'}
            </label>
            <textarea
              id={`${field}-message`}
              rows={3}
              maxLength={TALK_LIMIT}
              value={text}
              disabled={busy || !!record}
              onChange={(event) => setText(event.target.value)}
              aria-describedby={`${field}-count`}
            />
            <p className="fine" id={`${field}-count`}>
              {text.length} / {TALK_LIMIT} characters · plain text
            </p>
            <Button
              type="submit"
              disabled={
                !ready ||
                busy ||
                !text.trim() ||
                (!record && !!recipient && !target)
              }
            >
              {busy
                ? 'Sending…'
                : record
                  ? 'Retry exact message'
                  : recipient
                    ? 'Send private message'
                    : 'Send to everyone'}
            </Button>
          </form>
          {notice && <output>{notice}</output>}
          {record && !busy && (
            <p className="fine">
              Discarding retry details cannot undo a message already sent.
            </p>
          )}
          {record && !busy && (
            <Button
              variant="outline"
              onClick={() => {
                try {
                  sessionStorage.removeItem(key);
                  setRecord(null);
                  setText('');
                  setNotice(
                    'Retry details discarded. A message already sent remains in the conversation.',
                  );
                } catch {
                  setNotice(
                    'Retry details could not be removed from tab storage.',
                  );
                }
              }}
            >
              Discard retry details
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
