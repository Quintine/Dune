import test from 'node:test';
import assert from 'node:assert/strict';
import { isAdvisor } from '../game/advisors';
import { MOBILE_LOCATION } from '../game/board';
import { botActions } from '../game/bots';
import type { FactionId } from '../game/catalog';
import { createDiscoveryState } from '../game/discoveries';
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
import { enterDiscoveryCollection } from './fixture-discovery';

const reload = (game: Game): Game => JSON.parse(JSON.stringify(game)) as Game;

function giveExistingCard(
  game: Game,
  owner: string,
  predicate: (card: Game['deck'][number]) => boolean,
) {
  const recipient = game.players.find((player) => player.id === owner)!;
  const zones = [game.deck, game.discard, ...game.players.map((p) => p.hand)];
  for (const zone of zones) {
    const index = zone.findIndex(predicate);
    if (index < 0) continue;
    const [card] = zone.splice(index, 1);
    recipient.hand.push(card);
    return card;
  }
  assert.fail('The initialized physical deck has no Karama card.');
}

function physicalCardIds(game: Game) {
  return [...game.deck, ...game.discard, ...game.players.flatMap((p) => p.hand)]
    .map((card) => card.id)
    .sort();
}

function initialized(
  factions: [FactionId, FactionId, FactionId],
  expansions: string[] = [],
) {
  let game = createGame(
    'ENTRYREVIEW',
    newPlayer('a', 'Actor', factions[0]),
    true,
    expansions,
  );
  joinGame(game, newPlayer('b', 'Second', factions[1]));
  joinGame(game, newPlayer('g', 'Third', factions[2]));
  for (const player of game.players)
    game = applyAction(game, player.id, { type: 'ready' });
  game.discoveryEnabled = true;
  game = initializeDiscoveryGameForAudit(game);
  for (let step = 0; step < 80 && game.status === 'setup'; step++) {
    let next: Game | undefined;
    for (const player of game.players) {
      const view = viewGame(game, player.id);
      view.players.find((seat) => seat.id === player.id)!.bot = 'Easy';
      const action = botActions(view)[0];
      if (action) {
        next = applyAction(game, player.id, action);
        break;
      }
    }
    assert.ok(
      next,
      `setup stalled at ${game.setupStage}/${game.decision?.kind}`,
    );
    game = next;
  }
  assert.equal(game.status, 'playing');
  return game;
}

function revealCistern(game: Game, owner = 'a') {
  const token = enterDiscoveryCollection(game, 'cistern', owner);
  if (viewGame(game, owner).discoveries!.canInspect.includes(token.id))
    game = applyAction(game, owner, {
      type: 'discovery',
      token: token.id,
      reveal: false,
    });
  game = applyAction(game, owner, {
    type: 'discovery',
    token: token.id,
    reveal: true,
  });
  return { game, parent: `${token.territory}:${token.sector}` };
}

function nextTurn(game: Game) {
  Object.assign(game, {
    phase: 8,
    ready: [],
    decision: null,
    response: null,
    phaseOpening: null,
  });
  for (const player of game.players)
    game = applyAction(game, player.id, { type: 'ready' });
  return game;
}

function entryAction(game: Game): Action {
  assert.equal(game.decision?.kind, 'discoveryEntry');
  const offer = viewGame(game, game.decision.player).discoveryEntry!;
  return {
    type: 'decision',
    event: offer.event,
    accept: true,
    groups: offer.sources,
  };
}

function pendingAdvisorEntry(
  owner: 'atreides' | 'fremen' = 'atreides',
  existing = 0,
) {
  const revealed = revealCistern(initialized([owner, 'beneGesserit', 'guild']));
  let game = revealed.game;
  const parent = revealed.parent;
  const actor = game.players[0];
  if (owner === 'fremen') {
    actor.elites!.reserves--;
    actor.elites!.forces[parent] = 1;
  }
  if (existing) {
    actor.reserves -= existing;
    actor.forces['cistern:0'] = existing;
  }
  const beneGesserit = game.players[1];
  beneGesserit.reserves--;
  beneGesserit.forces['cistern:0'] = 1;
  const custody = physicalCardIds(game);
  giveExistingCard(game, actor.id, (card) => card.effect === 'karama');
  assert.deepEqual(physicalCardIds(game), custody);
  game = nextTurn(game);
  game = applyAction(game, actor.id, entryAction(game));
  assert.equal(game.discoveryEntry?.stage, 'arrival');
  assert.equal(game.decision?.kind, 'intrusion');
  return { game, parent };
}

void test('saved Discovery arrival binds the transferred force stack and rejects conflicting intrusion continuations', () => {
  const { game } = pendingAdvisorEntry();
  assert.equal(game.players[0].forces['cistern:0'], 2);
  assert.doesNotThrow(() => viewGame(game, 'a'));

  const retargeted = reload(game);
  retargeted.players[0].forces['cistern:0']--;
  retargeted.players[0].forces['arrakeen:10'] =
    (retargeted.players[0].forces['arrakeen:10'] ?? 0) + 1;
  assert.throws(
    () => viewGame(retargeted, 'a'),
    /transferred ordinary or elite force custody/,
  );

  const conflicting = reload(game);
  assert.equal(conflicting.decision?.kind, 'intrusion');
  if (conflicting.decision?.kind === 'intrusion')
    conflicting.decision.followup = {
      shipment: 'a',
      destination: 'polar_sink:0',
    };
  assert.throws(() => viewGame(conflicting, 'b'), /Bene Gesserit interaction/);

  const response = applyAction(reload(game), 'b', {
    type: 'decision',
    accept: true,
  });
  assert.equal(response.response?.kind, 'advisorFlip');
  assert.equal(response.response?.advisorResume, 'discoveryEntry');
  const misrouted = reload(response);
  misrouted.response!.advisorFollowup = {
    shipment: 'a',
    destination: 'polar_sink:0',
  };
  assert.throws(() => viewGame(misrouted, 'a'), /Bene Gesserit interaction/);
});

void test('saved Fedaykin arrival binds its elite overlay until the BG response finishes', () => {
  const { game, parent } = pendingAdvisorEntry('fremen');
  const fremen = game.players[0];
  assert.equal(fremen.forces['cistern:0'], 2);
  assert.equal(fremen.elites!.forces['cistern:0'], 1);

  const corrupted = reload(game);
  delete corrupted.players[0].elites!.forces['cistern:0'];
  corrupted.players[0].elites!.forces[parent] = 1;
  assert.throws(
    () => viewGame(corrupted, 'a'),
    /transferred ordinary or elite force custody/,
  );

  let resumed = applyAction(reload(game), 'b', {
    type: 'decision',
    accept: true,
  });
  while (resumed.response) {
    const responder = resumed.players.find(
      (player) => !resumed.response!.passed.includes(player.id),
    )!;
    resumed = applyAction(reload(resumed), responder.id, {
      type: 'passResponse',
    });
  }
  assert.equal(resumed.discoveryEntry, undefined);
  assert.equal(isAdvisor(resumed.players[1], 'cistern'), true);
  assert.equal(resumed.players[0].elites!.forces['cistern:0'], 1);
  assert.deepEqual(normalizeAutomaticGame(reload(resumed)), resumed);
});

void test('signed pre-arrival custody permits an existing owner stack beside BG and binds only the added forces', () => {
  const { game } = pendingAdvisorEntry('atreides', 1);
  assert.equal(game.discoveryEntry?.arrival?.destinationBefore, 1);
  assert.equal(game.discoveryEntry?.arrival?.destinationEliteBefore, 0);
  assert.equal(game.players[0].forces['cistern:0'], 3);
  assert.doesNotThrow(() => viewGame(reload(game), 'a'));

  let resumed = applyAction(reload(game), 'b', {
    type: 'decision',
    accept: false,
  });
  assert.equal(resumed.discoveryEntry, undefined);
  assert.equal(resumed.players[0].forces['cistern:0'], 3);
  resumed = normalizeAutomaticGame(reload(resumed));
  assert.equal(resumed.players[0].forces['cistern:0'], 3);
});

void test('automatic no-choice skips retain the Hidden Mobile Stronghold opening before normal storm continuation', () => {
  let game = createGame(
    'ENTRYHMSREVIEW',
    newPlayer('a', 'Ixians', 'ixians'),
    true,
    ['ix'],
  );
  game.players.push(
    newPlayer('b', 'Guild', 'guild'),
    newPlayer('g', 'Fremen', 'fremen'),
  );
  Object.assign(game, {
    status: 'playing',
    turn: 1,
    phase: 7,
    storm: 18,
    order: ['a', 'b', 'g'],
    ready: [],
    decision: null,
    response: null,
    phaseOpening: null,
    discoveryEnabled: true,
    discoveries: createDiscoveryState(() => 0),
  });
  for (const player of game.players) {
    player.forces = {};
    player.reserves = 20;
  }
  ({ game } = revealCistern(game));
  game.mobileStronghold = { location: 'polar_sink:0' };
  const ixians = game.players[0];
  ixians.reserves--;
  ixians.forces[MOBILE_LOCATION] = (ixians.forces[MOBILE_LOCATION] ?? 0) + 1;
  game = nextTurn(game);
  assert.ok(game.phaseOpening);
  for (const player of game.players)
    game = applyAction(game, player.id, { type: 'ready' });
  assert.equal(
    game.decision?.kind,
    'discoveryEntry',
    JSON.stringify({
      turn: game.turn,
      phase: game.phase,
      entry: game.discoveryEntry,
      newlyRevealed: game.discoveries?.newlyRevealed,
      forces: game.players[0].forces,
      storm: game.storm,
      stormPending: game.stormPending,
      mobileStronghold: game.mobileStronghold,
    }),
  );
  game = applyAction(game, 'a', {
    type: 'decision',
    event: game.decision!.event,
    accept: false,
  });
  assert.equal(game.discoveryEntry, undefined);
  assert.equal(game.decision?.kind, 'mobileStronghold');
  assert.equal(game.phase, 0);
  assert.deepEqual(normalizeAutomaticGame(reload(game)), game);

  game = applyAction(game, 'a', { type: 'decision', decline: true });
  assert.equal(game.phase, 0);
  assert.equal(game.decision, null);
  assert.ok(game.log.some((entry) => entry.text === 'Turn 2 begins.'));
});

void test('one-force entry uses singular chronicle wording and resumes the ordinary storm opening', () => {
  let { game } = revealCistern(initialized(['atreides', 'guild', 'fremen']));
  game = nextTurn(game);
  const offer = viewGame(game, 'a').discoveryEntry!;
  game = applyAction(game, 'a', {
    type: 'decision',
    event: offer.event,
    accept: true,
    groups: [{ ...offer.sources[0], normal: 1, elite: 0 }],
  });
  assert.equal(game.discoveryEntry, undefined);
  assert.equal(game.players[0].forces['cistern:0'], 1);
  assert.ok(
    game.log.some((entry) => entry.text.includes('moved 1 force from')),
  );
  assert.ok(game.log.every((entry) => !entry.text.includes('moved 1 forces')));
  assert.ok(game.log.some((entry) => entry.text === 'Turn 2 begins.'));
});
