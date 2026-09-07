import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  joinGame,
  newPlayer,
  viewGame,
  type Game,
} from '../game/engine';
import {
  baseDeck,
  leaders,
  battleLeaderStrength,
  type Card,
} from '../game/cards';
import { traitorDeck, CHEAP_HERO_TRAITOR } from '../game/traitors';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { createTechTokens } from '../game/tech-tokens';
/** Assign fixture cards by transferring their exact physical IDs from the deck. */
function setHand(g: Game, index: number, selected: Card[]) {
  const owner = g.players[index];
  const ids = new Set(selected.map((c) => c.id));
  assert.equal(ids.size, selected.length);
  const held = new Map(owner.hand.map((c) => [c.id, c]));
  for (const previous of owner.hand)
    if (!ids.has(previous.id)) g.deck.push(previous);
  owner.hand = selected.map((wanted) => {
    if (held.has(wanted.id)) return held.get(wanted.id)!;
    assert.ok(
      !g.players.some(
        (p, i) => i !== index && p.hand.some((c) => c.id === wanted.id),
      ),
      `Another player owns ${wanted.id}`,
    );
    const at = g.deck.findIndex((c) => c.id === wanted.id);
    assert.ok(at >= 0, `Fixture deck must contain ${wanted.id}`);
    return g.deck.splice(at, 1)[0];
  });
}
function fixture(setup = false) {
  let g = createGame('TLEILAXU2', newPlayer('a', 'Atreides', 'atreides'));
  joinGame(g, newPlayer('e', 'Emperor', 'emperor'));
  joinGame(g, newPlayer('t', 'Tleilaxu', 'guild'));
  g.players.forEach((p) => (p.ready = true));
  g = applyAction(g, 'a', { type: 'start' });
  const t = g.players[2];
  t.faction = 'tleilaxu';
  t.leaders = leaders('tleilaxu');
  t.traitorChoices = [];
  t.traitors = [];
  for (const p of g.players)
    p.traitorChoices = p.traitorChoices.map((id) =>
      id.replace('guild-', 'tleilaxu-'),
    );
  if (setup) return g;
  for (const p of g.players)
    if (p.traitorChoices.length)
      g = applyAction(g, p.id, {
        type: 'traitor',
        leader: p.traitorChoices[0],
      });
  g.phase = 6;
  g.active = 'a';
  g.order = ['a', 'e', 't'];
  g.storm = 18;
  // Return dealt cards before replacing setup hands for this battle fixture.
  g.deck.push(...g.players.flatMap((p) => p.hand));
  for (const p of g.players) {
    p.hand = [];
    p.traitors = [];
    p.spice = 20;
    p.forces = p.id === 't' ? { 'polar_sink:0': 2 } : { 'arrakeen:10': 5 };
    p.reserves = p.id === 't' ? 18 : 15;
  }
  g.players[2].faceDancers = [
    { leader: 'atreides-0', revealed: false },
    { leader: 'emperor-1', revealed: false },
    { leader: CHEAP_HERO_TRAITOR, revealed: false },
  ];
  g.traitorReserve = traitorDeck(g.players, true).filter(
    (id) => !g.players[2].faceDancers!.some((c) => c.leader === id),
  );
  return g;
}
function allow(state: Game) {
  let g = state;
  while (g.response)
    g = applyAction(
      g,
      g.players.find((p) => !g.response!.passed.includes(p.id))!.id,
      { type: 'passResponse' },
    );
  return g;
}
function prepare(state: Game, attacker = 'a', defender = 'e') {
  let g = allow(
    applyAction(state, attacker, {
      type: 'chooseBattle',
      territory: 'arrakeen',
      target: defender,
    }),
  );
  while (g.battle?.preparation)
    g = applyAction(g, g.battle.preparation.owner, {
      type: 'declineBattlePower',
    });
  if (g.decision?.kind === 'fullPlanOffer')
    g = applyAction(g, g.decision.player, { type: 'decision', decline: true });
  return g;
}
function battle(state: Game, a: object = {}, e: object = {}) {
  let g = prepare(state);
  g = applyAction(g, 'a', {
    type: 'battlePlan',
    dial: 1,
    leader: 'atreides-0',
    ...a,
  });
  g = applyAction(g, 'e', {
    type: 'battlePlan',
    dial: 0,
    leader: 'emperor-1',
    ...e,
  });
  g = applyAction(g, 'a', { type: 'traitorCall', call: false });
  return applyAction(g, 'e', { type: 'traitorCall', call: false });
}
const reveal = (
  g: Game,
  sources: Record<string, number> = { reserves: 2, 'polar_sink:0': 2 },
) =>
  applyAction(g, 't', { type: 'decision', reveal: true, sources, sector: 10 });
function conserved(g: Game) {
  for (const p of g.players)
    assert.equal(
      p.reserves + p.tanks + Object.values(p.forces).reduce((a, b) => a + b, 0),
      20,
      p.id,
    );
}
void test('Tleilaxu draw three private Face Dancers after ordinary selections, excluding held traitors', () => {
  let g = fixture(true);
  g.expansions = ['ix'];
  g = applyAction(g, 'a', {
    type: 'traitor',
    leader: g.players[0].traitorChoices[0],
  });
  assert.equal(g.players[2].faceDancers, undefined);
  g = applyAction(g, 'e', {
    type: 'traitor',
    leader: g.players[1].traitorChoices[0],
  });
  assert.equal(g.status, 'playing');
  assert.deepEqual(g.players[2].traitors, []);
  const all = [
    ...g.players.flatMap((p) => p.traitors),
    ...g.players[2].faceDancers!.map((c) => c.leader),
    ...g.traitorReserve!,
  ];
  assert.equal(all.length, 16);
  assert.equal(new Set(all).size, 16);
  assert.equal(g.players[2].faceDancers!.length, 3);
  assert.equal(viewGame(g, 'a').players[2].faceDancers, undefined);
  assert.equal('traitorReserve' in viewGame(g, 't'), false);
});
void test('Face Dancer replaces surviving winner forces from reserves and board without changing the battle rewards', () => {
  let g = battle(fixture());
  assert.equal(g.decision?.kind, 'faceDance');
  assert.equal(g.players[0].tanks, 1);
  assert.equal(g.players[1].tanks, 5);
  const snapshot = structuredClone(g);
  g = reveal(JSON.parse(JSON.stringify(g)));
  assert.equal(g.players[0].reserves, 19);
  assert.equal(g.players[0].tanks, 1);
  assert.equal(g.players[2].forces['arrakeen:10'], 4);
  assert.equal(g.players[2].forces['polar_sink:0'], undefined);
  assert.equal(g.players[0].leaders[0].dead, true);
  assert.equal(g.players[0].spice, snapshot.players[0].spice);
  assert.deepEqual(viewGame(g, 'e').players[2].revealedFaceDancers, [
    'atreides-0',
  ]);
  assert.equal(g.response, null);
  conserved(g);
});
void test('winner chooses cards and receives a tech token before Face Dancer replacement', () => {
  const before = fixture();
  const shield = baseDeck().find((c) => c.kind === 'shield')!;
  setHand(before, 0, [shield]);
  before.techTokens = createTechTokens();
  before.techTokens.heighliners.owner = 'e';
  let g = battle(before, { defense: shield.id });
  assert.equal(g.decision?.kind, 'battleCards');
  g = applyAction(g, 'a', { type: 'decision', discard: [] });
  assert.equal(g.decision?.kind, 'faceDance');
  assert.equal(g.techTokens?.heighliners.owner, 'a');
  g = reveal(g);
  assert.ok(g.players[0].hand.some((c) => c.id === shield.id));
  assert.equal(g.techTokens?.heighliners.owner, 'a');
});
void test('wrong owner, wrong matching card, excessive replacements and alien sources fail immutably', () => {
  const g = battle(fixture());
  const snapshot = structuredClone(g);
  assert.throws(
    () => applyAction(g, 'a', { type: 'decision', reveal: false }),
    /pending decision/,
  );
  assert.throws(() => reveal(g, { reserves: 5 }), /more forces/);
  assert.throws(() => reveal(g, { 'arrakeen:10': 1 }), /own reserves/);
  assert.throws(() => reveal(g, { reserves: -1 }), /integer/);
  assert.deepEqual(g, snapshot);
  const missing = structuredClone(g);
  missing.players[2].faceDancers = [];
  assert.throws(() => reveal(missing), /unrevealed Face Dancer/);
  assert.equal(viewGame(missing, 'a').decision?.kind, 'faceDance');
});
void test('Face Dancer can be declined without disclosing private cards', () => {
  const before = battle(fixture());
  const g = applyAction(before, 't', { type: 'decision', reveal: false });
  assert.equal(g.players[0].leaders[0].dead, false);
  assert.equal(g.players[0].forces['arrakeen:10'], 4);
  assert.deepEqual(g.players[2].faceDancers, before.players[2].faceDancers);
  assert.deepEqual(viewGame(g, 'a').players[2].revealedFaceDancers, []);
});
void test('winning Cheap Hero can be a Face Dancer even though the hero treachery card has been discarded', () => {
  const before = fixture();
  const heroes = baseDeck().filter((c) => c.kind === 'hero');
  setHand(before, 0, [heroes[0]]);
  setHand(before, 1, [heroes[1]]);
  let g = battle(before, { leader: heroes[0].id }, { leader: heroes[1].id });
  assert.equal(g.decision?.kind, 'faceDance');
  assert.ok(g.discard.some((c) => c.id === heroes[0].id));
  g = reveal(g);
  assert.ok(g.players[0].leaders.every((l) => !l.dead));
  assert.equal(g.players[2].forces['arrakeen:10'], 4);
});
void test('KH protects against traitors but does not stop a Face Dancer', () => {
  const before = fixture();
  before.advanced = true;
  before.players[0].battleLosses = 7;
  let g = battle(before, { kwisatz: true, dial: 0 });
  while (g.decision?.kind === 'battleLosses')
    g = applyAction(g, 'a', { type: 'decision', choice: 0 });
  assert.equal(g.decision?.kind, 'faceDance');
  g = reveal(g);
  assert.equal(g.players[0].leaders[0].dead, true);
  assert.equal(g.players[0].kwisatz?.dead, false);
});
void test('a winning leader already killed in battle is not killed a second time by its Face Dancer', () => {
  const before = fixture();
  const poison = baseDeck().find((c) => c.kind === 'poison')!;
  setHand(before, 1, [poison]);
  let g = battle(
    before,
    { dial: 3 },
    { leader: 'emperor-4', weapon: poison.id },
  );
  assert.equal(g.players[0].leaders[0].dead, true);
  const deaths = g.players[0].leaders[0].deaths;
  g = reveal(g, { reserves: 2 });
  assert.equal(g.players[0].leaders[0].deaths, deaths);
  assert.equal(g.players[0].spice, 25);
});
void test('the third reveal recycles all three Face Dancers into the private deck', () => {
  const before = fixture();
  before.players[2].faceDancers!.slice(1).forEach((c) => (c.revealed = true));
  const beforeCards = [
    ...before.traitorReserve!,
    ...before.players[2].faceDancers!.map((c) => c.leader),
  ].sort();
  const g = reveal(battle(before));
  assert.ok(g.players[2].faceDancers!.every((c) => !c.revealed));
  assert.equal(g.players[2].faceDancers!.length, 3);
  assert.deepEqual(
    [
      ...g.traitorReserve!,
      ...g.players[2].faceDancers!.map((c) => c.leader),
    ].sort(),
    beforeCards,
  );
});
void test('Mentat replacement is once per turn, private, cancelable and conserves the deck', () => {
  let g = fixture();
  g.phase = 8;
  const before = [
    ...g.traitorReserve!,
    ...g.players[2].faceDancers!.map((c) => c.leader),
  ].sort();
  g = applyAction(g, 't', { type: 'replaceFaceDancer', leader: 'atreides-0' });
  assert.equal(viewGame(g, 'a').response?.intent, undefined);
  g = allow(JSON.parse(JSON.stringify(g)));
  assert.equal(g.players[2].faceDancerReplacedTurn, g.turn);
  assert.deepEqual(
    [
      ...g.traitorReserve!,
      ...g.players[2].faceDancers!.map((c) => c.leader),
    ].sort(),
    before,
  );
  assert.throws(
    () =>
      applyAction(g, 't', {
        type: 'replaceFaceDancer',
        leader: g.players[2].faceDancers![0].leader,
      }),
    /one Face Dancer/,
  );
  let cancel = fixture();
  cancel.phase = 8;
  const karama = baseDeck().find((c) => c.effect === 'karama')!;
  setHand(cancel, 0, [karama]);
  const cards = structuredClone(cancel.players[2].faceDancers);
  cancel = applyAction(cancel, 't', {
    type: 'replaceFaceDancer',
    leader: 'atreides-0',
  });
  cancel = applyAction(cancel, 'a', {
    type: 'card',
    mode: 'cancel',
    card: karama.id,
  });
  assert.deepEqual(cancel.players[2].faceDancers, cards);
  assert.equal(cancel.players[2].faceDancerReplacedTurn, cancel.turn);
});
void test('Zoal copies the opposite leader disc, has zero against a hero, and retains a revival value of three', () => {
  const zoal = leaders('tleilaxu')[0];
  assert.equal(zoal.strength, 3);
  assert.equal(battleLeaderStrength(zoal, leaders('fremen')[0]), 7);
  assert.equal(battleLeaderStrength(zoal, undefined), 0);
  assert.deepEqual(
    leaders('ixians').map((l) => l.strength),
    [4, 5, 5, 2, 1],
  );
});
void test('Zoal battle totals and killed-leader spice use the copied strength rather than his revival cost', () => {
  const before = fixture();
  before.players[2].forces = { 'arrakeen:10': 5 };
  before.players[2].reserves = 15;
  before.players[0].forces = {};
  before.players[0].reserves = 20;
  before.active = 't';
  before.order = ['t', 'e', 'a'];
  const poison = baseDeck().find((c) => c.kind === 'poison')!;
  setHand(before, 1, [poison]);
  let g = prepare(before, 't', 'e');
  g = applyAction(g, 't', {
    type: 'battlePlan',
    leader: 'tleilaxu-0',
    dial: 5,
  });
  g = applyAction(g, 'e', {
    type: 'battlePlan',
    leader: 'emperor-0',
    dial: 0,
    weapon: poison.id,
  });
  g = applyAction(g, 't', { type: 'traitorCall', call: false });
  g = applyAction(g, 'e', { type: 'traitorCall', call: false });
  assert.equal(g.players[2].leaders[0].dead, true);
  assert.equal(g.players[1].spice, 26);
});
void test('all AI difficulties handle Face Dancer decisions using only their private matching cards', () => {
  for (const difficulty of DIFFICULTIES) {
    const g = battle(fixture());
    g.players[2].bot = difficulty;
    const action = botActions(viewGame(g, 't'))[0];
    assert.equal(action.reveal, true);
    assert.doesNotThrow(() => applyAction(g, 't', action));
    g.players[2].faceDancers = [];
    assert.deepEqual(botActions(viewGame(g, 't')), [
      { type: 'decision', reveal: false },
    ]);
  }
});
void test('expansion factions cannot bypass the unfinished-expansion start gate with an empty expansion selection', () => {
  const g = createGame('GATEDTEST2', newPlayer('t', 'Tleilaxu', 'tleilaxu'));
  joinGame(g, newPlayer('a', 'Atreides', 'atreides'));
  g.players.forEach((p) => (p.ready = true));
  assert.throws(
    () => applyAction(g, 't', { type: 'start' }),
    /Expansion factions/,
  );
});
void test('Face Dancer returns Sardaukar to reserves and leaves bystanding Bene Gesserit advisors in place', () => {
  const before = fixture();
  before.advanced = true;
  before.players[1].elites = {
    reserves: 2,
    tanks: 0,
    forces: { 'arrakeen:10': 3 },
    revived: 0,
  };
  before.players[2].faceDancers![0].leader = 'emperor-0';
  const bg = newPlayer('b', 'Bene Gesserit', 'beneGesserit');
  bg.forces = { 'arrakeen:10': 1 };
  bg.reserves = 19;
  bg.advisors = { arrakeen: { lockedTurn: before.turn } };
  before.players.push(bg);
  before.order.push('b');
  let g = battle(before, { dial: 0 }, { leader: 'emperor-0' });
  if (g.decision?.kind === 'battleLosses')
    g = applyAction(g, 'e', { type: 'decision', choice: 0 });
  assert.equal(g.decision?.kind, 'faceDance');
  g = reveal(g, { reserves: 5 });
  assert.equal(g.players[1].reserves, 20);
  assert.equal(g.players[1].elites?.reserves, 5);
  assert.deepEqual(g.players[1].elites?.forces, {});
  assert.equal(g.players[3].forces['arrakeen:10'], 1);
  assert.ok(g.players[3].advisors?.arrakeen);
  conserved(g);
});
void test('Harkonnen capture resolves first, then loss of its last native leader releases the captive', () => {
  const before = fixture();
  before.advanced = true;
  before.players[0].faction = 'harkonnen';
  before.players[0].leaders = leaders('harkonnen');
  before.players[0].leaders.slice(1).forEach((l) => {
    l.dead = true;
    l.deaths = 1;
  });
  before.players[2].faceDancers![0].leader = 'harkonnen-0';
  let g = battle(before, { leader: 'harkonnen-0', dial: 0 });
  if (g.decision?.kind === 'battleLosses')
    g = applyAction(g, 'a', { type: 'decision', choice: 0 });
  assert.equal(g.decision?.kind, 'captureOffer');
  g = allow(applyAction(g, 'a', { type: 'decision', accept: true }));
  assert.equal(g.decision?.kind, 'capturedLeader');
  const captive =
    g.decision?.kind === 'capturedLeader' ? g.decision.leader : '';
  g = applyAction(g, 'a', { type: 'decision', mode: 'keep' });
  assert.equal(g.decision?.kind, 'faceDance');
  assert.equal(
    g.players[1].leaders.find((l) => l.id === captive)?.capturedBy,
    'a',
  );
  g = reveal(g);
  assert.equal(
    g.players[1].leaders.find((l) => l.id === captive)?.capturedBy,
    undefined,
  );
});
void test('a successful traitor call against Zoal awards the opposing leader’s strength', () => {
  const before = fixture();
  before.players[2].forces = { 'arrakeen:10': 5 };
  before.players[2].reserves = 15;
  before.players[1].forces = {};
  before.players[1].reserves = 20;
  before.players[0].traitors = ['tleilaxu-0'];
  let g = prepare(before, 'a', 't');
  g = applyAction(g, 'a', {
    type: 'battlePlan',
    leader: 'atreides-0',
    dial: 0,
  });
  g = applyAction(g, 't', {
    type: 'battlePlan',
    leader: 'tleilaxu-0',
    dial: 0,
  });
  g = applyAction(g, 'a', { type: 'traitorCall', call: true });
  g = applyAction(g, 't', { type: 'traitorCall', call: false });
  assert.equal(g.players[0].spice, 25);
  assert.equal(g.players[2].leaders[0].dead, true);
});
void test('ordinary Karama cannot cancel a Face Dancer reveal or consume the selected card', () => {
  const before = fixture();
  const karama = baseDeck().find((c) => c.effect === 'karama')!;
  setHand(before, 0, [karama]);
  const g = battle(before);
  assert.throws(
    () =>
      applyAction(g, 'a', { type: 'card', mode: 'cancel', card: karama.id }),
    /pending decision/,
  );
  const after = reveal(g);
  assert.ok(after.players[0].hand.some((c) => c.id === karama.id));
});

void test('setup completes without a human selection when only Harkonnen and Tleilaxu are present', () => {
  const g = fixture(true);
  g.players = g.players.filter((p) => p.id !== 'e');
  g.players[0].faction = 'harkonnen';
  g.players[0].leaders = leaders('harkonnen');
  g.players[0].traitorChoices = [];
  g.players[0].traitors = [
    'harkonnen-0',
    'harkonnen-1',
    'harkonnen-2',
    'harkonnen-3',
  ];
  g.order = ['a', 't'];
  g.expansions = ['ix'];
  const next = applyAction(g, 't', { type: 'advanceBots' });
  assert.equal(next.status, 'playing');
  assert.equal(next.players[1].faceDancers?.length, 3);
  assert.ok(next.phaseOpening);
  assert.equal(
    new Set([
      ...next.players[0].traitors,
      ...next.traitorReserve!,
      ...next.players[1].faceDancers!.map((c) => c.leader),
    ]).size,
    11,
  );
});
