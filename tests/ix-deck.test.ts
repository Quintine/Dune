import test from 'node:test';
import assert from 'node:assert/strict';
import {
  baseDeck,
  ixDeck,
  treacheryDeck,
  harvesterAvailable,
} from '../game/cards';
import {
  applyAction,
  createGame,
  joinGame,
  newPlayer,
  shuffle,
  viewGame,
  type Game,
} from '../game/engine';
import {
  weaponKills,
  defaultVoiceMatch,
  validBattleCardPair,
} from '../game/battle-cards';
import { canUseAsKarama } from '../game/karama';
import { botActions, runBots } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
const card = (id: string) => ixDeck().find((c) => c.id === id)!;
function fixture() {
  const g = createGame(
    'IXDECK22',
    newPlayer('a', 'Atreides', 'atreides'),
    false,
    ['ix'],
  );
  g.players.push(newPlayer('e', 'Emperor', 'emperor'));
  g.status = 'playing';
  g.phase = 1;
  g.order = ['a', 'e'];
  g.storm = 18;
  g.turn = 2;
  for (const p of g.players) p.spice = 20;
  g.deck = treacheryDeck(['ix']);
  g.spiceDeck = [{ territory: 'red_chasm', sector: 7, amount: 8 }];
  return g;
}
function hold(g: Game, who: string, id: string) {
  const c = g.deck.find((c) => c.id === id)!;
  assert.ok(c);
  g.deck = g.deck.filter((c) => c.id !== id);
  g.players.find((p) => p.id === who)!.hand.push(c);
  return c;
}
function ready(state: Game) {
  let g = state;
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
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
const liveCards = (g: Game) =>
  [...g.deck, ...g.discard, ...g.players.flatMap((p) => p.hand)]
    .map((c) => c.id)
    .sort();
void test('the Ix expansion has fourteen distinct cards and combines into a forty-seven-card deck', () => {
  assert.deepEqual(
    ixDeck()
      .map((c) => c.name)
      .sort(),
    [
      'Amal',
      'Artillery Strike',
      'Basilia Weapon',
      'Chemistry',
      'Harvester',
      'Hunter Seeker',
      'Kull Wahad',
      'Poison Blade',
      'Poison Tooth',
      'Shield',
      'Shield Snooper',
      'Snooper',
      'Thumper',
      'Weirding Way',
    ].sort(),
  );
  const all = treacheryDeck(['ix']);
  assert.equal(all.length, 47);
  assert.equal(new Set(all.map((c) => c.id)).size, 47);
  assert.equal(treacheryDeck(['ix', 'ix']).length, 47);
  assert.equal(treacheryDeck().length, 33);
  for (const name of ['Shield', 'Snooper'])
    assert.equal(all.filter((c) => c.name === name).length, 5);
  assert.equal(all.filter((c) => c.effect === 'harvester').length, 2);
  assert.equal(all.filter((c) => c.kind === 'worthless').length, 6);
  assert.equal(all.filter((c) => c.kind === 'projectile').length, 5);
  assert.equal(all.filter((c) => c.kind === 'poison').length, 5);
  assert.equal(
    baseDeck().find((c) => c.id === 'treachery-7')?.name,
    'Ellaca Drug',
  );
  assert.equal(
    baseDeck().some((c) => c.name === 'Basilia Weapon'),
    false,
  );
  for (const expansion of ['choam', 'ecaz', 'unknown'])
    assert.throws(() => treacheryDeck([expansion]), /not implemented/);
});
void test('deck factories return independent physical cards and retain the earlier Ix identifiers', () => {
  const a = treacheryDeck(['ix']),
    b = treacheryDeck(['ix']);
  a[0].name = 'Changed';
  a.splice(1, 1);
  assert.equal(b.length, 47);
  assert.equal(b[0].name, 'Crysknife');
  for (const id of [
    'ix-poison-tooth',
    'ix-artillery',
    'ix-poison-blade',
    'ix-shield-snooper',
    'ix-weirding-way',
    'ix-chemistry',
    'ix-thumper',
    'ix-amal',
  ])
    assert.ok(b.some((c) => c.id === id));
});
void test('the added ordinary weapons, defenses and worthless card use their printed rule types', () => {
  const hunter = card('ix-hunter-seeker'),
    basilia = card('ix-basilia-weapon'),
    shield = card('ix-shield'),
    snooper = card('ix-snooper'),
    worthless = card('ix-kull-wahad');
  assert.equal(weaponKills(hunter, shield), false);
  assert.equal(weaponKills(hunter, snooper), true);
  assert.equal(weaponKills(basilia, snooper), false);
  assert.equal(weaponKills(basilia, shield), true);
  assert.equal(defaultVoiceMatch(hunter, 'projectile'), true);
  assert.equal(defaultVoiceMatch(basilia, 'poison'), true);
  assert.equal(defaultVoiceMatch(worthless, 'worthless'), true);
  assert.equal(validBattleCardPair(worthless, shield), true);
  assert.equal(canUseAsKarama(true, 'beneGesserit', worthless), true);
  assert.equal(canUseAsKarama(false, 'beneGesserit', worthless), false);
});
void test('two physical Harvesters can double the same open fresh blow without multiplying older spice', () => {
  let g = fixture();
  const first = hold(
      g,
      'a',
      baseDeck().find((c) => c.effect === 'harvester')!.id,
    ),
    second = hold(g, 'e', 'ix-harvester');
  g.spice['red_chasm:7'] = 3;
  g = ready(g);
  assert.equal(g.spice['red_chasm:7'], 11);
  g = applyAction(g, 'a', { type: 'card', card: first.id });
  assert.equal(g.spice['red_chasm:7'], 19);
  g = applyAction(g, 'a', { type: 'ready' });
  assert.deepEqual(g.ready, ['a']);
  g = applyAction(JSON.parse(JSON.stringify(g)), 'e', {
    type: 'card',
    card: second.id,
  });
  assert.equal(g.spice['red_chasm:7'], 35);
  assert.equal(g.spiceWindow!.amount, 32);
  assert.equal(g.spiceWindow!.harvesters, 2);
  assert.deepEqual(g.ready, []);
  assert.throws(
    () => applyAction(g, 'e', { type: 'card', card: second.id }),
    /special card in your hand/,
  );
  assert.deepEqual(
    liveCards(g),
    treacheryDeck(['ix'])
      .map((c) => c.id)
      .sort(),
  );
  g = ready(g);
  assert.equal(g.spiceWindow, null);
});
void test('the extra Harvester cannot restore storm-destroyed or worm-destroyed fresh spice', () => {
  let g = fixture();
  g.storm = 7;
  hold(g, 'a', 'ix-harvester');
  g = ready(g);
  g = applyAction(g, 'a', { type: 'card', card: 'ix-harvester' });
  assert.equal(g.spice['red_chasm:7'], undefined);
  g = fixture();
  hold(g, 'a', 'ix-harvester');
  g = ready(g);
  delete g.spice['red_chasm:7'];
  g.spiceWindow!.harvested = true;
  g.spiceWindow!.harvesters = 1;
  g.spiceWindow!.harvesterClosed = true;
  assert.throws(
    () => applyAction(g, 'a', { type: 'card', card: 'ix-harvester' }),
    /immediately after a spice blow/,
  );
  assert.equal(harvesterAvailable({ harvested: true }), false); // Legacy destroyed-window ambiguity stays closed.
});
void test('the Ix Shield still triggers lasgun explosions and the added poison still kills leaders in authoritative battles', () => {
  for (const explosive of [false, true]) {
    let g = fixture();
    g.phase = 6;
    g.active = 'a';
    for (const p of g.players) {
      p.forces = { 'arrakeen:10': 3 };
      p.reserves = 17;
    }
    const weapon = hold(
      g,
      'a',
      explosive
        ? baseDeck().find((c) => c.kind === 'lasgun')!.id
        : 'ix-basilia-weapon',
    );
    const defense = explosive ? hold(g, 'e', 'ix-shield') : null;
    g.battle = {
      territory: 'arrakeen',
      attacker: 'a',
      defender: 'e',
      plans: {},
      revealed: false,
      traitorCalls: {},
      prepared: true,
    };
    g = applyAction(g, 'a', {
      type: 'battlePlan',
      dial: 2,
      leader: g.players[0].leaders[0].id,
      weapon: weapon.id,
      defense: null,
      support: 0,
    });
    g = applyAction(g, 'e', {
      type: 'battlePlan',
      dial: 0,
      leader: g.players[1].leaders[0].id,
      weapon: null,
      defense: defense?.id ?? null,
      support: 0,
    });
    g = applyAction(g, 'a', { type: 'traitorCall', call: false });
    g = applyAction(g, 'e', { type: 'traitorCall', call: false });
    g = allow(g);
    assert.equal(g.players[1].leaders[0].dead, true);
    if (explosive) {
      assert.equal(g.players[0].tanks, 3);
      assert.equal(g.players[1].tanks, 3);
      assert.ok(g.discard.some((c) => c.id === 'ix-shield'));
    } else assert.equal(g.players[0].leaders[0].dead, false);
  }
});
void test('saved base Basilia labels normalize without changing expansion Basilia or the input state', () => {
  let g = fixture();
  const old = hold(g, 'a', 'treachery-7');
  old.name = 'Basilia Weapon';
  hold(g, 'e', 'ix-basilia-weapon');
  const before = structuredClone(g);
  const view = viewGame(g, 'a');
  assert.equal(view.players[0].hand![0].name, 'Ellaca Drug');
  assert.deepEqual(g, before);
  g = applyAction(g, 'a', { type: 'ready' });
  assert.equal(g.players[0].hand[0].name, 'Ellaca Drug');
  assert.equal(g.players[1].hand[0].name, 'Basilia Weapon');
});
void test('every AI difficulty can use the extra Harvester after another one has doubled a fresh blow', () => {
  for (const difficulty of DIFFICULTIES) {
    let g = fixture();
    g.players[0].bot = difficulty;
    g.players[0].forces = { 'red_chasm:7': 3 };
    g.players[0].reserves = 17;
    const first = hold(
      g,
      'e',
      baseDeck().find((c) => c.effect === 'harvester')!.id,
    );
    hold(g, 'a', 'ix-harvester');
    g = ready(g);
    g = applyAction(g, 'e', { type: 'card', card: first.id });
    const action = botActions(viewGame(g, 'a')).find(
      (a) => a.type === 'card' && a.card === 'ix-harvester',
    );
    assert.ok(action, difficulty);
    g = applyAction(g, 'a', action);
    assert.equal(g.spiceWindow!.harvesters, 2);
  }
});
void test('Hard and Brutal finish six-faction games with the entire Ix deck and conserve every physical card', () => {
  for (const difficulty of ['Hard', 'Brutal'] as const) {
    let g = createGame(
      `FULLIX${difficulty}`,
      newPlayer('a', 'Atreides', 'atreides'),
    );
    for (const [id, faction] of [
      ['e', 'emperor'],
      ['h', 'harkonnen'],
      ['g', 'guild'],
      ['f', 'fremen'],
      ['b', 'beneGesserit'],
    ] as const)
      joinGame(g, newPlayer(id, id, faction));
    for (const p of g.players) {
      p.ready = true;
      p.bot = difficulty;
    }
    g = applyAction(g, 'a', { type: 'start' });
    for (let i = 0; g.status === 'setup' && i < 40; i++) g = runBots(g, 1);
    assert.equal(g.status, 'playing');
    g.expansions = ['ix'];
    g.deck = shuffle([...g.deck, ...ixDeck()]);
    for (let i = 0; g.status !== 'finished' && i < 200; i++) g = runBots(g);
    assert.equal(g.status, 'finished', difficulty);
    assert.ok(g.winner.length);
    assert.deepEqual(
      liveCards(g),
      treacheryDeck(['ix'])
        .map((c) => c.id)
        .sort(),
    );
    for (const p of g.players)
      assert.equal(
        p.reserves +
          p.tanks +
          Object.values(p.forces).reduce((a, b) => a + b, 0),
        20,
      );
  }
});
