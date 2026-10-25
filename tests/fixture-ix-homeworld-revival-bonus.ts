import assert from 'node:assert/strict';
import { createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { MOBILE_LOCATION } from '../game/board';
import { homeworldContext, homeworldGameIntegrity } from '../game/homeworld-game';
import { homeworldForceGroups } from '../game/homeworld-custody';
import { homeworldPopulations } from '../game/homeworld-population';
import { nativeShipmentSources } from '../game/homeworld-options';
import { actTruthMovement } from './fixture-truth-movement';
import { nextRicheseStrongholdsNativeStep } from './fixture-richese-strongholds';

export type IxHomeworldRevivalBonusStep = { actor: string; action: Action };
export type IxHomeworldRevivalBonusTransition = { before: Game; steps: IxHomeworldRevivalBonusStep[]; after: Game };
export const actIxHomeworldRevivalBonus = actTruthMovement;
export const ixHomeworldRevivalBonusPlayer = (game: Game, actor = 'ixians') => {
  const player = game.players.find(player => player.id === actor); assert.ok(player); return player;
};
export const ixHomeworldRevivalBonusClean = (game: Game) => !game.phaseOpening && !game.response &&
  !game.decision && !game.truthtrance && !game.pendingTreacheryDiscard && !game.pendingRevival;
export const ixHomeworldRevivalBonusCards = (game: Game) => {
  const cards = [...game.deck, ...game.discard, ...(game.ixSetupCards ?? []),
    ...(game.auction?.cards.slice(game.auction.index + (game.currentAuctionSale ? 1 : 0)) ?? []),
    ...game.players.flatMap(player => player.hand)];
  const ids = cards.map(card => card.id).sort();
  assert.equal(new Set(ids).size, ids.length, 'Every original Treachery Card retains one physical slot');
  return ids;
};
export function ixHomeworldRevivalBonusInventory(game: Game) {
  homeworldGameIntegrity(game);
  const sum = (counts: Record<string, number>) => Object.values(counts).reduce((total, count) => total + count, 0);
  for (const player of game.players) {
    const visitors = Object.values(game.homeworlds!.custody!.visitors)
      .map(groups => groups[player.id] ?? { normal: 0, elite: 0 });
    assert.equal(player.reserves + player.tanks + sum(player.forces) +
      visitors.reduce((total, group) => total + group.normal + group.elite, 0), 20);
    if (player.elites) assert.equal(player.elites.reserves + player.elites.tanks + sum(player.elites.forces) +
      visitors.reduce((total, group) => total + group.elite, 0), player.faction === 'ixians' ? 7 : 5);
  }
  return ixHomeworldRevivalBonusCards(game);
}
export const ixHomeworldRevivalBonusPopulation = (game: Game, owner = 'ixians') => {
  const home = homeworldPopulations(homeworldContext(game), game.homeworlds!.custody!)
    .find(home => home.native === owner && home.card === 'ix'); assert.ok(home); return home;
};
export const ixHomeworldRevivalBonusNativeForces = (game: Game, owner = 'ixians') => {
  const home = homeworldForceGroups(homeworldContext(game), game.homeworlds!.custody!)
    .find(home => home.native === owner && !home.secondary); assert.ok(home); return home.forces[owner];
};

/** Only original native controls. Private battle plans and revival declarations
 * remain explicit; the original Caladan winner may decline its extra force. */
export function nextIxHomeworldRevivalBonus(game: Game): IxHomeworldRevivalBonusStep | null {
  if (game.truthtrance) return null;
  if (!game.phaseOpening && !game.response && !game.pendingTreacheryDiscard) {
    const decision = game.decision;
    if (decision?.kind === 'mobileStronghold') return { actor: decision.player, action: decision.placement
      ? { type: 'decision', location: 'rock_outcroppings:14' } : { type: 'decision', decline: true } };
    if (decision?.kind === 'ixAuction') {
      const card = game.ixAuction!.cards[0]; assert.ok(card);
      return { actor: decision.player, action: { type: 'decision', card: card.id, position: 'bottom' } };
    }
    if (decision?.kind === 'caladanReinforcement')
      return { actor: decision.player, action: { type: 'decision', event: decision.event, decline: true } };
    if (decision?.kind === 'fullPlanOffer' || decision?.kind === 'revivalStop')
      return { actor: decision.player, action: { type: 'decision', decline: true } };
  }
  return nextRicheseStrongholdsNativeStep(game);
}
export const nextIxHomeworldRevivalBonusNativeStep = nextIxHomeworldRevivalBonus;
export function advanceIxHomeworldRevivalBonus(game: Game, until: (state: Game) => boolean,
  actions: IxHomeworldRevivalBonusStep[] = []): Game {
  for (let count = 0; count < 1800; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The original Ixian chronology ended before its requested control');
    const next = nextIxHomeworldRevivalBonus(game);
    assert.ok(next, `Choose the original private plan or Truthtrance at ${game.turn}/${game.phase}/${game.decision?.kind}`);
    game = actIxHomeworldRevivalBonus(game, next.actor, next.action, actions);
  }
  throw Error('The genuine Ixian Homeworld source did not reach its finite boundary');
}
export function passIxHomeworldRevivalBonus(game: Game, actions: IxHomeworldRevivalBonusStep[] = []): Game {
  for (let count = 0; game.response && count < 60; count++) {
    const actor = game.players.find(player => !game.response!.passed.includes(player.id)); assert.ok(actor);
    game = actIxHomeworldRevivalBonus(game, actor.id, { type: 'passResponse' }, actions);
  }
  assert.ok(!game.response); return game;
}
export function finishIxHomeworldRevivalBonus(game: Game, actions: IxHomeworldRevivalBonusStep[] = []): Game {
  return advanceIxHomeworldRevivalBonus(game, state => state.phase === 5 && ixHomeworldRevivalBonusClean(state), actions);
}

/** Actual public Basic/Advanced Ix/Atreides/Emperor with Homeworlds. Native
 * first-Storm HMS setup retains its six counters. A paid five-force invasion
 * then really loses one Cyborg and four Suboids while native Ix remains HIGH.
 * Stop at the actual next Revival, before the caller's paid-Cyborg request. */
export function createIxHomeworldRevivalBonusFixture(options: {
  advanced?: boolean; ghola?: boolean; priorFree?: boolean;
} = {}) {
  const advanced = options.advanced ?? false, owner = 'ixians', opponent = 'atreides', observer = 'emperor';
  let game = createGame('IXHOMEWORLDREVIVALBONUS', newPlayer(owner, 'Ixians', 'ixians'), advanced, ['ix']);
  joinGame(game, newPlayer(opponent, 'Atreides', 'atreides'));
  joinGame(game, newPlayer(observer, 'Emperor', 'emperor'));
  const initial = structuredClone(game), actions: IxHomeworldRevivalBonusStep[] = [];
  const act = (actor: string, action: Action) => { game = actIxHomeworldRevivalBonus(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceIxHomeworldRevivalBonus(game, until, actions); };
  const transition = (run: () => void): IxHomeworldRevivalBonusTransition => {
    const before = structuredClone(game), start = actions.length; run();
    return { before, steps: structuredClone(actions.slice(start)), after: structuredClone(game) };
  };
  const enableHomeworlds = transition(() => { act(game.host, { type: 'homeworlds', enabled: true }); });
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game); act(game.host, advanced ? { type: 'start', advancedPreview: true } : { type: 'start' });
  const setup = structuredClone(game);
  assert.equal(game.status, 'setup'); assert.equal(game.advanced, advanced);
  assert.deepEqual(game.expansions, ['ix']); assert.ok(game.homeworlds);
  assert.ok(!game.nexusCards && !game.leaderSkills && !game.techTokens && !game.strongholdCards &&
    !game.discoveryEnabled && !game.ecazTreachery);
  assert.ok(game.players.every(player => !player.hand.length));
  const originalInventory = ixHomeworldRevivalBonusCards(game); assert.equal(originalInventory.length, 47);
  const ordinary = game.deck.filter(card => ['projectile', 'poison', 'shield', 'snooper'].includes(card.kind)).slice(0, 3);
  assert.equal(ordinary.length, 3);
  const gholaCard = options.ghola ? game.deck.find(card => card.effect === 'ghola') : null;
  assert.ok(!options.ghola || gholaCard);
  const selected = [gholaCard ?? ordinary[0], ordinary[1], ordinary[2]];
  const dealOrder = selected.map((card, position) => {
    const from = game.deck.findIndex(candidate => candidate.id === card.id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { position, from, card: card.id };
  });
  const beforeStartingDeal = structuredClone(game);
  reach(state => !state.response && !state.phaseOpening && state.decision?.kind === 'ixSetup');
  const beforeDraft = structuredClone(game);
  const startingDraft = transition(() => { act(owner, { type: 'decision', card: selected[0].id }); });
  reach(state => state.status === 'playing');
  const afterSetup = structuredClone(game);
  assert.deepEqual(game.players.flatMap(player => player.hand.map(card => card.id)), selected.map(card => card.id));
  assert.equal(ixHomeworldRevivalBonusPlayer(game, owner).forces[MOBILE_LOCATION], 6);
  assert.equal(ixHomeworldRevivalBonusPlayer(game, owner).elites?.forces[MOBILE_LOCATION], 3);
  assert.equal(ixHomeworldRevivalBonusPlayer(game, owner).reserves, 14);
  assert.equal(ixHomeworldRevivalBonusPopulation(game, owner).side, 'high');
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const spiceOrder = [0, 1, 2, 3].map(position => {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card && !card.discovery);
    assert.ok(from >= position); const card = game.spiceDeck.splice(from, 1)[0];
    game.spiceDeck.splice(position, 0, card); return { position, from, card: structuredClone(card) };
  });
  assert.deepEqual(game.spiceDeck.map(card => JSON.stringify(card)).sort(), originalSpice);
  reach(state => !state.response && !state.phaseOpening && state.decision?.kind === 'mobileStronghold' && state.decision.placement);
  const hmsPlacement = transition(() => { act(owner, { type: 'decision', location: 'rock_outcroppings:14' }); });
  reach(state => state.turn === 1 && state.phase === 5 && state.active === owner && ixHomeworldRevivalBonusClean(state));
  const beforeShipment = structuredClone(game), homeworldSources = nativeShipmentSources(viewGame(game, owner), 5, 1);
  assert.ok(homeworldSources);
  const shipmentStep: IxHomeworldRevivalBonusStep = { actor: owner, action: {
    type: 'ship', amount: 5, elite: 1, territory: 'arrakeen', sector: 10, allyPayment: 0, homeworldSources,
  } };
  const shipment = transition(() => { act(shipmentStep.actor, shipmentStep.action); reach(ixHomeworldRevivalBonusClean); });
  assert.equal(ixHomeworldRevivalBonusPlayer(beforeShipment, owner).spice - ixHomeworldRevivalBonusPlayer(game, owner).spice, 5);
  assert.equal(ixHomeworldRevivalBonusPlayer(game, owner).forces['arrakeen:10'], 5);
  assert.equal(ixHomeworldRevivalBonusPlayer(game, owner).elites?.forces['arrakeen:10'], 1);
  assert.equal(ixHomeworldRevivalBonusPopulation(game, owner).population, 9);
  reach(state => state.phase === 6 && ixHomeworldRevivalBonusClean(state) && !!state.active);
  const beforeBattle = structuredClone(game), choice = viewGame(game, game.active!).battleChoices
    .find(choice => choice.territory === 'arrakeen'); assert.ok(choice);
  const battleStep: IxHomeworldRevivalBonusStep = { actor: choice.chooser, action: {
    type: 'chooseBattle', territory: 'arrakeen',
    target: choice.attacker === choice.chooser ? choice.defender : choice.attacker,
  } };
  act(battleStep.actor, battleStep.action);
  const beforePreparation = structuredClone(game);
  reach(state => !!state.battle && ixHomeworldRevivalBonusClean(state) && !state.battle.preparation && state.battle.preLeader?.closed !== false);
  const beforePlans = structuredClone(game);
  const plans: IxHomeworldRevivalBonusStep[] = [
    { actor: owner, action: { type: 'battlePlan', leader: 'ixians-4', dial: 0, support: 0, weapon: null, defense: null } },
    { actor: opponent, action: { type: 'battlePlan', leader: 'atreides-0', dial: 0, support: 0, weapon: null, defense: null } },
  ];
  for (const step of plans) act(step.actor, step.action);
  const revealed = structuredClone(game);
  reach(state => !state.battle && ixHomeworldRevivalBonusClean(state));
  const afterBattle = structuredClone(game);
  assert.equal(game.lastBattleContext?.winner, opponent);
  assert.equal(ixHomeworldRevivalBonusPlayer(game, owner).tanks, 5);
  assert.equal(ixHomeworldRevivalBonusPlayer(game, owner).elites?.tanks, 1);
  assert.equal(ixHomeworldRevivalBonusPlayer(game, opponent).tanks, 0);
  assert.equal(ixHomeworldRevivalBonusPopulation(game, owner).side, 'high');
  reach(state => state.turn === 2 && state.phase === 4 && ixHomeworldRevivalBonusClean(state));
  const beforePriorFree = structuredClone(game);
  const priorFree = options.priorFree ? transition(() => {
    act(owner, { type: 'revive', amount: 1, elite: 0 }); reach(ixHomeworldRevivalBonusClean);
  }) : null;
  const paidAction: Action = options.priorFree
    ? { type: 'revive', amount: 2, elite: 1, freeElite: 0 }
    : { type: 'revive', amount: 3, elite: 1, freeElite: 0 };
  const freeCyborg: Action = { type: 'revive', amount: 1, elite: 1, freeElite: 1 };
  const suboidAction: Action = { type: 'revive', amount: 2, elite: 0, freeElite: 0 };
  const gholaAction: Action | null = gholaCard ? { type: 'card', card: gholaCard.id, amount: 1, elite: 1 } : null;
  assert.equal(ixHomeworldRevivalBonusPlayer(game, owner).tanks, options.priorFree ? 4 : 5);
  assert.equal(ixHomeworldRevivalBonusPlayer(game, owner).elites?.tanks, 1);
  assert.equal(ixHomeworldRevivalBonusPlayer(game, owner).revived, options.priorFree ? 1 : 0);
  assert.equal(ixHomeworldRevivalBonusPlayer(game, owner).forces[MOBILE_LOCATION], 6);
  assert.deepEqual(ixHomeworldRevivalBonusInventory(game), originalInventory);
  return { game, source: structuredClone(game), initial, enableHomeworlds, lobby, setup, beforeStartingDeal,
    beforeDraft, startingDraft, afterSetup, hmsPlacement, beforeShipment, shipmentStep, shipment,
    beforeBattle, battleStep, beforePreparation, beforePlans, plans, planSteps: plans, revealed, afterBattle,
    beforePriorFree, priorFree, advanced, owner, ixians: owner, opponent, atreides: opponent, observer, emperor: observer,
    territory: 'arrakeen', location: 'arrakeen:10', event: game.lastBattleContext!.event,
    originalInventory, originalCards: originalInventory, originalSpice, dealOrder, spiceOrder,
    action: paidAction, paidAction, freeCyborg, suboidAction, ghola: gholaCard?.id ?? null, gholaAction,
    amount: options.priorFree ? 2 : 3, elite: 1, freeElite: 0, cost: 5, bonus: 2,
    actions, steps: actions, sourceActionCount: actions.length,
    staging: [
      'Actual public Basic/Advanced Ixians/Atreides/Emperor lobby enables only Homeworlds, then performs native ready/start with the original Ix47 deck. No optional Skills, Nexus, Discovery, Tech or Stronghold cards are introduced.',
      'Choose only original scalar shuffles, three unopened Treachery positions and four unopened ordinary Spice positions. Original private Traitor choices and Ixian three-card starting draft really occur. The requested Ghola variant selects the actual original Ghola in that draft; the default selects an ordinary card so existing normal bot revival candidates remain visible.',
      'Native Ixian setup puts three Cyborgs and three Suboids in the HMS and fourteen counters at Ix. Complete the first actual safe Storm and place the HMS at Rock Outcroppings14 through its original decision, then actual Spice/Charity/Bidding/Revival controls.',
      'Ixians pay five own spice to ship one original Cyborg and four original Suboids from the explicit native Homeworld pool into Atreides’ native ten Arrakeen counters. Ix population becomes nine and stays HIGH. Actual movement endings, native battle choice, original preparation, two zero-dial unarmed plans and declined Traitors produce the Atreides victory. All five invaded counters actually enter Tanks; Atreides loses none and declines its optional Caladan reinforcement.',
      'Real Collection/Mentat, second Storm/Spice/Charity/Bidding reach clean turn-two Revival. The HMS and its original six typed counters stay intact. No phase, force, wallet, casualty, hand, revival ledger, occupation or receipt is installed.',
      options.priorFree
        ? 'The optional prior-free branch really returns one ordinary Suboid before the source. Its base/free ledgers remain recorded; the returned paid request uses the two remaining ordinary slots and still has two physical bonus Suboids available.'
        : 'Stop before any return. The original paid request is amount3/elite1/freeElite0: one ordinary free Suboid, one paid Suboid and one paid Cyborg for five spice. The requested bonus is additional to its three ordinary returns, using the two other real Suboid Tanks under the root’s explicitly provisional quota/shortage composition.',
    ],
  };
}
export type IxHomeworldRevivalBonusFixture = ReturnType<typeof createIxHomeworldRevivalBonusFixture>;

export function reviveIxHomeworldRevivalBonus(source: Game, fixture: IxHomeworldRevivalBonusFixture,
  action: Action = fixture.action, actions: IxHomeworldRevivalBonusStep[] = []) {
  const before = structuredClone(source), start = actions.length;
  let game = actIxHomeworldRevivalBonus(source, fixture.owner, action, actions);
  const requested = structuredClone(game);
  game = advanceIxHomeworldRevivalBonus(game, ixHomeworldRevivalBonusClean, actions);
  return { game, before, requested, after: structuredClone(game), steps: structuredClone(actions.slice(start)) };
}
