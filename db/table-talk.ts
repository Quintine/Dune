import { env } from 'cloudflare:workers';
import type { SeatAuth } from './rooms';
import {
  TALK_PAGE_SIZE,
  talkId,
  validTalkDraft,
  type TalkDraft,
  type TalkMessage,
  type TalkPage,
} from '../lib/table-talk';

export class TableTalkError extends Error {
  constructor(
    message: string,
    readonly status = 409,
    readonly code?: string,
  ) {
    super(message);
  }
}
function database() {
  if (!env.DB) throw new Error('Game storage is unavailable.');
  return env.DB;
}
async function requireRoomNotRemoved(code: string) {
  const removed = await database()
    .prepare(
      'SELECT 1 AS removed FROM room_removals WHERE room_code = ? AND removed = 1',
    )
    .bind(code)
    .first();
  if (removed)
    throw new TableTalkError(
      'An administrator recoverably removed this room. Keep your saved seat and retry details; access returns if the room is restored.',
      410,
      'ROOM_REMOVED',
    );
}
// Every read and write checks the exact active session AND room membership.
// A separate message table keeps private activity out of game versions/logs.
const viewer = `FROM rooms r JOIN seats s ON s.room_code = r.code
  JOIN json_each(r.state, '$.players') p ON json_extract(p.value, '$.id') = s.player_id
  WHERE r.code = ? AND s.player_id = ? AND s.token_hash = ? AND s.revoked = 0
  AND NOT EXISTS (SELECT 1 FROM room_removals WHERE room_code = r.code AND removed = 1)
  AND json_extract(p.value, '$.bot') IS NULL`;
const channel = `(m.recipient_id IS NULL AND ? IS NULL) OR
  (? IS NOT NULL AND ((m.sender_id = s.player_id AND m.recipient_id = ?) OR
  (m.sender_id = ? AND m.recipient_id = s.player_id)))`;

export async function readTableTalk(
  code: string,
  auth: SeatAuth,
  recipientId: string | null,
  before: string | null = null,
): Promise<TalkPage> {
  if (
    (recipientId !== null &&
      (!talkId(recipientId) || recipientId === auth.playerId)) ||
    (before !== null && !talkId(before))
  )
    throw new TableTalkError('Choose a valid conversation.', 400);
  const row = await database()
    .prepare(`SELECT (
    SELECT json_group_array(json(message)) FROM (
      SELECT json_object('id', m.id, 'senderId', m.sender_id, 'senderName', m.sender_name,
        'senderFaction', m.sender_faction, 'recipientId', m.recipient_id,
        'recipientName', m.recipient_name, 'text', m.body, 'createdAt', m.created_at) AS message
      FROM room_messages m WHERE m.room_code = r.code AND (${channel})
      AND (? IS NULL OR m.sequence < (SELECT m.sequence FROM room_messages m
        WHERE m.room_code = r.code AND m.id = ? AND (${channel})))
      ORDER BY m.sequence DESC LIMIT ${TALK_PAGE_SIZE + 1}
    )
  ) AS messages,
    EXISTS (SELECT 1 FROM seat_discussion_controls WHERE room_code=r.code AND player_id=s.player_id AND muted=1) AS muted
  ${viewer}`)
    .bind(
      recipientId,
      recipientId,
      recipientId,
      recipientId,
      before,
      before,
      recipientId,
      recipientId,
      recipientId,
      recipientId,
      code,
      auth.playerId,
      auth.tokenHash,
    )
    .first<{ messages: string; muted: number }>();
  if (!row) {
    await requireRoomNotRemoved(code);
    throw new TableTalkError('Your seat could not be verified.');
  }
  const newestFirst: TalkMessage[] = JSON.parse(row.messages);
  const messages = newestFirst.slice(0, TALK_PAGE_SIZE).reverse();
  return {
    messages,
    before: newestFirst.length > TALK_PAGE_SIZE ? messages[0].id : null,
    muted: row.muted === 1,
  };
}

export async function sendTableTalk(
  code: string,
  auth: SeatAuth,
  input: unknown,
  now = Date.now(),
) {
  if (!validTalkDraft(input))
    throw new TableTalkError('Enter a message of 1–1000 characters.', 400);
  const draft: TalkDraft = input;
  if (draft.recipientId === auth.playerId)
    throw new TableTalkError('Choose another human seat.', 400);
  const result = await database()
    .prepare(`INSERT INTO room_messages
    (room_code, id, sender_id, sender_session_hash, sender_name, sender_faction, recipient_id, recipient_name, body, created_at)
    SELECT r.code, ?, s.player_id, s.token_hash, json_extract(p.value, '$.name'), json_extract(p.value, '$.faction'), ?,
      (SELECT json_extract(target.value, '$.name') FROM json_each(r.state, '$.players') target WHERE json_extract(target.value, '$.id') = ?), ?, ?
    ${viewer}
    AND NOT EXISTS (SELECT 1 FROM room_closures WHERE room_code = r.code AND closed = 1)
    AND NOT EXISTS (SELECT 1 FROM seat_discussion_controls WHERE room_code=r.code AND player_id=s.player_id AND muted=1)
    AND (? IS NULL OR EXISTS (SELECT 1 FROM json_each(r.state, '$.players') target
      WHERE json_extract(target.value, '$.id') = ? AND json_extract(target.value, '$.bot') IS NULL))
    AND NOT EXISTS (SELECT 1 FROM room_messages recent WHERE recent.room_code = r.code
      AND recent.sender_id = s.player_id AND recent.created_at > ?)
    ON CONFLICT(room_code, id) DO NOTHING`)
    .bind(
      draft.id,
      draft.recipientId,
      draft.recipientId,
      draft.text,
      now,
      code,
      auth.playerId,
      auth.tokenHash,
      draft.recipientId,
      draft.recipientId,
      now - 1000,
    )
    .run();
  // The INSERT itself authenticated the writer. A later rotation must not turn
  // a committed send into a definite rejection; this receipt contains only the caller's ID.
  if (result.meta.changes === 1) return { id: draft.id, replayed: false };
  // No foreign receipt/body is ever returned, even for a deliberately reused UUID.
  const receipt = await database()
    .prepare(`SELECT 1 AS accepted ${viewer}
    AND EXISTS (SELECT 1 FROM room_messages m WHERE m.room_code = r.code AND m.id = ?
      AND m.sender_id = s.player_id AND m.sender_session_hash = s.token_hash
      AND m.recipient_id IS ? AND m.body = ?)`)
    .bind(
      code,
      auth.playerId,
      auth.tokenHash,
      draft.id,
      draft.recipientId,
      draft.text,
    )
    .first<{ accepted: number }>();
  if (!receipt) {
    await requireRoomNotRemoved(code);
    if (await database().prepare('SELECT 1 FROM room_closures WHERE room_code = ? AND closed = 1').bind(code).first())
      throw new TableTalkError('An administrator closed this room. Discussion history remains readable; new messages are available after reopening.', 409, 'ROOM_CLOSED');
    // Only a still-authenticated seat may learn its own restriction. Never gate prior receipts on mute.
    if (await database().prepare(`SELECT 1 ${viewer} AND EXISTS (SELECT 1 FROM seat_discussion_controls WHERE room_code=r.code AND player_id=s.player_id AND muted=1)`)
      .bind(code, auth.playerId, auth.tokenHash).first())
      throw new TableTalkError('An administrator muted discussion for this seat. You can still read messages and play; new messages are available after unmuting.', 409, 'SEAT_DISCUSSION_MUTED');
    throw new TableTalkError(
      'Message not confirmed. Check your seat and recipient, wait a second, then try again.',
    );
  }
  return { id: draft.id, replayed: result.meta.changes === 0 };
}
