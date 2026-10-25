import assert from 'node:assert/strict';
import {
  createGame, initializeSemutaGameForAudit, joinGame, newPlayer, viewGame, type Action, type Game,
} from '../game/engine';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { actTruthMovement } from './fixture-truth-movement';
import { nextSemutaRicheseCacheKarama } from './fixture-semuta-richese-cache-karama';
import { truthFaceDancerTraitors } from './fixture-truthtrance-face-dancer';
import { withClassicDiscoveryNexusLottery } from './fixture-discovery-classic-nexus';

export type SemutaStormDancerStep = { actor: string; action: Action };
export type SemutaStormDancerKind = 'stormPeek' | 'faceDancerReplacement';
export const actSemutaStormDancer = actTruthMovement;
export const semutaStormDancerPlayer = (game: Game, id: string) => {
  const player = game.players.find(p => p.id === id); assert.ok(player); return player;
};
export const semutaStormDancerClean = (game: Game) => !game.phaseOpening && !game.response &&
  !game.decision && !game.truthtrance && !game.pendingTreacheryDiscard;
export function semutaStormDancerInventory(game: Game) {
  const ids = [...game.deck, ...game.discard, ...(game.richeseCache ?? []), ...(game.richeseRemoved ?? []),
    ...game.players.flatMap(p => p.hand),
    ...(game.auction?.cards.slice(game.auction.index + Number(game.currentAuctionSale?.origin === 'normal')) ?? [])]
    .map(card => card.id).sort();
  assert.equal(new Set(ids).size, ids.length); return ids;
}
export const semutaStormDancerTraitors = truthFaceDancerTraitors;
/** Real setup/readiness controls. A fresh reaction stays caller-owned; no
 * optional replacement or cancellation is silently chosen. */
export function nextSemutaStormDancerStep(game: Game): SemutaStormDancerStep | null {
  if (game.pendingTreacheryDiscard || game.truthtrance) return null;
  if (game.status === 'setup' && game.setupStage === 'forces') {
    const fremen = game.players.find(p => p.faction === 'fremen');
    if (fremen?.reserves === 20 && viewGame(game, fremen.id).setupPending.includes(fremen.id))
      return { actor: fremen.id, action: { type: 'fremenSetup', placements: { 'sietch_tabr:14': 10 } } };
  }
  return nextSemutaRicheseCacheKarama(game);
}
export function advanceSemutaStormDancer(game: Game, until: (state: Game) => boolean,
  actions: SemutaStormDancerStep[] = []): Game {
  for (let count = 0; count < 2000; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    const next = nextSemutaStormDancerStep(game);
    assert.ok(next, 'Choose the original terminal-cost fresh reaction before continuing');
    game = actSemutaStormDancer(game, next.actor, next.action, actions);
  }
  throw Error('The native Storm/Dancer programme did not reach its finite boundary');
}
export function passSemutaStormDancer(game: Game, actions: SemutaStormDancerStep[] = []): Game {
  const event = game.pendingTreacheryDiscard?.batch.event; assert.ok(event);
  for (let count = 0; game.pendingTreacheryDiscard?.batch.event === event && count < game.players.length; count++) {
    const pending: NonNullable<Game['pendingTreacheryDiscard']> = game.pendingTreacheryDiscard!;
    const reaction = pending.reaction; assert.ok(reaction?.stage === 'offer');
    const actor = game.players.find(p => !reaction.passed.includes(p.id)); assert.ok(actor);
    game = actSemutaStormDancer(game, actor.id, { type: 'semutaPass', event }, actions);
  }
  assert.notEqual(game.pendingTreacheryDiscard?.batch.event, event); return game;
}
export function claimSemutaStormDancer(game: Game, holder: string,
  actions: SemutaStormDancerStep[] = []): Game {
  const pending = game.pendingTreacheryDiscard; assert.ok(pending && pending.batch.entries.length === 1);
  const event = pending.batch.event, card = pending.batch.entries[0].card.id;
  game = actSemutaStormDancer(game, holder, { type: 'semutaCommit', event }, actions);
  if (game.pendingTreacheryDiscard?.reaction?.stage === 'select')
    game = actSemutaStormDancer(game, holder, { type: 'semutaSelect', event, card }, actions);
  return game;
}
/** Original dispatcher priority: finish a coexisting opening through real
 * ready actions before allowing this native response. Never initialize twice. */
export function allowSemutaStormDancer(game: Game, actions: SemutaStormDancerStep[] = []): Game {
  const kind = game.response?.kind; assert.ok(kind === 'stormPeek' || kind === 'faceDancerReplacement');
  while (game.phaseOpening) {
    const actor = game.players.find(p => !game.phaseOpening!.passed.includes(p.id)); assert.ok(actor);
    game = actSemutaStormDancer(game, actor.id, { type: 'ready' }, actions);
  }
  for (let count = 0; game.response?.kind === kind && count < game.players.length; count++) {
    const actor = game.players.find(p => !game.response!.passed.includes(p.id)); assert.ok(actor);
    game = actSemutaStormDancer(game, actor.id, { type: 'passResponse' }, actions);
  }
  assert.notEqual(game.response?.kind, kind); return game;
}

/** Actual paid first cache, original E Karama and native terminal opportunity.
 * Only unopened deal/Spice positions and original scalar lotteries are chosen.
 * No played custody, wallet, army, phase, pending frame or traitor pool is set. */
export function createSemutaStormDancerFixture(options: { kind?: SemutaStormDancerKind; advanced?: boolean } = {}) {
  const kind = options.kind ?? 'faceDancerReplacement', advanced = options.advanced ?? kind === 'stormPeek';
  assert.ok(kind !== 'stormPeek' || advanced, 'Native next-Storm knowledge is Advanced only');
  const seller = 'richese', holder = 'choam', dancer = 'tleilaxu', fremen = 'fremen', spender = 'emperor';
  const owner = kind === 'stormPeek' ? fremen : dancer;
  let game = createGame('SEMUTASTORMDANCER', newPlayer(seller, 'Richese', 'richese'), advanced, ['choam', 'ix']);
  for (const faction of ['choam', 'tleilaxu', 'fremen', 'emperor'] as const) joinGame(game, newPlayer(faction, faction, faction));
  const actions: SemutaStormDancerStep[] = [];
  const act = (actor: string, action: Action) => { game = actSemutaStormDancer(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceSemutaStormDancer(game, until, actions); };
  const transition = (run: () => void) => {
    const before = structuredClone(game), start = actions.length; run();
    return { before, steps: structuredClone(actions.slice(start)), after: structuredClone(game) };
  };
  for (const p of game.players) act(p.id, { type: 'ready' });
  const lobby = structuredClone(game);
  if (advanced) game = withClassicDiscoveryNexusLottery(() => initializeSemutaGameForAudit(game));
  else act(game.host, { type: 'start' });
  const setup = structuredClone(game), initialization = { before: lobby, after: setup,
    entry: advanced ? 'explicit-original-semuta-initializer' : 'public-basic-start' };
  assert.equal(game.status, 'setup'); assert.equal(game.advanced, advanced); assert.equal(game.semutaPreview, true);
  assert.ok(game.players.every(p => !p.hand.length));
  const originalInventory = semutaStormDancerInventory(game); assert.equal(originalInventory.length, 57);
  const originalTraitors = semutaStormDancerTraitors(game);
  const printed = game.deck.find(card => card.effect === 'karama' && !card.id.startsWith('ix-'));
  const ordinary = game.deck.filter(card => ['projectile', 'poison', 'shield', 'snooper'].includes(card.kind) && !card.effect).slice(0, 4);
  assert.ok(printed); assert.equal(ordinary.length, 4);
  const deal = [...ordinary.map(card => card.id), printed.id], cost = printed.id;
  const dealOrder = deal.map((card, position) => {
    const from = game.deck.findIndex(candidate => candidate.id === card); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { card, position, from };
  });
  const beforeStartingDeal = structuredClone(game);
  let faceDancerDeal: { before: Game; steps: SemutaStormDancerStep[]; after: Game } | null = null;
  for (let count = 0; game.status === 'setup' && count < 150; count++) {
    const next = nextSemutaStormDancerStep(game); assert.ok(next);
    const before = structuredClone(game), hadDancers = !!semutaStormDancerPlayer(game, dancer).faceDancers;
    act(next.actor, next.action);
    if (!hadDancers && semutaStormDancerPlayer(game, dancer).faceDancers)
      faceDancerDeal = { before, steps: [structuredClone(next)], after: structuredClone(game) };
  }
  assert.equal(game.status, 'playing'); assert.ok(faceDancerDeal);
  const afterSetup = structuredClone(game), originalFaceDancers = structuredClone(semutaStormDancerPlayer(game, dancer).faceDancers!);
  assert.deepEqual(game.players.flatMap(p => p.hand.map(card => card.id)), deal);
  assert.equal(originalFaceDancers.length, 3); assert.ok(originalFaceDancers.every(card => !card.revealed));
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const spiceOrder: { position: number; from: number; card: Game['spiceDeck'][number] }[] = [];
  for (let position = 0; position < (advanced ? 4 : 2); position++) {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card && !card.discovery &&
      ['hagga_basin', 'rock_outcroppings', 'broken_land', 'oh_gap'].includes(card.territory));
    assert.ok(from >= position); const card = game.spiceDeck.splice(from, 1)[0]; game.spiceDeck.splice(position, 0, card);
    spiceOrder.push({ position, from, card: structuredClone(card) });
  }
  assert.deepEqual(game.spiceDeck.map(card => JSON.stringify(card)).sort(), originalSpice);
  let beforeBid: Game | undefined, bid: SemutaStormDancerStep | undefined, bidAt = -1;
  for (let count = 0; count < 900 && !semutaStormDancerPlayer(game, holder).hand.some(card => card.id === SEMUTA_DRUG_ID); count++) {
    const next = nextSemutaStormDancerStep(game); assert.ok(next);
    if (next.actor === holder && next.action.type === 'richeseBid' && next.action.amount === 1) {
      beforeBid = structuredClone(game); bid = structuredClone(next); bidAt = actions.length;
    }
    act(next.actor, next.action);
  }
  assert.ok(beforeBid && bid && bidAt >= 0);
  const acquired = structuredClone(game), acquisition = { before: beforeBid, bid,
    steps: structuredClone(actions.slice(bidAt)), after: acquired, price: 1 };
  assert.ok(semutaStormDancerPlayer(game, holder).hand.some(card => card.id === SEMUTA_DRUG_ID));
  assert.equal(semutaStormDancerPlayer(beforeBid, holder).spice - semutaStormDancerPlayer(game, holder).spice, 1);
  assert.equal(semutaStormDancerPlayer(game, seller).spice - semutaStormDancerPlayer(beforeBid, seller).spice, 1);
  let trigger: { before: Game; steps: SemutaStormDancerStep[]; after: Game };
  let opening: { before: Game; steps: SemutaStormDancerStep[]; after: Game } | null = null;
  let replacementAction: Action | null = null, candidate: string | null = null;
  if (kind === 'faceDancerReplacement') {
    reach(state => state.turn === 1 && state.phase === 8 && semutaStormDancerClean(state));
    candidate = semutaStormDancerPlayer(game, dancer).faceDancers!.find(card => !card.revealed)!.leader;
    replacementAction = { type: 'replaceFaceDancer', leader: candidate };
    trigger = transition(() => { act(dancer, replacementAction!); });
    assert.equal(semutaStormDancerPlayer(game, dancer).faceDancerReplacedTurn, game.turn);
    assert.equal(game.response?.intent, candidate);
  } else {
    reach(state => state.turn === 2 && state.phase === 0 && semutaStormDancerClean(state));
    trigger = transition(() => { reach(state => state.turn === 2 && state.response?.kind === 'stormPeek'); });
    assert.equal(game.phase, 1); assert.deepEqual(game.phaseOpening, { passed: [], initialize: false });
    const forecast = game.stormCard;
    opening = transition(() => {
      while (game.phaseOpening) {
        const actor = game.players.find(p => !game.phaseOpening!.passed.includes(p.id)); assert.ok(actor);
        act(actor.id, { type: 'ready' });
      }
    });
    assert.equal(game.stormCard, forecast); assert.equal(game.stormCardKnown, false);
    assert.equal(game.response?.kind, 'stormPeek');
  }
  assert.equal(game.response?.kind, kind); assert.equal(game.response?.owner, owner);
  assert.ok(!game.phaseOpening && !game.decision && !game.pendingTreacheryDiscard && !game.pendingAmbassador && !game.battle);
  assert.ok(semutaStormDancerPlayer(game, spender).hand.some(card => card.id === cost));
  assert.deepEqual(semutaStormDancerPlayer(game, dancer).faceDancers, originalFaceDancers);
  assert.deepEqual(semutaStormDancerTraitors(game), originalTraitors);
  assert.deepEqual(semutaStormDancerInventory(game), originalInventory);
  const source = structuredClone(game), action: Action = { type: 'card', card: cost, mode: 'cancel' };
  return { game, source, beforeCost: source, kind, advanced, holder, spender, owner, seller, dancer, fremen,
    cost, karama: cost, card: cost, semuta: SEMUTA_DRUG_ID, action, candidate, replacementAction,
    lobby, setup, initialization, beforeStartingDeal, afterSetup, deal, dealOrder, faceDancerDeal, originalFaceDancers,
    originalSpice, spiceOrder, acquired, acquisition, trigger, opening, beforeOpening: opening?.before ?? null,
    coexistentOpening: opening?.before.phaseOpening ?? null, stormCard: game.stormCard,
    originalInventory, originalCards: originalInventory, originalTraitors,
    actions, steps: actions, sourceActionCount: actions.length,
    staging: [
      'Native Richese/CHOAM/Tleilaxu/Fremen/Emperor uses the public bare Basic start or original explicit Advanced Semuta initializer, main47/cache10. Only unopened original deal/Spice positions and scalar lotteries are selected; Emperor actually receives its printed Karama and Tleilaxu its three original unrevealed Face Dancers.',
      'Fremen actually places ten starting normals in Sietch Tabr14. CHOAM buys the real Semuta through an original cache1 bid and payment before this later opportunity. No dealt hand, force, wallet, phase, traitor pool or paused source is assigned.',
      kind === 'faceDancerReplacement' ? 'At actual first Mentat, Tleilaxu really declares replacement of one originally dealt unrevealed candidate. The attempt is used before its native response; no reserve card has been shuffled/drawn and no Face Dancer replaced yet.' : 'Actually finish first Mentat and the original second Storm, including original CHOAM storm market closure. Capture native stormPeek plus initialize:false opening coexistence, then submit all real ready acknowledgements. Stop at the same valid original forecast counter after its opening has finished; no dispatcher priority, card, opening or pending response is installed.',
      'Stop before Emperor spends the original cancellation cost. Caller owns the exact fresh-cost Semuta claim/pass and original prevention; no new knowledge, replacement, draw or once-use reset is assumed.',
    ] };
}
export type SemutaStormDancerFixture = ReturnType<typeof createSemutaStormDancerFixture>;
