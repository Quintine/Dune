import assert from 'node:assert/strict';
import { applyAction, createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { nextRicheseStrongholdsNativeStep } from './fixture-richese-strongholds';

export type AtreidesFullPlanWindowStep = { actor: string; action: Action };
export type AtreidesFullPlanWindowTransition = {
  before: Game; steps: AtreidesFullPlanWindowStep[]; after: Game;
};
export const atreidesFullPlanWindowPlayer = (game: Game, id: string) => {
  const player = game.players.find(player => player.id === id); assert.ok(player); return player;
};
export const atreidesFullPlanWindowClean = (game: Game) => !game.phaseOpening && !game.response &&
  !game.decision && !game.truthtrance && !game.pendingTreacheryDiscard && !game.pendingRevival;
export const atreidesFullPlanWindowInventory = (game: Game) => {
  const cards = [...game.deck, ...game.discard, ...game.players.flatMap(player => player.hand),
    ...(game.auction?.cards.slice(game.auction.index + (game.currentAuctionSale ? 1 : 0)) ?? [])];
  const ids = cards.map(card => card.id).sort();
  assert.equal(new Set(ids).size, ids.length, 'Original physical Treachery Cards retain distinct current slots');
  return ids;
};

/** Choose original scalar shuffle order only. UUIDs and every other native byte
 * source remain untouched; no played cards, forces or sealed plans are replaced. */
function originalScalarOrder<T>(run: () => T): T {
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  const original = crypto.getRandomValues.bind(crypto);
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    if (array instanceof Uint32Array && array.length === 1) array[0] = 0xffffffff;
    else Reflect.apply(original, crypto, [array]);
    return array;
  };
  try { return run(); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}
export function actAtreidesFullPlanWindow(game: Game, actor: string, action: Action,
  actions: AtreidesFullPlanWindowStep[] = []): Game {
  const next = originalScalarOrder(() => applyAction(game, actor, action));
  actions.push({ actor, action: structuredClone(action) }); return next;
}
/** Native continuation declines optional powers, including the special offer.
 * It never spends Karama or chooses a combatant's private Battle Plan. */
export function nextAtreidesFullPlanWindowStep(game: Game): AtreidesFullPlanWindowStep | null {
  if (!game.phaseOpening && !game.response && !game.pendingTreacheryDiscard) {
    if (game.decision?.kind === 'fullPlanOffer')
      return { actor: game.decision.player, action: { type: 'decision', decline: true } };
    if (game.decision?.kind === 'fullPlanRead')
      return { actor: game.decision.player, action: { type: 'decision', continue: true } };
    if (game.decision?.kind === 'guildTiming')
      return { actor: game.decision.player, action: { type: 'decision', take: false } };
  }
  return nextRicheseStrongholdsNativeStep(game);
}
export function advanceAtreidesFullPlanWindow(game: Game, until: (state: Game) => boolean,
  actions: AtreidesFullPlanWindowStep[] = []): Game {
  for (let count = 0; count < 1600; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The genuine full-plan chronology ended before its requested boundary');
    const next = nextAtreidesFullPlanWindowStep(game);
    assert.ok(next, `Supply the original private plan at ${game.status}/${game.turn}/${game.phase}/${game.decision?.kind}`);
    game = actAtreidesFullPlanWindow(game, next.actor, next.action, actions);
  }
  throw Error('The native full-plan chronology did not reach its finite boundary');
}
export function passAtreidesFullPlanWindowResponses(game: Game,
  actions: AtreidesFullPlanWindowStep[] = []): Game {
  for (let count = 0; game.response && count < 60; count++) {
    const actor = game.players.find(player => !game.response!.passed.includes(player.id)); assert.ok(actor);
    game = actAtreidesFullPlanWindow(game, actor.id, { type: 'passResponse' }, actions);
  }
  assert.ok(!game.response); return game;
}
export function cloneAtreidesFullPlanWindow(game: Game): Game {
  assert.ok(!game.phaseOpening && !game.response && !game.truthtrance && !game.pendingTreacheryDiscard,
    'Clone an actual available full-plan choice boundary');
  return structuredClone(game);
}

/** Fresh public Advanced classic setup. Only original undealt Treachery/Spice
 * positions and scalar shuffle choices are selected. An actual one-spice normal
 * Shield purchase, paid shipments and a ground move create the native battle.
 * The returned game has actually declined the original special offer, without
 * committing either private plan or spending its real held Karama. */
export function createAtreidesFullPlanWindowFixture() {
  const owner = 'atreides', opponent = 'emperor', guild = 'guild';
  let game = createGame('ATREIDESFULLPLANWINDOW', newPlayer(owner, 'Atreides', 'atreides'), true);
  joinGame(game, newPlayer(opponent, 'Emperor', 'emperor'));
  joinGame(game, newPlayer(guild, 'Guild', 'guild'));
  const initial = structuredClone(game), actions: AtreidesFullPlanWindowStep[] = [];
  const act = (actor: string, action: Action) => { game = actAtreidesFullPlanWindow(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceAtreidesFullPlanWindow(game, until, actions); };
  const transition = (run: () => void): AtreidesFullPlanWindowTransition => {
    const before = structuredClone(game), start = actions.length; run();
    return { before, steps: structuredClone(actions.slice(start)), after: structuredClone(game) };
  };
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game); act(game.host, { type: 'start', advancedPreview: true });
  const setup = structuredClone(game);
  assert.equal(game.status, 'setup'); assert.equal(game.advanced, true);
  assert.equal(game.expansions.length, 0);
  assert.ok(!game.homeworlds && !game.nexusCards && !game.leaderSkills && !game.techTokens &&
    !game.strongholdCards && !game.discoveryEnabled && !game.ecazTreachery);
  assert.ok(game.players.every(player => player.hand.length === 0));
  const originalInventory = atreidesFullPlanWindowInventory(game);
  const karama = game.deck.find(card => card.effect === 'karama');
  const weapon = game.deck.find(card => card.kind === 'projectile');
  const defense = game.deck.find(card => card.kind === 'shield');
  const guildCard = game.deck.find(card => card.kind === 'snooper');
  assert.ok(karama && weapon && defense && guildCard);
  const selected = [karama, weapon, guildCard, defense];
  const dealOrder = selected.map((card, position) => {
    const from = game.deck.findIndex(candidate => candidate.id === card.id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { position, from, card: card.id };
  });
  const beforeStartingDeal = structuredClone(game);
  reach(state => state.status === 'playing');
  const afterSetup = structuredClone(game);
  assert.deepEqual(game.players.flatMap(player => player.hand.map(card => card.id)), selected.slice(0, 3).map(card => card.id));
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const spiceOrder = [0, 1].map(position => {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card && !card.discovery);
    assert.ok(from >= position); const card = game.spiceDeck.splice(from, 1)[0];
    game.spiceDeck.splice(position, 0, card); return { position, from, card: structuredClone(card) };
  });
  assert.deepEqual(game.spiceDeck.map(card => JSON.stringify(card)).sort(), originalSpice);
  reach(state => state.phase === 3 && atreidesFullPlanWindowClean(state) &&
    state.auction?.cards[state.auction.index]?.id === defense.id && state.auction.active === owner);
  const acquisition = transition(() => {
    act(owner, { type: 'bid', amount: 1, allyPayment: 0 });
    reach(state => atreidesFullPlanWindowClean(state) && atreidesFullPlanWindowPlayer(state, owner).hand.some(card => card.id === defense.id));
  });
  assert.equal(atreidesFullPlanWindowPlayer(acquisition.before, owner).spice - atreidesFullPlanWindowPlayer(game, owner).spice, 1);
  reach(state => state.phase === 5 && state.active === owner && atreidesFullPlanWindowClean(state));
  const ownerShipment = transition(() => {
    act(owner, { type: 'ship', territory: 'imperial_basin', sector: 10, amount: 2, elite: 0, allyPayment: 0 });
    reach(atreidesFullPlanWindowClean);
  });
  assert.equal(atreidesFullPlanWindowPlayer(ownerShipment.before, owner).spice - atreidesFullPlanWindowPlayer(game, owner).spice, 4);
  const ownerMovement = transition(() => {
    act(owner, { type: 'move', from: 'arrakeen:10', territory: 'imperial_basin', sector: 10, amount: 2 });
    reach(atreidesFullPlanWindowClean);
  });
  assert.equal(atreidesFullPlanWindowPlayer(game, owner).forces['imperial_basin:10'], 4);
  act(owner, { type: 'endMovement' });
  reach(state => state.phase === 5 && state.active === opponent && atreidesFullPlanWindowClean(state));
  const opponentShipment = transition(() => {
    act(opponent, { type: 'ship', territory: 'imperial_basin', sector: 10, amount: 2, elite: 0, allyPayment: 0 });
    reach(atreidesFullPlanWindowClean);
  });
  assert.equal(atreidesFullPlanWindowPlayer(opponentShipment.before, opponent).spice - atreidesFullPlanWindowPlayer(game, opponent).spice, 4);
  reach(state => state.phase === 6 && atreidesFullPlanWindowClean(state) && !!state.active);
  const beforeBattle = structuredClone(game), choice = viewGame(game, game.active!).battleChoices
    .find(choice => choice.territory === 'imperial_basin'); assert.ok(choice);
  const battleStep: AtreidesFullPlanWindowStep = { actor: choice.chooser,
    action: { type: 'chooseBattle', territory: 'imperial_basin',
      target: choice.attacker === choice.chooser ? choice.defender : choice.attacker } };
  act(battleStep.actor, battleStep.action);
  const beforePreparation = structuredClone(game);
  reach(state => !state.response && !state.phaseOpening && state.decision?.kind === 'fullPlanOffer');
  const offer = structuredClone(game), offerActionCount = actions.length;
  assert.equal(game.decision?.player, owner);
  assert.ok(game.battle && !game.battle.revealed && Object.keys(game.battle.plans).length === 0);
  const declineStep: AtreidesFullPlanWindowStep = { actor: owner, action: { type: 'decision', decline: true } };
  act(declineStep.actor, declineStep.action);
  const declined = structuredClone(game);
  assert.ok(atreidesFullPlanWindowClean(game) && game.battle && !game.battle.revealed);
  assert.equal(Object.keys(game.battle.plans).length, 0);
  assert.ok(!atreidesFullPlanWindowPlayer(game, owner).specialKaramaUsed);
  assert.ok(atreidesFullPlanWindowPlayer(game, owner).hand.some(card => card.id === karama.id));
  assert.deepEqual(atreidesFullPlanWindowInventory(game), originalInventory);
  const ownLeader = atreidesFullPlanWindowPlayer(game, owner).leaders.filter(leader => !leader.dead && !leader.usedAt)
    .sort((a, b) => b.strength - a.strength || a.id.localeCompare(b.id))[0];
  const opposingLeader = atreidesFullPlanWindowPlayer(game, opponent).leaders.filter(leader => !leader.dead && !leader.usedAt)
    .sort((a, b) => a.strength - b.strength || a.id.localeCompare(b.id))[0];
  assert.ok(ownLeader && opposingLeader);
  const ownPlan: Action = { type: 'battlePlan', dial: 1, support: 1, leader: ownLeader.id,
    weapon: null, defense: defense.id };
  const opponentPlan: Action = { type: 'battlePlan', dial: 1, support: 1, leader: opposingLeader.id,
    weapon: weapon.id, defense: null };
  const inspect: Action = { type: 'card', mode: 'special', card: karama.id, target: opponent };
  return { game, initial, lobby, setup, beforeStartingDeal, afterSetup, acquisition,
    ownerShipment, ownerMovement, opponentShipment, beforeBattle, battleStep, beforePreparation,
    offer, originalOffer: offer, declined, declineStep, owner, atreides: owner, opponent, emperor: opponent, guild,
    territory: 'imperial_basin', sector: 10, location: 'imperial_basin:10',
    karama: karama.id, weapon: weapon.id, defense: defense.id,
    ownPlan, opponentPlan, targetPlan: opponentPlan, inspect,
    ownPlanStep: { actor: owner, action: ownPlan } satisfies AtreidesFullPlanWindowStep,
    opponentPlanStep: { actor: opponent, action: opponentPlan } satisfies AtreidesFullPlanWindowStep,
    inspectStep: { actor: owner, action: inspect } satisfies AtreidesFullPlanWindowStep,
    actions, offerActions: structuredClone(actions.slice(0, offerActionCount)), offerActionCount,
    sourceActionCount: actions.length, originalInventory, originalSpice, dealOrder, spiceOrder,
    staging: [
      'Actual public native Advanced Atreides/Emperor/Guild ready/startPreview and private Traitor choices. Original scalar shuffle order keeps circles/deals reproducible; UUID and non-scalar entropy remain native.',
      'Select only four original unopened Treachery positions: Atreides Karama, Emperor projectile weapon, Guild Snooper, then the first normal auction Shield. Select two original unopened ordinary Spice positions before the native dual Spice Blow.',
      'Actually complete first Storm, dual Spice, Charity and native auction controls. Atreides wins the original Shield lot for one own spice and explicitly pays instead of using its held Karama.',
      'Atreides actually pays four to ship two reserves to Imperial Basin10, then really moves two original Arrakeen counters into that group. Emperor actually pays four to ship two normal reserves there. Native Guild income, timing and movement endings retain their original controls.',
      'Choose the real resulting battle and pass/decline native preparation. Record the original fullPlanOffer, then actually decline it. Stop with both plans unsealed and the original real Karama still held. Returned own/target plans may be legally sealed in either order by caller actions.',
      'No played phase, wallet, army, alliance, hand acquisition, sealed plan, ownership or inspection receipt is assigned. No optional module, No-Field or exceptional custody is introduced.',
    ],
  };
}
export type AtreidesFullPlanWindowFixture = ReturnType<typeof createAtreidesFullPlanWindowFixture>;

/** Finish this actual battle with its reusable owned plans. Missing target-first
 * commitment is supplied first when an explicit inspection has already begun;
 * native continuation never spends an otherwise unused special Karama. */
export function finishAtreidesFullPlanWindow(source: Game, fixture: AtreidesFullPlanWindowFixture,
  actions: AtreidesFullPlanWindowStep[] = []): Game {
  let game = source;
  game = advanceAtreidesFullPlanWindow(game, state => !state.battle ||
    (atreidesFullPlanWindowClean(state) && !state.battle.preparation && state.battle.preLeader?.closed !== false), actions);
  if (!game.battle) return game;
  const target = game.battle.fullPlan?.target;
  const actors = target && [fixture.owner, fixture.opponent].includes(target)
    ? [target, ...[fixture.owner, fixture.opponent].filter(actor => actor !== target)]
    : [fixture.opponent, fixture.owner];
  for (const actor of actors) {
    if (game.battle && !game.battle.revealed && !game.battle.plans[actor])
      game = actAtreidesFullPlanWindow(game, actor,
        actor === fixture.owner ? fixture.ownPlan : fixture.opponentPlan, actions);
  }
  return advanceAtreidesFullPlanWindow(game, state => !state.battle && state.phase !== 6 &&
    atreidesFullPlanWindowClean(state), actions);
}
