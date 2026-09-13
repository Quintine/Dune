import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { isAbsolute, relative, sep } from 'node:path';

type Seat = { code: string; playerId: string; version: number; token: string };
export type RestorationConfig = {
  baseUrl: string;
  isolatedQa: true;
  seats: Seat[];
};

export function loadRestorationConfig(
  path: string,
  root: string,
): RestorationConfig {
  const stat = lstatSync(path),
    rel = relative(realpathSync(root), realpathSync(path));
  if (
    !stat.isFile() ||
    (stat.mode & 0o077) !== 0 ||
    (!rel.startsWith('..' + sep) && rel !== '..' && !isAbsolute(rel))
  )
    throw new Error(
      'Seat credentials require a private file outside the checkout.',
    );
  return JSON.parse(readFileSync(path, 'utf8')) as RestorationConfig;
}

export async function checkSeatRestoration(
  config: RestorationConfig,
  request: typeof fetch = fetch,
) {
  // These GETs can resume automatic server work. Only deliberately isolated QA
  // fixtures are appropriate; callers must never probe arbitrary human games.
  const url = new URL(config.baseUrl);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash ||
    config.isolatedQa !== true
  )
    throw new Error('Use an explicit loopback origin and isolated QA seats.');
  if (
    !Array.isArray(config.seats) ||
    !config.seats.length ||
    config.seats.some(
      (s) =>
        !s ||
        !/^[A-Z2-9]{8}$/.test(s.code) ||
        typeof s.playerId !== 'string' ||
        !s.playerId ||
        !Number.isSafeInteger(s.version) ||
        s.version < 0 ||
        typeof s.token !== 'string' ||
        !/^[A-Za-z0-9_-]+$/.test(s.token),
    )
  )
    throw new Error('Invalid seat manifest.');
  for (const [index, seat] of config.seats.entries()) {
    try {
      const response = await request(new URL(`/api/rooms/${seat.code}`, url), {
        method: 'GET',
        headers: { cookie: `dune_${seat.code}=${seat.token}` },
        redirect: 'error',
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) throw new Error();
      const view = await response.json();
      if (
        !view ||
        typeof view !== 'object' ||
        !('players' in view) ||
        !('code' in view) ||
        !('me' in view) ||
        !('version' in view) ||
        view.code !== seat.code ||
        view.me !== seat.playerId ||
        view.version !== seat.version ||
        !Array.isArray(view.players) ||
        ('botsPending' in view && view.botsPending)
      )
        throw new Error();
      if (
        view.players.some(
          (p: unknown) =>
            !p ||
            typeof p !== 'object' ||
            !('id' in p) ||
            typeof p.id !== 'string',
        )
      )
        throw new Error();
      const own = view.players.filter(
        (p: { id?: string }) => p.id === seat.playerId,
      );
      if (
        own.length !== 1 ||
        !Array.isArray(own[0].hand) ||
        !Array.isArray(own[0].traitors) ||
        !Number.isFinite(own[0].spice)
      )
        throw new Error();
      const privateFields = [
        'hand',
        'traitors',
        'traitorChoices',
        'spice',
        'faceDancers',
        'prediction',
        'bribes',
      ];
      if (
        view.players.some(
          (p: Record<string, unknown>) =>
            p.id !== seat.playerId && privateFields.some((key) => key in p),
        )
      )
        throw new Error();
    } catch {
      // Never echo response bodies, session cookies or private hands.
      throw new Error(
        `Seat ${index + 1} failed restoration, version or privacy checks.`,
      );
    }
  }
  return { checked: config.seats.length, passed: true };
}
