import assert from 'node:assert/strict';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { JACURUTU_SIETCH, DISCOVERY_CARD_PLACEMENTS } from '../game/discoveries';
import { discoveryEntryMoveAction } from '../game/discovery-entry-options';
import { nativeShipmentSources } from '../game/homeworld-options';
import { REINFORCEMENTS_CARD } from '../game/reinforcements';
import { HARASS_WITHDRAW_CARD } from '../game/harass-withdraw';
import { RECRUITS_CARD_ID, recruitsPlayAction } from '../game/recruits';
import { createSelectedIndependentEntry, type SelectedIndependentEntryOptions } from './fixture-selected-independent-nexus-entry';
import { e3IndependentDukeClean, nextE3IndependentDukeStep } from './fixture-e3-independent-nexus-duke';
import { withClassicDiscoveryNexusLottery, withClassicDiscoveryNexusToken } from './fixture-discovery-classic-nexus';

export type IndependentDiscoveryBattleStep = { actor: string; action: Action };
export type IndependentDiscoveryBattleOptions = Omit<SelectedIndependentEntryOptions, 'factions' | 'discoveries'>;
export const independentDiscoveryBattleClean = e3IndependentDukeClean;
export const independentDiscoveryBattlePlayer = (game: Game, actor: string) => {
  const player = game.players.find(player => player.id === actor); assert.ok(player); return player;
};
export function actIndependentDiscoveryBattle(game: Game, actor: string, action: Action,
  actions: IndependentDiscoveryBattleStep[] = []): Game {
  actions.push({ actor, action: structuredClone(action) });
  return withClassicDiscoveryNexusLottery(() => applyAction(game, actor, action));
}
export function advanceIndependentDiscoveryBattle(game: Game, until: (state: Game) => boolean,
  actions: IndependentDiscoveryBattleStep[] = []): Game {
  for (let count = 0; count < 2400; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The original nested battle programme ended before its next owned boundary');
    assert.notEqual(game.decision?.kind, 'harassWithdraw', 'Supply the actual typed Harass allocation explicitly');
    const step = nextE3IndependentDukeStep(game);
    assert.ok(step, `Complete the real ${game.decision?.kind ?? 'Battle Plan'} at ${game.turn}/${game.phase}`);
    game = actIndependentDiscoveryBattle(game, step.actor, step.action, actions);
  }
  throw Error('The original independent Discovery battle did not reach its finite boundary');
}

/** Only original unopened Spice Cards are ordered. No discarded encounter is
 * retagged as a new blow, and no already-placed Discovery token is exchanged. */
function orderSpice(game: Game, discovery: boolean) {
  const front: Game['spiceDeck'] = [];
  for (let pile = 0; pile < (game.advanced ? 2 : 1); pile++) {
    const at = game.spiceDeck.findIndex(card => 'territory' in card &&
      (discovery && pile === 0 ? card.discovery === 'discovery-hagga-basin' : !card.discovery));
    assert.ok(at >= 0); front.push(game.spiceDeck.splice(at, 1)[0]);
  }
  game.spiceDeck.unshift(...front);
}

/** Three genuinely paid original lots, all selected while still unopened.
 * The ordinary native auction handles payment, card ownership and hand limit. */
function purchaseOriginalCards(game: Game, actions: IndependentDiscoveryBattleStep[]) {
  assert.equal(game.phase, 2);
  const desired = [REINFORCEMENTS_CARD, HARASS_WITHDRAW_CARD, RECRUITS_CARD_ID];
  const front = desired.map(id => {
    const at = game.deck.findIndex(card => card.id === id); assert.ok(at >= 0, `Original ${id} must still be undealt`);
    return game.deck.splice(at, 1)[0];
  });
  game.deck.unshift(...front);
  const before = structuredClone(game), bids: { before: Game; step: IndependentDiscoveryBattleStep; after: Game }[] = [];
  for (let count = 0; count < 420; count++) {
    if (desired.every(id => independentDiscoveryBattlePlayer(game, 'emperor').hand.some(card => card.id === id))) {
      assert.equal(bids.length, 3); return { game, before, bids };
    }
    if (independentDiscoveryBattleClean(game) && game.auction?.active === 'emperor' &&
      desired.includes(game.auction.cards[game.auction.index].id as typeof desired[number]) && game.auction.bid === 0) {
      const prior = structuredClone(game), step: IndependentDiscoveryBattleStep = {
        actor: 'emperor', action: { type: 'bid', amount: 1, allyPayment: 0 },
      };
      game = actIndependentDiscoveryBattle(game, step.actor, step.action, actions);
      bids.push({ before: prior, step, after: structuredClone(game) });
    } else {
      const step = nextE3IndependentDukeStep(game); assert.ok(step);
      game = actIndependentDiscoveryBattle(game, step.actor, step.action, actions);
    }
  }
  throw Error('The actual first auction did not deliver its three paid original card lots');
}

/** Original placement, paid finder, actual inspection/reveal, next-turn free
 * nested entry and paid enemy shipment. No dealt card, counter, wallet, phase,
 * native reserve pool, leader identity or earned receipt is staged. */
export function createIndependentDiscoveryBattleFixture(options: Partial<IndependentDiscoveryBattleOptions> = {}) {
  const source = withClassicDiscoveryNexusLottery(() => createSelectedIndependentEntry({
    ...options, advanced: options.advanced ?? true, expansions: options.expansions ?? ['ix', 'choam', 'ecaz'],
    factions: ['emperor', 'guild', 'atreides'], discoveries: true,
  }));
  let game = structuredClone(source.game);
  const afterSetup = structuredClone(game), actions = [...source.actions];
  const act = (actor: string, action: Action) => { game = actIndependentDiscoveryBattle(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceIndependentDiscoveryBattle(game, until, actions); };
  orderSpice(game, true);
  for (let count = 0; !game.discoveries!.tokens.some(token => token.face === JACURUTU_SIETCH && token.status === 'placed') && count < 100; count++) {
    const step = nextE3IndependentDukeStep(game); assert.ok(step);
    actions.push(structuredClone(step));
    // The token's own scalar producer surrounds applyAction directly; the
    // generic shuffle wrapper must not replace this original supply lottery.
    game = withClassicDiscoveryNexusToken(game, JACURUTU_SIETCH, () => applyAction(game, step.actor, step.action));
  }
  const token = game.discoveries!.tokens.find(token => token.face === JACURUTU_SIETCH && token.status === 'placed')?.id;
  assert.ok(token);
  const placed = structuredClone(game), parent = DISCOVERY_CARD_PLACEMENTS['discovery-hagga-basin'];
  reach(state => state.phase === 2 && independentDiscoveryBattleClean(state));
  const purchased = purchaseOriginalCards(game, actions); game = purchased.game;
  reach(state => state.phase === 5 && state.active === 'emperor' && independentDiscoveryBattleClean(state));
  const shipments: { before: Game; step: IndependentDiscoveryBattleStep; after: Game }[] = [];
  const ship = (actor: string, territory: string, sector: number, amount: number, elite: number) => {
    const homeworldSources = game.homeworlds ? nativeShipmentSources(viewGame(game, actor), amount, elite) : undefined;
    assert.ok(!game.homeworlds || homeworldSources);
    const before = structuredClone(game), step: IndependentDiscoveryBattleStep = { actor, action: {
      type: 'ship', territory, sector, amount, elite, allyPayment: 0,
      ...(homeworldSources ? { homeworldSources } : {}),
    } };
    act(actor, step.action); reach(independentDiscoveryBattleClean);
    shipments.push({ before, step, after: structuredClone(game) });
  };
  ship('emperor', parent.territory, parent.sector, 3, game.advanced ? 2 : 0);
  reach(state => state.phase === 7 && independentDiscoveryBattleClean(state));
  const collection = structuredClone(game), finder = viewGame(game, 'emperor').discoveries!;
  assert.ok(finder.canInspect.includes(token), 'The actual parent-board finder must inspect the still-hidden original token');
  const inspection: IndependentDiscoveryBattleStep = { actor: 'emperor', action: { type: 'discovery', token, reveal: false } };
  act(inspection.actor, inspection.action);
  const inspected = structuredClone(game);
  assert.ok(viewGame(game, 'emperor').discoveries!.canReveal.includes(token));
  const reveal: IndependentDiscoveryBattleStep = { actor: 'emperor', action: { type: 'discovery', token, reveal: true } };
  act(reveal.actor, reveal.action);
  const revealed = structuredClone(game);
  reach(state => state.turn === 2 && state.decision?.kind === 'discoveryEntry' &&
    state.decision.player === 'emperor' && !state.response && !state.phaseOpening);
  const beforeEntry = structuredClone(game), entryView = viewGame(game, 'emperor');
  const entryAction = discoveryEntryMoveAction(entryView, entryView.discoveryEntry!.sources); assert.ok(entryAction);
  const entry: IndependentDiscoveryBattleStep = { actor: 'emperor', action: entryAction };
  act(entry.actor, entry.action); reach(independentDiscoveryBattleClean);
  const afterEntry = structuredClone(game);
  orderSpice(game, false);
  reach(state => state.turn === 2 && state.phase === 5 && state.active === 'guild' && independentDiscoveryBattleClean(state));
  ship('guild', JACURUTU_SIETCH, 0, 2, 0);
  reach(state => state.phase === 6 && !!state.active && independentDiscoveryBattleClean(state));
  const beforeBattle = structuredClone(game), choice = viewGame(game, game.active!).battleChoices
    .find(choice => choice.territory === JACURUTU_SIETCH &&
      [choice.attacker, choice.defender].includes('emperor') && [choice.attacker, choice.defender].includes('guild'));
  assert.ok(choice);
  const battle: IndependentDiscoveryBattleStep = { actor: choice.chooser, action: {
    type: 'chooseBattle', territory: JACURUTU_SIETCH, target: choice.chooser === 'emperor' ? 'guild' : 'emperor',
  } };
  act(battle.actor, battle.action);
  reach(state => !!state.battle && !state.battle.preparation && state.battle.preLeader?.closed !== false && independentDiscoveryBattleClean(state));
  const leaders = (actor: string) => independentDiscoveryBattlePlayer(game, actor).leaders.filter(leader =>
    !leader.dead && !leader.usedAt && !game.leaderSkills?.assignments.some(assignment => assignment.leader === leader.id));
  const leader = leaders('emperor').sort((a, b) => b.strength - a.strength)[0], enemy = leaders('guild').sort((a, b) => a.strength - b.strength)[0];
  assert.ok(leader && enemy);
  const fee = viewGame(game, 'emperor').battle!.reinforcements!;
  assert.ok(fee && !fee.blocked);
  const sources = fee.homeworldSources?.[0]; assert.ok(!game.homeworlds || sources);
  const plans: IndependentDiscoveryBattleStep[] = [
    { actor: 'emperor', action: { type: 'battlePlan', leader: leader.id, dial: 1, support: game.advanced ? 1 : 0,
      weapon: REINFORCEMENTS_CARD, defense: HARASS_WITHDRAW_CARD,
      ...(sources ? { reinforcementsSources: sources } : {}) } },
    { actor: 'guild', action: { type: 'battlePlan', leader: enemy.id, dial: 0, support: 0 } },
  ];
  const nested = `${JACURUTU_SIETCH}:0`, returns = { [nested]: { normal: game.advanced ? 0 : 2, elite: game.advanced ? 2 : 0 } };
  return { ...source, game, afterSetup, placed, token, parent, purchased, shipments, collection,
    inspection, inspected, reveal, revealed, beforeEntry, entry, afterEntry, beforeBattle, battle,
    plans, returns, fee: { normal: fee.normal, elite: fee.elite }, sources, nested, actions,
    owner: 'emperor', opponent: 'guild', territory: JACURUTU_SIETCH,
    staging: ['Only unopened original card lots, Discovery supply/scalar lotteries and Spice positions are selected. Native host, setup, paid shipments, reveal, free entry and battle remain real actions. Nexus is selected but no held Nexus card or effect is asserted.'] };
}
export type IndependentDiscoveryBattleFixture = ReturnType<typeof createIndependentDiscoveryBattleFixture>;

/** Seal the real original plans and finish typed Harass, physical fee and
 * casualty settlement. An explicit allocation uses the submitted owner pool. */
export function completeIndependentDiscoveryBattle(fixture: IndependentDiscoveryBattleFixture) {
  const actions: IndependentDiscoveryBattleStep[] = [];
  let game = structuredClone(fixture.game);
  for (const step of fixture.plans) {
    game = actIndependentDiscoveryBattle(game, step.actor, step.action, actions);
    game = advanceIndependentDiscoveryBattle(game, state => !state.response && !state.phaseOpening &&
      (!state.decision || state.decision.kind === 'harassWithdraw') && !state.pendingGuildBetrayal &&
      !state.pendingNexusIxianBetrayal && !state.pendingNexusHarkonnenBetrayal, actions);
  }
  assert.ok(game.battle?.revealed);
  const revealed = structuredClone(game);
  if (game.decision?.kind === 'harassWithdraw') game = actIndependentDiscoveryBattle(game, game.decision.player,
    { type: 'decision', event: game.decision.event, returns: fixture.returns }, actions);
  game = advanceIndependentDiscoveryBattle(game, state => !state.battle && independentDiscoveryBattleClean(state), actions);
  return { game, revealed, actions };
}

/** The paid Recruits is used only after the real battle supplied physical
 * casualties. Continue the original next-turn clock before its free revival. */
export function reviveIndependentDiscoveryBattle(fixture: IndependentDiscoveryBattleFixture, afterBattle: Game) {
  const actions: IndependentDiscoveryBattleStep[] = [];
  let game = structuredClone(afterBattle);
  // Select only the still-unopened next-turn land replacements before the
  // current turn closes; no played blow, discard or encounter is replaced.
  orderSpice(game, false);
  game = advanceIndependentDiscoveryBattle(game, state => state.turn === fixture.game.turn + 1 &&
    state.phase === 4 && independentDiscoveryBattleClean(state), actions);
  const before = structuredClone(game), play = recruitsPlayAction(viewGame(game, fixture.owner).recruitsPreview);
  assert.ok(play, 'The genuinely purchased Recruits needs its original Revival control');
  game = actIndependentDiscoveryBattle(game, fixture.owner, play, actions);
  game = advanceIndependentDiscoveryBattle(game, independentDiscoveryBattleClean, actions);
  const activated = structuredClone(game), revival: Action = { type: 'revive', amount: 2, elite: 0 };
  game = actIndependentDiscoveryBattle(game, fixture.owner, revival, actions);
  game = advanceIndependentDiscoveryBattle(game, independentDiscoveryBattleClean, actions);
  const revived = structuredClone(game);
  game = advanceIndependentDiscoveryBattle(game, state => state.phase === 5 && independentDiscoveryBattleClean(state), actions);
  return { game, before, activated, revived, play, revival, actions };
}

/** Minimal legal positive native card plans from all four real owner views. */
export function smokeIndependentDiscoveryBattle(options: Partial<IndependentDiscoveryBattleOptions> = {}) {
  const fixture = createIndependentDiscoveryBattleFixture(options);
  return (['Easy', 'Medium', 'Hard', 'Brutal'] as const).map(difficulty => {
    const view = viewGame(fixture.game, fixture.owner);
    view.players.find(player => player.id === fixture.owner)!.bot = difficulty;
    const action = botActions(view).find(action => action.type === 'battlePlan' && Number(action.dial) > 0 &&
      (action.weapon === REINFORCEMENTS_CARD || action.defense === REINFORCEMENTS_CARD));
    assert.ok(action, `${difficulty} must retain a positive native Reinforcements plan at the nested site`);
    assert.ok(!fixture.game.homeworlds || action.reinforcementsSources);
    const game = actIndependentDiscoveryBattle(structuredClone(fixture.game), fixture.owner, action);
    return { difficulty, plan: game.battle!.plans[fixture.owner], sources: action.reinforcementsSources };
  });
}
