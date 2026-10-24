import assert from 'node:assert/strict';
import { applyAction, createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { RECRUITS_CARD_ID } from '../game/recruits';
import { nextRicheseStrongholdsNativeStep } from './fixture-richese-strongholds';

export type FremenRevivalGrantStep = { actor: string; action: Action };
export type FremenRevivalGrantTransition = {
  before: Game; steps: FremenRevivalGrantStep[]; after: Game;
};
export const fremenRevivalGrantPlayer = (game: Game, id: string) => {
  const player = game.players.find(player => player.id === id); assert.ok(player); return player;
};
export const fremenRevivalGrantClean = (game: Game) => !game.phaseOpening && !game.response &&
  !game.decision && !game.truthtrance && !game.pendingTreacheryDiscard && !game.pendingRevival;
export const fremenRevivalGrantInventory = (game: Game) => {
  const cards = [...game.deck, ...game.discard, ...game.players.flatMap(player => player.hand),
    ...(game.auction?.cards.slice(game.auction.index + (game.currentAuctionSale ? 1 : 0)) ?? [])];
  const ids = cards.map(card => card.id).sort();
  assert.equal(new Set(ids).size, ids.length, 'Original physical Treachery Cards retain distinct current slots');
  return ids;
};

/** Scope original scalar shuffle choices only; UUIDs and other byte entropy stay
 * native. No card, force, wallet or historical event is installed after a deal. */
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
export function actFremenRevivalGrant(game: Game, actor: string, action: Action,
  actions: FremenRevivalGrantStep[] = []): Game {
  const next = originalScalarOrder(() => applyAction(game, actor, action));
  actions.push({ actor, action: structuredClone(action) }); return next;
}
/** Advance native controls only. No voluntary revival, grant, Recruits play,
 * alliance or private battle plan is selected by the generic continuation. */
export function nextFremenRevivalGrantStep(game: Game): FremenRevivalGrantStep | null {
  if (!game.phaseOpening && !game.response && !game.pendingTreacheryDiscard) {
    if (game.status === 'setup' && game.setupStage === 'forces' &&
        fremenRevivalGrantPlayer(game, 'fremen').reserves === 20)
      return { actor: 'fremen', action: { type: 'fremenSetup', placements: { 'sietch_tabr:14': 10 } } };
    if (game.decision?.kind === 'wormRide' || game.decision?.kind === 'wormPlacement')
      return { actor: game.decision.player, action: { type: 'decision', accept: false } };
    if (game.decision?.kind === 'guildTiming')
      return { actor: game.decision.player, action: { type: 'decision', take: false } };
  }
  return nextRicheseStrongholdsNativeStep(game);
}
export function advanceFremenRevivalGrant(game: Game, until: (state: Game) => boolean,
  actions: FremenRevivalGrantStep[] = []): Game {
  for (let count = 0; count < 1800; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The genuine Fremen grant chronology ended before its requested control');
    const next = nextFremenRevivalGrantStep(game);
    assert.ok(next, `Supply the original control at ${game.status}/${game.turn}/${game.phase}/${game.decision?.kind}`);
    game = actFremenRevivalGrant(game, next.actor, next.action, actions);
  }
  throw Error('The native Fremen grant chronology did not reach its finite boundary');
}
export function passFremenRevivalGrantResponses(game: Game,
  actions: FremenRevivalGrantStep[] = []): Game {
  for (let count = 0; game.response && count < 60; count++) {
    const actor = game.players.find(player => !game.response!.passed.includes(player.id)); assert.ok(actor);
    game = actFremenRevivalGrant(game, actor.id, { type: 'passResponse' }, actions);
  }
  assert.ok(!game.response); return game;
}
export function cloneFremenRevivalGrant(game: Game): Game {
  assert.ok(fremenRevivalGrantClean(game), 'Clone a clean original Revival choice boundary');
  return structuredClone(game);
}

/** Actual public classic setup, a paid Tabr invasion, six native casualties per
 * combatant, a later original Shai-Hulud and accepted Nexus alliance. Stop at
 * clean turn-two Revival BEFORE grant or optional Recruits activation. Only
 * unopened physical card/Spice positions and native scalar shuffles are chosen. */
export function createFremenRevivalGrantFixture(options: {
  advanced?: boolean; recruits?: boolean; priorRevival?: boolean;
} = {}) {
  const advanced = options.advanced ?? false, recruits = options.recruits ?? false;
  const fremen = 'fremen', ally = 'atreides', observer = 'emperor';
  let game = createGame('FREMENREVIVALGRANT', newPlayer(fremen, 'Fremen', 'fremen'), advanced);
  joinGame(game, newPlayer(ally, 'Atreides', 'atreides'));
  joinGame(game, newPlayer(observer, 'Emperor', 'emperor'));
  const initial = structuredClone(game), actions: FremenRevivalGrantStep[] = [];
  const act = (actor: string, action: Action) => { game = actFremenRevivalGrant(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceFremenRevivalGrant(game, until, actions); };
  const transition = (run: () => void): FremenRevivalGrantTransition => {
    const before = structuredClone(game), start = actions.length; run();
    return { before, steps: structuredClone(actions.slice(start)), after: structuredClone(game) };
  };
  if (recruits) act(game.host, { type: 'moduleOption', module: 'ecazTreachery', enabled: true });
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game);
  act(game.host, advanced ? { type: 'start', advancedPreview: true } : { type: 'start' });
  const setup = structuredClone(game);
  assert.equal(game.status, 'setup'); assert.equal(game.advanced, advanced);
  assert.equal(!!game.ecazTreachery, recruits);
  assert.ok(!game.homeworlds && !game.nexusCards && !game.leaderSkills && !game.techTokens &&
    !game.strongholdCards && !game.discoveryEnabled);
  assert.ok(game.players.every(player => player.hand.length === 0));
  const originalInventory = fremenRevivalGrantInventory(game);
  const ordinary = game.deck.filter(card => ['projectile', 'poison', 'shield', 'snooper'].includes(card.kind)).slice(0, 2);
  const karama = game.deck.find(card => card.effect === 'karama');
  const recruitsCard = recruits ? game.deck.find(card => card.id === RECRUITS_CARD_ID) : null;
  assert.equal(ordinary.length, 2); assert.ok(karama); assert.ok(!recruits || recruitsCard);
  const startingCards = [recruitsCard ?? ordinary[0], ordinary[1], karama];
  const dealOrder = startingCards.map((card, position) => {
    const from = game.deck.findIndex(candidate => candidate.id === card.id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { position, from, card: card.id };
  });
  const beforeStartingDeal = structuredClone(game);
  reach(state => state.status === 'playing');
  const afterSetup = structuredClone(game);
  assert.deepEqual(game.players.flatMap(player => player.hand.map(card => card.id)), startingCards.map(card => card.id));
  assert.equal(fremenRevivalGrantPlayer(game, fremen).forces['sietch_tabr:14'], 10);
  assert.ok(fremenRevivalGrantPlayer(game, observer).hand.some(card => card.id === karama.id));
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const spiceOrder = [0, 1].map(position => {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card && !card.discovery &&
      card.territory !== 'sietch_tabr');
    assert.ok(from >= position); const card = game.spiceDeck.splice(from, 1)[0];
    game.spiceDeck.splice(position, 0, card); return { position, from, card: structuredClone(card) };
  });
  assert.deepEqual(game.spiceDeck.map(card => JSON.stringify(card)).sort(), originalSpice);
  reach(state => state.turn === 1 && state.phase === 5 && state.active === ally && fremenRevivalGrantClean(state));
  const shipment = transition(() => {
    act(ally, { type: 'ship', territory: 'sietch_tabr', sector: 14, amount: 6, elite: 0, allyPayment: 0 });
    reach(fremenRevivalGrantClean);
  });
  assert.equal(fremenRevivalGrantPlayer(game, ally).forces['sietch_tabr:14'], 6);
  assert.equal(fremenRevivalGrantPlayer(shipment.before, ally).spice - fremenRevivalGrantPlayer(game, ally).spice, 6);
  reach(state => state.turn === 1 && state.phase === 6 && fremenRevivalGrantClean(state) && !!state.active);
  const beforeBattle = structuredClone(game);
  const choice = viewGame(game, game.active!).battleChoices.find(choice => choice.territory === 'sietch_tabr'); assert.ok(choice);
  const battleStep: FremenRevivalGrantStep = { actor: choice.chooser,
    action: { type: 'chooseBattle', territory: 'sietch_tabr',
      target: choice.attacker === choice.chooser ? choice.defender : choice.attacker } };
  act(battleStep.actor, battleStep.action);
  const plans: FremenRevivalGrantStep[] = [];
  for (const actor of [fremen, ally]) {
    reach(state => !!state.battle && fremenRevivalGrantClean(state) &&
      !state.battle.preparation && state.battle.preLeader?.closed !== false);
    const leaders = fremenRevivalGrantPlayer(game, actor).leaders.filter(leader => !leader.dead && !leader.usedAt)
      .sort((a, b) => a.strength - b.strength || a.id.localeCompare(b.id));
    const leader = actor === fremen ? leaders.at(-1) : leaders[0]; assert.ok(leader);
    const step: FremenRevivalGrantStep = { actor, action: { type: 'battlePlan',
      leader: leader.id, dial: actor === fremen ? 6 : 0, support: 0, weapon: null, defense: null } };
    plans.push(step); act(step.actor, step.action);
  }
  reach(state => !state.battle && fremenRevivalGrantClean(state));
  const afterBattle = structuredClone(game);
  assert.equal(fremenRevivalGrantPlayer(game, fremen).tanks, 6);
  assert.equal(fremenRevivalGrantPlayer(game, ally).tanks, 6);
  reach(state => state.turn === 2 && state.phase === 1 && fremenRevivalGrantClean(state) &&
    !state.spiceSequence && !state.spiceResolution && !state.spiceWindow && !state.nexus && state.ready.length === 0);
  const beforeWormOrder = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const wormIndex = game.spiceDeck.findIndex(card => 'worm' in card && !card.greatMaker && !card.suppressed && !card.thumper);
  assert.ok(wormIndex >= 0);
  const worm = game.spiceDeck.splice(wormIndex, 1)[0]; game.spiceDeck.unshift(worm);
  const wormOrder = { position: 0, from: wormIndex, card: structuredClone(worm) };
  assert.deepEqual(game.spiceDeck.map(card => JSON.stringify(card)).sort(), beforeWormOrder);
  reach(state => state.nexus && !state.spiceWindow && !state.spiceResolution && fremenRevivalGrantClean(state));
  const alliance = transition(() => {
    act(fremen, { type: 'alliance', target: ally });
    act(ally, { type: 'alliance', target: fremen });
  });
  assert.equal(fremenRevivalGrantPlayer(game, fremen).ally, ally);
  assert.equal(fremenRevivalGrantPlayer(game, ally).ally, fremen);
  reach(state => state.turn === 2 && state.phase === 4 && fremenRevivalGrantClean(state));
  const beforePriorRevival = structuredClone(game);
  let priorRevival: FremenRevivalGrantTransition | null = null;
  if (options.priorRevival) priorRevival = transition(() => {
    act(ally, { type: 'revive', amount: 3, elite: 0 });
    reach(fremenRevivalGrantClean);
  });
  assert.equal(game.turn, 2); assert.equal(game.phase, 4); assert.ok(fremenRevivalGrantClean(game));
  assert.equal(fremenRevivalGrantPlayer(game, ally).tanks, options.priorRevival ? 3 : 6);
  assert.equal(fremenRevivalGrantPlayer(game, ally).revived, options.priorRevival ? 3 : 0);
  assert.equal(fremenRevivalGrantPlayer(game, ally).freeForcesRevived, options.priorRevival ? 2 : 0);
  assert.ok(!options.priorRevival ||
    fremenRevivalGrantPlayer(beforePriorRevival, ally).spice - fremenRevivalGrantPlayer(game, ally).spice === 2);
  assert.ok(!game.freeRevival.includes(ally));
  assert.ok(!game.recruits);
  assert.ok(fremenRevivalGrantPlayer(game, observer).hand.some(card => card.id === karama.id));
  assert.deepEqual(fremenRevivalGrantInventory(game), originalInventory);
  const grant: Action = { type: 'grantRevival' };
  const recruitsPlay: Action | null = recruits ? { type: 'card', card: RECRUITS_CARD_ID } : null;
  return { game, initial, lobby, setup, beforeStartingDeal, afterSetup, beforeBattle, afterBattle,
    beforePriorRevival, shipment, battleStep, plans, alliance, priorRevival,
    fremen, owner: fremen, ally, beneficiary: ally, observer, counterOwner: observer,
    karama: karama.id, recruits: recruitsCard?.id ?? null, recruitsPlay,
    grant, grantStep: { actor: fremen, action: grant } satisfies FremenRevivalGrantStep,
    recruitsStep: recruitsPlay ? { actor: fremen, action: recruitsPlay } satisfies FremenRevivalGrantStep : null,
    ordinaryRevival: { type: 'revive', amount: 3, elite: 0 } satisfies Action,
    advanced, actions, sourceActionCount: actions.length, originalInventory, originalSpice,
    dealOrder, spiceOrder, wormOrder,
    staging: [
      'Actual public classic Fremen/Atreides/Emperor ready/start and native private setup. Optional independent three-card variant is selected before start; Advanced uses the original explicit preview action.',
      'Select original scalar shuffle order and three original unopened Treachery positions. Emperor receives its original Karama; optional Recruits is physically dealt to Fremen. No played hand is replaced or later card acquired.',
      'Native Fremen setup puts ten ordinary counters at Tabr. Atreides actually pays six to ship six original reserves there. Both seal unarmed native leader plans; Fremen really dials six and wins. Original casualties put six counters from each faction into Tanks.',
      'Order two original unopened ordinary first-turn Spice Cards and, only before actual turn-two Spice Blow, one original unopened Shai-Hulud. The actual Nexus permits Fremen proposal and Atreides acceptance; intervening native Storm, market-free Bidding, worm and readiness controls execute.',
      options.priorRevival
        ? 'At the real second Revival, Atreides actually returns three normal counters before the grant: two recorded free and one paid at two spice. Payment, usage and native Tanks remain earned state.'
        : 'At the real second Revival, neither ally has returned any counter this phase.',
      'Stop before Fremen grant or optional Recruits play. No alliance, phase, wallet, army, denial stamp, response or receipt is assigned, and no grant/Recruits settlement policy is asserted.',
    ],
  };
}
export type FremenRevivalGrantFixture = ReturnType<typeof createFremenRevivalGrantFixture>;
