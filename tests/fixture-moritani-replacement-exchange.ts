import assert from 'node:assert/strict';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { territory } from '../game/board';
import { nexusTraitorDrawAction, nexusTraitorReturnAction } from '../game/nexus-traitor-options';
import {
  advanceMixedE3Moritani, mixedE3MoritaniClean,
  mixedE3MoritaniPlayer, mixedE3MoritaniReload,
  orderMixedE3MoritaniSpice, quoteMixedE3MoritaniBattle, revealMixedE3MoritaniPlans,
  settleMixedE3MoritaniBoundary, shipMixedE3Moritani, stepMixedE3Moritani,
  type MixedE3MoritaniStep, type MixedE3MoritaniTransition,
} from './fixture-mixed-e3-moritani-nexus';
import {
  createMoritaniAuditorWinnerFixture, finishMoritaniAuditorReplacement,
  nextMoritaniAuditorWinnerStep, pendingMoritaniAuditorAssassination,
  revealMoritaniAuditorTarget, type MoritaniAuditorWinnerFixture,
} from './fixture-moritani-auditor-winner';

/** Original undealt Traitor reserve prefix requested from the real initial
 * shuffle: the card the original Mentat actually replaces the retired native
 * CHOAM victim with, the real Guild Traitor retained by the Secret Ally draw,
 * and the second card returned beside that replacement. Positions 16..18 of
 * the original deal remain the undealt head after setup appends every unchosen
 * offer, so the reserve head here is exactly this prefix without the drawn
 * replacement. */
const RESERVE_PREFIX = ['emperor-0', 'guild-2', 'emperor-2'] as const;
/** Printed territories a genuine paid shipment may legally occupy. */
const EXCHANGE_SITES = [
  'red_chasm', 'habbanya_ridge_sietch', 'sietch_tabr', 'hagga_basin', 'imperial_basin',
  'arrakeen', 'carthag', 'false_wall_south', 'broken_land', 'south_mesa',
] as const;

export type MoritaniReplacementExchangeFixture = MoritaniAuditorWinnerFixture & {
  /** The actual public face-up card the original Mentat retired from play. */
  retiredVictim: string;
  /** The private card that original Mentat actually drew and still holds. */
  historicalReplacement: string;
  /** A real Traitor Card of the loaded reserve head, drawn by Secret Ally. */
  guildTraitor: string;
  reservePrefix: readonly string[];
  /** Original phase-8 window, retaining Moritani's optional placement while Nexus pauses it. */
  ready: Game;
  /** The genuine owner-only Secret Ally draw for that offer. */
  draw: Action;
  /** The two physical cards the original draw takes from the reserve head. */
  drawn: readonly string[];
  history: { event: string; card: string; replacement: string; signature: string };
};

/** Inverse of the engine's real Fisher-Yates reserve shuffle: the exact
 * original randomness that lands one physical reserve in the requested
 * layout. Directed only onto a shuffle this fixture itself just caused. */
function fisherRolls(source: readonly string[], desired: readonly string[]): number[] {
  assert.deepEqual([...source].sort(), [...desired].sort());
  const working = [...source], rolls: number[] = [];
  for (let i = working.length - 1; i > 0; i--) {
    const j = working.indexOf(desired[i]);
    assert.ok(j >= 0 && j <= i, 'The requested reserve layout is not a permutation of the shuffle.');
    rolls.push(Math.floor((j + 0.5) * 0x100000000 / (i + 1)));
    [working[i], working[j]] = [working[j], working[i]];
  }
  return rolls;
}

/** Runs one real action with the supplied original shuffle entropy, and proves
 * that entropy was the only randomness the action consumed. */
function directedRolls<T>(rolls: readonly number[], operation: () => T): { value: T; consumed: number } {
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  const native = crypto.getRandomValues.bind(crypto);
  let cursor = 0;
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    if (cursor < rolls.length && array instanceof Uint32Array && array.length === 1) array[0] = rolls[cursor++];
    else Reflect.apply(native, crypto, [array]);
    return array;
  };
  try { return { value: operation(), consumed: cursor }; }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}

/** Highest- or lowest-strength legal commitment for one combatant, chosen by
 * trying the engine's own plan validator. Never assumes a fixed dial or budget. */
function legalPlan(g: Game, actor: string, leader: string, prefer: 'max' | 'min'): Action {
  const spice = mixedE3MoritaniPlayer(g, actor).spice;
  const supports = prefer === 'max' ? Array.from({ length: spice + 1 }, (_, index) => spice - index) : [0];
  const dials = prefer === 'max' ? Array.from({ length: 13 }, (_, index) => 12 - index) : [0];
  const reasons = new Set<string>();
  for (const support of supports) for (const dial of dials) {
    const action: Action = { type: 'battlePlan', leader, dial, support };
    try { applyAction(mixedE3MoritaniReload(g), actor, action); return action; }
    catch (error) { reasons.add(error instanceof Error ? error.message : String(error)); }
  }
  throw Error(`No legal battle plan for ${actor} with ${leader} (spice ${spice}): ${[...reasons].join(' | ')}`);
}

/** First printed territory no original force occupies and whose storm-free
 * sector can legally receive a real shipment. */
function freeMixedE3MoritaniLocation(g: Game): string {
  for (const id of EXCHANGE_SITES) {
    const occupied = g.players.some(player => Object.keys(player.forces).some(key => key.startsWith(`${id}:`)));
    if (occupied) continue;
    const sector = territory(id).sectors.find(candidate => candidate !== 0 && candidate !== g.storm);
    if (sector === undefined) continue;
    return `${id}:${sector}`;
  }
  throw Error('The original programme left no free printed territory for the second real shipment.');
}

function exchangeOffer(g: Game, owner: string) {
  const offer = viewGame(g, owner).nexusTraitors?.offer;
  assert.ok(offer, 'The owner must receive the real Harkonnen Nexus offer.');
  assert.equal(offer.mode, 'secretAlly');
  assert.equal(offer.blocked, null);
  assert.equal(offer.draw, 2);
  return offer;
}

/** Original Advanced CHOAM victory, reveal, Mentat retirement and private
 * replacement. Secret Ally pauses the still-owned Moritani placement control;
 * only original undealt reserve positions and the conserved Nexus draw are directed. */
export function createMoritaniReplacementExchangeFixture(
  options: { seatIds?: readonly string[] } = {},
): MoritaniReplacementExchangeFixture {
  const f = createMoritaniAuditorWinnerFixture({
    nexusCard: 'harkonnen', initialReserveTraitors: RESERVE_PREFIX, seatIds: options.seatIds,
  });
  f.staging.push(
    `Conserved undealt original Traitor reserve ordered as ${RESERVE_PREFIX.join(', ')} `
    + 'before the real deal; the Moritani closing draw remains the undealt harkonnen Nexus singleton.',
  );
  const pending = pendingMoritaniAuditorAssassination(f);
  const reveal = revealMoritaniAuditorTarget(f, pending);
  const replaced = finishMoritaniAuditorReplacement(f, reveal.after);
  const receipt = replaced.moritaniAssassinate!.opportunities.at(-1)!;
  assert.equal(receipt.stage, 'replaced', 'The original Mentat must retire the revealed card.');
  assert.equal(receipt.card, f.target);
  assert.equal(receipt.replacement, RESERVE_PREFIX[0],
    'The original Mentat replacement must draw the reserve head, never the retired card.');
  assert.deepEqual(mixedE3MoritaniPlayer(replaced, f.moritani).traitors, [RESERVE_PREFIX[0]]);
  assert.equal(replaced.traitorReserve!.includes(f.target), false,
    'A retired victim never re-enters the physical reserve.');
  const ready = replaced;
  assert.equal(ready.decision?.kind, 'moritaniPlacement');
  assert.equal(ready.nexusTraitorPending ?? null, null);
  const view = viewGame(ready, f.moritani);
  const offer = exchangeOffer(ready, f.moritani);
  assert.deepEqual(ready.traitorReserve!.slice(0, 2), RESERVE_PREFIX.slice(1),
    'The original reserve head must hold the retained Guild Traitor and the second return.');
  const draw = nexusTraitorDrawAction(view, offer.event, 'secretAlly');
  assert.ok(draw, 'The actual owner must be able to play the real Secret Ally draw.');
  return {
    ...f, retiredVictim: f.target, historicalReplacement: RESERVE_PREFIX[0],
    guildTraitor: RESERVE_PREFIX[1], reservePrefix: RESERVE_PREFIX,
    ready: mixedE3MoritaniReload(ready), draw, drawn: ready.traitorReserve!.slice(0, 2),
    history: { event: receipt.event, card: receipt.card!, replacement: receipt.replacement!, signature: receipt.signature },
  };
}

/** Owner-only draw at the real boundary; the physical draw is untouched by any
 * shuffle, so only the two fixed reserve-head cards leave the deck. */
export function moritaniReplacementDrawStep(
  f: MoritaniReplacementExchangeFixture, state: Game = f.ready,
): MixedE3MoritaniTransition {
  const before = mixedE3MoritaniReload(state);
  const offer = exchangeOffer(before, f.moritani);
  const action = nexusTraitorDrawAction(viewGame(before, f.moritani), offer.event, 'secretAlly');
  assert.ok(action, 'The real owner-only Secret Ally draw must stay legal.');
  const step: MixedE3MoritaniStep = { actor: f.moritani, action };
  return { before, step, after: stepMixedE3Moritani(before, step, f.actions) };
}

/** Owner-only return including the historical replacement, with the original
 * return shuffle directed onto the fixture's own disclosed layout: the
 * historical card returns first, the freshly drawn Guild Traitor is kept. */
export function moritaniReplacementReturnStep(
  f: MoritaniReplacementExchangeFixture, drawn: Game, cards: readonly string[],
): { before: Game; step: MixedE3MoritaniStep; rolls: number[]; after: Game } {
  const before = mixedE3MoritaniReload(drawn);
  const view = viewGame(before, f.moritani);
  const pendingReturn = view.nexusTraitors?.pending;
  assert.ok(pendingReturn, 'The owner must hold the real pending Secret Ally return.');
  const action = nexusTraitorReturnAction(view, pendingReturn.event, cards);
  assert.ok(action, 'The exact owner-only physical return must stay legal.');
  const base = [...before.traitorReserve!, ...cards];
  const desired = [f.historicalReplacement, ...base.filter(card => card !== f.historicalReplacement)];
  const rolls = fisherRolls(base, desired);
  f.staging.push('Directed the fixture-caused original return shuffle so the returned historical replacement leads the reserve again.');
  const step: MixedE3MoritaniStep = { actor: f.moritani, action };
  const result = directedRolls(rolls, () => stepMixedE3Moritani(before, step, f.actions));
  assert.equal(result.consumed, rolls.length,
    'The original return shuffle must consume exactly the directed Fisher-Yates rolls.');
  assert.deepEqual(result.value.traitorReserve, desired,
    'The real return shuffle must land on the directed physical reserve.');
  return { before, step, rolls, after: result.value };
}

/** The exact owner-only return action for API/UI smoke, keeping the freshly
 * drawn Guild Traitor and giving the historical replacement back. The caller
 * applies it with its own live randomness. */
export function moritaniReplacementReturnAction(
  f: MoritaniReplacementExchangeFixture, drawn: Game,
): Action {
  const view = viewGame(mixedE3MoritaniReload(drawn), f.moritani);
  const pendingReturn = view.nexusTraitors?.pending;
  assert.ok(pendingReturn, 'The owner must hold the real pending Secret Ally return.');
  const cards = pendingReturn.choices.map(choice => choice.id).filter(id => id !== f.guildTraitor);
  assert.equal(cards.length, 2);
  assert.ok(cards.includes(f.historicalReplacement),
    'The owner must be able to return the historical replacement.');
  const action = nexusTraitorReturnAction(view, pendingReturn.event, cards);
  assert.ok(action, 'The exact owner-only physical return must stay legal.');
  return action;
}

/** Completes the real Secret Ally draw and return, keeping the freshly drawn
 * Guild Traitor and giving the historical replacement back to the deck. */
export function finishMoritaniReplacementExchange(
  f: MoritaniReplacementExchangeFixture, state: Game = f.ready,
): {
  drawn: Game; exchanged: Game; returnCards: string[];
  exchange: { before: Game; step: MixedE3MoritaniStep; after: Game };
} {
  const draw = moritaniReplacementDrawStep(f, state);
  assert.deepEqual(draw.after.traitorReserve, draw.before.traitorReserve!.slice(2),
    'The draw removes exactly its two physical reserve-head cards.');
  const action = moritaniReplacementReturnAction(f, draw.after);
  const returnCards = action.cards as string[];
  const back = moritaniReplacementReturnStep(f, draw.after, returnCards);
  return { drawn: draw.after, exchanged: back.after, returnCards,
    exchange: { before: back.before, step: back.step, after: back.after } };
}

export type MoritaniReplacementRedrawProgramme = {
  fixture: MoritaniReplacementExchangeFixture;
  exchanged: Game;
  /** Which of the two real shipments arrived first in the live original order. */
  arrivalOrder: 'moritani' | 'guild';
  location: string;
  arrival: MixedE3MoritaniTransition;
  assault: MixedE3MoritaniTransition;
  plans: MixedE3MoritaniStep[];
  revealed: Game;
  /** The real second native-equivalent assassination boundary. */
  pending: Game;
  reveal: MixedE3MoritaniTransition;
  /** After the second original Mentat drew the same physical card again. */
  redrawn: Game;
};

/** Stops as soon as one original Mentat replacement is on record, never at an
 * intermediate owner window. */
function finishReceiptReplacement(f: MoritaniAuditorWinnerFixture, state: Game, event: string): Game {
  let g = mixedE3MoritaniReload(state);
  for (let n = 0; n < 600; n++) {
    const receipt = g.moritaniAssassinate?.opportunities.find(r => r.event === event);
    if (receipt?.stage === 'replaced') return g;
    const next = nextMoritaniAuditorWinnerStep(g);
    assert.ok(next, `Choose the original replacement aftermath ${g.decision?.kind ?? g.phase}.`);
    g = stepMixedE3Moritani(g, next, f.actions);
  }
  throw Error('The original battle did not reach its Mentat replacement.');
}

/** Same source-clear original programme continued through the real turn-three
 * storm, conserved unplayed Spice, two real paid shipments and a second
 * original battle loss, so the next Mentat can draw the physical card the
 * earlier Nexus return gave back. */
export function createMoritaniReplacementRedrawProgramme(
  options: { seatIds?: readonly string[] } = {},
): MoritaniReplacementRedrawProgramme {
  const fixture = createMoritaniReplacementExchangeFixture(options);
  const exchanged = finishMoritaniReplacementExchange(fixture).exchanged;
  const guildSeat = fixture.seats.guild;
  assert.ok(guildSeat, 'The original classic roster must seat the Guild.');
  // The turn-three deal is drawn from the unplayed Spice deck; fronting two
  // real land cards is the same disclosed conserved ordering used at turn one.
  orderMixedE3MoritaniSpice(exchanged);
  let g = advanceMixedE3Moritani(exchanged,
    s => s.turn === 3 && s.phase === 1 && mixedE3MoritaniClean(s), fixture.actions);
  g = advanceMixedE3Moritani(g,
    s => s.phase === 5 && (s.active === fixture.moritani || s.active === guildSeat) && mixedE3MoritaniClean(s),
    fixture.actions);
  const location = freeMixedE3MoritaniLocation(g);
  const mover = g.active;
  assert.ok(mover === fixture.moritani || mover === guildSeat,
    'The live original movement order must open with one of the two combatants.');
  const first: string = mover === guildSeat ? guildSeat : fixture.moritani;
  const arrival = shipMixedE3Moritani(g, first, location, 1, 0, fixture.actions);
  const other = mover === guildSeat ? fixture.moritani : guildSeat;
  const assault = shipMixedE3Moritani(arrival.settled, other, location, 1, 0, fixture.actions);
  fixture.staging.push(`Real paid turn-three shipments into the free printed location ${location}: `
    + `${first} first, then ${other}; no force count, card or wallet was staged.`);
  const choices = (state: Game) => {
    const quote = viewGame(state, state.host).battleChoices;
    assert.equal(quote.length, 1, 'The two real shipments must create exactly one original battle pair.');
    assert.deepEqual([quote[0].attacker, quote[0].defender].sort(),
      [fixture.moritani, guildSeat].sort());
    return quote[0];
  };
  const armed = advanceMixedE3Moritani(assault.settled, s => s.phase === 6 && mixedE3MoritaniClean(s), fixture.actions);
  const choice = choices(armed);
  const fought = stepMixedE3Moritani(armed, { actor: choice.chooser, action: {
    type: 'chooseBattle', territory: choice.territory,
    target: choice.attacker === choice.chooser ? choice.defender : choice.attacker } }, fixture.actions);
  const entered = advanceMixedE3Moritani(fought, s => !!s.battle && mixedE3MoritaniClean(s) &&
    !s.battle.preparation && s.battle.preLeader?.closed !== false, fixture.actions);
  const own = mixedE3MoritaniPlayer(entered, fixture.moritani).leaders
    .filter(leader => !leader.dead)
    .sort((one, two) => one.strength - two.strength)[0];
  const opposing = mixedE3MoritaniPlayer(entered, guildSeat).leaders
    .filter(leader => !leader.dead && leader.id !== fixture.guildTraitor)
    .sort((one, two) => two.strength - one.strength)[0];
  assert.ok(own && opposing, 'The original deal must still supply the second real battle discs.');
  const plans: MixedE3MoritaniStep[] = [
    { actor: fixture.moritani, action: legalPlan(entered, fixture.moritani, own.id, 'min') },
    { actor: guildSeat, action: legalPlan(entered, guildSeat, opposing.id, 'max') },
  ];
  const revealed = revealMixedE3MoritaniPlans(entered, plans, fixture.actions);
  assert.equal(quoteMixedE3MoritaniBattle(revealed).winner, guildSeat,
    'The real Guild disc must survive the genuine second loss.');
  const boundary = settleMixedE3MoritaniBoundary(revealed, null, fixture.actions);
  assert.equal(boundary.kind, 'assassination');
  const decision = boundary.game.decision;
  assert.ok(decision?.kind === 'moritaniAssassinate' && decision.player === fixture.moritani);
  const ownChoices = viewGame(boundary.game, fixture.moritani).moritaniAssassinate!.pending!;
  assert.deepEqual(ownChoices.cards.map(entry => entry.card), [fixture.guildTraitor]);
  const step: MixedE3MoritaniStep = { actor: fixture.moritani,
    action: { type: 'decision', event: decision.event, card: fixture.guildTraitor } };
  const reveal: MixedE3MoritaniTransition = { before: mixedE3MoritaniReload(boundary.game), step,
    after: stepMixedE3Moritani(boundary.game, step, fixture.actions) };
  const redrawn = finishReceiptReplacement(fixture, reveal.after,
    reveal.after.moritaniAssassinate!.opportunities.at(-1)!.event);
  return { fixture, exchanged, arrivalOrder: first === fixture.moritani ? 'moritani' : 'guild',
    location, arrival, assault, plans, revealed, pending: boundary.game, reveal, redrawn };
}
