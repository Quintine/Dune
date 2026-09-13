import { fighterCount } from './advisors';
import type { Game } from './engine';
import { isDiscoveryTokenId, type DiscoveryOpaqueTokenId } from './discoveries';

export class DiscoveryStormError extends Error {}
const whole = (n: unknown): n is number =>
  Number.isSafeInteger(n) && (n as number) >= 0;
const record = (x: unknown): x is Record<string, unknown> =>
  !!x && typeof x === 'object' && !Array.isArray(x);
function need(x: unknown, message: string): asserts x {
  if (!x) throw new DiscoveryStormError(message);
}
export type StormMovementSource = {
  turn: number;
  kind: 'dials' | 'card' | 'weather';
  distance: number;
  signature: string;
};
export type DiscoveryStorm = {
  event: string;
  turn: number;
  owner: string;
  token: DiscoveryOpaqueTokenId;
  from: number;
  base: number;
  delta: -1 | 0 | 1 | null;
  stage: 'choose' | 'traversal' | 'complete';
  signature: string;
};
export type DiscoveryStormContext = Pick<
  Game,
  | 'status'
  | 'turn'
  | 'phase'
  | 'storm'
  | 'stormPending'
  | 'discoveryEnabled'
  | 'discoveries'
  | 'players'
> & { stormMovementSource?: StormMovementSource };
export function stormSourceSignature(
  source: Omit<StormMovementSource, 'signature'>,
) {
  return JSON.stringify([source.turn, source.kind, source.distance]);
}
export function createStormSource(
  turn: number,
  kind: StormMovementSource['kind'],
  distance: number,
): StormMovementSource {
  const source = { turn, kind, distance, signature: '' };
  source.signature = stormSourceSignature(source);
  validateStormSource(source);
  return source;
}
export function validateStormSource(source: StormMovementSource) {
  need(
    record(source) &&
      Object.keys(source).sort().join(',') === 'distance,kind,signature,turn' &&
      whole(source.turn) &&
      source.turn > 0 &&
      ['dials', 'card', 'weather'].includes(source.kind) &&
      whole(source.distance) &&
      source.distance <= 40 &&
      source.signature === stormSourceSignature(source),
    'The storm has lost its original movement source.',
  );
}
export function discoveryStormSignature(
  frame: Omit<DiscoveryStorm, 'signature'>,
) {
  return JSON.stringify([
    frame.event,
    frame.turn,
    frame.owner,
    frame.token,
    frame.from,
    frame.base,
    frame.delta,
    frame.stage,
  ]);
}
export function discoveryStormOffer(g: DiscoveryStormContext) {
  const token =
    g.discoveryEnabled &&
    g.discoveries?.tokens.find(
      (t) =>
        t.face === 'ecological-testing-station' &&
        t.status === 'placed' &&
        t.revealedTurn !== null,
    );
  if (!token) return null;
  const occupants = g.players.filter(
    (p) => fighterCount(p, 'ecological-testing-station') > 0,
  );
  if (occupants.length !== 1) return null;
  const owner = occupants[0].id,
    source = g.stormMovementSource;
  if (source) validateStormSource(source);
  let blocked: string | null = null;
  if (g.status !== 'playing' || g.phase !== 0 || g.stormPending === null)
    blocked = 'Wait until ordinary storm movement is revealed.';
  else if (!source || source.turn !== g.turn)
    blocked =
      'This storm was already pending before the station became available. Its original movement is preserved.';
  else if (source.kind === 'weather')
    blocked = 'Ecological Testing Station cannot change Weather Control.';
  else if (source.distance !== g.stormPending)
    blocked =
      'The current storm movement no longer matches this station opportunity.';
  const base = g.stormPending ?? 0;
  const options = ([-1, 0, 1] as const)
    .filter((delta) => base + delta >= 0 && base + delta <= 40)
    .map((delta) => ({ delta, distance: base + delta }));
  return { owner, token: token.id, base, options, blocked };
}
export function createDiscoveryStorm(
  g: DiscoveryStormContext,
  event: string,
): DiscoveryStorm {
  const offer = discoveryStormOffer(g);
  need(
    offer && !offer.blocked && typeof event === 'string' && event.length > 0,
    offer?.blocked ?? 'No sole occupant may adjust this storm.',
  );
  const frame: DiscoveryStorm = {
    event,
    turn: g.turn,
    owner: offer.owner,
    token: offer.token,
    from: g.storm,
    base: offer.base,
    delta: null,
    stage: 'choose',
    signature: '',
  };
  frame.signature = discoveryStormSignature(frame);
  validateDiscoveryStorm(g, frame);
  return frame;
}
export function validateDiscoveryStorm(
  g: DiscoveryStormContext,
  frame: DiscoveryStorm,
) {
  need(
    record(frame) &&
      Object.keys(frame).sort().join(',') ===
        'base,delta,event,from,owner,signature,stage,token,turn' &&
      typeof frame.event === 'string' &&
      frame.event.length > 0 &&
      typeof frame.owner === 'string' &&
      g.players.some((p) => p.id === frame.owner) &&
      isDiscoveryTokenId(frame.token) &&
      whole(frame.turn) &&
      frame.turn > 0 &&
      frame.turn <= g.turn &&
      whole(frame.from) &&
      frame.from <= 18 &&
      whole(frame.base) &&
      frame.base <= 40 &&
      ['choose', 'traversal', 'complete'].includes(frame.stage) &&
      (frame.stage === 'choose'
        ? frame.delta === null
        : [-1, 0, 1].includes(frame.delta as number) &&
          frame.base + frame.delta! >= 0 &&
          frame.base + frame.delta! <= 40) &&
      frame.signature === discoveryStormSignature(frame),
    'The station has lost its signed storm choice.',
  );
  need(
    g.discoveryEnabled &&
      g.discoveries?.tokens.some(
        (token) =>
          token.id === frame.token &&
          token.face === 'ecological-testing-station' &&
          token.status === 'placed' &&
          token.revealedTurn !== null &&
          token.revealedTurn <= frame.turn,
      ),
    'The station choice must retain its original revealed physical token.',
  );
  if (frame.stage === 'complete') return;
  need(
    g.discoveryEnabled &&
      g.status === 'playing' &&
      g.phase === 0 &&
      g.turn === frame.turn &&
      g.storm === frame.from &&
      g.stormMovementSource,
    'Finish the station choice with its original storm.',
  );
  validateStormSource(g.stormMovementSource);
  need(
    g.stormMovementSource.turn === frame.turn &&
      g.stormMovementSource.kind !== 'weather' &&
      g.stormMovementSource.distance === frame.base,
    'The station cannot replace its original storm source or affect Weather Control.',
  );
  if (frame.stage === 'choose') {
    const offer = discoveryStormOffer(g);
    need(
      offer &&
        !offer.blocked &&
        offer.owner === frame.owner &&
        offer.token === frame.token &&
        offer.base === frame.base,
      'The station choice no longer belongs to its original occupant and storm.',
    );
  } else
    need(
      g.stormPending === frame.base + frame.delta!,
      'The adjusted storm must retain the chosen distance.',
    );
}
export function chooseDiscoveryStorm(
  g: DiscoveryStormContext,
  frame: DiscoveryStorm,
  owner: string,
  event: unknown,
  delta: unknown,
): DiscoveryStorm {
  validateDiscoveryStorm(g, frame);
  need(
    frame.stage === 'choose' &&
      frame.owner === owner &&
      frame.event === event &&
      typeof delta === 'number' &&
      [-1, 0, 1].includes(delta) &&
      frame.base + delta >= 0 &&
      frame.base + delta <= 40,
    'Choose the current station opportunity: decrease one, keep the distance, or increase one.',
  );
  const next = {
    ...frame,
    delta: delta as -1 | 0 | 1,
    stage: 'traversal' as const,
    signature: '',
  };
  next.signature = discoveryStormSignature(next);
  return next;
}
export function finishDiscoveryStorm(frame: DiscoveryStorm): DiscoveryStorm {
  need(
    frame.stage === 'traversal',
    'Only a committed station adjustment can complete.',
  );
  const next = { ...frame, stage: 'complete' as const, signature: '' };
  next.signature = discoveryStormSignature(next);
  return next;
}
