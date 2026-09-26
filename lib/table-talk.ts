export const TALK_LIMIT = 1000;
export const TALK_PAGE_SIZE = 50;
export type TalkDraft = {
  id: string;
  recipientId: string | null;
  text: string;
};
export type TalkMessage = {
  id: string;
  senderId: string;
  senderName: string;
  senderFaction: string;
  recipientId: string | null;
  recipientName: string | null;
  text: string;
  createdAt: number;
};
export type TalkPage = { messages: TalkMessage[]; before: string | null; muted: boolean };
export const talkId = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);
export function validTalkDraft(value: unknown): value is TalkDraft {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const draft = value as Record<string, unknown>;
  return (
    Object.keys(draft).length === 3 &&
    talkId(draft.id) &&
    (draft.recipientId === null || talkId(draft.recipientId)) &&
    typeof draft.text === 'string' &&
    draft.text.length <= TALK_LIMIT &&
    draft.text.trim().length > 0 &&
    Array.from(draft.text).every((character) => {
      const code = character.codePointAt(0)!;
      return (
        code === 9 || code === 10 || code === 13 || (code >= 32 && code !== 127)
      );
    })
  );
}
export function talkDraftKey(room: string, seat: string) {
  return `dune-table-talk-v1:${room}:${seat}`;
}
export function restoreTalkDraft(raw: string | null): TalkDraft | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return validTalkDraft(value) ? value : null;
  } catch {
    return null;
  }
}
/** A bounded page merge: UUIDs identify only already-entitled messages. */
export function mergeTalkPages(older: TalkMessage[], newer: TalkMessage[]) {
  const seen = new Set(newer.map((message) => message.id));
  return [...older.filter((message) => !seen.has(message.id)), ...newer];
}

/** A late response may clear only its own tab-scoped retry proof. */
export function clearTalkDraft(
  storage: Pick<Storage, 'getItem' | 'removeItem'>,
  key: string,
  draft: TalkDraft,
): boolean {
  const saved = restoreTalkDraft(storage.getItem(key));
  if (
    !saved ||
    saved.id !== draft.id ||
    saved.recipientId !== draft.recipientId ||
    saved.text !== draft.text
  )
    return false;
  storage.removeItem(key);
  return true;
}
