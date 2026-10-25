import assert from 'node:assert/strict';
import {
  createGame, initializeSemutaGameForAudit, joinGame, newPlayer, type Action, type Game,
} from '../game/engine';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { actTruthMovement } from './fixture-truth-movement';
import { nextSemutaRicheseCacheKarama } from './fixture-semuta-richese-cache-karama';
import { withClassicDiscoveryNexusLottery } from './fixture-discovery-classic-nexus';

export type SemutaRevivalIncomeStep = { actor: string; action: Action };
export type SemutaRevivalIncomeKind = 'ordinary' | 'ghola';
export const actSemutaRevivalIncome = actTruthMovement;
export const semutaRevivalIncomePlayer = (game: Game, id: string) => {
  const player = game.players.find(p => p.id === id); assert.ok(player); return player;
};
export const semutaRevivalIncomeClean = (game: Game) => !game.phaseOpening && !game.response &&
  !game.decision && !game.truthtrance && !game.pendingTreacheryDiscard && !game.pendingRevival;
export function semutaRevivalIncomeInventory(game: Game) {
  const ids = [...game.deck, ...game.discard, ...(game.richeseCache ?? []), ...(game.richeseRemoved ?? []),
    ...game.players.flatMap(p => p.hand),
    ...(game.auction?.cards.slice(game.auction.index + Number(game.currentAuctionSale?.origin === 'normal')) ?? [])]
    .map(card => card.id).sort();
  assert.equal(new Set(ids).size, ids.length, 'Each original main/cache card retains one physical zone'); return ids;
}
/** Original optional choices are declined. Fresh Ghola/cost disposal remains
 * explicit and the ordinary income counter is never synthesized. */
export function nextSemutaRevivalIncomeStep(game: Game): SemutaRevivalIncomeStep | null {
  if (game.pendingTreacheryDiscard || game.truthtrance) return null;
  if (!game.response && !game.phaseOpening) {
    if (game.decision?.kind === 'revivalStop') return { actor: game.decision.player,
      action: { type: 'decision', decline: true } };
    if (!game.decision && game.status === 'playing' && game.phase === 0 && game.stormPending === null) {
      const actor = game.stormDialers.find(id => game.stormDials[id] === undefined);
      if (actor) return { actor, action: { type: 'stormDial', amount: game.turn === 1
        ? actor === game.stormDialers[0] ? 17 : 0 : 1 } };
    }
  }
  return nextSemutaRicheseCacheKarama(game);
}
export function advanceSemutaRevivalIncome(game: Game, until: (state: Game) => boolean,
  actions: SemutaRevivalIncomeStep[] = []): Game {
  for (let count = 0; count < 2200; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    const next = nextSemutaRevivalIncomeStep(game);
    assert.ok(next, 'Choose the actual Ghola or Karama fresh-discard reaction before advancing');
    game = actSemutaRevivalIncome(game, next.actor, next.action, actions);
  }
  throw Error('The genuine revival-income programme did not reach its finite boundary');
}
/** Only this batch, preserving the original resumed income response. */
export function passSemutaRevivalIncome(game: Game, actions: SemutaRevivalIncomeStep[] = []): Game {
  const event = game.pendingTreacheryDiscard?.batch.event; assert.ok(event);
  for (let count = 0; game.pendingTreacheryDiscard?.batch.event === event && count < game.players.length; count++) {
    const pending: NonNullable<Game['pendingTreacheryDiscard']> = game.pendingTreacheryDiscard!;
    const reaction = pending.reaction; assert.ok(reaction?.stage === 'offer');
    const actor = game.players.find(p => !reaction.passed.includes(p.id)); assert.ok(actor);
    game = actSemutaRevivalIncome(game, actor.id, { type: 'semutaPass', event }, actions);
  }
  assert.notEqual(game.pendingTreacheryDiscard?.batch.event, event); return game;
}
export function claimSemutaRevivalIncome(game: Game, holder: string,
  actions: SemutaRevivalIncomeStep[] = []): Game {
  const pending = game.pendingTreacheryDiscard; assert.ok(pending && pending.batch.entries.length === 1);
  const event = pending.batch.event, card = pending.batch.entries[0].card.id;
  game = actSemutaRevivalIncome(game, holder, { type: 'semutaCommit', event }, actions);
  if (game.pendingTreacheryDiscard?.reaction?.stage === 'select')
    game = actSemutaRevivalIncome(game, holder, { type: 'semutaSelect', event, card }, actions);
  return game;
}
/** Allow one original income opportunity; this does not request another return. */
export function allowSemutaRevivalIncome(game: Game, actions: SemutaRevivalIncomeStep[] = []): Game {
  assert.equal(game.response?.kind, 'revivalIncome');
  for (let count = 0; game.response?.kind === 'revivalIncome' && count < game.players.length; count++) {
    const actor = game.players.find(p => !game.response!.passed.includes(p.id)); assert.ok(actor);
    game = actSemutaRevivalIncome(game, actor.id, { type: 'passResponse' }, actions);
  }
  assert.ok(!game.response); return game;
}

/** Genuine native source: actual cache purchase, paid shipment, next Storm
 * casualties, then original ordinary/Ghola return. No played custody, resource,
 * casualty, phase, alliance, pending return or income receipt is installed. */
export function createSemutaRevivalIncomeFixture(options: { kind?: SemutaRevivalIncomeKind; advanced?: boolean } = {}) {
  const kind = options.kind ?? 'ordinary', advanced = options.advanced ?? false;
  const seller = 'richese', holder = 'choam', incomeOwner = 'tleilaxu', spender = 'atreides', recipient = 'emperor';
  let game = createGame('SEMUTAREVIVALINCOME', newPlayer(seller, 'Richese', 'richese'), advanced, ['choam', 'ix']);
  for (const faction of ['choam', 'tleilaxu', 'atreides', 'emperor'] as const) joinGame(game, newPlayer(faction, faction, faction));
  const actions: SemutaRevivalIncomeStep[] = [];
  const act = (actor: string, action: Action) => { game = actSemutaRevivalIncome(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceSemutaRevivalIncome(game, until, actions); };
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
  const originalInventory = semutaRevivalIncomeInventory(game); assert.equal(originalInventory.length, 57);
  const costCard = game.deck.find(card => card.effect === 'karama' && !card.id.startsWith('ix-'));
  const gholaCard = game.deck.find(card => card.effect === 'ghola');
  const shield = game.deck.find(card => card.kind === 'shield');
  const ordinary = game.deck.filter(card => card.kind === 'projectile' && !card.effect).slice(0, 2);
  assert.ok(costCard && gholaCard && shield); assert.equal(ordinary.length, 2);
  const deal = [ordinary[0].id, ordinary[1].id, shield.id, costCard.id, gholaCard.id];
  const dealOrder = deal.map((card, position) => {
    const from = game.deck.findIndex(candidate => candidate.id === card); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { card, from, position };
  });
  const beforeStartingDeal = structuredClone(game), cost = costCard.id, ghola = gholaCard.id;
  reach(state => state.status === 'playing'); const afterSetup = structuredClone(game);
  assert.deepEqual(game.players.flatMap(p => p.hand.map(card => card.id)), deal);
  assert.equal(semutaRevivalIncomePlayer(game, incomeOwner).faceDancers?.length, 3);
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const spiceOrder: { position: number; from: number; card: Game['spiceDeck'][number] }[] = [];
  for (let position = 0; position < (advanced ? 4 : 2); position++) {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card && !card.discovery &&
      ['hagga_basin', 'rock_outcroppings', 'broken_land', 'oh_gap'].includes(card.territory));
    assert.ok(from >= position); const card = game.spiceDeck.splice(from, 1)[0]; game.spiceDeck.splice(position, 0, card);
    spiceOrder.push({ position, from, card: structuredClone(card) });
  }
  assert.deepEqual(game.spiceDeck.map(card => JSON.stringify(card)).sort(), originalSpice);
  let beforeBid: Game | undefined, bid: SemutaRevivalIncomeStep | undefined, bidAt = -1;
  for (let count = 0; count < 900 && !semutaRevivalIncomePlayer(game, holder).hand.some(card => card.id === SEMUTA_DRUG_ID); count++) {
    const next = nextSemutaRevivalIncomeStep(game); assert.ok(next);
    if (next.actor === holder && next.action.type === 'richeseBid' && next.action.amount === 1) {
      beforeBid = structuredClone(game); bid = structuredClone(next); bidAt = actions.length;
    }
    act(next.actor, next.action);
  }
  assert.ok(beforeBid && bid && bidAt >= 0);
  const acquired = structuredClone(game), acquisition = { before: beforeBid, bid,
    steps: structuredClone(actions.slice(bidAt)), after: acquired, price: 1 };
  assert.ok(semutaRevivalIncomePlayer(game, holder).hand.some(card => card.id === SEMUTA_DRUG_ID));
  assert.equal(semutaRevivalIncomePlayer(beforeBid, holder).spice - semutaRevivalIncomePlayer(game, holder).spice, 1);
  assert.equal(semutaRevivalIncomePlayer(game, seller).spice - semutaRevivalIncomePlayer(beforeBid, seller).spice, 1);
  reach(state => state.turn === 1 && state.phase === 5 && state.active === recipient && semutaRevivalIncomeClean(state));
  assert.equal(game.storm, 18);
  const shipment = transition(() => {
    act(recipient, { type: 'ship', territory: 'cielago_north', sector: 1, amount: 2, elite: 0, allyPayment: 0 });
    reach(semutaRevivalIncomeClean);
  });
  assert.equal(semutaRevivalIncomePlayer(shipment.before, recipient).spice - semutaRevivalIncomePlayer(game, recipient).spice, 4);
  assert.equal(semutaRevivalIncomePlayer(game, recipient).forces['cielago_north:1'], 2);
  act(recipient, { type: 'endMovement' });
  reach(state => state.turn === 2 && state.phase === 0 && semutaRevivalIncomeClean(state));
  const storm = transition(() => {
    reach(state => state.turn === 2 && state.phase === 1 && semutaRevivalIncomeClean(state));
  });
  assert.equal(storm.before.storm, 18); assert.ok(storm.after.storm >= 1 && storm.after.storm <= 6);
  assert.equal(semutaRevivalIncomePlayer(game, recipient).tanks, 2);
  assert.equal(semutaRevivalIncomePlayer(game, recipient).forces['cielago_north:1'] ?? 0, 0);
  reach(state => state.turn === 2 && state.phase === 4 && semutaRevivalIncomeClean(state));
  const beforeRevival = structuredClone(game), revivalAction: Action = kind === 'ordinary'
    ? { type: 'revive', amount: 2, elite: 0 } : { type: 'card', card: ghola, amount: 2, elite: 0 };
  const revival = transition(() => {
    act(recipient, revivalAction);
    if (kind === 'ordinary') reach(state => state.response?.kind === 'revivalIncome' && !state.pendingTreacheryDiscard);
  });
  let gholaDiscard: { before: Game; steps: SemutaRevivalIncomeStep[]; after: Game } | null = null;
  if (kind === 'ghola') {
    assert.equal(game.pendingTreacheryDiscard?.continuation.kind, 'ordinaryCardDiscard');
    assert.deepEqual(game.pendingTreacheryDiscard!.batch.entries.map(entry => entry.card.id), [ghola]);
    gholaDiscard = transition(() => { game = passSemutaRevivalIncome(game, actions); });
    assert.ok(semutaRevivalIncomePlayer(game, holder).hand.some(card => card.id === SEMUTA_DRUG_ID));
  }
  assert.equal(game.response?.kind, 'revivalIncome'); assert.equal(game.response?.owner, incomeOwner);
  assert.equal(game.response?.recipient, recipient); assert.equal(game.response?.amount, kind === 'ordinary' ? 3 : 1);
  assert.ok(!game.pendingRevival && !game.pendingTreacheryDiscard && !game.battle && !game.pendingAmbassador && !game.pendingChoamMarketGhola);
  assert.equal(semutaRevivalIncomePlayer(game, recipient).tanks, 0);
  assert.equal(semutaRevivalIncomePlayer(game, recipient).reserves - semutaRevivalIncomePlayer(beforeRevival, recipient).reserves, 2);
  assert.equal(semutaRevivalIncomePlayer(beforeRevival, recipient).spice - semutaRevivalIncomePlayer(game, recipient).spice,
    kind === 'ordinary' ? 2 : 0);
  assert.ok(semutaRevivalIncomePlayer(game, spender).hand.some(card => card.id === cost));
  assert.deepEqual(semutaRevivalIncomeInventory(game), originalInventory);
  const source = structuredClone(game), amount = game.response!.amount!, action: Action = { type: 'card', card: cost, mode: 'cancel' };
  return { game, source, beforeCost: source, kind, advanced, holder, spender, recipient, payer: recipient,
    incomeOwner, owner: incomeOwner, seller, cost, karama: cost, card: cost, semuta: SEMUTA_DRUG_ID, ghola, amount, action,
    lobby, setup, initialization, beforeStartingDeal, afterSetup, deal, dealOrder, originalSpice, spiceOrder,
    acquisition, acquired, shipment, storm, beforeRevival, revivalAction, revival, gholaDiscard,
    originalInventory, originalCards: originalInventory, actions, steps: actions, sourceActionCount: actions.length,
    staging: [
      'Public bare Basic Richese/CHOAM/Tleilaxu/Atreides/Emperor start, or the original Advanced Semuta initializer on its ready undealt lobby, retains original union47/cache10. Only unopened starting-card/Spice positions and scalar lotteries are selected; Atreides actually receives its printed Karama and Emperor its Ghola.',
      'CHOAM actually buys cache Semuta for1 before any later source. Legal original first Storm dials17+0 end18; Emperor pays4 to ship2 original normal reserves into exposed Cielago North1. The next actual native Storm sweeps sector1 and places those two physical counters in Tanks. No casualty, wallet, force, phase or history is installed.',
      kind === 'ordinary' ? 'At clean turn2 Revival Emperor really requests2 normals. Original CHOAM free-revival choice is declined; the completed return spends2, records ordinary2/free1 and offers native Tleilaxu income3 (paid2 plus the first free-event reward1).' : 'At clean turn2 Revival Emperor really plays its originally dealt Ghola for2 normals, preserving ordinary quotas and paying0. Every seat actually passes that earlier original Ghola fresh-discard group; paid-cache Semuta stays held for the later Karama group. Native Ghola income1 is still conditional.',
      'Stop at clean native revivalIncome before Atreides spends the actual printed cancellation cost. Completed counters/payment/allowance/free-income stay native; Ambassador, market, battle and other unfinished parents are absent.',
    ] };
}
export type SemutaRevivalIncomeFixture = ReturnType<typeof createSemutaRevivalIncomeFixture>;
