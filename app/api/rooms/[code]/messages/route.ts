import { authenticate } from '@/db/rooms';
import { readTableTalk, sendTableTalk, TableTalkError } from '@/db/table-talk';
import { RuleError } from '@/game/engine';
const noStore = { 'Cache-Control': 'no-store' };
async function handle(req: Request, write: boolean) {
  try {
    const url = new URL(req.url);
    if (
      write &&
      req.headers.get('origin') &&
      req.headers.get('origin') !== url.origin
    )
      throw new TableTalkError('Invalid request origin.', 403);
    const code = url.pathname.split('/').at(-2)!.toUpperCase();
    if (!/^[A-Z2-9]{8}$/.test(code))
      throw new TableTalkError('Invalid room code.', 400);
    const token =
      req.headers
        .get('cookie')
        ?.split(';')
        .map((part) => part.trim())
        .find((part) => part.startsWith(`dune_${code}=`))
        ?.split('=')[1] ?? '';
    const auth = await authenticate(code, token);
    if (write) {
      const raw = await req.text();
      if (raw.length > 6500)
        throw new TableTalkError('Request too large.', 413);
      return Response.json(await sendTableTalk(code, auth, JSON.parse(raw)), {
        headers: noStore,
      });
    }
    if (
      [...url.searchParams.keys()].some(
        (key) => !['recipient', 'before'].includes(key),
      )
    )
      throw new TableTalkError('Invalid conversation request.', 400);
    return Response.json(
      await readTableTalk(
        code,
        auth,
        url.searchParams.get('recipient'),
        url.searchParams.get('before'),
      ),
      { headers: noStore },
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof TableTalkError || error instanceof RuleError
            ? error.message
            : error instanceof SyntaxError
              ? 'Invalid JSON.'
              : 'Table discussion is temporarily unavailable.',
      },
      {
        status:
          error instanceof TableTalkError
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
export const GET = (req: Request) => handle(req, false);
export const POST = (req: Request) => handle(req, true);
