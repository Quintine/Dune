import assert from 'node:assert/strict';
import { createGame, joinGame, newPlayer, type Action, type Game } from '../game/engine';
import { quotePlacementCancellation } from '../game/placement-cancellation';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import {
  actSemutaRicheseCacheKarama, nextSemutaRicheseCacheKarama,
  semutaRicheseCacheKaramaClean, semutaRicheseCacheKaramaInventory, semutaRicheseCacheKaramaPlayer,
} from './fixture-semuta-richese-cache-karama';
import { passSemutaFremenGuildMovement, claimSemutaFremenGuildMovement } from './fixture-semuta-fremen-guild-movement';

export type SemutaE3PlacementKind = 'ecazPlacement' | 'moritaniPlacement' | 'moritaniDuke';
export type SemutaE3PlacementStep = { actor: string; action: Action };
export const actSemutaE3Placement = actSemutaRicheseCacheKarama;
export const passSemutaE3Placement = passSemutaFremenGuildMovement;
export const claimSemutaE3Placement = claimSemutaFremenGuildMovement;
export const semutaE3PlacementPlayer = semutaRicheseCacheKaramaPlayer;
export const semutaE3PlacementInventory = semutaRicheseCacheKaramaInventory;
export const semutaE3PlacementClean = semutaRicheseCacheKaramaClean;

/** Fresh declarations stay explicit. Mori's Duke source really starts in an
 * empty Arrakeen; its other source uses the native ordinary Oh Gap placement. */
export function nextSemutaE3Placement(game: Game,
  kind: SemutaE3PlacementKind = 'ecazPlacement'): SemutaE3PlacementStep | null {
  if (game.pendingTreacheryDiscard || game.truthtrance ||
    ['ecazPlacement', 'moritaniPlacement', 'moritaniDuke'].includes(game.response?.kind ?? '')) return null;
  if (!game.response && !game.phaseOpening && game.status === 'setup' && !game.setupStage &&
    game.decision?.kind === 'moritaniSetup')
    return { actor: game.decision.player, action: { type: 'decision',
      territory: kind === 'moritaniDuke' ? 'arrakeen' : 'oh_gap', sector: kind === 'moritaniDuke' ? 10 : 9 } };
  if (!game.response && !game.phaseOpening && game.decision?.kind === 'moritaniPlacement') return null;
  const step = nextSemutaRicheseCacheKarama(game);
  if (step?.action.type === 'stormDial' && game.turn === 1)
    return { actor: step.actor, action: { ...step.action, amount: 0 } };
  return step;
}
export function advanceSemutaE3Placement(game: Game, until: (state: Game) => boolean,
  actions: SemutaE3PlacementStep[] = [], kind: SemutaE3PlacementKind = 'ecazPlacement'): Game {
  for (let count = 0; count < 2000; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    const step = nextSemutaE3Placement(game, kind); assert.ok(step, 'Choose the actual E3 declaration or fresh-cost reaction');
    game = actSemutaE3Placement(game, step.actor, step.action, actions);
  }
  throw Error('The genuine E3 placement source did not reach its finite boundary');
}
export function allowSemutaE3Placement(game: Game, actions: SemutaE3PlacementStep[] = []): Game {
  const kind = game.response?.kind;
  assert.ok(kind === 'ecazPlacement' || kind === 'moritaniPlacement' || kind === 'moritaniDuke');
  for (let count = 0; game.response?.kind === kind && count < game.players.length; count++) {
    const actor = game.players.find(player => !game.response!.passed.includes(player.id)); assert.ok(actor);
    game = actSemutaE3Placement(game, actor.id, { type: 'passResponse' }, actions);
  }
  assert.notEqual(game.response?.kind, kind); return game;
}
/** Close only the still-owned positive Ecaz chooser or the Duke suffix's real
 * CHOAM phase-closing market. No new movement or battle choice is made. */
export function finishSemutaE3Placement(game: Game, kind: SemutaE3PlacementKind,
  actions: SemutaE3PlacementStep[] = []): Game {
  assert.equal(game.pendingTreacheryDiscard ?? null, null);
  assert.notEqual(game.response?.kind, kind);
  if (kind === 'ecazPlacement' && game.decision?.kind === 'ecazPlacement')
    game = actSemutaE3Placement(game, game.decision.player, { type: 'decision', decline: true }, actions);
  if (kind === 'moritaniDuke' && game.phase === 5) {
    assert.equal(game.response ?? null, null);
    assert.equal(game.decision?.kind, 'choamMarket');
    assert.equal(game.choamMarket?.resume, 'phase');
    assert.equal(game.choamMarket?.owner, game.decision!.player);
    game = actSemutaE3Placement(game, game.decision!.player, { type: 'decision', done: true }, actions);
  }
  assert.equal(game.phase, kind === 'ecazPlacement' ? 5 : kind === 'moritaniPlacement' ? 8 : 6);
  assert.equal(game.turn, 1);
  return game;
}

/** Bare public Basic E3 source. All setup, cache purchase, placement, shipment,
 * ready/end controls are actual native actions, without played-state staging. */
export function createSemutaE3PlacementFixture(options: { kind: SemutaE3PlacementKind; second?: boolean }) {
  const kind = options.kind, second = options.second ?? false;
  assert.ok(!second || kind === 'ecazPlacement');
  const richese = 'richese', holder = 'choam', owner = kind === 'ecazPlacement' ? 'ecaz' : 'moritani', spender = 'emperor';
  let game = createGame('SEMUTAE3PLACEMENT', newPlayer(richese, 'Richese', 'richese'), false, ['choam', 'ecaz']);
  for (const faction of [holder, owner, spender] as const) joinGame(game, newPlayer(faction, faction, faction));
  const initial = structuredClone(game), actions: SemutaE3PlacementStep[] = [];
  const act = (actor: string, action: Action) => { game = actSemutaE3Placement(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceSemutaE3Placement(game, until, actions, kind); };
  const transition = (run: () => void) => {
    const before = structuredClone(game), start = actions.length; run();
    return { before, steps: structuredClone(actions.slice(start)), after: structuredClone(game) };
  };
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game);
  act(game.host, { type: 'start' });
  const setup = structuredClone(game), initialization = { before: lobby, after: setup, entry: 'public-bare-basic-native-start' };
  assert.equal(game.status, 'setup'); assert.equal(game.advanced, false); assert.equal(game.semutaPreview, true);
  assert.ok(game.players.every(player => player.hand.length === 0));
  assert.ok(!game.homeworlds && !game.nexusCards && !game.leaderSkills && !game.techTokens &&
    !game.strongholdCards && !game.discoveryEnabled && !game.ecazTreachery);
  const originalInventory = semutaE3PlacementInventory(game); assert.equal(originalInventory.length, 45);
  assert.equal(game.deck.length, 35); assert.equal(game.richeseCache!.length, 10);
  const printed = game.deck.find(card => card.effect === 'karama'); assert.ok(printed);
  const ordinary = game.deck.filter(card => card.kind === 'projectile' && !card.effect).slice(0, 3);
  assert.equal(ordinary.length, 3);
  const deal = [...ordinary.map(card => card.id), printed.id], cost = printed.id;
  const dealOrder = deal.map((card, position) => {
    const from = game.deck.findIndex(candidate => candidate.id === card); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { card, from, position };
  });
  const beforeStartingDeal = structuredClone(game);
  reach(state => state.status === 'playing'); const afterSetup = structuredClone(game);
  assert.deepEqual(game.players.flatMap(player => player.hand.map(card => card.id)), deal);
  assert.ok(semutaE3PlacementPlayer(game, spender).hand.some(card => card.id === cost));
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const from = game.spiceDeck.findIndex(card => 'territory' in card && !card.discovery &&
    ['hagga_basin', 'rock_outcroppings', 'broken_land'].includes(card.territory)); assert.ok(from >= 0);
  const firstSpice = game.spiceDeck.splice(from, 1)[0]; game.spiceDeck.unshift(firstSpice);
  const spiceOrder = [{ position: 0, from, card: structuredClone(firstSpice) }];
  assert.deepEqual(game.spiceDeck.map(card => JSON.stringify(card)).sort(), originalSpice);
  let beforeBid: Game | undefined, bid: SemutaE3PlacementStep | undefined, bidAt = -1;
  for (let count = 0; count < 900 && !semutaE3PlacementPlayer(game, holder).hand.some(card => card.id === SEMUTA_DRUG_ID); count++) {
    const step = nextSemutaE3Placement(game, kind); assert.ok(step);
    if (step.actor === holder && step.action.type === 'richeseBid' && step.action.amount === 1) {
      beforeBid = structuredClone(game); bid = structuredClone(step); bidAt = actions.length;
    }
    act(step.actor, step.action);
  }
  assert.ok(beforeBid && bid && bidAt >= 0);
  const acquired = structuredClone(game), acquisition = { before: beforeBid, bid,
    steps: structuredClone(actions.slice(bidAt)), after: acquired, price: 1 };
  assert.equal(semutaE3PlacementPlayer(beforeBid, holder).spice - semutaE3PlacementPlayer(game, holder).spice, 1);
  assert.equal(semutaE3PlacementPlayer(game, richese).spice - semutaE3PlacementPlayer(beforeBid, richese).spice, 1);
  let firstPlacement: ReturnType<typeof transition> | null = null;
  const shipments: ReturnType<typeof transition>[] = [];
  let nativeAction: Action, declaration: ReturnType<typeof transition>, token: string | null = null;
  let territory: string | null = null;
  if (kind === 'ecazPlacement') {
    reach(state => state.phase === 4 && !state.response && !state.phaseOpening && state.decision?.kind === 'ecazPlacement');
    if (second) {
      const first = game.ecazAmbassadors!.tokens.find(token => token.effect === 'ecaz' && token.zone === 'supply'); assert.ok(first);
      firstPlacement = transition(() => {
        act(owner, { type: 'decision', token: first.id, territory: 'sietch_tabr' });
        assert.equal(game.pendingEcazPlacement?.cost, 1);
        game = allowSemutaE3Placement(game, actions);
      });
      assert.equal(semutaE3PlacementPlayer(firstPlacement.before, owner).spice - semutaE3PlacementPlayer(game, owner).spice, 1);
      assert.equal(game.ecazAmbassadors!.tokens.find(candidate => candidate.id === first.id)?.location, 'sietch_tabr');
      assert.equal(game.decision?.kind, 'ecazPlacement');
    }
    const selected = game.ecazAmbassadors!.tokens.find(token => token.zone === 'supply' &&
      (second ? token.effect !== 'ecaz' : token.effect === 'ecaz')); assert.ok(selected);
    token = selected.id; territory = second ? 'habbanya_ridge_sietch' : 'sietch_tabr';
    nativeAction = { type: 'decision', token, territory };
    declaration = transition(() => { act(owner, nativeAction); });
    assert.equal(game.pendingEcazPlacement?.cost, second ? 2 : 1);
  } else if (kind === 'moritaniPlacement') {
    reach(state => state.phase === 8 && !state.response && !state.phaseOpening && state.decision?.kind === 'moritaniPlacement');
    const selected = game.moritaniTerror!.tokens.find(token => token.kind === 'sabotage' && token.status === 'available'); assert.ok(selected);
    token = selected.id; territory = 'carthag';
    nativeAction = { type: 'decision', token, territory };
    declaration = transition(() => { act(owner, nativeAction); });
  } else {
    assert.equal(semutaE3PlacementPlayer(game, owner).forces['arrakeen:10'], 6);
    for (const [actor, destination, sector] of [[richese, 'carthag', 11], [owner, 'carthag', 11], [spender, 'arrakeen', 10]] as const) {
      reach(state => state.phase === 5 && state.active === actor && semutaE3PlacementClean(state));
      shipments.push(transition(() => {
        act(actor, { type: 'ship', territory: destination, sector, amount: 1, elite: 0, allyPayment: 0 });
        reach(semutaE3PlacementClean);
      }));
      if (actor !== spender) act(actor, { type: 'endMovement' });
    }
    nativeAction = { type: 'endMovement' };
    declaration = transition(() => { act(spender, nativeAction); });
    assert.deepEqual(game.movementRemaining, []); assert.equal(game.dukeAcquisitionTurn, game.turn);
  }
  assert.equal(game.response?.kind, kind); assert.equal(game.response?.owner, owner);
  assert.equal(game.phaseOpening ?? null, null); assert.equal(game.decision ?? null, null);
  assert.equal(game.pendingTreacheryDiscard ?? null, null);
  const source = structuredClone(game), originalResponse = structuredClone(game.response!);
  const originalPending = structuredClone(kind === 'ecazPlacement' ? game.pendingEcazPlacement : game.pendingMoritaniPlacement ?? null);
  const originalAmbassadors = structuredClone(game.ecazAmbassadors ?? null), originalTerror = structuredClone(game.moritaniTerror ?? null);
  const originalDuke = structuredClone(game.dukeVidal ?? null), expected = quotePlacementCancellation(game, game.response!);
  assert.ok(expected);
  assert.ok(semutaE3PlacementPlayer(game, holder).hand.some(card => card.id === SEMUTA_DRUG_ID));
  assert.ok(semutaE3PlacementPlayer(game, spender).hand.some(card => card.id === cost));
  assert.deepEqual(semutaE3PlacementInventory(game), originalInventory);
  const action: Action = { type: 'card', card: cost, mode: 'cancel' };
  return { game, source, beforeCost: source, kind, second, advanced: false, richese, holder, spender, owner,
    cost, semuta: SEMUTA_DRUG_ID, action, nativeAction, token, territory,
    originalResponse, originalPending, originalAmbassadors, originalTerror, originalDuke, expected,
    initial, lobby, setup, initialization, beforeStartingDeal, afterSetup, deal, dealOrder,
    originalSpice, spiceOrder, acquired, acquisition, firstPlacement, shipments, declaration,
    originalInventory, actions, sourceActions: actions, sourceActionCount: actions.length,
    staging: [
      'Public bare Basic R/C/Ecaz/E or R/C/Moritani/E ready/start uses its existing Semuta E3 gate. Original main35/cache10 remain physical; only unopened starting/Spice positions and scalar lotteries are selected. Emperor really receives printed Karama and CHOAM buys cache Semuta for1. Advanced E3 admission is unchanged.',
      kind === 'ecazPlacement' ? second
        ? 'At native end-Revival Ecaz really declares/permits reusable Ecaz at Tabr14 and pays1. It then declares a real remaining supply token at Habbanya17 for next native price2. Stop before pending second cost/payment/placement; the first physical placement stays committed.'
        : 'At native end-Revival Ecaz declares its actual reusable supply token at Tabr14 for1. Stop before pending payment/physical placement.' :
        kind === 'moritaniPlacement' ? 'Moritani really chooses Oh Gap9 for its six setup counters. Actual first-turn phases finish without a battle. At native Mentat it declares its actual available Sabotage token at Carthag; no Terror token has moved.' :
          'Moritani really chooses empty Arrakeen10 for its six setup counters. During original combined turns Richese ships1 to Carthag, Moritani ships1 there, then Emperor ships1 to Arrakeen. Actual final endMovement earns the native Duke opportunity from two unresolved stronghold battles; no board, Duke or qualification is installed.',
      'Stop before separate printed cancellation cost. Native pure placement quote supplies denial receipts; original continuation closes Revival, finishes Mentat placement, or opens the real CHOAM closing market at completed Movement. Its actual Done action then advances to Battle once. No prior payment is refunded and no pending placement fee is charged on denial.',
    ] };
}
export type SemutaE3PlacementFixture = ReturnType<typeof createSemutaE3PlacementFixture>;
