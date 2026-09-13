import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  initializeDiscoveryGameForAudit,
  joinGame,
  newPlayer,
  normalizeAutomaticGame,
  viewGame,
  type Action,
  type Game,
} from '../game/engine';
import type { Card, SpiceCard } from '../game/cards';
import { discoveryStashSignature } from '../game/discovery-actions';
import { greatMakerSignature } from '../game/great-maker';
import { isAdvisor } from '../game/advisors';
import {
  discoveryFixture,
  enterDiscoveryCollection,
} from './fixture-discovery';

const reload = (game: Game): Game => JSON.parse(JSON.stringify(game));

function rejectUnchanged(game: Game, player: string, action: Action) {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, player, action));
  assert.deepEqual(game, before);
}

function takeSpice(
  game: Game,
  predicate: (card: SpiceCard) => boolean,
): SpiceCard {
  const index = game.spiceDeck.findIndex(predicate);
  assert.ok(index >= 0, 'the physical spice card must remain in the deck');
  return game.spiceDeck.splice(index, 1)[0];
}

function giveCard(
  game: Game,
  owner: string,
  predicate: (card: Card) => boolean,
): Card {
  const zones = [
    game.deck,
    game.discard,
    ...game.players.map((player) => player.hand),
  ];
  for (const zone of zones) {
    const index = zone.findIndex(predicate);
    if (index < 0) continue;
    const [card] = zone.splice(index, 1);
    game.players.find((player) => player.id === owner)!.hand.push(card);
    return card;
  }
  assert.fail('the physical Treachery card must remain in a live zone');
}

function ready(game: Game): Game {
  let next = game;
  for (const player of next.players)
    next = applyAction(next, player.id, { type: 'ready' });
  return next;
}

function greatMakerSurvival(allied = false): { game: Game; karama: Card; source: string } {
  const game = discoveryFixture();
  const greatMaker = takeSpice(
    game,
    (card) => 'worm' in card && card.greatMaker === true,
  );
  const sourceCard = takeSpice(
    game,
    (card) =>
      'territory' in card &&
      card.territory === 'broken_land' &&
      card.discovery === undefined,
  );
  assert.ok('territory' in sourceCard);
  const replacement = takeSpice(
    game,
    (card) => 'territory' in card && card.discovery === undefined,
  );
  const karama = giveCard(game, 'a', (card) => card.effect === 'karama');
  Object.assign(game, {
    turn: 2,
    phase: 1,
    storm: 18,
    nexus: false,
    summonedBeforeBlow: false,
    wormRides: [],
    spiceSequence: null,
    spiceResolution: null,
    spiceWindow: null,
    response: null,
    decision: null,
    phaseOpening: null,
    ready: [],
  });
  for (const player of game.players)
    Object.assign(player, { forces: {}, reserves: 20, tanks: 0, ally: null });
  const source = `${sourceCard.territory}:${sourceCard.sector}`;
  const fremen = game.players.find((player) => player.id === 'f')!;
  fremen.forces = { [source]: 4 };
  fremen.reserves = 16;
  if (allied) {
    const atreides = game.players.find((player) => player.id === 'a')!;
    fremen.ally = atreides.id;
    atreides.ally = fremen.id;
    atreides.forces = { [source]: 2 };
    atreides.reserves = 18;
  }
  game.spice[source] = 5;
  game.spiceDiscard = [[sourceCard], []];
  game.spiceDeck = [greatMaker, replacement, ...game.spiceDeck];
  const pending = ready(game);
  assert.equal(pending.greatMaker?.stage, 'worm');
  assert.equal(
    allied ? pending.decision?.kind : pending.response?.kind,
    allied ? 'wormProtection' : 'wormSurvival',
  );
  return { game: pending, karama, source };
}

function passCurrentResponse(game: Game, kind: NonNullable<Game['response']>['kind']): Game {
  let next = game;
  while (next.response?.kind === kind) {
    const player = next.players.find(
      (candidate) => !next.response!.passed.includes(candidate.id),
    );
    assert.ok(player);
    next = applyAction(next, player.id, { type: 'passResponse' });
  }
  return next;
}

function advancedAdvisorGame(): Game {
  let game = createGame(
    'GMADVISOR',
    newPlayer('a', 'Atreides', 'atreides'),
    true,
  );
  joinGame(game, newPlayer('g', 'Guild', 'guild'));
  joinGame(game, newPlayer('f', 'Fremen', 'fremen'));
  joinGame(game, newPlayer('b', 'Bene Gesserit', 'beneGesserit'));
  game.discoveryEnabled = true;
  game = ready(game);
  game = initializeDiscoveryGameForAudit(game);
  game = applyAction(game, 'b', {
    type: 'predict',
    faction: 'atreides',
    turn: 4,
  });
  while (game.setupStage === 'traitors') {
    const player = game.players.find(
      (candidate) => candidate.traitorChoices.length,
    );
    assert.ok(player);
    game = applyAction(game, player.id, {
      type: 'traitor',
      leader: player.traitorChoices[0],
    });
  }
  game = applyAction(game, 'f', {
    type: 'fremenSetup',
    placements: { sietch_tabr: 10 },
  });
  game = applyAction(game, 'b', {
    type: 'advisorSetup',
    territory: 'imperial_basin',
    sector: 10,
  });
  assert.equal(game.status, 'playing');
  assert.equal(
    isAdvisor(
      game.players.find((player) => player.id === 'b')!,
      'imperial_basin',
    ),
    false,
  );
  return game;
}

function voteAll(game: Game, yes = false): Game {
  let next = game;
  for (let count = 0; count < next.players.length; count++) {
    assert.ok(next.decision?.kind === 'greatMakerVote');
    next = applyAction(next, next.decision.player, {
      type: 'decision',
      event: next.decision.event,
      yes,
    });
  }
  return next;
}

void test('canceling Fremen worm survival destroys the board group but retains the Great Maker reserve ride', () => {
  const encounter = greatMakerSurvival();
  let game = applyAction(encounter.game, 'a', {
    type: 'card',
    card: encounter.karama.id,
    mode: 'cancel',
  });
  const fremen = game.players.find((player) => player.id === 'f')!;
  assert.equal(fremen.forces[encounter.source], undefined);
  assert.equal(fremen.tanks, 4);
  assert.equal(fremen.reserves, 16);
  assert.equal(game.spice[encounter.source], undefined);
  assert.deepEqual(game.wormRides, []);
  assert.equal(game.greatMaker?.stage, 'vote');

  game = voteAll(reload(game));
  assert.equal(game.decision?.kind, 'greatMakerRide');
  const event = game.greatMaker!.event;
  game = applyAction(game, 'f', {
    type: 'decision',
    event,
    accept: true,
    territory: 'polar_sink',
    sector: 0,
    amount: 3,
    elite: 0,
  });
  const rider = game.players.find((player) => player.id === 'f')!;
  assert.equal(rider.tanks, 4);
  assert.equal(rider.reserves, 13);
  assert.equal(rider.forces['polar_sink:0'], 3);
  assert.equal(game.greatMaker?.stage, 'complete');
});

void test('Fremen ally protection returns through survival to the Great Maker vote', () => {
  const encounter = greatMakerSurvival(true);
  let game = encounter.game;
  assert.equal(game.decision?.kind, 'wormProtection');
  game = applyAction(game, 'f', { type: 'decision', accept: true });
  assert.equal(game.greatMaker?.stage, 'worm');
  assert.equal(game.response?.kind, 'wormAllyProtection');
  assert.doesNotThrow(() => viewGame(reload(game), 'a'));

  game = passCurrentResponse(game, 'wormAllyProtection');
  assert.equal(game.response?.kind, 'wormSurvival');
  assert.equal(game.response.recipient, 'a');
  assert.doesNotThrow(() => viewGame(reload(game), 'f'));

  game = passCurrentResponse(game, 'wormSurvival');
  const atreides = game.players.find((player) => player.id === 'a')!;
  const fremen = game.players.find((player) => player.id === 'f')!;
  assert.equal(atreides.forces[encounter.source], 2);
  assert.equal(atreides.reserves, 18);
  assert.equal(atreides.tanks, 0);
  assert.equal(fremen.forces[encounter.source], 4);
  assert.equal(fremen.reserves, 16);
  assert.equal(fremen.tanks, 0);
  assert.equal(game.spice[encounter.source], undefined);
  assert.equal(game.greatMaker?.stage, 'vote');
  assert.equal(game.decision?.kind, 'greatMakerVote');
});

void test('an Advanced Bene Gesserit intrusion returns from a restored Great Maker ride before spice continues', () => {
  let game = advancedAdvisorGame();
  const greatMaker = takeSpice(
    game,
    (card) => 'worm' in card && card.greatMaker === true,
  );
  const source = takeSpice(
    game,
    (card) =>
      'territory' in card &&
      card.territory === 'broken_land' &&
      card.discovery === undefined,
  );
  const replacement = takeSpice(
    game,
    (card) => 'territory' in card && card.discovery === undefined,
  );
  assert.ok('territory' in replacement);
  giveCard(game, 'a', (card) => card.effect === 'karama');
  Object.assign(game, {
    turn: 2,
    phase: 1,
    storm: 18,
    nexus: false,
    summonedBeforeBlow: false,
    wormRides: [],
    spiceSequence: null,
    spiceResolution: null,
    spiceWindow: null,
    response: null,
    decision: null,
    phaseOpening: null,
    ready: [],
  });
  game.spiceDiscard = [[source], []];
  game.spiceDeck = [greatMaker, replacement, ...game.spiceDeck];
  game = voteAll(ready(game));
  assert.ok(game.decision?.kind === 'greatMakerRide');
  game = applyAction(game, 'f', {
    type: 'decision',
    event: game.decision.event,
    accept: true,
    territory: 'imperial_basin',
    sector: 10,
    amount: 1,
    elite: 0,
  });
  game = reload(game);
  assert.equal(game.greatMaker?.stage, 'arrival');
  assert.equal(game.decision?.kind, 'intrusion');
  assert.doesNotThrow(() => viewGame(game, 'b'));
  const misbound = reload(game);
  assert.ok(misbound.decision?.kind === 'intrusion');
  misbound.decision.territory = 'carthag';
  assert.throws(
    () => viewGame(misbound, 'b'),
    /Great Maker.*arrival|arrival.*territory/i,
  );
  game = applyAction(game, 'b', { type: 'decision', accept: true });
  game = reload(game);
  assert.equal(game.response?.kind, 'advisorFlip');
  assert.equal(game.response?.advisorResume, 'wormRide');
  assert.doesNotThrow(() => viewGame(game, 'f'));
  while (game.response) {
    const player = game.players.find(
      (candidate) => !game.response!.passed.includes(candidate.id),
    );
    assert.ok(player);
    game = applyAction(game, player.id, { type: 'passResponse' });
  }
  const beneGesserit = game.players.find((player) => player.id === 'b')!;
  assert.equal(isAdvisor(beneGesserit, 'imperial_basin'), true);
  assert.equal(game.greatMaker?.stage, 'complete');
  assert.equal(game.spiceWindow?.territory, replacement.territory);
  assert.equal(game.decision, null);
});

void test('Great Maker integrity rejects orphaned, moduleless, and post-completion controls', () => {
  const pending = greatMakerSurvival().game;
  const wrongSurvivalOwner = structuredClone(pending);
  assert.equal(wrongSurvivalOwner.response?.kind, 'wormSurvival');
  wrongSurvivalOwner.response.owner = 'a';
  assert.throws(
    () => viewGame(wrongSurvivalOwner, 'a'),
    /original Fremen response|pending worm survival/i,
  );
  const vote = structuredClone(pending);
  vote.response = null;
  vote.greatMaker!.stage = 'vote';
  vote.greatMaker!.signature = greatMakerSignature(vote.greatMaker!);
  vote.decision = {
    kind: 'greatMakerVote',
    player: vote.greatMaker!.order[0],
    event: vote.greatMaker!.event,
  };

  const orphan = structuredClone(vote);
  delete orphan.greatMaker;
  assert.throws(() => viewGame(orphan, 'a'), /lost its original encounter/i);
  const moduleless = structuredClone(vote);
  delete moduleless.discoveryEnabled;
  delete moduleless.discoveries;
  assert.throws(() => viewGame(moduleless, 'a'), /physical Discovery module/i);

  let complete = voteAll(vote);
  assert.ok(complete.decision?.kind === 'greatMakerRide');
  complete = applyAction(complete, 'f', {
    type: 'decision',
    event: complete.decision.event,
    accept: false,
  });
  assert.equal(complete.greatMaker?.stage, 'complete');
  const retained = structuredClone(complete);
  retained.decision = {
    kind: 'greatMakerRide',
    player: 'f',
    event: retained.greatMaker!.event,
  };
  assert.throws(() => viewGame(retained, 'a'), /completed Great Maker/i);
});

void test('a pending Treachery Card Stash binds its exact private hand and rejects stale discard actions atomically', () => {
  let game = discoveryFixture();
  const token = enterDiscoveryCollection(game, 'treachery-card-stash');
  while (game.players[0].hand.length < 4)
    game.players[0].hand.push(game.deck.shift()!);
  game = applyAction(game, 'a', {
    type: 'discovery',
    token: token.id,
    reveal: false,
  });
  game = applyAction(game, 'a', {
    type: 'discovery',
    token: token.id,
    reveal: true,
  });
  assert.ok(game.decision?.kind === 'discoveryDiscard');
  const decision = game.decision;
  const selected = game.players[0].hand[0];
  rejectUnchanged(game, 'g', {
    type: 'decision',
    event: decision.event,
    card: selected.id,
  });
  rejectUnchanged(game, 'a', {
    type: 'decision',
    event: 'stale',
    card: selected.id,
  });
  rejectUnchanged(game, 'a', {
    type: 'decision',
    event: decision.event,
    card: selected.id,
    extra: true,
  });

  const lostControl = reload(game);
  lostControl.decision = null;
  assert.throws(
    () => viewGame(lostControl, 'a'),
    /lost its owned discard choice/i,
  );
  const changedHand = reload(game);
  const removed = changedHand.players[0].hand.pop()!;
  changedHand.deck.push(removed);
  assert.throws(() => viewGame(changedHand, 'a'), /finish the original.*hand/i);
  const bypassedDiscard = reload(game);
  bypassedDiscard.decision = null;
  bypassedDiscard.discoveryStash!.stage = 'complete';
  bypassedDiscard.discoveryStash!.signature = discoveryStashSignature(
    bypassedDiscard.discoveryStash!,
  );
  assert.throws(
    () => viewGame(bypassedDiscard, 'a'),
    /stash.*discard|full.*hand/i,
  );

  const done = applyAction(reload(game), 'a', {
    type: 'decision',
    event: decision.event,
    card: selected.id,
  });
  assert.equal(done.discoveryStash?.stage, 'complete');
  assert.equal(done.players[0].hand.length, 4);
  assert.equal(
    done.discard.filter((card) => card.id === selected.id).length,
    1,
  );
  assert.deepEqual(normalizeAutomaticGame(done), done);
});

void test('pre-Discovery saved games remain valid without synthesized component state', () => {
  let game = createGame('OLDROOM1', newPlayer('a', 'Atreides', 'atreides'));
  joinGame(game, newPlayer('g', 'Guild', 'guild'));
  for (const player of game.players)
    game = applyAction(game, player.id, { type: 'ready' });
  game = applyAction(game, 'a', { type: 'start' });
  while (game.status === 'setup') {
    const player = game.players.find(
      (candidate) => candidate.traitorChoices.length,
    );
    assert.ok(player);
    game = applyAction(game, player.id, {
      type: 'traitor',
      leader: player.traitorChoices[0],
    });
  }
  const restored = reload(game);
  assert.equal(restored.discoveryEnabled, undefined);
  assert.equal(restored.discoveries, undefined);
  assert.equal(restored.discoveryStash, undefined);
  assert.equal(restored.greatMaker, undefined);
  const view = viewGame(restored, 'a');
  assert.equal(view.discoveries, null);
  assert.equal(view.greatMaker, null);
  assert.doesNotThrow(() => normalizeAutomaticGame(restored));
  assert.equal(restored.discoveries, undefined);
  assert.equal(restored.greatMaker, undefined);
});
