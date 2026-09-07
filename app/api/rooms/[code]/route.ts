import {
  readSeatView,
  authenticate,
  joinRoom,
  act,
  RoomEntryError,
  continueRoomBots,
  continueRoomAutomatic,
  needsAutomaticRoomRecovery,
  type SeatAuth,
} from '@/db/rooms';
import { RuleError } from '@/game/engine';
import type { FactionId } from '@/game/catalog';
import { waitUntil } from 'cloudflare:workers';
// Coalesce overlapping polls inside this isolate. Database CAS still fences
// other isolates, restarts, seat recovery, and human actions.
const continuations = new Map<string, Promise<void>>();
function resumeRoom(code: string): Promise<void> {
  const existing = continuations.get(code);
  if (existing) return existing;
  const pending = (async () => {
    await continueRoomAutomatic(code);
    await continueRoomBots(code);
  })().finally(() => {
    if (continuations.get(code) === pending) continuations.delete(code);
  });
  continuations.set(code, pending);
  return pending;
}

const codeOf = (req: Request) => {
  const code = new URL(req.url).pathname.split('/').pop()!.toUpperCase();
  if (!/^[A-Z2-9]{8}$/.test(code))
    throw new RuleError('Enter the eight-character room code.');
  return code;
};
const tokenOf = (req: Request, code: string) =>
  req.headers
    .get('cookie')
    ?.split(';')
    .map((x) => x.trim())
    .find((x) => x.startsWith(`dune_${code}=`))
    ?.split('=')[1] ?? '';
const failure = (e: unknown) =>
  Response.json(
    {
      ...(e instanceof RoomEntryError ? { code: e.code } : {}),
      error:
        e instanceof RuleError
          ? e.message
          : e instanceof SyntaxError
            ? 'Invalid JSON.'
            : 'The game server could not complete this request.',
    },
    {
      status:
        e instanceof RoomEntryError
          ? e.status
          : e instanceof RuleError
            ? 409
            : e instanceof SyntaxError
              ? 400
              : 500,
      headers: { 'Cache-Control': 'no-store' },
    },
  );
export async function GET(req: Request) {
  try {
    const code = codeOf(req),
      id = await authenticate(code, tokenOf(req, code));
    const view = await readSeatView(code, id);
    // Reconnect resumes persisted automatic effects/acknowledgements and AI work
    // after an interruption. Actual human choices remain engine-owned decisions.
    if (view.botsPending || needsAutomaticRoomRecovery(view))
      waitUntil(resumeRoom(code));
    return Response.json(view, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: Request) {
  try {
    if (
      req.headers.get('origin') &&
      req.headers.get('origin') !== new URL(req.url).origin
    )
      return Response.json(
        { error: 'Invalid request origin.' },
        { status: 403 },
      );
    const code = codeOf(req);
    const raw = await req.text();
    if (raw.length > 8000)
      return Response.json({ error: 'Request too large.' }, { status: 413 });
    const body = JSON.parse(raw);
    if (!body || typeof body !== 'object' || Array.isArray(body))
      throw new RuleError('The request is invalid.');
    if (body.type === 'join') {
      const existing = tokenOf(req, code);
      let auth: SeatAuth | null = null;
      if (existing) {
        try {
          auth = await authenticate(code, existing);
        } catch (error) {
          if (!(error instanceof RuleError)) throw error;
        }
      }
      if (body.entry === undefined && auth) {
        return Response.json(await readSeatView(code, auth), {
          headers: { 'Cache-Control': 'no-store' },
        });
      }
      if (typeof body.name !== 'string' || typeof body.faction !== 'string')
        throw new RuleError('Enter your name and faction.');
      const r = await joinRoom(
        code,
        body.name,
        body.faction as FactionId,
        body.entry,
        auth,
      );
      return Response.json(
        {
          ...r.view,
          ...(r.entryReceipt ? { entryReceipt: r.entryReceipt } : {}),
          ...(r.alreadySeated ? { alreadySeated: true } : {}),
        },
        {
          headers: {
            ...(r.token
              ? {
                  'Set-Cookie': `dune_${code}=${r.token}; HttpOnly; SameSite=Strict; Path=/api/rooms/${code}; Max-Age=2592000${new URL(req.url).protocol === 'https:' ? '; Secure' : ''}`,
                }
              : {}),
            'Cache-Control': 'no-store',
          },
        },
      );
    }
    const id = await authenticate(code, tokenOf(req, code));
    if (
      !Number.isSafeInteger(body.version) ||
      !body.action ||
      typeof body.action !== 'object'
    )
      throw new RuleError('The action is invalid.');
    const view = await act(code, id, body.version, body.action);
    if (view.botsPending || needsAutomaticRoomRecovery(view))
      waitUntil(resumeRoom(code));
    return Response.json(view, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    return failure(e);
  }
}
