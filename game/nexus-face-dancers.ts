import {
  validateNexusTraitorSnapshot,
  type NexusTraitorSnapshot,
} from './nexus-traitor-exchange';

export type NexusFaceDancerReceipt = {
  version: 1;
  event: string;
  owner: string;
  turn: number;
  phase: number;
  stage: 'complete';
  source: NexusTraitorSnapshot;
  replaced: string[];
  drawn: string[];
  settledReserve: string[];
  signature: string;
};
export type NexusFaceDancerResult = {
  state: NexusTraitorSnapshot;
  receipt: NexusFaceDancerReceipt;
};
function requireDancers(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) throw new Error(message);
}
function identifier(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    !['__proto__', 'constructor', 'prototype'].includes(value)
  );
}
function exact(value: unknown, keys: readonly string[]): boolean {
  return (
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    [Object.prototype, null].includes(Object.getPrototypeOf(value)) &&
    Object.keys(value).sort().join(',') === [...keys].sort().join(',')
  );
}
function identities(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every(identifier) &&
    new Set(value).size === value.length
  );
}
function same(one: readonly string[], two: readonly string[]): boolean {
  return one.length === two.length && one.every((value, i) => value === two[i]);
}
function validateInput(
  input: Pick<NexusFaceDancerReceipt, 'event' | 'owner' | 'turn' | 'phase'>,
): void {
  requireDancers(
    exact(input, ['event', 'owner', 'turn', 'phase']) &&
      identifier(input.event) &&
      identifier(input.owner) &&
      Number.isSafeInteger(input.turn) &&
      input.turn > 0 &&
      Number.isSafeInteger(input.phase) &&
      input.phase >= 0 &&
      input.phase <= 8,
    'Invalid Tleilaxu Nexus replacement event.',
  );
}
function replacementGroup(
  state: NexusTraitorSnapshot,
  owner: string,
): string[] {
  const player = state.players.find((p) => p.id === owner);
  requireDancers(
    player?.faction === 'tleilaxu' && player.faceDancers,
    'Tleilaxu Cunning requires its native Face Dancer owner.',
  );
  const revealed = player.faceDancers
    .filter((card) => card.revealed)
    .map((card) => card.leader);
  requireDancers(
    revealed.length > 0,
    'Tleilaxu Cunning requires a revealed Face Dancer.',
  );
  requireDancers(
    state.reserve.length >= revealed.length,
    'Draw every replacement before returning the revealed Face Dancers.',
  );
  return revealed;
}
function signature(receipt: Omit<NexusFaceDancerReceipt, 'signature'>): string {
  return JSON.stringify([
    'nexusFaceDancers',
    receipt.version,
    receipt.event,
    receipt.owner,
    receipt.turn,
    receipt.phase,
    receipt.stage,
    receipt.source.reserve,
    receipt.source.players.map((p) => [
      p.id,
      p.faction,
      p.traitors,
      p.faceDancers?.map((card) => [card.leader, card.revealed]) ?? null,
    ]),
    receipt.replaced,
    receipt.drawn,
    receipt.settledReserve,
  ]);
}
function resultingState(receipt: NexusFaceDancerReceipt): NexusTraitorSnapshot {
  const state = structuredClone(receipt.source);
  const owner = state.players.find((p) => p.id === receipt.owner)!;
  owner.faceDancers = [
    ...owner.faceDancers!.filter((card) => !card.revealed),
    ...receipt.drawn.map((leader) => ({ leader, revealed: false })),
  ];
  state.reserve = [...receipt.settledReserve];
  return state;
}
/** Intrinsic original-event evidence, independent of later live custody. */
export function validateNexusFaceDancerHistory(
  universe: readonly string[],
  receipt: NexusFaceDancerReceipt,
): void {
  requireDancers(
    exact(receipt, [
      'version',
      'event',
      'owner',
      'turn',
      'phase',
      'stage',
      'source',
      'replaced',
      'drawn',
      'settledReserve',
      'signature',
    ]) &&
      receipt.version === 1 &&
      receipt.stage === 'complete' &&
      identities(receipt.replaced) &&
      identities(receipt.drawn) &&
      identities(receipt.settledReserve),
    'Invalid saved Tleilaxu Nexus replacement.',
  );
  validateInput({
    event: receipt.event,
    owner: receipt.owner,
    turn: receipt.turn,
    phase: receipt.phase,
  });
  validateNexusTraitorSnapshot(receipt.source, universe);
  const group = replacementGroup(receipt.source, receipt.owner);
  requireDancers(
    same(receipt.replaced, group) &&
      same(receipt.drawn, receipt.source.reserve.slice(0, group.length)),
    'The Nexus replacement must preserve the entire original revealed batch and its prior draw.',
  );
  requireDancers(
    same(
      [...receipt.settledReserve].sort(),
      [...receipt.source.reserve.slice(group.length), ...group].sort(),
    ),
    'The revealed Face Dancers return only after their replacements leave the deck.',
  );
  requireDancers(
    receipt.signature === signature(receipt),
    'The Tleilaxu Nexus replacement has lost its original history.',
  );
  validateNexusTraitorSnapshot(resultingState(receipt), universe);
}
/** Replace the full revealed batch atomically. No optional subset and no draw
 * from the just-set-aside cards. Timing and Nexus-card use belong to the engine. */
export function replaceNexusFaceDancers(
  state: NexusTraitorSnapshot,
  universe: readonly string[],
  input: Pick<NexusFaceDancerReceipt, 'event' | 'owner' | 'turn' | 'phase'>,
  rng: () => number,
): NexusFaceDancerResult {
  validateInput(input);
  validateNexusTraitorSnapshot(state, universe);
  const replaced = replacementGroup(state, input.owner);
  requireDancers(
    typeof rng === 'function',
    'A Nexus replacement needs valid shuffle randomness.',
  );
  const drawn = state.reserve.slice(0, replaced.length);
  const reserve = [...state.reserve.slice(replaced.length), ...replaced];
  for (let i = reserve.length - 1; i > 0; i--) {
    const value = rng();
    requireDancers(
      typeof value === 'number' &&
        Number.isFinite(value) &&
        value >= 0 &&
        value < 1,
      'Invalid Tleilaxu Nexus shuffle randomness.',
    );
    const j = Math.floor(value * (i + 1));
    [reserve[i], reserve[j]] = [reserve[j], reserve[i]];
  }
  const receipt: NexusFaceDancerReceipt = {
    version: 1,
    ...input,
    stage: 'complete',
    source: structuredClone(state),
    replaced,
    drawn,
    settledReserve: reserve,
    signature: '',
  };
  receipt.signature = signature(receipt);
  validateNexusFaceDancerHistory(universe, receipt);
  return { state: resultingState(receipt), receipt };
}
