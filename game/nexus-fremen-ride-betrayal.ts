import { TERRITORIES, splitLocation } from './board';
import type { Game } from './engine';
import { fremenNexusModeSupported } from './fremen-nexus-profile';
import { validateGreatMaker } from './great-maker';
import { validateNexusCards } from './nexus-cards';
import { quoteFremenCunningRide } from './nexus-fremen-cunning';

export type FremenRideBetrayalParent =
  | { kind: 'wormRide'; player: string; territory: string }
  | { kind: 'nexusFremenCunningRide' | 'greatMakerRide'; player: string; event: string };
export type FremenRideBetrayalFrame = {
  event: string;
  turn: number;
  source: FremenRideBetrayalParent;
  stage: 'choose' | 'complete';
  order: string[];
  passed: string[];
  usedBy: string | null;
  signature: string;
};
export class FremenRideBetrayalError extends Error {
  constructor(message: string) { super(message); this.name = 'FremenRideBetrayalError'; }
}
function requireRide(condition: unknown, message: string): asserts condition {
  if (!condition) throw new FremenRideBetrayalError(message);
}
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const exact = (value: unknown, keys: readonly string[]): boolean => !!value && typeof value === 'object' &&
  !Array.isArray(value) && Object.keys(value).sort().join(',') === [...keys].sort().join(',');
const ids = (value: unknown): value is string[] => Array.isArray(value) && value.every(text) &&
  new Set(value).size === value.length;
const equal = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((id, i) => id === b[i]);

function validateParent(parent: FremenRideBetrayalParent): void {
  requireRide(parent && text(parent.player) &&
    (parent.kind === 'wormRide'
      ? exact(parent, ['kind', 'player', 'territory']) && TERRITORIES.some(t => t.id === parent.territory)
      : ['nexusFremenCunningRide', 'greatMakerRide'].includes(parent.kind) &&
        exact(parent, ['kind', 'player', 'event']) && text(parent.event)),
  'Fremen ride Betrayal needs one exact original native ride decision.');
}
function parentKey(parent: FremenRideBetrayalParent) {
  return [parent.kind, parent.player, parent.kind === 'wormRide' ? parent.territory : parent.event];
}
function signature(frame: Omit<FremenRideBetrayalFrame, 'signature'>): string {
  return JSON.stringify(['nexusFremenRideBetrayal', frame.event, frame.turn, parentKey(frame.source),
    frame.stage, frame.order, frame.passed, frame.usedBy]);
}
function seal(frame: Omit<FremenRideBetrayalFrame, 'signature'>): FremenRideBetrayalFrame {
  return { ...frame, signature: signature(frame) };
}
function validateFrame(frame: FremenRideBetrayalFrame): void {
  requireRide(exact(frame, ['event', 'turn', 'source', 'stage', 'order', 'passed', 'usedBy', 'signature']) &&
    text(frame.event) && Number.isSafeInteger(frame.turn) && frame.turn > 0 &&
    ['choose', 'complete'].includes(frame.stage) && ids(frame.order) && frame.order.length > 0 &&
    ids(frame.passed) && frame.passed.length <= frame.order.length &&
    equal(frame.passed, frame.order.slice(0, frame.passed.length)),
  'The original Fremen ride Betrayal acknowledgement progress is invalid.');
  validateParent(frame.source);
  requireRide(frame.stage === 'choose'
    ? frame.usedBy === null && frame.passed.length < frame.order.length
    : frame.usedBy === null
      ? frame.passed.length === frame.order.length
      : text(frame.usedBy) && frame.usedBy === frame.order[frame.passed.length],
  'Fremen ride Betrayal must finish by all original passes or one current responder.');
  requireRide(frame.signature === signature(frame), 'Fremen ride Betrayal lost its original parent or progress.');
}

/** Public participation only: no card face enters membership, order or event. */
function publicOrder(g: Game): string[] {
  requireRide(ids(g.order) && g.order.length === g.players.length &&
    g.players.every(p => g.order.includes(p.id)), 'Fremen ride Betrayal needs the complete original storm order.');
  return g.order.filter(id => {
    const p = g.players.find(p => p.id === id)!;
    return p.faction !== 'fremen' && !p.ally && Boolean(g.nexusCards!.cards!.hands[id]);
  });
}
function available(g: Game): boolean {
  return g.status === 'playing' && g.phase === 1 && fremenNexusModeSupported(g) &&
    !g.nexusCards!.cards!.discard.includes('fremen') &&
    !g.players.some(p => p.faction === 'fremen' && p.fremenNexusWormBlockedTurn === g.turn);
}
function validateNativeParent(g: Game, parent: FremenRideBetrayalParent): void {
  const native = g.players.find(p => p.id === parent.player && p.faction === 'fremen');
  requireRide(native, 'Only the actual Fremen native ride can open this Betrayal opportunity.');
  if (parent.kind === 'wormRide') {
    // nextWormRide already shifted this territory out of the remaining queue.
    requireRide(Object.entries(native.forces).some(([key, count]) => {
      const at = splitLocation(key);
      return count > 0 && at.territory === parent.territory && at.sector !== g.storm;
    }), 'The original ordinary worm ride has no remaining clear Fremen source.');
  } else if (parent.kind === 'greatMakerRide') {
    requireRide(g.greatMaker?.stage === 'ride' && g.greatMaker.event === parent.event &&
      g.greatMaker.turn === g.turn && native.reserves > 0,
    'The original Great Maker reserve ride has changed.');
    try { validateGreatMaker(g.greatMaker, g.turn, g.players); }
    catch (error) { throw new FremenRideBetrayalError(error instanceof Error ? error.message : 'Invalid Great Maker ride.'); }
  } else {
    const row = g.nexusFremenCunningRides?.find(row => row.stage === 'select' &&
      row.occurrence.event === parent.event && row.occurrence.turn === g.turn && row.authorization.owner === native.id);
    requireRide(row && quoteFremenCunningRide(g, native.id, row.occurrence, row.authorization),
      'The original selected Fremen Cunning ride has changed.');
  }
}

/** Called only at the original native decision's creation. Public discard and
 * public card backs decide whether anyone could respond. A valid Cunning ride
 * currently keeps the Fremen card in discard, so it needs no neutral pause. */
export function createFremenRideBetrayal(g: Game, parent: FremenRideBetrayalParent,
  event: string): FremenRideBetrayalFrame | null {
  if (!available(g)) return null;
  requireRide(Number.isSafeInteger(g.turn) && g.turn > 0, 'Fremen ride Betrayal needs its original positive turn.');
  validateNexusCards(g.nexusCards!.cards!, g.players);
  const order = publicOrder(g); if (!order.length) return null;
  validateParent(parent);
  requireRide(text(event) && g.decision && exact(g.decision, parent.kind === 'wormRide'
    ? ['kind', 'player', 'territory'] : ['kind', 'player', 'event']) &&
    JSON.stringify(parentKey(g.decision as FremenRideBetrayalParent)) === JSON.stringify(parentKey(parent)),
  'Open Betrayal only before the current original Fremen ride decision.');
  validateNativeParent(g, parent);
  return seal({ event, turn: g.turn, source: structuredClone(parent), stage: 'choose', order, passed: [], usedBy: null });
}

export function fremenRideBetrayalCurrentOwner(frame: FremenRideBetrayalFrame): string | null {
  validateFrame(frame); return frame.stage === 'choose' ? frame.order[frame.passed.length] : null;
}

/** Active validation accepts the exact original producer before wrapping, or
 * the exact published wrapper owner/event. Completed records are detached
 * signed progress: native continuation may already have consumed its parent. */
export function validateFremenRideBetrayal(g: Game, frame: FremenRideBetrayalFrame): void {
  validateFrame(frame);
  requireRide(Number.isSafeInteger(g.turn) && g.turn >= frame.turn &&
    g.players.some(p => p.id === frame.source.player && p.faction === 'fremen') &&
    frame.order.every(id => g.players.some(p => p.id === id && p.faction !== 'fremen')),
  'Fremen ride Betrayal lost its original turn or native roster.');
  if (frame.stage === 'complete') return;
  requireRide(g.turn === frame.turn && available(g), 'This original Fremen ride Betrayal opportunity has expired.');
  validateNexusCards(g.nexusCards!.cards!, g.players);
  requireRide(equal(frame.order, publicOrder(g)), 'The original public Fremen ride Betrayal responders changed.');
  const decision = g.decision;
  const original = decision && exact(decision, frame.source.kind === 'wormRide'
    ? ['kind', 'player', 'territory'] : ['kind', 'player', 'event']) &&
    JSON.stringify(parentKey(decision as FremenRideBetrayalParent)) === JSON.stringify(parentKey(frame.source));
  const wrapper = exact(decision, ['kind', 'player', 'event']) &&
    decision?.kind === 'nexusFremenRideBetrayal' && decision.event === frame.event &&
    decision.player === fremenRideBetrayalCurrentOwner(frame);
  requireRide(original || wrapper, 'Fremen ride Betrayal is not holding its exact original decision or current wrapper.');
  validateNativeParent(g, frame.source);
}

function current(g: Game, frame: FremenRideBetrayalFrame, actor: string, event: string): void {
  validateFremenRideBetrayal(g, frame);
  requireRide(frame.stage === 'choose' && event === frame.event && fremenRideBetrayalCurrentOwner(frame) === actor,
    'Acknowledge only your current original Fremen ride Betrayal opportunity.');
}
export function passFremenRideBetrayal(g: Game, frame: FremenRideBetrayalFrame,
  actor: string, event: string): FremenRideBetrayalFrame {
  current(g, frame, actor, event);
  const passed = [...frame.passed, actor];
  return seal({ ...structuredClone(frame), passed, stage: passed.length === frame.order.length ? 'complete' : 'choose' });
}
/** Eligibility of the actual Fremen face is deliberately the engine's private
 * responsibility. Finish this frame BEFORE spending that physical card. */
export function useFremenRideBetrayal(g: Game, frame: FremenRideBetrayalFrame,
  actor: string, event: string): FremenRideBetrayalFrame {
  current(g, frame, actor, event);
  return seal({ ...structuredClone(frame), stage: 'complete', usedBy: actor });
}
