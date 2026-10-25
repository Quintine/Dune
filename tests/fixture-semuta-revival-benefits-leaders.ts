import assert from 'node:assert/strict';
import {
  createGame, initializeSemutaGameForAudit, joinGame, newPlayer, viewGame, type Action, type Game,
} from '../game/engine';
import { quoteRevivalCancellation } from '../game/revival-cancellation';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { actTruthMovement } from './fixture-truth-movement';
import { nextSemutaRicheseCacheKarama } from './fixture-semuta-richese-cache-karama';
import { withClassicDiscoveryNexusLottery } from './fixture-discovery-classic-nexus';

export type SemutaRevivalBenefitsLeadersStep = { actor: string; action: Action };
export type SemutaRevivalBenefitsLeadersKind = 'earlyRevival' | 'revivalDiscount' | 'foreignGhola';
export const actSemutaRevivalBenefitsLeaders = actTruthMovement;
export const semutaRevivalBenefitsLeadersPlayer = (game: Game, id: string) => {
  const player = game.players.find(p => p.id === id); assert.ok(player); return player;
};
export const semutaRevivalBenefitsLeadersClean = (game: Game) => !game.response && !game.phaseOpening &&
  !game.decision && !game.truthtrance && !game.pendingTreacheryDiscard && !game.pendingRevival;
/** Sealed plans and discard batches refer to these zones without duplicating cards. */
export function semutaRevivalBenefitsLeadersInventory(game: Game) {
  const ids = [...game.deck, ...game.discard, ...(game.richeseCache ?? []), ...(game.richeseRemoved ?? []),
    ...game.players.flatMap(p => p.hand),
    ...(game.auction?.cards.slice(game.auction.index + Number(game.currentAuctionSale?.origin === 'normal')) ?? [])]
    .map(card => card.id).sort();
  assert.equal(new Set(ids).size, ids.length); return ids;
}
/** Original preparation/readiness and cleanup only. Private plans and every
 * fresh disposal are explicit; no optional replacement or revival is invented. */
export function nextSemutaRevivalBenefitsLeadersStep(game: Game): SemutaRevivalBenefitsLeadersStep | null {
  if (game.pendingTreacheryDiscard || game.truthtrance) return null;
  if (!game.response && !game.phaseOpening) {
    const d = game.decision;
    if (d?.kind === 'revivalStop') return { actor: d.player, action: { type: 'decision', decline: true } };
    if (d?.kind === 'faceDance') return { actor: d.player, action: { type: 'decision', reveal: false } };
    if (d?.kind === 'battleCards') return { actor: d.player, action: { type: 'decision', discard: [...d.cards] } };
    const window = game.battle?.outcomeWindow;
    if (!d && window && !window.closed) {
      const actor = [window.attacker, window.defender].find(id => !window.ready.includes(id)); assert.ok(actor);
      return { actor, action: { type: 'battleOutcomeReady', event: window.event } };
    }
  }
  return nextSemutaRicheseCacheKarama(game);
}
export function advanceSemutaRevivalBenefitsLeaders(game: Game, until: (state: Game) => boolean,
  actions: SemutaRevivalBenefitsLeadersStep[] = []): Game {
  for (let count = 0; count < 2200; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    const next = nextSemutaRevivalBenefitsLeadersStep(game);
    assert.ok(next, 'Supply the real private plans or fresh-discard reaction before continuing');
    game = actSemutaRevivalBenefitsLeaders(game, next.actor, next.action, actions);
  }
  throw Error('The native leader-revival programme did not reach its finite boundary');
}
export function passSemutaRevivalBenefitsLeaders(game: Game, actions: SemutaRevivalBenefitsLeadersStep[] = []): Game {
  const event = game.pendingTreacheryDiscard?.batch.event; assert.ok(event);
  for (let count = 0; game.pendingTreacheryDiscard?.batch.event === event && count < game.players.length; count++) {
    const pending: NonNullable<Game['pendingTreacheryDiscard']> = game.pendingTreacheryDiscard!;
    const reaction = pending.reaction; assert.ok(reaction?.stage === 'offer');
    const actor = game.players.find(p => !reaction.passed.includes(p.id)); assert.ok(actor);
    game = actSemutaRevivalBenefitsLeaders(game, actor.id, { type: 'semutaPass', event }, actions);
  }
  assert.notEqual(game.pendingTreacheryDiscard?.batch.event, event); return game;
}
export function claimSemutaRevivalBenefitsLeaders(game: Game, holder: string,
  actions: SemutaRevivalBenefitsLeadersStep[] = []): Game {
  const pending = game.pendingTreacheryDiscard; assert.ok(pending && pending.batch.entries.length === 1);
  const event = pending.batch.event, card = pending.batch.entries[0].card.id;
  game = actSemutaRevivalBenefitsLeaders(game, holder, { type: 'semutaCommit', event }, actions);
  if (game.pendingTreacheryDiscard?.reaction?.stage === 'select')
    game = actSemutaRevivalBenefitsLeaders(game, holder, { type: 'semutaSelect', event, card }, actions);
  return game;
}
/** Allow exactly one native benefit; later checks stay explicit until finish. */
export function allowSemutaRevivalBenefitsLeaders(game: Game,
  actions: SemutaRevivalBenefitsLeadersStep[] = []): Game {
  const kind = game.response?.kind;
  assert.ok(kind === 'earlyRevival' || kind === 'revivalDiscount' || kind === 'foreignGhola');
  for (let count = 0; game.response?.kind === kind && count < game.players.length; count++) {
    const actor = game.players.find(p => !game.response!.passed.includes(p.id)); assert.ok(actor);
    game = actSemutaRevivalBenefitsLeaders(game, actor.id, { type: 'passResponse' }, actions);
  }
  assert.notEqual(game.response?.kind, kind); return game;
}
/** Complete only the accepted original request's native remaining benefit,
 * consent/income controls. No request is replayed and fresh costs stay owned. */
export function finishSemutaRevivalBenefitsLeaders(game: Game,
  actions: SemutaRevivalBenefitsLeadersStep[] = []): Game {
  return advanceSemutaRevivalBenefitsLeaders(game, semutaRevivalBenefitsLeadersClean, actions);
}

/** Actual first-turn two-Poison battle earns both native dead discs. Original
 * starting cards, paid cache, shipments, plans, votes and disposal stay real;
 * no dead/deaths/ghola/custody/resource/phase/response state is assigned. */
export function createSemutaRevivalBenefitsLeadersFixture(options: {
  kind?: SemutaRevivalBenefitsLeadersKind; advanced?: boolean;
} = {}) {
  const kind = options.kind ?? 'earlyRevival', advanced = options.advanced ?? kind === 'foreignGhola';
  assert.ok(kind !== 'foreignGhola' || advanced, 'Native foreign Ghola is Advanced only');
  const seller = 'richese', holder = 'choam', owner = 'tleilaxu', opponent = 'atreides', spender = 'emperor';
  const territory = 'imperial_basin', sector = 9, location = `${territory}:${sector}`;
  let game = createGame('SEMUTAREVIVALBENEFITSLEADERS', newPlayer(seller, 'Richese', 'richese'), advanced, ['choam', 'ix']);
  for (const faction of ['choam', 'tleilaxu', 'atreides', 'emperor'] as const) joinGame(game, newPlayer(faction, faction, faction));
  const actions: SemutaRevivalBenefitsLeadersStep[] = [];
  const act = (actor: string, action: Action) => { game = actSemutaRevivalBenefitsLeaders(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceSemutaRevivalBenefitsLeaders(game, until, actions); };
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
  const originalInventory = semutaRevivalBenefitsLeadersInventory(game); assert.equal(originalInventory.length, 57);
  const printed = game.deck.find(card => card.effect === 'karama' && !card.id.startsWith('ix-'));
  const poisons = game.deck.filter(card => card.kind === 'poison' && !card.effect).slice(0, 2);
  const ordinary = game.deck.filter(card => card.kind === 'projectile' && !card.effect).slice(0, 2);
  assert.ok(printed); assert.equal(poisons.length, 2); assert.equal(ordinary.length, 2);
  const deal = [ordinary[0].id, ordinary[1].id, poisons[0].id, poisons[1].id, printed.id];
  const dealOrder = deal.map((card, position) => {
    const from = game.deck.findIndex(candidate => candidate.id === card); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { card, position, from };
  });
  const cost = printed.id, beforeStartingDeal = structuredClone(game);
  reach(state => state.status === 'playing'); const afterSetup = structuredClone(game);
  assert.deepEqual(game.players.flatMap(p => p.hand.map(card => card.id)), deal);
  const ownLeader = semutaRevivalBenefitsLeadersPlayer(game, owner).leaders.filter(leader => leader.strength > 1)
    .sort((a, b) => a.strength - b.strength || a.id.localeCompare(b.id))[0];
  const foreignLeader = semutaRevivalBenefitsLeadersPlayer(game, opponent).leaders
    .slice().sort((a, b) => a.strength - b.strength || a.id.localeCompare(b.id))[0];
  assert.ok(ownLeader && foreignLeader); assert.equal(ownLeader.strength, 2); assert.equal(foreignLeader.strength, 1);
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const spiceOrder: { position: number; from: number; card: Game['spiceDeck'][number] }[] = [];
  for (let position = 0; position < (advanced ? 4 : 2); position++) {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card && !card.discovery &&
      ['hagga_basin', 'rock_outcroppings', 'broken_land', 'oh_gap'].includes(card.territory));
    assert.ok(from >= position); const card = game.spiceDeck.splice(from, 1)[0]; game.spiceDeck.splice(position, 0, card);
    spiceOrder.push({ position, from, card: structuredClone(card) });
  }
  assert.deepEqual(game.spiceDeck.map(card => JSON.stringify(card)).sort(), originalSpice);
  let beforeBid: Game | undefined, bid: SemutaRevivalBenefitsLeadersStep | undefined, bidAt = -1;
  for (let count = 0; count < 900 && !semutaRevivalBenefitsLeadersPlayer(game, holder).hand.some(card => card.id === SEMUTA_DRUG_ID); count++) {
    const next = nextSemutaRevivalBenefitsLeadersStep(game); assert.ok(next);
    if (next.actor === holder && next.action.type === 'richeseBid' && next.action.amount === 1) {
      beforeBid = structuredClone(game); bid = structuredClone(next); bidAt = actions.length;
    }
    act(next.actor, next.action);
  }
  assert.ok(beforeBid && bid && bidAt >= 0);
  const acquired = structuredClone(game), acquisition = { before: beforeBid, bid,
    steps: structuredClone(actions.slice(bidAt)), after: acquired, price: 1 };
  assert.ok(semutaRevivalBenefitsLeadersPlayer(game, holder).hand.some(card => card.id === SEMUTA_DRUG_ID));
  assert.equal(semutaRevivalBenefitsLeadersPlayer(beforeBid, holder).spice - semutaRevivalBenefitsLeadersPlayer(game, holder).spice, 1);
  const shipments: { actor: string; before: Game; steps: SemutaRevivalBenefitsLeadersStep[]; after: Game }[] = [];
  for (const actor of [owner, opponent]) {
    reach(state => state.turn === 1 && state.phase === 5 && state.active === actor && semutaRevivalBenefitsLeadersClean(state));
    const shipment = transition(() => {
      act(actor, { type: 'ship', territory, sector, amount: 1, elite: 0, allyPayment: 0 });
      reach(semutaRevivalBenefitsLeadersClean);
    });
    assert.equal(semutaRevivalBenefitsLeadersPlayer(shipment.before, actor).spice - semutaRevivalBenefitsLeadersPlayer(game, actor).spice, 2);
    shipments.push({ actor, ...shipment }); act(actor, { type: 'endMovement' });
  }
  reach(state => state.phase === 6 && semutaRevivalBenefitsLeadersClean(state) && !!state.active);
  const beforeBattle = structuredClone(game), choice = viewGame(game, game.active!).battleChoices.find(choice => choice.territory === territory);
  assert.ok(choice); assert.equal(choice.chooser, owner); assert.equal(choice.attacker, owner);
  const battleAction: Action = { type: 'chooseBattle', territory, target: opponent };
  act(choice.chooser, battleAction);
  reach(state => !!state.battle && semutaRevivalBenefitsLeadersClean(state) && !state.battle.preparation && state.battle.preLeader?.closed !== false);
  const beforePlans = structuredClone(game), planSteps: SemutaRevivalBenefitsLeadersStep[] = [
    { actor: owner, action: { type: 'battlePlan', leader: ownLeader.id, dial: 0, support: 0, weapon: poisons[0].id, defense: null } },
    { actor: opponent, action: { type: 'battlePlan', leader: foreignLeader.id, dial: 0, support: 0, weapon: poisons[1].id, defense: null } },
  ];
  for (const step of planSteps) act(step.actor, step.action);
  const revealed = structuredClone(game), battleStepsAt = actions.length;
  const disposals: { before: Game; steps: SemutaRevivalBenefitsLeadersStep[]; after: Game; cards: string[] }[] = [];
  for (let count = 0; (game.battle || !semutaRevivalBenefitsLeadersClean(game)) && count < 100; count++) {
    if (game.pendingTreacheryDiscard) {
      const cards: string[] = game.pendingTreacheryDiscard.batch.entries.map(entry => entry.card.id);
      disposals.push({ ...transition(() => { game = passSemutaRevivalBenefitsLeaders(game, actions); }), cards });
    } else {
      const next = nextSemutaRevivalBenefitsLeadersStep(game); assert.ok(next, 'Finish the original final battle/cleanup controls');
      act(next.actor, next.action);
    }
  }
  assert.ok(!game.battle && semutaRevivalBenefitsLeadersClean(game));
  const afterBattle = structuredClone(game), battleResolution = structuredClone(actions.slice(battleStepsAt));
  const ownDead = semutaRevivalBenefitsLeadersPlayer(game, owner).leaders.find(leader => leader.id === ownLeader.id)!;
  const foreignDead = semutaRevivalBenefitsLeadersPlayer(game, opponent).leaders.find(leader => leader.id === foreignLeader.id)!;
  assert.equal(ownDead.dead, true); assert.equal(ownDead.deaths, 1);
  assert.equal(foreignDead.dead, true); assert.equal(foreignDead.deaths, 1);
  assert.equal(game.lastBattleContext?.winner, owner);
  assert.equal(semutaRevivalBenefitsLeadersPlayer(game, owner).forces[location], 1);
  assert.equal(semutaRevivalBenefitsLeadersPlayer(game, opponent).tanks, 1);
  assert.ok(disposals.length && disposals.every(disposal => disposal.steps.every(step => step.action.type === 'semutaPass')));
  assert.ok(semutaRevivalBenefitsLeadersPlayer(game, holder).hand.some(card => card.id === SEMUTA_DRUG_ID));
  reach(state => state.turn === 2 && state.phase === 4 && semutaRevivalBenefitsLeadersClean(state));
  const beforeRequest = structuredClone(game), targetLeader = kind === 'foreignGhola' ? foreignLeader.id : ownLeader.id;
  assert.ok(semutaRevivalBenefitsLeadersPlayer(game, owner).spice >= ownLeader.strength);
  const nativeAction: Action = kind === 'foreignGhola'
    ? { type: 'reviveForeignGhola', leader: targetLeader } : { type: 'reviveLeader', leader: targetLeader };
  const declaration = transition(() => { act(owner, nativeAction); });
  let priorEarly: { before: Game; steps: SemutaRevivalBenefitsLeadersStep[]; after: Game } | null = null;
  if (kind === 'revivalDiscount') {
    assert.equal(game.response?.kind, 'earlyRevival');
    priorEarly = transition(() => { game = allowSemutaRevivalBenefitsLeaders(game, actions); });
  }
  assert.equal(game.response?.kind, kind); assert.equal(game.response?.owner, owner); assert.equal(game.response?.recipient, owner);
  assert.ok(game.pendingRevival && game.pendingRevival.leader === targetLeader);
  assert.equal(semutaRevivalBenefitsLeadersPlayer(game, owner).spice, semutaRevivalBenefitsLeadersPlayer(beforeRequest, owner).spice);
  assert.ok(semutaRevivalBenefitsLeadersPlayer(game, spender).hand.some(card => card.id === cost));
  assert.deepEqual(semutaRevivalBenefitsLeadersInventory(game), originalInventory);
  const source = structuredClone(game), action: Action = { type: 'card', card: cost, mode: 'cancel' };
  const expected = quoteRevivalCancellation(game, game.response!); assert.ok(expected);
  return { game, source, beforeCost: source, kind, advanced, holder, spender, owner, recipient: owner, payer: owner,
    opponent, seller, cost, karama: cost, card: cost, semuta: SEMUTA_DRUG_ID, action, nativeAction,
    targetLeader, ownLeader: ownLeader.id, foreignLeader: foreignLeader.id, normalCost: game.pendingRevival!.normalCost,
    discountedCost: game.pendingRevival!.cost, pending: structuredClone(game.pendingRevival), expected,
    territory, location, lobby, setup, initialization, beforeStartingDeal, afterSetup, deal, dealOrder,
    originalSpice, spiceOrder, acquired, acquisition, shipments, beforeBattle, battleAction,
    beforePlans, planSteps, revealed, disposals, battleResolution, afterBattle, beforeRequest, declaration, priorEarly,
    originalInventory, originalCards: originalInventory, actions, steps: actions, sourceActionCount: actions.length,
    staging: [
      'Original public Basic or explicit undealt Advanced Semuta setup uses native R/CHOAM/Tleilaxu/Atreides/Emperor, main47/cache10. Only unopened card/Spice positions and original scalar lotteries are selected. Tleilaxu/Atreides actually receive separate printed Poison weapons; Emperor receives the printed Karama.',
      'CHOAM really buys Semuta cache1. Tleilaxu and Atreides each really pay2 to ship one normal into otherwise empty Imperial Basin9. Native battle seals Wykk2/Yueh1, dial0/support0, both original Poison and no defense, then submits actual final readiness/no-Traitor votes. Both native leaders die through the real weapons; no dead/deaths/ghola/custody/army/phase assignment occurs.',
      'All real losing/winner played-card disposal groups are explicitly passed so the original paid Semuta remains held. Native aftermath, Collection, Mentat, next Storm/Spice/Charity/Bidding lead to clean turn2 Revival. The surviving native Tleilaxu group and four active own leaders remain actual outcomes; original funds cover full2 without a bribe.',
      kind === 'foreignGhola' ? 'The original Advanced foreign-Ghola declaration targets the different actually dead Atreides disc while the real dead own disc leaves Tleilaxu active capacity4.' : kind === 'revivalDiscount' ? 'Actually declare the original own dead Wykk revival and pass its earlier earlyRevival window before stopping at the native remaining discount response.' : 'Actually declare own dead Wykk revival and stop at its native earlyRevival response before any return or payment.',
      'Stop before the actual Emperor cancellation; source pending/quote are read, not installed. Native cancellation decides abandonment or current full-price continuation; caller owns fresh-cost Semuta and later original checks/income.',
    ] };
}
export type SemutaRevivalBenefitsLeadersFixture = ReturnType<typeof createSemutaRevivalBenefitsLeadersFixture>;
