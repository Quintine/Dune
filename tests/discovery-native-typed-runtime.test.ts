import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, normalizeAutomaticGame, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { gameDistance, gameTerritories } from '../game/board';
import { DISCOVERY_SPICE_CARDS } from '../game/discoveries';
import {
  MOBILE_LOCATION, MOBILE_STRONGHOLD, nativeTypedCard, nativeTypedCollection,
  nativeTypedCustody, nativeTypedEntry, nativeTypedFaceDance, nativeTypedMovementTurn,
  nativeTypedPhase, nativeTypedPlace, nativeTypedPlayer, nativeTypedReload,
  nativeTypedReveal, nativeTypedSetup, nativeTypedStep,
} from './fixture-discovery-native-typed';

function rejectUnchanged(game: Game, owner: string, action: Action) {
  const before = nativeTypedReload(game);
  assert.throws(() => applyAction(game, owner, action));
  assert.deepEqual(game, before);
}
function legalPolicies(game: Game, owner: string) {
  assert.equal(DIFFICULTIES.length, 4);
  for (const difficulty of DIFFICULTIES) {
    const view = viewGame(game, owner);
    view.players.find(p => p.id === owner)!.bot = difficulty;
    const actions = botActions(view);
    assert.ok(actions.length > 0);
    for (const action of actions) {
      const result = applyAction(nativeTypedReload(game), owner, action);
      nativeTypedCustody(result);
    }
  }
}
function entryAction(game: Game, groups?: unknown): Action {
  const owner = game.decision!.player;
  const offer = viewGame(game, owner).discoveryEntry!;
  return { type: 'decision', accept: true, event: offer.event, groups: groups ?? offer.sources };
}
function settle(state: Game): Game {
  let game = state;
  for (let step = 0; step < 100 && (game.decision || game.response || game.pendingShipment); step++)
    game = nativeTypedStep(game);
  assert.ok(!game.decision && !game.response && !game.pendingShipment);
  return game;
}

void test('fresh E1 Discovery uses original 47-card setup, Sandtrout, seven cards/eight tokens, HMS and native private deals', () => {
  for (const advanced of [false, true]) for (const tech of [false, true]) {
    const { game, initialized, lobby } = nativeTypedSetup({ advanced, tech });
    assert.equal(game.discoveryEnabled, true);
    assert.equal(game.leaderSkills, undefined);
    assert.equal(game.strongholdCards, undefined);
    assert.equal(game.homeworlds, undefined);
    assert.equal(game.nexusCards, undefined);
    assert.deepEqual(initialized.spiceDeck.flatMap(c => 'territory' in c && c.discovery ? [c.discovery] : []).sort(),
      DISCOVERY_SPICE_CARDS.map(c => c.discovery).sort());
    assert.equal(viewGame(initialized, 'i').discoveries!.tokens.length, 0);
    assert.equal(viewGame(game, 't').players.find(p => p.id === 't')!.faceDancers!.length, 3);
    assert.equal(viewGame(game, 'g').players.find(p => p.id === 't')!.faceDancers, undefined);
    assert.equal(nativeTypedPlayer(game, 'i').elites!.reserves, 4);
    assert.equal(nativeTypedPlayer(game, 'i').elites!.forces[MOBILE_LOCATION], 3);
    if (tech) {
      assert.equal(game.techTokens!.heighliners.owner, 'i');
      assert.equal(game.techTokens!.axlotl.owner, 't');
      assert.equal(game.techTokens!.production.owner, 'f');
    } else assert.equal(game.techTokens, undefined);
    const before = nativeTypedReload(lobby);
    assert.throws(() => applyAction(lobby, lobby.host, { type: 'start' }));
    assert.deepEqual(lobby, before);
    nativeTypedCustody(game);
  }
});

void test('original native Cyborg/Suboid and ordinary/starred Fremen free entry transfers only actual typed counters once', () => {
  for (const advanced of [false, true]) for (const owner of ['i', 'f']) {
    const { game, source } = nativeTypedEntry({ advanced, tech: true }, owner);
    const player = nativeTypedPlayer(game, owner);
    const expectedElite = owner === 'i' || advanced ? 1 : 0;
    const offer = viewGame(game, owner).discoveryEntry!;
    assert.deepEqual(offer.sources, [{ source, normal: 2, elite: expectedElite }]);
    assert.ok(offer.sources.every(group => group.source !== MOBILE_LOCATION));
    const before = nativeTypedReload(game);
    const action = entryAction(game, [{ source, normal: 1, elite: expectedElite }]);
    legalPolicies(game, owner);
    const done = applyAction(nativeTypedReload(game), owner, action);
    const arrived = nativeTypedPlayer(done, owner);
    assert.equal(arrived.forces['shrine:0'], 1 + expectedElite);
    assert.equal(arrived.elites?.forces['shrine:0'] ?? 0, expectedElite);
    assert.equal(arrived.forces[source], 1);
    assert.equal(arrived.elites?.forces[source] ?? 0, 0);
    assert.equal(arrived.reserves, player.reserves);
    assert.equal(arrived.elites?.reserves, player.elites?.reserves);
    assert.equal(arrived.spice, player.spice);
    assert.equal(arrived.moved, player.moved);
    assert.equal(arrived.shipped, player.shipped);
    assert.deepEqual(done.techTokens, game.techTokens);
    const progress = viewGame(done, owner).victoryProgress.find(row => row.player === owner)!;
    assert.deepEqual(progress.strongholds, owner === 'i' ? [MOBILE_STRONGHOLD] : []);
    assert.equal(progress.techStronghold, false);
    assert.equal(progress.qualifies, false);
    assert.equal(done.discoveryEntry, undefined);
    assert.deepEqual(done.discoveries!.newlyRevealed, []);
    assert.deepEqual(game, before);
    assert.deepEqual(normalizeAutomaticGame(nativeTypedReload(done)), done);
    rejectUnchanged(done, owner, action);
    nativeTypedCustody(done);
  }
});

void test('duplicate, stale, foreign and overdrawn native typed free entry selections reject atomically across JSON', () => {
  const { game, source } = nativeTypedEntry({ advanced: true });
  const group = { source, normal: 1, elite: 1 };
  const action = entryAction(game, [group]);
  rejectUnchanged(game, 't', action);
  rejectUnchanged(game, 'i', { ...action, event: 'old-native-entry' });
  rejectUnchanged(game, 'i', entryAction(game, [group, group]));
  rejectUnchanged(game, 'i', entryAction(game, [{ source, normal: 3, elite: 1 }]));
  rejectUnchanged(game, 'i', entryAction(game, [{ source, normal: 0, elite: 2 }]));
  rejectUnchanged(game, 'i', entryAction(game, [{ source: MOBILE_LOCATION, normal: 1, elite: 1 }]));
  const reloaded = nativeTypedReload(game);
  const publicOffer = viewGame(reloaded, 'i').discoveryEntry!;
  publicOffer.sources[0].elite = 7;
  assert.deepEqual(reloaded, game);
  assert.ok(game.decision?.kind === 'discoveryEntry');
  const declined = applyAction(reloaded, 'i', { type: 'decision', accept: false, event: game.decision!.event });
  assert.equal(nativeTypedPlayer(declined, 'i').forces['shrine:0'], undefined);
  assert.equal(nativeTypedPlayer(declined, 'i').forces[source], 3);
  nativeTypedCustody(declined);
});

void test('typed native free entry keeps a signed pending child and resumes exactly once after original advisor controls', () => {
  let game = nativeTypedEntry({ advanced: true, advisors: true }).game;
  nativeTypedPlace(game, 'b', 'shrine:0', 1);
  const action = entryAction(game);
  game = applyAction(game, 'i', action);
  assert.equal(game.discoveryEntry?.stage, 'arrival');
  assert.equal(game.decision?.kind, 'intrusion');
  assert.equal(nativeTypedPlayer(game, 'i').forces['shrine:0'], 3);
  assert.equal(nativeTypedPlayer(game, 'i').elites!.forces['shrine:0'], 1);
  const malformed = nativeTypedReload(game);
  if (malformed.decision?.kind === 'intrusion') malformed.decision.discoveryEntry!.elite = 0;
  assert.throws(() => viewGame(malformed, 'b'));
  rejectUnchanged(malformed, 'b', { type: 'decision', accept: false });
  const arrived = nativeTypedReload(game);
  nativeTypedPlayer(arrived, 'i').elites!.forces['shrine:0'] = 0;
  assert.throws(() => normalizeAutomaticGame(arrived));
  rejectUnchanged(arrived, 'b', { type: 'decision', accept: false });
  game = applyAction(nativeTypedReload(game), 'b', { type: 'decision', accept: true });
  game = settle(nativeTypedReload(game));
  assert.equal(game.discoveryEntry, undefined);
  assert.equal(game.phase, 0);
  assert.equal(nativeTypedPlayer(game, 'i').forces['shrine:0'], 3);
  rejectUnchanged(game, 'i', action);
  nativeTypedCustody(game);
});

void test('ordinary paid Cyborg shipment and nested movement preserve physical HMS identity and optional native industry', () => {
  for (const advanced of [false, true]) for (const tech of [false, true]) {
    const entry = nativeTypedEntry({ advanced, tech });
    assert.ok(entry.game.decision?.kind === 'discoveryEntry');
    let game = applyAction(entry.game, 'i', { type: 'decision', accept: false, event: entry.game.decision!.event });
    game = nativeTypedMovementTurn(nativeTypedPhase(game, 5), 'i');
    const before = nativeTypedReload(game);
    const hms = nativeTypedPlayer(game, 'i').forces[MOBILE_LOCATION];
    game = settle(applyAction(nativeTypedReload(game), 'i', { type: 'ship', territory: 'shrine', sector: 0, amount: 2, elite: 1 }));
    assert.equal(nativeTypedPlayer(game, 'i').forces['shrine:0'], 2);
    assert.equal(nativeTypedPlayer(game, 'i').elites!.forces['shrine:0'], 1);
    assert.equal(nativeTypedPlayer(game, 'i').reserves, nativeTypedPlayer(before, 'i').reserves - 2);
    assert.equal(nativeTypedPlayer(game, 'i').elites!.reserves, nativeTypedPlayer(before, 'i').elites!.reserves - 1);
    assert.equal(nativeTypedPlayer(game, 'i').spice, nativeTypedPlayer(before, 'i').spice - 2);
    assert.equal(nativeTypedPlayer(game, 'g').spice, nativeTypedPlayer(before, 'g').spice + 2);
    assert.equal(nativeTypedPlayer(game, 'i').shipped, true);
    assert.equal(nativeTypedPlayer(game, 'i').forces[MOBILE_LOCATION], hms);
    assert.notEqual(MOBILE_STRONGHOLD, 'shrine');
    assert.equal(gameDistance(game, entry.source, 'shrine:0'), 1);
    const movement: Action = { type: 'move', forces: { [entry.source]: 2 }, eliteForces: { [entry.source]: 1 }, territory: 'shrine', sector: 0 };
    const moving = nativeTypedReload(game);
    game = settle(applyAction(game, 'i', movement));
    assert.equal(nativeTypedPlayer(game, 'i').forces['shrine:0'], 4);
    assert.equal(nativeTypedPlayer(game, 'i').elites!.forces['shrine:0'], 2);
    assert.equal(nativeTypedPlayer(game, 'i').forces[entry.source], 1);
    assert.equal(nativeTypedPlayer(game, 'i').moved, 1);
    assert.equal(nativeTypedPlayer(game, 'i').spice, nativeTypedPlayer(moving, 'i').spice);
    rejectUnchanged(game, 'i', movement);
    if (tech) {
      assert.equal(game.techTokens!.heighliners.triggeredTurn, game.turn);
      assert.equal(game.techTokens!.heighliners.spice, 1);
      const wallet = nativeTypedPlayer(game, 'i').spice;
      for (let step = 0; step < 100 && game.phase === 5; step++) game = nativeTypedStep(game);
      assert.notEqual(game.phase, 5);
      assert.equal(game.techTokens!.heighliners.spice, 0);
      assert.equal(nativeTypedPlayer(game, 'i').spice, wallet + 1);
    }
    nativeTypedCustody(game);
  }
});

void test('native Tleilaxu Collection stash draws an actual E1 card privately and all four policies recover a full hand', () => {
  const position = nativeTypedCollection('treachery-card-stash', 't', { advanced: true });
  const player = nativeTypedPlayer(position.game, 't');
  while (player.hand.length < 4) nativeTypedCard(position.game, 't', () => true);
  const drawn = position.game.deck[0];
  const before = player.hand.map(c => c.id);
  const game = nativeTypedReveal(position);
  assert.equal(game.decision?.kind, 'discoveryDiscard');
  assert.deepEqual(nativeTypedPlayer(game, 't').hand.map(c => c.id), [...before, drawn.id]);
  assert.equal(viewGame(game, 'g').players.find(p => p.id === 't')!.hand, undefined);
  assert.equal(JSON.stringify(viewGame(game, 'g')).includes(JSON.stringify(drawn.id)), false);
  legalPolicies(game, 't');
  const action = { type: 'decision', event: game.discoveryStash!.event, card: drawn.id };
  rejectUnchanged(game, 'g', action);
  rejectUnchanged(game, 't', { ...action, event: 'old-native-stash' });
  const done = applyAction(nativeTypedReload(game), 't', action);
  assert.equal(nativeTypedPlayer(done, 't').hand.length, 4);
  assert.ok(done.discard.some(c => c.id === drawn.id));
  assert.equal(done.discoveries!.tokens.find(t => t.id === position.token)!.status, 'removed');
  rejectUnchanged(done, 't', action);
  nativeTypedCustody(done);
});

void test('native nested battle retains original winner cards/Tech rewards before valid Face Dance replaces from actual sources', () => {
  for (const advanced of [false, true]) for (const tech of [false, true]) {
    const fixture = nativeTypedFaceDance(advanced, tech);
    const { game, action } = fixture;
    assert.ok(nativeTypedPlayer(game, 'g').hand.some(c => c.id === fixture.weapon.id));
    assert.ok(game.discard.some(c => c.id === fixture.defense.id));
    assert.ok(game.discard.some(c => c.id === fixture.loserCard.id));
    assert.equal(nativeTypedPlayer(game, 't').tanks, 8);
    assert.equal(game.lastBattleContext!.winner, 'g');
    if (tech) {
      assert.equal(fixture.cleanup.techTokens!.axlotl.owner, 't');
      assert.equal(game.techTokens!.axlotl.owner, 'g');
      assert.equal(game.techTokens!.heighliners.owner, 'i');
      assert.equal(game.techTokens!.production.owner, 'f');
    }
    legalPolicies(game, 't');
    rejectUnchanged(game, 'i', action);
    rejectUnchanged(game, 't', { ...action, sector: 1 });
    rejectUnchanged(game, 't', { ...action, sources: { reserves: 9 } });
    rejectUnchanged(game, 't', { ...action, sources: { [MOBILE_LOCATION]: 1 } });
    const done = applyAction(nativeTypedReload(game), 't', action);
    assert.equal(nativeTypedPlayer(done, 'g').forces['shrine:0'], undefined);
    assert.equal(nativeTypedPlayer(done, 'g').reserves, nativeTypedPlayer(game, 'g').reserves + 8);
    assert.equal(nativeTypedPlayer(done, 't').forces['shrine:0'], 3);
    assert.equal(nativeTypedPlayer(done, 't').forces[fixture.source], 1);
    assert.equal(nativeTypedPlayer(done, 't').reserves, nativeTypedPlayer(game, 't').reserves - 1);
    assert.equal(nativeTypedPlayer(done, 't').spice, nativeTypedPlayer(game, 't').spice);
    assert.equal(nativeTypedPlayer(done, 'g').leaders.find(l => l.id === fixture.winnerLeader)!.dead, true);
    assert.deepEqual(done.techTokens, game.techTokens);
    assert.equal(done.phase, 6);
    assert.deepEqual(viewGame(done, 't').victoryProgress.find(row => row.player === 't')!.strongholds, []);
    rejectUnchanged(done, 't', action);
    nativeTypedCustody(done);
  }
});

void test('native third Face Dance refills only genuine private identities with conserved Traitor/Face Dancer inventory', () => {
  const fixture = nativeTypedFaceDance(true);
  // Labelled original revealed-card history, not a fabricated card or new identity.
  for (const dancer of nativeTypedPlayer(fixture.game, 't').faceDancers!)
    dancer.revealed = dancer.leader !== fixture.winnerLeader;
  const identities = [...fixture.game.traitorReserve!,
    ...nativeTypedPlayer(fixture.game, 't').faceDancers!.map(c => c.leader)].sort();
  const done = applyAction(nativeTypedReload(fixture.game), 't', fixture.action);
  assert.equal(nativeTypedPlayer(done, 't').faceDancers!.length, 3);
  assert.ok(nativeTypedPlayer(done, 't').faceDancers!.every(c => !c.revealed));
  assert.deepEqual([...done.traitorReserve!, ...nativeTypedPlayer(done, 't').faceDancers!.map(c => c.leader)].sort(), identities);
  assert.equal(viewGame(done, 'i').players.find(p => p.id === 't')!.faceDancers, undefined);
  nativeTypedCustody(done);
});

void test('original E1 Discovery Spice Blow producer destroys actual ordinary/starred groups before physical placement', () => {
  for (const advanced of [false, true]) {
    let game = nativeTypedSetup({ advanced }).game;
    game = nativeTypedPhase(game, 1);
    const printed = DISCOVERY_SPICE_CARDS.find(card => card.sector !== game.storm)!;
    const index = game.spiceDeck.findIndex(card => 'territory' in card && card.discovery === printed.discovery);
    assert.ok(index >= 0);
    const [chosen] = game.spiceDeck.splice(index, 1);
    game.spiceDeck.unshift(chosen);
    // One blow only: another card for the same territory would stack a second
    // deposit and make the printed amount depend on the random storm.
    game.spiceDeck = game.spiceDeck.filter(card => card === chosen || !('territory' in card && card.territory === printed.territory));
    const key = `${printed.territory}:${printed.sector}`;
    nativeTypedPlace(game, 'i', key, 1, 1);
    nativeTypedPlace(game, 'f', key, 1, advanced ? 1 : 0);
    const before = nativeTypedReload(game);
    for (let step = 0; step < 100 && game.phase === 1; step++) game = nativeTypedStep(game);
    assert.ok(game.spiceDiscard.flat().some(card => 'territory' in card && card.discovery === printed.discovery));
    assert.equal(game.spice[key], 6);
    for (const id of ['i', 'f']) {
      const old = nativeTypedPlayer(before, id), player = nativeTypedPlayer(game, id);
      assert.equal(player.forces[key], undefined);
      assert.equal(player.tanks, old.tanks + old.forces[key]);
      assert.equal(player.elites?.forces[key], undefined);
      if (player.elites) assert.equal(player.elites.tanks, old.elites!.tanks + (old.elites!.forces[key] ?? 0));
    }
    assert.equal(game.discoveries!.tokens.filter(token => token.status === 'placed').length, 1);
    assert.ok(gameTerritories(game).every(t => t.id !== 'shrine'));
    nativeTypedCustody(game);
  }
});
