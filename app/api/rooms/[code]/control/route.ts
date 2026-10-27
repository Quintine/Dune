import { requestOrigin } from '@/lib/request-origin';
import { authenticateSelectedSeat, selectedSeatId, seatCookie, roomSeatCookies } from '@/lib/selected-seat';
import {
  createSeatHandover,
  revokeSeatHandover,
  claimSeatHandover,
  recoverSeat,
  SeatControlError,
  RoomEntryError,
  setRecoveryKey,
  setSeatAiDelegate,
  revokeSeatAiDelegate,
  useSeatAiDelegate as activateSeatAiDelegate,
  needsAutomaticRoomRecovery,
} from '@/db/rooms';
import { RuleError } from '@/game/engine';
import { validSeatAiDelegateRequest } from '@/lib/seat-ai-delegation';
import { resumeRoom } from '@/db/room-continuation';
import { env, waitUntil } from 'cloudflare:workers';
const noStore = { 'Cache-Control': 'no-store' };
export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    if (req.headers.get('origin') && req.headers.get('origin') !== requestOrigin(req, env.DUNE_PUBLIC_ORIGIN))
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
    const selector = selectedSeatId(req);
    if (
      input.type === 'setSeatAiDelegate' ||
      input.type === 'revokeSeatAiDelegate' ||
      input.type === 'useSeatAiDelegate'
    ) {
      if (!validSeatAiDelegateRequest(input))
        throw new SeatControlError(
          'The AI permission request is invalid.',
          'INVALID_CONTROL_REQUEST',
          400,
        );
      const auth = await authenticateSelectedSeat(req, code);
      const result =
        input.type === 'setSeatAiDelegate'
          ? await setSeatAiDelegate(code, auth, input.version, {
              grantId: input.grantId,
              delegateId: input.delegateId,
              difficulty: input.difficulty,
            })
          : input.type === 'revokeSeatAiDelegate'
            ? await revokeSeatAiDelegate(
                code,
                auth,
                input.version,
                input.grantId,
              )
            : await activateSeatAiDelegate(code, auth, input.version, {
                ownerId: input.ownerId,
                grantId: input.grantId,
              });
      if (!result.view.roomControl?.paused && !result.view.roomControl?.closed && (result.view.botsPending || needsAutomaticRoomRecovery(result.view)))
        waitUntil(resumeRoom(code));
      return Response.json(result, { headers: noStore });
    }
    if (
      input.type === 'setRecoveryKey' ||
      input.type === 'createSeatHandover' ||
      input.type === 'revokeSeatHandover'
    ) {
      const auth = await authenticateSelectedSeat(req, code);
      if (input.type === 'createSeatHandover')
        return Response.json(
          await createSeatHandover(code, auth, input.version, {
            offerId: input.offerId,
            handoverSecret: input.handoverSecret,
          }),
          { headers: noStore },
        );
      if (input.type === 'revokeSeatHandover')
        return Response.json(
          await revokeSeatHandover(code, auth, input.version, input.offerId),
          { headers: noStore },
        );
      return Response.json(
        await setRecoveryKey(code, auth, input.version, input.recoverySecret),
        { headers: noStore },
      );
    }
    if (input.type !== 'recoverSeat' && input.type !== 'claimSeatHandover')
      throw new SeatControlError(
        'Choose a recovery operation.',
        'INVALID_CONTROL_REQUEST',
        400,
      );
    if (typeof input.playerId !== 'string' || !input.playerId || input.playerId.length > 100)
      throw new SeatControlError('Provide a valid player ID.', 'INVALID_CONTROL_REQUEST', 400);
    const targetId = input.playerId;
    if (input.type === 'claimSeatHandover') {
      // A caller cannot evade the existing-browser restriction by selecting a
      // nonexistent scoped cookie while retaining another legacy credential.
      for (const cookie of roomSeatCookies(req, code)) {
        if (!cookie) continue;
        let existing;
        try {
          existing = await authenticateSelectedSeat(new Request(req.url, { headers: { cookie: `dune_${code}=${cookie}` } }), code);
        } catch (error) {
          if (error instanceof RoomEntryError && error.code === 'ROOM_REMOVED' || !(error instanceof RuleError)) throw error;
        }
        if (existing && existing.playerId !== targetId)
          throw new SeatControlError(
            'This browser already controls another seat in this room. Use a separate browser profile to accept the handover.',
            'ALREADY_SEATED', 409,
          );
      }
    }
    if (selector && selector !== targetId)
      throw new SeatControlError('The selected seat does not match this recovery request.', 'INVALID_CONTROL_REQUEST', 400);
    // Determine ownership before recovery rotates the old credential.
    const existingLegacy = seatCookie(req, `dune_${code}`);
    let legacyOtherSeat = false;
    if (existingLegacy) {
      try {
        legacyOtherSeat = (await authenticateSelectedSeat(new Request(req.url, { headers: { cookie: `dune_${code}=${existingLegacy}` } }), code)).playerId !== targetId;
      } catch (error) {
        if (error instanceof RoomEntryError && error.code === 'ROOM_REMOVED' || !(error instanceof RuleError)) throw error;
      }
    }
    // A recovery claim may omit the selector. Replace any existing scoped
    // cookie for its target so that a stale token cannot shadow the new one.
    const hasTargetCookie = !!seatCookie(req, `dune_${code}_${targetId}`);
    const cookieName = hasTargetCookie || legacyOtherSeat
      ? `dune_${code}_${targetId}` : `dune_${code}`;
    const result =
      input.type === 'claimSeatHandover'
        ? await claimSeatHandover(code, {
            playerId: input.playerId,
            offerId: input.offerId,
            handoverSecret: input.handoverSecret,
            operationId: input.operationId,
            newSessionToken: input.newSessionToken,
          })
        : await recoverSeat(code, {
            playerId: input.playerId,
            recoverySecret: input.recoverySecret,
            operationId: input.operationId,
            newSessionToken: input.newSessionToken,
          });
    return Response.json(
      {
        view: result.view,
        ...('transferred' in result
          ? { transferred: result.transferred }
          : { recovered: result.recovered }),
        replayed: result.replayed,
      },
      {
        headers: {
          ...noStore,
          'Set-Cookie': `${cookieName}=${result.token}; HttpOnly; SameSite=Strict; Path=/api/rooms/${code}; Max-Age=2592000${requestOrigin(req, env.DUNE_PUBLIC_ORIGIN).startsWith('https:') ? '; Secure' : ''}`,
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
              : 'The server could not complete this seat request.',
        code:
          (error instanceof SeatControlError || error instanceof RoomEntryError)
            ? error.code
            : error instanceof RuleError
              ? 'INVALID_SESSION'
              : error instanceof SyntaxError
                ? 'INVALID_CONTROL_REQUEST'
                : 'SERVER_ERROR',
      },
      {
        status:
          (error instanceof SeatControlError || error instanceof RoomEntryError)
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
