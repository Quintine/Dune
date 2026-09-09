import type { Game } from './engine';
import {
  homeworldArrivalSignature,
  appendHomeworldArrivalAmbassador,
  completeHomeworldArrivalAmbassador,
  validateHomeworldArrival,
  type HomeworldAmbassadorArrival,
} from './homeworld-arrival';
import { HomeworldCustodyError } from './homeworld-custody';
import type {
  HomeworldRevivalDeploymentGroup,
  HomeworldRevivalDeploymentQuote,
  HomeworldRevivalDeploymentSource,
} from './homeworld-revival-deployment';

export type HomeworldRevivalReturn = {
  progressVersion?: 1;
  event: string;
  turn: number;
  phase: number;
  player: string;
  source: HomeworldRevivalDeploymentSource;
  card?: string;
  group: HomeworldRevivalDeploymentGroup;
  quote: HomeworldRevivalDeploymentQuote;
  stage: 'waiting' | 'choice' | 'arrival' | 'complete';
  resumeResponse?: Game['response'];
  destination?: string;
  signature: string;
  resumeSignature?: string;
  ambassadors?: HomeworldAmbassadorArrival[];
  arrivalSignature?: string;
};

export type HomeworldRevivalProgress = {
  event: string;
  stage: HomeworldRevivalReturn['stage'];
  signature: string;
};

type Original = Pick<
  HomeworldRevivalReturn,
  | 'progressVersion'
  | 'event'
  | 'turn'
  | 'phase'
  | 'player'
  | 'source'
  | 'card'
  | 'group'
  | 'quote'
>;
type Context = Pick<
  Game,
  | 'turn'
  | 'phase'
  | 'players'
  | 'homeworlds'
  | 'pendingAmbassador'
  | 'homeworldRevivalProgress'
>;

function fail(): never {
  throw new HomeworldCustodyError(
    'The saved Homeworld revival return does not match its original typed revival and continuation.',
  );
}
function count(value: unknown, min = 0, max = 20): value is number {
  return (
    Number.isSafeInteger(value) &&
    (value as number) >= min &&
    (value as number) <= max
  );
}
function text(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}
function keys(value: unknown, allowed: string[]): boolean {
  return (
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).every((key) => allowed.includes(key))
  );
}
function originalSignature(frame: Original): string {
  return JSON.stringify([
    'homeworldRevivalReturn',
    frame.event,
    frame.turn,
    frame.phase,
    frame.player,
    frame.source,
    frame.card ?? null,
    [frame.group.amount, frame.group.elite, frame.group.free],
    [
      frame.quote.kind,
      frame.quote.normal,
      frame.quote.elite,
      frame.quote.beforePopulation,
      frame.quote.afterPopulation,
      frame.quote.blocked,
    ],
    // Preserve the exact signature bytes of legacy unversioned saves.
    ...(frame.progressVersion === 1 ? ['progressVersion', 1] : []),
  ]);
}

/** Compatibility wrappers retain the original revival grant validation. */
export function homeworldRevivalArrivalSignature(
  frame: HomeworldRevivalReturn,
): string {
  return homeworldArrivalSignature(frame);
}
export function appendHomeworldRevivalAmbassador(
  frame: HomeworldRevivalReturn,
  entry: Parameters<typeof appendHomeworldArrivalAmbassador>[1],
  parent?: string,
): void {
  validateOriginal(frame);
  if (frame.signature !== originalSignature(frame)) fail();
  appendHomeworldArrivalAmbassador(frame, entry, parent);
}
export function completeHomeworldRevivalAmbassador(
  frame: HomeworldRevivalReturn,
  event: string,
): void {
  validateOriginal(frame);
  if (frame.signature !== originalSignature(frame)) fail();
  completeHomeworldArrivalAmbassador(frame, event);
}
function validateOriginal(frame: Original): void {
  if (
    (frame.progressVersion !== undefined && frame.progressVersion !== 1) ||
    !text(frame.event) ||
    !text(frame.player) ||
    !count(frame.turn, 1, Number.MAX_SAFE_INTEGER) ||
    !count(frame.phase, 0, 8) ||
    !['normal', 'emperorExtra', 'ghola'].includes(frame.source) ||
    (frame.source === 'ghola' ? !text(frame.card) : frame.card !== undefined) ||
    !keys(frame.group, ['amount', 'elite', 'free']) ||
    !count(frame.group.amount, 1) ||
    !count(frame.group.elite, 0, frame.group.amount) ||
    !count(frame.group.free, 0, frame.group.amount) ||
    (frame.source !== 'normal' && frame.group.free !== 0) ||
    !keys(frame.quote, [
      'kind',
      'normal',
      'elite',
      'beforePopulation',
      'afterPopulation',
      'blocked',
    ]) ||
    frame.quote.blocked !== null ||
    !count(frame.quote.normal) ||
    !count(frame.quote.elite) ||
    !count(frame.quote.beforePopulation) ||
    !count(frame.quote.afterPopulation) ||
    frame.quote.afterPopulation - frame.quote.beforePopulation !==
      frame.group.amount
  )
    fail();
  const quote = frame.quote;
  if (quote.kind === 'fedaykin') {
    if (
      quote.normal !== 0 ||
      !count(quote.elite, 1, 3) ||
      quote.elite !== frame.group.elite ||
      quote.beforePopulation < 3
    )
      fail();
  } else if (quote.kind === 'tleilax') {
    if (
      frame.source !== 'normal' ||
      frame.group.elite !== 0 ||
      quote.elite !== 0 ||
      quote.normal !== frame.group.free ||
      quote.normal < 1 ||
      quote.beforePopulation < 9
    )
      fail();
  } else fail();
}

/** Captured response proof survives JSON key reordering, but never omitted values. */
export function homeworldRevivalResumeSignature(
  response: Game['response'],
): string {
  if (response === null) return 'null';
  if (
    !keys(response, [
      'kind',
      'owner',
      'passed',
      'recipient',
      'amount',
      'intent',
    ])
  )
    fail();
  return JSON.stringify(
    Object.fromEntries(
      Object.entries(response).sort(([left], [right]) =>
        left.localeCompare(right),
      ),
    ),
  );
}

/** Construct only after the quoted deposit actually returned its exact group. */
export function makeHomeworldRevivalReturn(
  original: Omit<Original, 'progressVersion'>,
): HomeworldRevivalReturn {
  if (
    !keys(original, [
      'event',
      'turn',
      'phase',
      'player',
      'source',
      'card',
      'group',
      'quote',
    ])
  )
    fail();
  validateOriginal(original);
  const versioned = {
    ...structuredClone(original),
    progressVersion: 1 as const,
  };
  return {
    ...versioned,
    stage: 'waiting',
    signature: originalSignature(versioned),
  };
}

/** Only engine transition boundaries create progress; readers never reconstruct it. */
export function makeHomeworldRevivalProgress(
  frame: HomeworldRevivalReturn,
): HomeworldRevivalProgress {
  validateOriginal(frame);
  if (
    frame.progressVersion !== 1 ||
    frame.signature !== originalSignature(frame) ||
    !['waiting', 'choice', 'arrival', 'complete'].includes(frame.stage)
  )
    fail();
  return {
    event: frame.event,
    stage: frame.stage,
    signature: JSON.stringify([
      'homeworldRevivalProgress',
      frame.signature,
      frame.event,
      frame.stage,
    ]),
  };
}

/** Entitlement is the original receipt. Current native population never grants it again. */
export function validateHomeworldRevivalReturn(
  g: Context,
  frame: HomeworldRevivalReturn | null | undefined,
): void {
  if (frame === null || frame === undefined) {
    if (g.homeworldRevivalProgress !== undefined) fail();
    return;
  }
  if (
    !keys(frame, [
      'progressVersion',
      'event',
      'turn',
      'phase',
      'player',
      'source',
      'card',
      'group',
      'quote',
      'stage',
      'resumeResponse',
      'destination',
      'signature',
      'resumeSignature',
      'ambassadors',
      'arrivalSignature',
    ])
  )
    fail();
  validateOriginal(frame);
  if (
    frame.signature !== originalSignature(frame) ||
    !['waiting', 'choice', 'arrival', 'complete'].includes(frame.stage) ||
    !g.homeworlds?.custody ||
    (frame.stage !== 'complete' &&
      (g.turn !== frame.turn || g.phase !== frame.phase)) ||
    (frame.stage === 'complete' && g.turn < frame.turn)
  )
    fail();
  if (frame.progressVersion === 1) {
    const expected = makeHomeworldRevivalProgress(frame);
    const progress = g.homeworldRevivalProgress;
    if (
      !keys(progress, ['event', 'stage', 'signature']) ||
      progress?.event !== expected.event ||
      progress.stage !== expected.stage ||
      progress.signature !== expected.signature
    )
      fail();
  } else if (g.homeworldRevivalProgress !== undefined) fail();
  const owners = g.players.filter((seat) => seat.id === frame.player);
  const owner = owners[0];
  if (
    owners.length !== 1 ||
    owner.faction !== (frame.quote.kind === 'fedaykin' ? 'fremen' : 'tleilaxu')
  )
    fail();
  if (frame.stage === 'waiting' || frame.stage === 'choice') {
    if (frame.ambassadors !== undefined || frame.arrivalSignature !== undefined)
      fail();
    const elites = owner.elites?.reserves ?? 0;
    if (
      !count(owner.reserves) ||
      !count(elites, 0, owner.reserves) ||
      elites < frame.quote.elite ||
      owner.reserves - elites < frame.quote.normal
    )
      fail();
  }
  if (frame.stage === 'arrival' || frame.stage === 'complete')
    validateHomeworldArrival(g, frame, 'revivalEvent');
  if (frame.stage === 'waiting') {
    if (
      frame.resumeResponse !== undefined ||
      frame.resumeSignature !== undefined ||
      frame.destination !== undefined
    )
      fail();
    return;
  }
  if (
    frame.resumeResponse === undefined ||
    frame.resumeSignature !==
      homeworldRevivalResumeSignature(frame.resumeResponse)
  )
    fail();
  if (
    frame.stage === 'choice'
      ? frame.destination !== undefined
      : !text(frame.destination)
  )
    fail();
  const response = frame.resumeResponse;
  if (
    response !== null &&
    (response.kind !== 'revivalIncome' ||
      response.recipient !== frame.player ||
      !g.players.some(
        (seat) => seat.id === response.owner && seat.faction === 'tleilaxu',
      ) ||
      !count(response.amount, 1, Number.MAX_SAFE_INTEGER) ||
      (frame.source === 'ghola' && response.amount !== 1) ||
      !Array.isArray(response.passed) ||
      new Set(response.passed).size !== response.passed.length ||
      response.passed.some((id) => !g.players.some((seat) => seat.id === id)) ||
      (response.intent !== undefined && !text(response.intent)))
  )
    fail();
}
