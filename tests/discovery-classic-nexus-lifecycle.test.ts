import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { baseDeck } from '../game/cards';
import { territory } from '../game/board';
import { DIFFICULTIES } from '../game/bot-profiles';
import { botActions } from '../game/bots';
import { validateNexusCards } from '../game/nexus-cards';
import { validateDiscoveryState } from '../game/discoveries';
import { greatMakerRideAction } from '../game/great-maker-options';
import { quoteEcazInquiry } from '../game/nexus-ecaz-inquiry';
import { nexusCleanPlayBlocked } from '../game/nexus-play-boundary';
import { strongholdControllers } from '../game/stronghold-cards';
import {
  advanceClassicDiscoveryNexus, applyClassicDiscoveryNexusStep, classicDiscoveryNexusClean,
  classicDiscoveryNexusPlayer, createClassicDiscoveryNexusFixture, enterClassicDiscoveryNexus,
  finishClassicDiscoveryNexusMentat, formClassicDiscoveryNexusAlliance, nextClassicDiscoveryNexusStep,
  openClassicDiscoveryNexusAlliance, openClassicDiscoveryNexusEncounter, revealClassicDiscoveryNexus,
  voteClassicDiscoveryNexus, type ClassicDiscoveryNexusFixture,
} from './fixture-discovery-classic-nexus';

const reload = (game: Game): Game => JSON.parse(JSON.stringify(game));
function custody(game: Game): void {
  validateNexusCards(game.nexusCards!.cards!, game.players);
  validateDiscoveryState(game.discoveries!);
  assert.deepEqual([...game.deck, ...game.discard, ...game.players.flatMap(player => player.hand)]
    .map(card => card.id).sort(), baseDeck().map(card => card.id).sort());
  for (const player of game.players) {
    assert.equal(player.reserves + player.tanks + Object.values(player.forces).reduce((sum, amount) => sum + amount, 0), 20);
    if (player.elites) assert.equal(player.elites.reserves + player.elites.tanks +
      Object.values(player.elites.forces).reduce((sum, amount) => sum + amount, 0), player.faction === 'emperor' ? 5 : 3);
  }
  assert.ok(!(game.discoveryEntry && game.nexusCards!.phase?.stage === 'drawing'));
  assert.ok(!(game.greatMaker?.stage === 'vote' && game.nexusCards!.phase?.stage === 'drawing'));
}
function rejectUnchanged(game: Game, actor: string, action: Action): void {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before);
}

/** Real majority, optional reserve-ride decline, real negotiated alliance, then
 * the single source-closing deal. Only the remaining physical Nexus deck order
 * is positioned before that deal; no card is transferred into a hand. */
function closingDraw(fixture: ClassicDiscoveryNexusFixture): Game {
  let game = openClassicDiscoveryNexusEncounter(fixture);
  game = voteClassicDiscoveryNexus(game, game.players.map(() => true));
  game = openClassicDiscoveryNexusAlliance(game);
  assert.ok(fixture.fremen);
  game = formClassicDiscoveryNexusAlliance(game, fixture.opponent, fixture.fremen);
  const deck = game.nexusCards!.cards!.deck;
  const index = deck.indexOf('ecaz'); assert.ok(index >= 0);
  deck.unshift(deck.splice(index, 1)[0]);
  game = advanceClassicDiscoveryNexus(game, state => state.nexusCards!.phase?.stage === 'drawing');
  assert.equal(game.phase, 1);
  assert.equal(game.nexus, false);
  assert.equal(game.discoveryEntry, undefined);
  assert.equal(game.greatMaker?.stage, 'complete');
  assert.deepEqual(game.nexusCards!.phase!.eligible, [fixture.collector]);
  assert.deepEqual(viewGame(game, fixture.opponent).nexusCards!.choices, []);
  const draw: Action = { type: 'nexusCardChoice', turn: game.turn, card: null, choice: 'draw', ownRedraws: 0 };
  const before = structuredClone(game), owner = classicDiscoveryNexusPlayer(game, fixture.collector);
  game = applyClassicDiscoveryNexusStep(game, { actor: fixture.collector, action: draw });
  assert.equal(game.phase, 2, 'Completing the original closing draw must release the next phase.');
  assert.equal(game.nexusCards!.phase!.stage, 'complete');
  assert.equal(game.nexusCards!.cards!.hands[fixture.collector], 'ecaz');
  assert.equal(classicDiscoveryNexusPlayer(game, fixture.collector).spice, owner.spice);
  assert.equal(game.nexusCards!.cards!.deck.length, before.nexusCards!.cards!.deck.length - 1);
  assert.deepEqual(game.wormRides, []);
  rejectUnchanged(game, fixture.collector, draw);
  custody(game);
  return game;
}
function secondCollection(fixture: ClassicDiscoveryNexusFixture, game: Game): Game {
  const shrine = game.discoveries!.tokens.find(token => token.face === 'shrine' && token.status === 'placed');
  assert.ok(shrine, 'The explicit original second Hiereg supply lottery must place Shrine.');
  game = advanceClassicDiscoveryNexus(game, state => state.phase === 5 && state.active === fixture.collector && classicDiscoveryNexusClean(state));
  const sector = territory(shrine.territory!).sectors.find(value => value !== game.storm);
  assert.notEqual(sector, undefined);
  game = applyClassicDiscoveryNexusStep(game, { actor: fixture.collector,
    action: { type: 'ship', territory: shrine.territory!, sector: sector!, amount: 1, elite: 0, allyPayment: 0 } });
  game = advanceClassicDiscoveryNexus(game, state => state.phase === 7 && classicDiscoveryNexusClean(state));
  return revealClassicDiscoveryNexus(game, fixture.collector, shrine.id);
}

void test('original staged Nexus/Discovery is playable from Basic and Advanced two-through-six seats through Mentat and free entry', () => {
  for (const advanced of [false, true]) for (const seats of [2, 3, 4, 5, 6] as const) {
    const fixture = createClassicDiscoveryNexusFixture({ advanced, seats, tech: seats >= 3, strongholds: advanced && seats >= 3 });
    assert.equal(fixture.setup.status, 'setup');
    assert.equal(fixture.setup.players.length, seats);
    assert.equal(fixture.setup.spiceDeck.length, 28);
    assert.equal(fixture.setup.discoveries!.tokens.length, 8);
    custody(fixture.setup);
    assert.equal(fixture.collection.turn, 1);
    assert.equal(classicDiscoveryNexusPlayer(fixture.collection, fixture.collector).forces[`${fixture.parent}:${fixture.parentSector}`], 3);
    assert.equal(fixture.firstMentat.before.phase, 8);
    assert.equal(fixture.firstMentat.after.turn, 2);
    assert.equal(fixture.game.phase, 0);
    assert.equal(fixture.game.discoveryEntry?.stage, 'choose');
    assert.equal(fixture.game.storm, fixture.firstMentat.before.storm, 'Free entry precedes original Storm movement.');
    assert.equal(fixture.game.nexusCards!.phase?.stage, 'complete');
    if (fixture.game.strongholdCards) {
      assert.equal(fixture.firstMentat.before.strongholdCards!.claimedTurn, 0);
      assert.equal(fixture.game.strongholdCards.claimedTurn, 1);
      assert.deepEqual(fixture.game.strongholdCards.owners, strongholdControllers(fixture.game.players, false));
      assert.equal(fixture.game.strongholdCards.owners.tueks_sietch, fixture.collector);
      assert.equal(fixture.game.strongholdCards.owners.sietch_tabr, fixture.fremen);
    }
    const before = classicDiscoveryNexusPlayer(fixture.game, fixture.collector);
    const entered = enterClassicDiscoveryNexus(reload(fixture.game), fixture.collector);
    const after = classicDiscoveryNexusPlayer(entered, fixture.collector);
    assert.equal(after.forces['cistern:0'], 1);
    assert.equal(after.forces[`${fixture.parent}:${fixture.parentSector}`], 2);
    assert.equal(after.spice, before.spice);
    assert.equal(after.shipped, before.shipped);
    assert.equal(after.moved, before.moved);
    assert.equal(entered.discoveryEntry, undefined);
    const encounter = advanceClassicDiscoveryNexus(entered, game => game.greatMaker?.stage === 'vote');
    assert.equal(encounter.turn, 2);
    assert.equal(classicDiscoveryNexusPlayer(encounter, fixture.opponent).forces[fixture.wormSource], undefined);
    assert.equal(classicDiscoveryNexusPlayer(encounter, fixture.opponent).tanks, 3);
    assert.equal(encounter.spice[fixture.wormSource], undefined);
    assert.equal(classicDiscoveryNexusPlayer(encounter, fixture.collector).forces['cistern:0'], 1);
    assert.deepEqual(encounter.wormRides, []);
    custody(encounter);
    const refused = voteClassicDiscoveryNexus(encounter, encounter.players.map(() => false));
    const mentat = finishClassicDiscoveryNexusMentat(refused);
    assert.equal(mentat.after.turn, 3);
    assert.equal(mentat.after.nexusCards!.phase?.stage, 'complete');
    assert.equal(mentat.after.discoveryEntry, undefined, 'An exhausted one-time entry cannot reopen without a newly revealed location.');
    custody(mentat.after);
  }
});

void test('fresh authenticated Game and seat IDs survive original setup, private cards and first free entry without mutating the caller', () => {
  const fixture = createClassicDiscoveryNexusFixture({ gameId: 'AUTHENTICATEDNEXUS', seatIds: ['auth-guild', 'auth-emperor', 'auth-fremen'], advanced: true });
  for (const initial of [fixture.initial, fixture.setup]) {
    const before = structuredClone(initial);
    const continued = createClassicDiscoveryNexusFixture({ initial });
    assert.deepEqual(initial, before);
    assert.equal(continued.game.code, initial.code);
    assert.deepEqual(continued.game.players.map(player => player.id), initial.players.map(player => player.id));
    assert.equal(continued.collector, 'auth-guild');
    assert.equal(continued.opponent, 'auth-emperor');
    assert.equal(continued.game.decision?.kind, 'discoveryEntry');
    custody(continued.game);
  }
  rejectUnchanged(fixture.initial, fixture.initial.host, { type: 'start' });
  assert.throws(() => createClassicDiscoveryNexusFixture({ initial: fixture.game }));
});

void test('Great Maker ordinary worm prefix precedes every vote; strict majority waits for all owners, and a tie adds no Nexus', () => {
  const fixture = createClassicDiscoveryNexusFixture({ seats: 4 });
  const original = openClassicDiscoveryNexusEncounter(fixture);
  assert.equal(original.greatMaker?.territory, 'hagga_basin');
  assert.equal(original.greatMaker?.stage, 'vote');
  assert.equal(classicDiscoveryNexusPlayer(original, fixture.opponent).tanks, 3);
  assert.equal(original.nexus, false);
  assert.ok(nexusCleanPlayBlocked(original));
  rejectUnchanged(original, original.order[1], { type: 'decision', event: original.greatMaker!.event, yes: true });
  let majority = voteClassicDiscoveryNexus(reload(original), [true, true, true]);
  assert.equal(majority.nexus, false);
  assert.equal(majority.decision?.player, majority.order[3]);
  majority = voteClassicDiscoveryNexus(majority, [false]);
  assert.equal(majority.nexus, true);
  assert.equal(majority.nexusCards!.phase!.occurred, true);
  assert.equal(majority.decision?.kind, 'greatMakerRide');
  const tied = voteClassicDiscoveryNexus(reload(original), [true, false, true, false]);
  assert.equal(tied.nexus, false);
  assert.equal(tied.nexusCards!.phase!.occurred, false);
  const afterTie = finishClassicDiscoveryNexusMentat(tied).after;
  assert.equal(afterTie.turn, 3);
  assert.equal(afterTie.nexusCards!.phase!.eligible.length, 0);
  custody(afterTie);
});

void test('a preceding original Shai-Hulud and tied Great Maker produce one negotiated Nexus and one closing deal, not duplicated rides or payments', () => {
  const fixture = createClassicDiscoveryNexusFixture({ advanced: true, seats: 4, ordinaryWormFirst: true });
  let game = openClassicDiscoveryNexusEncounter(fixture);
  assert.equal(game.nexus, true);
  assert.equal(classicDiscoveryNexusPlayer(game, fixture.opponent).tanks, 3);
  const wallets = game.players.map(player => player.spice);
  game = voteClassicDiscoveryNexus(game, [true, false, true, false]);
  assert.equal(game.nexus, true);
  game = openClassicDiscoveryNexusAlliance(game);
  game = formClassicDiscoveryNexusAlliance(game, fixture.opponent, fixture.fremen!);
  game = advanceClassicDiscoveryNexus(game, state => state.nexusCards!.phase?.stage === 'drawing');
  const action: Action = { type: 'nexusCardChoice', turn: game.turn, card: null, choice: 'draw', ownRedraws: 0 };
  game = applyClassicDiscoveryNexusStep(game, { actor: fixture.collector, action });
  rejectUnchanged(game, fixture.collector, action);
  game = advanceClassicDiscoveryNexus(game, state => state.phase === 2 && classicDiscoveryNexusClean(state));
  assert.equal(game.phase, 2);
  assert.deepEqual(game.players.map(player => player.spice), wallets);
  assert.equal(classicDiscoveryNexusPlayer(game, fixture.opponent).tanks, 3);
  assert.deepEqual(game.wormRides, []);
  rejectUnchanged(game, fixture.collector, action);
  custody(game);
});

void test('Fremen Great Maker reserve ride transfers real normal/starred counters into a separately revealed nested destination without spending shipment, movement or spice', () => {
  for (const advanced of [false, true]) {
    const fixture = createClassicDiscoveryNexusFixture({ advanced });
    let game = openClassicDiscoveryNexusEncounter(fixture, false);
    game = voteClassicDiscoveryNexus(game, game.players.map(() => false));
    assert.equal(game.decision?.kind, 'greatMakerRide');
    const fremen = classicDiscoveryNexusPlayer(game, fixture.fremen!);
    const elite = advanced ? 1 : 0;
    assert.ok((fremen.elites?.reserves ?? 0) >= elite);
    const ride = greatMakerRideAction(viewGame(game, fremen.id), 'cistern', 0, 2, elite);
    assert.ok(ride, 'A revealed separate location is a real Great Maker reserve destination.');
    const event = game.greatMaker!.event;
    game = applyClassicDiscoveryNexusStep(game, { actor: fremen.id, action: ride });
    const after = classicDiscoveryNexusPlayer(game, fremen.id);
    assert.equal(after.reserves, fremen.reserves - 2);
    assert.equal(after.forces['cistern:0'], 2);
    assert.equal(after.elites?.forces['cistern:0'] ?? 0, elite);
    assert.equal(after.elites?.reserves ?? 0, (fremen.elites?.reserves ?? 0) - elite);
    assert.equal(after.spice, fremen.spice);
    assert.equal(after.shipped, fremen.shipped);
    assert.equal(after.moved, fremen.moved);
    assert.deepEqual(Object.fromEntries(Object.entries(after.forces).filter(([key]) => key !== 'cistern:0')), fremen.forces);
    assert.equal(game.greatMaker?.stage, 'complete');
    assert.deepEqual(game.wormRides, []);
    assert.notEqual(game.response?.kind, 'wormSurvival');
    rejectUnchanged(game, fremen.id, { ...ride, event });
    const moved = advanceClassicDiscoveryNexus(game, state => state.phase === 5 && state.active === fremen.id && classicDiscoveryNexusClean(state));
    assert.equal(classicDiscoveryNexusPlayer(moved, fremen.id).shipped, false);
    custody(moved);
  }
});

void test('actual closing Nexus draw, end-Mentat settlement and next free-entry owner are sequential; held no-phase Nexus cannot interrupt that owner', () => {
  for (const advanced of [false, true]) {
    const fixture = createClassicDiscoveryNexusFixture({ advanced, strongholds: advanced });
    let game = secondCollection(fixture, closingDraw(fixture));
    const mentat = finishClassicDiscoveryNexusMentat(game);
    game = mentat.after;
    assert.equal(game.turn, 3);
    assert.equal(game.decision?.kind, 'discoveryEntry');
    assert.equal(game.nexusCards!.phase!.stage, 'complete');
    assert.equal(game.nexusCards!.cards!.hands[fixture.collector], 'ecaz');
    if (advanced) assert.equal(game.strongholdCards!.claimedTurn, 2);
    const blocked = quoteEcazInquiry(game, fixture.collector); assert.ok(blocked?.blocked);
    rejectUnchanged(game, fixture.collector, { type: 'nexusEcazInquiry', event: blocked.event, target: fixture.opponent });
    const before = classicDiscoveryNexusPlayer(game, fixture.collector);
    game = enterClassicDiscoveryNexus(game, fixture.collector);
    assert.equal(classicDiscoveryNexusPlayer(game, fixture.collector).forces['shrine:0'], 1);
    assert.equal(classicDiscoveryNexusPlayer(game, fixture.collector).spice, before.spice);
    assert.equal(game.discoveryEntry, undefined);
    const offer = quoteEcazInquiry(game, fixture.collector); assert.ok(offer && !offer.blocked);
    game = applyClassicDiscoveryNexusStep(game, { actor: fixture.collector,
      action: { type: 'nexusEcazInquiry', event: offer.event, target: fixture.opponent } });
    assert.equal(game.nexusCards!.cards!.hands[fixture.collector], null);
    assert.equal(game.nexusEcazInquiries!.length, 1);
    const storm = advanceClassicDiscoveryNexus(game, state => state.phase === 1 && classicDiscoveryNexusClean(state));
    assert.equal(classicDiscoveryNexusPlayer(storm, fixture.collector).forces['shrine:0'], 1);
    custody(storm);
  }
});

void test('additional original Advanced worm destroys the real parent army but not its nested Cistern, while owned placement blocks no-phase interruption', () => {
  const fixture = createClassicDiscoveryNexusFixture({ advanced: true });
  let game = secondCollection(fixture, closingDraw(fixture));
  const front: Game['spiceDeck'] = [];
  for (let index = 0; index < 2; index++) {
    const worm = game.spiceDeck.findIndex(card => 'worm' in card && !card.greatMaker);
    assert.ok(worm >= 0); front.push(game.spiceDeck.splice(worm, 1)[0]);
  }
  for (let index = 0; index < 2; index++) {
    const land = game.spiceDeck.findIndex(card => 'territory' in card && !card.discovery);
    assert.ok(land >= 0); front.push(game.spiceDeck.splice(land, 1)[0]);
  }
  // Explicit turn-three unplayed positions: two original worms, two original
  // land replacements. Native Fremen placement chooses the actual parent.
  game.spiceDeck.unshift(...front);
  game = finishClassicDiscoveryNexusMentat(game).after;
  game = enterClassicDiscoveryNexus(game, fixture.collector);
  game = advanceClassicDiscoveryNexus(game, state => state.decision?.kind === 'wormPlacement');
  assert.ok(nexusCleanPlayBlocked(game));
  const blocked = quoteEcazInquiry(game, fixture.collector); assert.ok(blocked?.blocked);
  rejectUnchanged(game, fixture.collector, { type: 'nexusEcazInquiry', event: blocked.event, target: fixture.opponent });
  const before = classicDiscoveryNexusPlayer(game, fixture.collector);
  assert.equal(before.forces[`${fixture.parent}:${fixture.parentSector}`], 2);
  assert.equal(before.forces['cistern:0'], 1);
  game = applyClassicDiscoveryNexusStep(game, { actor: fixture.fremen!,
    action: { type: 'decision', accept: true, territory: fixture.parent } });
  game = advanceClassicDiscoveryNexus(game, state => !state.response && !state.decision);
  const after = classicDiscoveryNexusPlayer(game, fixture.collector);
  assert.equal(after.forces[`${fixture.parent}:${fixture.parentSector}`], undefined);
  assert.equal(after.tanks, before.tanks + 2);
  assert.equal(after.forces['cistern:0'], 1);
  assert.equal(after.forces['shrine:0'], 1);
  custody(game);
});

void test('joining a later original alliance returns the real held Nexus card and removes draw eligibility before original closing controls continue', () => {
  const fixture = createClassicDiscoveryNexusFixture();
  let game = secondCollection(fixture, closingDraw(fixture));
  const worm = game.spiceDeck.findIndex(card => 'worm' in card && !card.greatMaker); assert.ok(worm >= 0);
  const original = game.spiceDeck.splice(worm, 1)[0];
  const land = game.spiceDeck.findIndex(card => 'territory' in card && !card.discovery); assert.ok(land >= 0);
  game.spiceDeck.unshift(original, game.spiceDeck.splice(land, 1)[0]);
  game = finishClassicDiscoveryNexusMentat(game).after;
  game = enterClassicDiscoveryNexus(game, fixture.collector);
  game = openClassicDiscoveryNexusAlliance(game);
  game = applyClassicDiscoveryNexusStep(game, { actor: fixture.opponent, action: { type: 'alliance', target: null } });
  game = formClassicDiscoveryNexusAlliance(game, fixture.collector, fixture.opponent);
  assert.equal(game.nexusCards!.cards!.hands[fixture.collector], null);
  assert.equal(game.nexusCards!.cards!.discard.filter(card => card === 'ecaz').length, 1);
  game = advanceClassicDiscoveryNexus(game, state => state.nexusCards!.phase?.stage === 'drawing');
  assert.deepEqual(game.nexusCards!.phase!.eligible, [fixture.fremen]);
  assert.deepEqual(viewGame(game, fixture.collector).nexusCards!.choices, []);
  rejectUnchanged(game, fixture.collector, { type: 'nexusCardChoice', turn: game.turn, card: null, choice: 'draw', ownRedraws: 0 });
  const next = nextClassicDiscoveryNexusStep(game); assert.ok(next);
  game = applyClassicDiscoveryNexusStep(game, next);
  assert.equal(game.phase, 2);
  custody(game);
});

void test('optional original Tech accrues after real next-turn charity and pays exactly once at native phase end', () => {
  for (const advanced of [false, true]) {
    const fixture = createClassicDiscoveryNexusFixture({ advanced, tech: true, techCharity: true });
    let game = openClassicDiscoveryNexusEncounter(fixture);
    game = voteClassicDiscoveryNexus(game, game.players.map(() => false));
    game = advanceClassicDiscoveryNexus(game, state => state.phase === 2 && classicDiscoveryNexusClean(state));
    const before = classicDiscoveryNexusPlayer(game, fixture.fremen!).spice;
    game = applyClassicDiscoveryNexusStep(game, { actor: fixture.opponent, action: { type: 'charity' } });
    game = advanceClassicDiscoveryNexus(game, state => classicDiscoveryNexusClean(state));
    assert.equal(classicDiscoveryNexusPlayer(game, fixture.opponent).spice, 2);
    assert.equal(game.techTokens!.production.spice, 1);
    assert.equal(game.techTokens!.production.triggeredTurn, 2);
    assert.equal(classicDiscoveryNexusPlayer(game, fixture.fremen!).spice, before);
    game = advanceClassicDiscoveryNexus(game, state => state.phase === 3 && classicDiscoveryNexusClean(state));
    assert.equal(game.techTokens!.production.spice, 0);
    assert.equal(classicDiscoveryNexusPlayer(game, fixture.fremen!).spice, before + 1);
    rejectUnchanged(game, fixture.opponent, { type: 'charity' });
    const revival = advanceClassicDiscoveryNexus(game, state => state.phase === 4 && classicDiscoveryNexusClean(state));
    assert.equal(classicDiscoveryNexusPlayer(revival, fixture.fremen!).spice, before + 1);
    custody(revival);
  }
});

void test('all four minimal policies have actual legal owned continuations at free entry, Great Maker vote/ride and original closing Nexus deal', () => {
  const fixture = createClassicDiscoveryNexusFixture({ advanced: true });
  const vote = openClassicDiscoveryNexusEncounter(fixture);
  const ride = voteClassicDiscoveryNexus(reload(vote), vote.players.map(() => true));
  let drawing = openClassicDiscoveryNexusAlliance(reload(ride));
  drawing = formClassicDiscoveryNexusAlliance(drawing, fixture.opponent, fixture.fremen!);
  drawing = advanceClassicDiscoveryNexus(drawing, game => game.nexusCards!.phase?.stage === 'drawing');
  const cases = [
    { game: fixture.game, owner: fixture.collector, type: 'decision' },
    { game: vote, owner: vote.decision!.player, type: 'decision' },
    { game: ride, owner: ride.decision!.player, type: 'decision' },
    { game: drawing, owner: fixture.collector, type: 'nexusCardChoice' },
  ];
  for (const difficulty of DIFFICULTIES) for (const current of cases) {
    const view = viewGame(current.game, current.owner);
    view.players.find(player => player.id === current.owner)!.bot = difficulty;
    const before = structuredClone(view);
    const action = botActions(view).find(action => action.type === current.type);
    assert.ok(action, `${difficulty} must answer the actual owned ${current.game.decision?.kind ?? 'closing Nexus draw'}.`);
    const after = applyClassicDiscoveryNexusStep(reload(current.game), { actor: current.owner, action });
    assert.deepEqual(view, before);
    if (current.game.decision?.kind === 'greatMakerVote')
      assert.equal(after.greatMaker!.votes.length, current.game.greatMaker!.votes.length + 1);
    else if (current.game.decision?.kind === 'greatMakerRide')
      assert.equal(after.greatMaker!.stage, 'complete');
    else if (current.game.decision?.kind === 'discoveryEntry')
      assert.equal(after.discoveryEntry, undefined);
    else assert.equal(after.nexusCards!.phase!.stage, 'complete');
    custody(after);
  }
});
