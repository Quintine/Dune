import {
  authenticate,
  recoverSeat,
  SeatControlError,
  setRecoveryKey,
} from '@/db/rooms';
import { RuleError } from '@/game/engine';
const noStore = { 'Cache-Control': 'no-store' };
export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    if (req.headers.get('origin') && req.headers.get('origin') !== url.origin)
      throw new SeatControlError(
        'Invalid request origin.',
        'INVALID_ORIGIN',
        403,
      );
    const code = url.pathname.split('/').at(-2)!.toUpperCase();
    if (!/^[A-Z2-9]{8}$/.test(code))
      throw new SeatControlError(
        'Enter the eight-character room code.',
        'INVALID_CONTROL_REQUEST',
        400,
      );
    const raw = await req.text();
    if (raw.length > 4000)
      throw new SeatControlError(
        'Request too large.',
        'REQUEST_TOO_LARGE',
        413,
      );
    const body: unknown = JSON.parse(raw);
    if (!body || typeof body !== 'object' || Array.isArray(body))
      throw new SeatControlError(
        'Choose a recovery operation.',
        'INVALID_CONTROL_REQUEST',
        400,
      );
    const input = body as Record<string, unknown>;
    if (input.type === 'setRecoveryKey') {
      const token =
        req.headers
          .get('cookie')
          ?.split(';')
          .map((part) => part.trim())
          .find((part) => part.startsWith(`dune_${code}=`))
          ?.split('=')[1] ?? '';
      const auth = await authenticate(code, token);
      return Response.json(
        await setRecoveryKey(code, auth, input.version, input.recoverySecret),
        { headers: noStore },
      );
    }
    if (input.type !== 'recoverSeat')
      throw new SeatControlError(
        'Choose a recovery operation.',
        'INVALID_CONTROL_REQUEST',
        400,
      );
    const result = await recoverSeat(code, {
      playerId: input.playerId,
      recoverySecret: input.recoverySecret,
      operationId: input.operationId,
      newSessionToken: input.newSessionToken,
    });
    return Response.json(
      {
        view: result.view,
        recovered: result.recovered,
        replayed: result.replayed,
      },
      {
        headers: {
          ...noStore,
          'Set-Cookie': `dune_${code}=${result.token}; HttpOnly; SameSite=Strict; Path=/api/rooms/${code}; Max-Age=2592000${url.protocol === 'https:' ? '; Secure' : ''}`,
        },
      },
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof RuleError
            ? error.message
            : error instanceof SyntaxError
              ? 'Invalid JSON.'
              : 'The server could not complete seat recovery.',
        code:
          error instanceof SeatControlError
            ? error.code
            : error instanceof RuleError
              ? 'INVALID_SESSION'
              : error instanceof SyntaxError
                ? 'INVALID_CONTROL_REQUEST'
                : 'SERVER_ERROR',
      },
      {
        status:
          error instanceof SeatControlError
            ? error.status
            : error instanceof RuleError
              ? 409
              : error instanceof SyntaxError
                ? 400
                : 500,
        headers: noStore,
      },
    );
  }
}
