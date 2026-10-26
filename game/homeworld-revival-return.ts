import type { Game } from './engine';
import {
  homeworldArrivalSignature,
  appendHomeworldArrivalAmbassador,
  completeHomeworldArrivalAmbassador,
  validateHomeworldArrival,
  type HomeworldAmbassadorArrival,
  type HomeworldArrivalFrame,
} from './homeworld-arrival';
import { HomeworldCustodyError } from './homeworld-custody';
import type {
  HomeworldRevivalDeploymentGroup,
  HomeworldRevivalDeploymentQuote,
  HomeworldRevivalDeploymentSource,
} from './homeworld-revival-deployment';

export type HomeworldRevivalReturn = {
  progressVersion?: 1 | 2;
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
  allocation?: SouthernRevivalAllocation;
};

export type SouthernRevivalChild = Omit<HomeworldArrivalFrame, 'stage'> & {
  rootEvent: string;
  index: number;
  amount: number | null;
  elite: number | null;
  stage: 'choice' | 'arrival' | 'complete';
};
export type SouthernRevivalAllocation = { version: 1; children: SouthernRevivalChild[] };

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
type ArrivalIdentity = Pick<HomeworldArrivalFrame, 'event' | 'turn' | 'phase' | 'stage' | 'destination'> & {
  progressVersion?: 1 | 2;
  allocation?: SouthernRevivalAllocation;
};
type Context = Pick<
  Game,
  | 'turn'
  | 'phase'
  | 'players'
  | 'homeworlds'
  | 'pendingAmbassador'
  | 'homeworldRevivalProgress'
> & { advanced?: boolean };

/** Selection only: minimal saved parent identities remain valid legacy inputs. */
export function currentHomeworldRevivalArrival<T extends ArrivalIdentity>(frame: T | null | undefined): T | SouthernRevivalChild | null {
  return !frame ? null : frame.progressVersion === 2 ? frame.allocation?.children.at(-1) ?? null : frame;
}

/** Actual entry packet only; an unchosen allocation has not moved any forces. */
export function currentHomeworldRevivalGroup(frame: HomeworldRevivalReturn): { amount: number; elite: number } | null {
  if (frame.progressVersion !== 2) return { amount: frame.quote.normal + frame.quote.elite, elite: frame.quote.elite };
  const child = frame.allocation?.children.at(-1);
  return child && child.amount !== null && child.elite !== null ? { amount: child.amount, elite: child.elite } : null;
}

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
    ...(frame.progressVersion === 2 ? ['progressVersion', 2, 'allocation', 1] : []),
  ]);
}

/** Compatibility wrappers retain the original revival grant validation. */
export function homeworldRevivalArrivalSignature(
  frame: HomeworldRevivalReturn,
): string {
  const arrival = currentHomeworldRevivalArrival(frame);
  if (!arrival) fail();
  return homeworldArrivalSignature(arrival);
}
export function appendHomeworldRevivalAmbassador(
  frame: HomeworldRevivalReturn,
  entry: Parameters<typeof appendHomeworldArrivalAmbassador>[1],
  parent?: string,
): void {
  validateOriginal(frame);
  if (frame.signature !== originalSignature(frame)) fail();
  validateAllocation(frame);
  const arrival = currentHomeworldRevivalArrival(frame);
  if (!arrival) fail();
  appendHomeworldArrivalAmbassador(arrival, entry, parent);
}
export function completeHomeworldRevivalAmbassador(
  frame: HomeworldRevivalReturn,
  event: string,
): void {
  validateOriginal(frame);
  if (frame.signature !== originalSignature(frame)) fail();
  validateAllocation(frame);
  const arrival = currentHomeworldRevivalArrival(frame);
  if (!arrival) fail();
  completeHomeworldArrivalAmbassador(arrival, event);
}
function validateOriginal(frame: Original): void {
  if (
    (frame.progressVersion !== undefined && frame.progressVersion !== 1 && frame.progressVersion !== 2) ||
    !text(frame.event) ||
    !text(frame.player) ||
    !count(frame.turn, 1, Number.MAX_SAFE_INTEGER) ||
    !count(frame.phase, 0, 8) ||
    !['normal', 'emperorExtra', 'ghola', 'nexusTleilaxu', 'nexusEmperor'].includes(frame.source) ||
    (frame.source === 'ghola' ? !text(frame.card) : frame.card !== undefined) ||
    !keys(frame.group, ['amount', 'elite', 'free']) ||
    !count(frame.group.amount, 1) ||
    !count(frame.group.elite, 0, frame.group.amount) ||
    !count(frame.group.free, 0, frame.group.amount) ||
    (frame.source === 'nexusEmperor'
      ? frame.group.amount !== 3 || frame.group.free !== 3
      : frame.source !== 'normal' && frame.group.free !== 0) ||
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
  if (frame.progressVersion === 2 && (quote.kind !== 'fedaykin' || quote.elite < 2)) fail();
  // Provisional composition policy: the population resulting from this return
  // decides the ability, so the crossing return's frame is valid even though
  // the pre-return population was below the high threshold.
  if (quote.kind === 'fedaykin') {
    if (
      quote.normal !== 0 ||
      !count(quote.elite, 1, 3) ||
      quote.elite !== frame.group.elite
    )
      fail();
  } else if (quote.kind === 'tleilax') {
    if (
      frame.source !== 'normal' ||
      frame.group.elite !== 0 ||
      quote.elite !== 0 ||
      quote.normal !== frame.group.free ||
      quote.normal < 1
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

function southernChildSignature(root: HomeworldRevivalReturn, child: SouthernRevivalChild): string {
  return JSON.stringify(['southernRevivalChild', root.signature, root.event, child.index, child.event, child.amount, child.elite]);
}

function validateAllocation(root: HomeworldRevivalReturn): void {
  if (root.progressVersion !== 2) {
    if (Object.hasOwn(root, 'allocation')) fail();
    return;
  }
  const allocation = root.allocation;
  if (!keys(allocation, ['version', 'children']) || allocation?.version !== 1 || !Array.isArray(allocation.children) ||
    allocation.children.length > root.quote.elite || root.destination !== undefined || root.ambassadors !== undefined ||
    root.arrivalSignature !== undefined) fail();
  const seen = new Set([root.event]);
  let selected = 0;
  for (const [index, child] of allocation.children.entries()) {
    if (!keys(child, ['event', 'turn', 'phase', 'player', 'stage', 'signature', 'destination', 'ambassadors',
      'arrivalSignature', 'rootEvent', 'index', 'amount', 'elite']) || !text(child.event) || seen.has(child.event) ||
      child.rootEvent !== root.event || child.index !== index || child.turn !== root.turn || child.phase !== root.phase ||
      child.player !== root.player || !['choice', 'arrival', 'complete'].includes(child.stage) ||
      (index < allocation.children.length - 1 && child.stage !== 'complete')) fail();
    seen.add(child.event);
    if (child.stage === 'choice') {
      if (child.amount !== null || child.elite !== null || child.destination !== undefined ||
        child.ambassadors !== undefined || child.arrivalSignature !== undefined || selected >= root.quote.elite) fail();
    } else {
      if (!count(child.amount, 1, root.quote.elite) || child.elite !== child.amount || !text(child.destination) ||
        child.arrivalSignature !== homeworldArrivalSignature(child)) fail();
      selected += child.amount;
    }
    if (child.signature !== southernChildSignature(root, child) || selected > root.quote.elite) fail();
  }
  const current = allocation.children.at(-1);
  if (root.stage === 'waiting' ? allocation.children.length !== 0 : !current || root.stage !== current.stage) fail();
  if (root.stage === 'complete' && selected !== root.quote.elite) fail();
}

function requireSouthern(root: HomeworldRevivalReturn): void {
  validateOriginal(root);
  if (root.progressVersion !== 2 || root.signature !== originalSignature(root)) fail();
  validateAllocation(root);
  if (root.stage !== 'waiting' && (root.resumeResponse === undefined ||
    root.resumeSignature !== homeworldRevivalResumeSignature(root.resumeResponse))) fail();
}

export function southernRevivalSummary(root: HomeworldRevivalReturn): { total: number; remaining: number; placed: number; kept: number } {
  requireSouthern(root);
  let placed = 0, kept = 0;
  for (const child of root.allocation!.children) {
    if (child.amount === null) continue;
    if (child.destination === 'decline') kept += child.amount;
    else placed += child.amount;
  }
  return { total: root.quote.elite, remaining: root.quote.elite - placed - kept, placed, kept };
}

export function southernRevivalRemaining(root: HomeworldRevivalReturn): number {
  return southernRevivalSummary(root).remaining;
}

/** Fresh Basic multi-star roots only. The engine owns the actual one-time return. */
export function makeSouthernRevivalAllocation(original: Omit<Original, 'progressVersion'>): HomeworldRevivalReturn {
  const base = makeHomeworldRevivalReturn(original);
  const root: HomeworldRevivalReturn = { ...base, progressVersion: 2, allocation: { version: 1, children: [] } };
  validateOriginal(root);
  root.signature = originalSignature(root);
  validateAllocation(root);
  return root;
}

function makeSouthernChoice(root: HomeworldRevivalReturn, event: string): SouthernRevivalChild {
  if (!text(event) || event !== event.trim() || event === root.event || root.allocation!.children.some(child => child.event === event)) fail();
  const child: SouthernRevivalChild = { event, turn: root.turn, phase: root.phase, player: root.player,
    stage: 'choice', signature: '', rootEvent: root.event, index: root.allocation!.children.length, amount: null, elite: null };
  child.signature = southernChildSignature(root, child);
  return child;
}

/** Capture the original response once before opening the first owned child. */
export function openSouthernRevivalChoice(root: HomeworldRevivalReturn, newEvent: string): void {
  requireSouthern(root);
  if (root.stage !== 'waiting' || root.allocation!.children.length || root.resumeResponse === undefined ||
    root.resumeSignature !== homeworldRevivalResumeSignature(root.resumeResponse)) fail();
  const child = makeSouthernChoice(root, newEvent);
  root.allocation!.children.push(child);
  root.stage = 'choice';
}

/** Called at the same atomic boundary as the native subset debit/placement. */
export function commitSouthernRevivalChoice(root: HomeworldRevivalReturn, event: string,
  selection: { amount: number; destination: string }): void {
  requireSouthern(root);
  const child = root.allocation!.children.at(-1);
  if (root.stage !== 'choice' || !child || child.stage !== 'choice' || child.event !== event ||
    !keys(selection, ['amount', 'destination']) || !count(selection.amount, 1, southernRevivalRemaining(root)) ||
    !text(selection.destination) || selection.destination !== selection.destination.trim()) fail();
  child.amount = selection.amount;
  child.elite = selection.amount;
  child.destination = selection.destination;
  child.stage = 'arrival';
  child.signature = southernChildSignature(root, child);
  child.ambassadors = [];
  child.arrivalSignature = homeworldArrivalSignature(child);
  root.stage = 'arrival';
}

/** Retire one complete native arrival, then open the next fresh choice or finish.
 * The original response remains held until the whole root is complete. */
export function completeSouthernRevivalChild(root: HomeworldRevivalReturn, event: string, nextEvent?: string): void {
  requireSouthern(root);
  const child = root.allocation!.children.at(-1);
  if (root.stage !== 'arrival' || !child || child.stage !== 'arrival' || child.event !== event ||
    child.ambassadors!.some(entry => !entry.completed)) fail();
  const remaining = southernRevivalRemaining(root);
  if (remaining === 0 && nextEvent !== undefined || remaining > 0 && nextEvent === undefined) fail();
  const next = remaining > 0 ? makeSouthernChoice(root, nextEvent!) : null;
  child.stage = 'complete';
  if (next) {
    root.allocation!.children.push(next);
    root.stage = 'choice';
  } else root.stage = 'complete';
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
    (frame.progressVersion !== 1 && frame.progressVersion !== 2) ||
    frame.signature !== originalSignature(frame) ||
    !['waiting', 'choice', 'arrival', 'complete'].includes(frame.stage)
  )
    fail();
  validateAllocation(frame);
  return {
    event: frame.event,
    stage: frame.stage,
    signature: JSON.stringify([
      'homeworldRevivalProgress',
      frame.signature,
      frame.event,
      frame.stage,
      ...(frame.progressVersion === 2 ? ['allocation', frame.allocation!.children.map(child => [
        child.event, child.index, child.amount, child.elite, child.stage, child.destination ?? null, child.signature,
      ])] : []),
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
      ...(frame.progressVersion === 2 ? ['allocation'] : []),
    ])
  )
    fail();
  validateOriginal(frame);
  validateAllocation(frame);
  if (
    frame.signature !== originalSignature(frame) ||
    !['waiting', 'choice', 'arrival', 'complete'].includes(frame.stage) ||
    !g.homeworlds?.custody ||
    (frame.stage !== 'complete' &&
      (g.turn !== frame.turn || g.phase !== frame.phase)) ||
    (frame.stage === 'complete' && g.turn < frame.turn) ||
    (frame.progressVersion === 2 && g.advanced !== false)
  )
    fail();
  if (frame.progressVersion === 1 || frame.progressVersion === 2) {
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
  }
  if (frame.stage === 'waiting' || frame.stage === 'choice' || frame.progressVersion === 2 && frame.stage !== 'complete') {
    const elites = owner.elites?.reserves ?? 0;
    const elite = frame.progressVersion === 2 ? southernRevivalRemaining(frame) : frame.quote.elite;
    const normal = frame.progressVersion === 2 ? 0 : frame.quote.normal;
    if (
      !count(owner.reserves) ||
      !count(elites, 0, owner.reserves) ||
      elites < elite ||
      owner.reserves - elites < normal
    )
      fail();
  }
  if (frame.progressVersion === 2) {
    for (const child of frame.allocation!.children)
      if (child.stage !== 'choice') validateHomeworldArrival(g, child, 'revivalEvent');
  } else if (frame.stage === 'arrival' || frame.stage === 'complete')
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
  if (frame.progressVersion !== 2 && (
    frame.stage === 'choice'
      ? frame.destination !== undefined
      : !text(frame.destination)
  ))
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
