import type { FactionId } from './catalog';

export const CHOAM_NEXUS_EFFECTS = Object.freeze({
  kulon: 'Kulon',
  laLaLa: 'La La La',
  gamont: 'Trip to Gamont',
  baliset: 'Baliset',
  jubba: 'Jubba Cloak',
  kull: 'Kull Wahad',
} as const);
export type NexusChoamEffect = keyof typeof CHOAM_NEXUS_EFFECTS;
export type NexusChoamContext = {
  turn: number;
  players: readonly { id: string; faction: FactionId }[];
};
export type NexusChoamReceipt = {
  version: 1;
  event: string;
  turn: number;
  phase: number;
  owner: string;
  card: string;
  effect: NexusChoamEffect;
  roster: { id: string; faction: FactionId }[];
  signature: string;
};
function requireChoam(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
function identifier(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    !['__proto__', 'constructor', 'prototype'].includes(value)
  );
}
function roster(context: NexusChoamContext) {
  requireChoam(
    Number.isSafeInteger(context.turn) &&
      context.turn > 0 &&
      Array.isArray(context.players) &&
      context.players.length > 0 &&
      context.players.every(
        (p) => p && identifier(p.id) && identifier(p.faction),
      ) &&
      new Set(context.players.map((p) => p.id)).size ===
        context.players.length &&
      new Set(context.players.map((p) => p.faction)).size ===
        context.players.length,
    'CHOAM Nexus needs its original faction roster and turn.',
  );
  return context.players
    .map(({ id, faction }) => ({ id, faction }))
    .sort((a, b) => a.id.localeCompare(b.id));
}
function phaseMatches(effect: NexusChoamEffect, phase: number): boolean {
  if (!Number.isSafeInteger(phase) || phase < 0 || phase > 8) return false;
  switch (effect) {
    case 'kulon':
    case 'baliset':
      return phase === 5;
    case 'laLaLa':
      return phase === 4;
    case 'gamont':
      return phase === 8;
    case 'jubba':
      return phase === 0;
    // This describes printed timing only; the engine must separately authorize
    // a real Karama attempt and retains Kull's unresolved implementation gate.
    case 'kull':
      return true;
    default:
      return false;
  }
}
function signature(receipt: NexusChoamReceipt): string {
  return JSON.stringify([
    receipt.version,
    receipt.event,
    receipt.turn,
    receipt.phase,
    receipt.owner,
    receipt.card,
    receipt.effect,
    receipt.roster.map((p) => [p.id, p.faction]),
  ]);
}
/** Historical evidence is independent of later card custody or alliances.
 * Current eligibility, canonical card inventory and progress belong to the engine. */
export function validateNexusChoam(
  context: NexusChoamContext,
  receipt: NexusChoamReceipt,
): void {
  const seats = roster(context);
  requireChoam(
    receipt &&
      typeof receipt === 'object' &&
      !Array.isArray(receipt) &&
      [Object.prototype, null].includes(Object.getPrototypeOf(receipt)) &&
      Object.keys(receipt).sort().join(',') ===
        'card,effect,event,owner,phase,roster,signature,turn,version' &&
      receipt.version === 1 &&
      Number.isSafeInteger(receipt.turn) &&
      receipt.turn > 0 &&
      receipt.turn <= context.turn &&
      identifier(receipt.card) &&
      Object.hasOwn(CHOAM_NEXUS_EFFECTS, receipt.effect) &&
      phaseMatches(receipt.effect, receipt.phase) &&
      seats.some((p) => p.id === receipt.owner && p.faction === 'choam') &&
      receipt.event ===
        JSON.stringify([
          'nexusChoam',
          receipt.turn,
          receipt.phase,
          receipt.owner,
          receipt.card,
          receipt.effect,
        ]) &&
      JSON.stringify(receipt.roster) === JSON.stringify(seats) &&
      receipt.signature === signature(receipt),
    'CHOAM Nexus has lost its original card, chosen effect, timing or owner.',
  );
}
export function createNexusChoam(
  context: NexusChoamContext,
  owner: string,
  phase: number,
  card: string,
  effect: NexusChoamEffect,
): NexusChoamReceipt {
  const receipt: NexusChoamReceipt = {
    version: 1,
    event: JSON.stringify([
      'nexusChoam',
      context.turn,
      phase,
      owner,
      card,
      effect,
    ]),
    turn: context.turn,
    phase,
    owner,
    card,
    effect,
    roster: roster(context),
    signature: '',
  };
  receipt.signature = signature(receipt);
  validateNexusChoam(context, receipt);
  return receipt;
}
