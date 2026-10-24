import assert from 'node:assert/strict';
import { applyAction, createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { nextRicheseStrongholdsNativeStep } from './fixture-richese-strongholds';

export type TleilaxuSpecialKaramaStep = { actor: string; action: Action };
export type TleilaxuSpecialKaramaTransition = {
  before: Game; steps: TleilaxuSpecialKaramaStep[]; after: Game;
};
export const tleilaxuSpecialKaramaPlayer = (game: Game, id: string) => {
  const player = game.players.find(player => player.id === id); assert.ok(player); return player;
};
export const tleilaxuSpecialKaramaClean = (game: Game) => !game.phaseOpening && !game.response &&
  !game.decision && !game.truthtrance && !game.pendingTreacheryDiscard && !game.pendingRevival;
export const tleilaxuSpecialKaramaInventory = (game: Game) => {
  const cards = [...game.deck, ...game.discard, ...game.players.flatMap(player => player.hand),
    ...(game.auction?.cards.slice(game.auction.index + (game.currentAuctionSale ? 1 : 0)) ?? [])];
  const ids = cards.map(card => card.id).sort();
  assert.equal(new Set(ids).size, ids.length, 'Original physical Treachery Cards retain distinct current slots');
  return ids;
};

/** Select original scalar shuffle order. UUIDs and every other native byte
 * source stay unchanged; no played resource, card hand or casualty is installed. */
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
export function actTleilaxuSpecialKarama(game: Game, actor: string, action: Action,
  actions: TleilaxuSpecialKaramaStep[] = []): Game {
  const next = originalScalarOrder(() => applyAction(game, actor, action));
  actions.push({ actor, action: structuredClone(action) }); return next;
}
/** Native controls only. Preserve Karama/Ghola, decline the optional special
 * inspection and Face Dance, and allow a pending normal revival by default. */
export function nextTleilaxuSpecialKarama(game: Game): TleilaxuSpecialKaramaStep | null {
  if (!game.phaseOpening && !game.response && !game.pendingTreacheryDiscard) {
    const decision = game.decision;
    if (decision?.kind === 'revivalStop' || decision?.kind === 'fullPlanOffer')
      return { actor: decision.player, action: { type: 'decision', decline: true } };
    if (decision?.kind === 'fullPlanRead')
      return { actor: decision.player, action: { type: 'decision', continue: true } };
    if (decision?.kind === 'faceDance')
      return { actor: decision.player, action: { type: 'decision', reveal: false } };
  }
  return nextRicheseStrongholdsNativeStep(game);
}
export function advanceTleilaxuSpecialKarama(game: Game, until: (state: Game) => boolean,
  actions: TleilaxuSpecialKaramaStep[] = []): Game {
  for (let count = 0; count < 1800; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The genuine Tleilaxu chronology ended before its requested boundary');
    const next = nextTleilaxuSpecialKarama(game);
    assert.ok(next, `Supply the original private plan at ${game.turn}/${game.phase}/${game.decision?.kind}`);
    game = actTleilaxuSpecialKarama(game, next.actor, next.action, actions);
  }
  throw Error('The native Tleilaxu special chronology did not reach its finite boundary');
}
export function passTleilaxuSpecialKarama(game: Game,
  actions: TleilaxuSpecialKaramaStep[] = []): Game {
  for (let count = 0; game.response && count < 60; count++) {
    const actor = game.players.find(player => !game.response!.passed.includes(player.id)); assert.ok(actor);
    game = actTleilaxuSpecialKarama(game, actor.id, { type: 'passResponse' }, actions);
  }
  assert.ok(!game.response); return game;
}

/** Genuine public Advanced Tleilaxu/Atreides/Emperor setup. Two paid shipments
 * make twelve native Atreides counters in Arrakeen; Hidar's real unarmed win
 * puts all twelve in Tanks. Stop at actual turn-two Revival with the original
 * Karama and Ghola still held. No card/army/phase/wallet/casualty is assigned. */
export function createTleilaxuSpecialKaramaFixture(options: { priorRevival?: boolean } = {}) {
  const owner = 'tleilaxu', target = 'atreides', observer = 'emperor';
  let game = createGame('TLEILAXUSPECIALKARAMA', newPlayer(owner, 'Tleilaxu', 'tleilaxu'), true, ['ix']);
  joinGame(game, newPlayer(target, 'Atreides', 'atreides'));
  joinGame(game, newPlayer(observer, 'Emperor', 'emperor'));
  const initial = structuredClone(game), actions: TleilaxuSpecialKaramaStep[] = [];
  const act = (actor: string, action: Action) => { game = actTleilaxuSpecialKarama(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceTleilaxuSpecialKarama(game, until, actions); };
  const transition = (run: () => void): TleilaxuSpecialKaramaTransition => {
    const before = structuredClone(game), start = actions.length; run();
    return { before, steps: structuredClone(actions.slice(start)), after: structuredClone(game) };
  };
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game); act(game.host, { type: 'start', advancedPreview: true });
  const setup = structuredClone(game);
  assert.equal(game.status, 'setup'); assert.equal(game.advanced, true);
  assert.deepEqual(game.expansions, ['ix']);
  assert.ok(!game.homeworlds && !game.nexusCards && !game.leaderSkills && !game.techTokens &&
    !game.strongholdCards && !game.discoveryEnabled && !game.ecazTreachery);
  assert.ok(game.players.every(player => player.hand.length === 0));
  const originalInventory = tleilaxuSpecialKaramaInventory(game);
  const karama = game.deck.find(card => card.effect === 'karama');
  const ghola = game.deck.find(card => card.effect === 'ghola');
  const ordinary = game.deck.find(card => ['projectile', 'poison', 'shield', 'snooper'].includes(card.kind));
  assert.ok(karama && ghola && ordinary);
  const selected = [karama, ghola, ordinary];
  const dealOrder = selected.map((card, position) => {
    const from = game.deck.findIndex(candidate => candidate.id === card.id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { position, from, card: card.id };
  });
  const beforeStartingDeal = structuredClone(game);
  reach(state => state.status === 'playing');
  const afterSetup = structuredClone(game);
  assert.deepEqual(game.players.flatMap(player => player.hand.map(card => card.id)), selected.map(card => card.id));
  assert.equal(tleilaxuSpecialKaramaPlayer(game, owner).faceDancers?.length, 3);
  assert.equal(tleilaxuSpecialKaramaPlayer(game, target).forces['arrakeen:10'], 10);
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const spiceOrder = [0, 1, 2, 3].map(position => {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card && !card.discovery);
    assert.ok(from >= position); const card = game.spiceDeck.splice(from, 1)[0];
    game.spiceDeck.splice(position, 0, card); return { position, from, card: structuredClone(card) };
  });
  assert.deepEqual(game.spiceDeck.map(card => JSON.stringify(card)).sort(), originalSpice);
  reach(state => state.turn === 1 && state.phase === 5 && state.active === owner && tleilaxuSpecialKaramaClean(state));
  const ownerShipment = transition(() => {
    act(owner, { type: 'ship', territory: 'arrakeen', sector: 10, amount: 1, elite: 0, allyPayment: 0 });
    reach(tleilaxuSpecialKaramaClean);
  });
  assert.equal(tleilaxuSpecialKaramaPlayer(ownerShipment.before, owner).spice - tleilaxuSpecialKaramaPlayer(game, owner).spice, 1);
  act(owner, { type: 'endMovement' });
  reach(state => state.phase === 5 && state.active === target && tleilaxuSpecialKaramaClean(state));
  const targetShipment = transition(() => {
    act(target, { type: 'ship', territory: 'arrakeen', sector: 10, amount: 2, elite: 0, allyPayment: 0 });
    reach(tleilaxuSpecialKaramaClean);
  });
  assert.equal(tleilaxuSpecialKaramaPlayer(targetShipment.before, target).spice - tleilaxuSpecialKaramaPlayer(game, target).spice, 2);
  assert.equal(tleilaxuSpecialKaramaPlayer(game, target).forces['arrakeen:10'], 12);
  reach(state => state.phase === 6 && tleilaxuSpecialKaramaClean(state) && !!state.active);
  const beforeBattle = structuredClone(game), choice = viewGame(game, game.active!).battleChoices
    .find(choice => choice.territory === 'arrakeen'); assert.ok(choice);
  const battleStep: TleilaxuSpecialKaramaStep = { actor: choice.chooser,
    action: { type: 'chooseBattle', territory: 'arrakeen',
      target: choice.attacker === choice.chooser ? choice.defender : choice.attacker } };
  act(battleStep.actor, battleStep.action);
  const beforePreparation = structuredClone(game);
  reach(state => !!state.battle && tleilaxuSpecialKaramaClean(state) &&
    !state.battle.preparation && state.battle.preLeader?.closed !== false);
  const plans: TleilaxuSpecialKaramaStep[] = [
    { actor: owner, action: { type: 'battlePlan', leader: 'tleilaxu-1', dial: 0, support: 0, weapon: null, defense: null } },
    { actor: target, action: { type: 'battlePlan', leader: 'atreides-4', dial: 0, support: 0, weapon: null, defense: null } },
  ];
  for (const step of plans) act(step.actor, step.action);
  const revealed = structuredClone(game);
  reach(state => !state.battle && tleilaxuSpecialKaramaClean(state));
  const afterBattle = structuredClone(game);
  assert.equal(game.lastBattleContext?.winner, owner);
  assert.equal(tleilaxuSpecialKaramaPlayer(game, target).tanks, 12);
  assert.equal(tleilaxuSpecialKaramaPlayer(game, owner).tanks, 0);
  assert.equal(tleilaxuSpecialKaramaPlayer(game, target).leaders.find(leader => leader.id === 'atreides-4')?.dead, false);
  reach(state => state.turn === 2 && state.phase === 4 && tleilaxuSpecialKaramaClean(state));
  const beforePriorRevival = structuredClone(game);
  let priorRevival: TleilaxuSpecialKaramaTransition | null = null;
  if (options.priorRevival) priorRevival = transition(() => {
    act(target, { type: 'revive', amount: 1, elite: 0 });
    reach(tleilaxuSpecialKaramaClean);
  });
  assert.equal(game.turn, 2); assert.equal(game.phase, 4); assert.ok(tleilaxuSpecialKaramaClean(game));
  assert.equal(tleilaxuSpecialKaramaPlayer(game, target).tanks, options.priorRevival ? 11 : 12);
  assert.equal(tleilaxuSpecialKaramaPlayer(game, target).revived, options.priorRevival ? 1 : 0);
  assert.equal(tleilaxuSpecialKaramaPlayer(game, target).freeForcesRevived, options.priorRevival ? 1 : 0);
  assert.ok(tleilaxuSpecialKaramaPlayer(game, owner).hand.some(card => card.id === karama.id));
  assert.ok(tleilaxuSpecialKaramaPlayer(game, target).hand.some(card => card.id === ghola.id));
  assert.ok(!tleilaxuSpecialKaramaPlayer(game, owner).specialKaramaUsed);
  assert.deepEqual(tleilaxuSpecialKaramaInventory(game), originalInventory);
  const special: Action = { type: 'card', card: karama.id, mode: 'special', target };
  const ordinaryRevival: Action = { type: 'revive', amount: 1, elite: 0 };
  const gholaAction: Action = { type: 'card', card: ghola.id, amount: 5, elite: 0 };
  return { game, source: structuredClone(game), initial, lobby, setup, beforeStartingDeal, afterSetup,
    ownerShipment, targetShipment, beforeBattle, battleStep, beforePreparation, plans, revealed, afterBattle,
    beforePriorRevival, priorRevival, owner, tleilaxu: owner, target, atreides: target, observer, emperor: observer,
    karama: karama.id, card: karama.id, ghola: ghola.id, special, action: special,
    ordinaryRevival, gholaAction, prior: !!options.priorRevival,
    actions, sourceActionCount: actions.length, inventory: originalInventory, originalInventory,
    originalSpice, dealOrder, spiceOrder,
    staging: [
      'Actual public native Advanced Tleilaxu/Atreides/Emperor ready/startPreview, private Traitor choices and original three-card Face Dancer deal. No optional module or changed rules mode is introduced.',
      'Select only original scalar shuffle order, three original unopened Treachery positions and four original unopened ordinary Spice positions. Tleilaxu really receives its starting Karama and Atreides its starting Ghola; neither card is played during the source.',
      'Tleilaxu actually pays one to ship one reserve into Arrakeen. Atreides actually pays two to ship two reserves into its original ten home counters. Native first Storm, dual Spice, Charity, auction and Revival controls all execute.',
      'The real Arrakeen battle seals unarmed Hidar4 and Yueh1 at dial0/support0. The native Tleilaxu victory puts all twelve original Atreides counters into Tanks without killing either leader or costing Tleilaxu a force. Actual native Battle loss/Kwisatz history remains.',
      'Continue real Collection, Mentat, second Storm/dual Spice, Charity and Bidding into clean second Revival, retaining original Karama/Ghola. No phase, army, wallet, card hand, Tanks, prevention or receipt is assigned.',
      options.priorRevival
        ? 'Before the special choice, Atreides actually returns one own counter free. Tleilaxu declines the native revivalStop and original response passes settle its normal income; the completed return remains earned state.'
        : 'Stop before any normal revival request or special Karama. Native revivalStop and later ordinary/Ghola continuations remain caller actions.',
    ],
  };
}
export type TleilaxuSpecialKaramaFixture = ReturnType<typeof createTleilaxuSpecialKaramaFixture>;

/** Optional native partial-return branch. The initial requested snapshot keeps
 * the real revivalStop available for explicit prevention or ordinary decline. */
export function reviveTleilaxuSpecialKarama(source: Game, fixture: TleilaxuSpecialKaramaFixture,
  amount = 1, actions: TleilaxuSpecialKaramaStep[] = []) {
  const before = structuredClone(source), start = actions.length;
  const step: TleilaxuSpecialKaramaStep = { actor: fixture.target, action: { type: 'revive', amount, elite: 0 } };
  const requested = actTleilaxuSpecialKarama(source, step.actor, step.action, actions);
  const game = advanceTleilaxuSpecialKarama(requested, tleilaxuSpecialKaramaClean, actions);
  return { game, before, step, requested, after: structuredClone(game), steps: structuredClone(actions.slice(start)) };
}
export function finishTleilaxuSpecialKarama(source: Game, actions: TleilaxuSpecialKaramaStep[] = []): Game {
  return advanceTleilaxuSpecialKarama(source, game => game.phase === 5 && tleilaxuSpecialKaramaClean(game), actions);
}
