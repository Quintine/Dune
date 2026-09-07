import { createRoom, RoomEntryError } from '@/db/rooms';
import { RuleError } from '@/game/engine';
import type { FactionId } from '@/game/catalog';
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
    const raw = await req.text();
    if (raw.length > 4000)
      return Response.json({ error: 'Request too large.' }, { status: 413 });
    const body = JSON.parse(raw);
    if (
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body) ||
      typeof body.name !== 'string' ||
      typeof body.faction !== 'string' ||
      !Array.isArray(body.expansions) ||
      typeof body.advanced !== 'boolean'
    )
      throw new RuleError('Enter a name, faction and rules selection.');
    const result = await createRoom(
      body.name,
      body.faction as FactionId,
      body.advanced,
      body.expansions,
      body.entry,
    );
    return Response.json(
      {
        ...result.view,
        ...(result.entryReceipt ? { entryReceipt: result.entryReceipt } : {}),
      },
      {
        status: 201,
        headers: {
          'Set-Cookie': `dune_${result.view.code}=${result.token}; HttpOnly; SameSite=Strict; Path=/api/rooms/${result.view.code}; Max-Age=2592000${new URL(req.url).protocol === 'https:' ? '; Secure' : ''}`,
          'Cache-Control': 'no-store',
        },
      },
    );
  } catch (e) {
    return Response.json(
      {
        ...(e instanceof RoomEntryError ? { code: e.code } : {}),
        error:
          e instanceof RuleError
            ? e.message
            : e instanceof SyntaxError
              ? 'Invalid JSON.'
              : 'Unable to create the room. Please retry.',
      },
      {
        status:
          e instanceof RoomEntryError
            ? e.status
            : e instanceof RuleError || e instanceof SyntaxError
              ? 400
              : 500,
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  }
}
