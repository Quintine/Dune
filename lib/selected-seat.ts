import { authenticate, type SeatAuth } from '@/db/rooms';
import { RuleError } from '@/game/engine';

const seatIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function selectedSeatId(req: Request): string | null {
  const id = req.headers.get('X-Dune-Seat');
  if (id !== null && !seatIdPattern.test(id)) throw new RuleError('The selected seat is invalid.');
  return id;
}

export function seatCookie(req: Request, name: string): string {
  return req.headers.get('cookie')?.split(';').map(part => part.trim())
    .find(part => part.startsWith(`${name}=`))?.slice(name.length + 1) ?? '';
}

/** All browser-held room credentials, used to preserve handover restrictions. */
export function roomSeatCookies(req: Request, code: string): string[] {
  const prefix = `dune_${code}`;
  return (req.headers.get('cookie') ?? '').split(';').map(part => part.trim())
    .flatMap(part => {
      const equals = part.indexOf('=');
      if (equals < 0) return [];
      const name = part.slice(0, equals);
      if (name !== prefix && !(name.startsWith(`${prefix}_`) && seatIdPattern.test(name.slice(prefix.length + 1)))) return [];
      return [part.slice(equals + 1)];
    });
}

/** The selector chooses a credential, never a seat without authentication. */
export async function authenticateSelectedSeat(req: Request, code: string): Promise<SeatAuth> {
  const id = selectedSeatId(req);
  const token = (id && seatCookie(req, `dune_${code}_${id}`)) || seatCookie(req, `dune_${code}`);
  const auth = await authenticate(code, token);
  if (id && auth.playerId !== id) throw new RuleError('Your selected seat could not be verified.');
  return auth;
}
