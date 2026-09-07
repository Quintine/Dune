import test from 'node:test';
import assert from 'node:assert/strict';
import { baseDeck, ixBattleCards, type Card } from '../game/cards';
import {
  applyAction,
  createGame,
  joinGame,
  newPlayer,
  viewGame,
  type Game,
  type Action,
} from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
const all = [...baseDeck(), ...ixBattleCards()];
const card = (kind: Card['kind']) => all.find((c) => c.kind === kind)!;
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
function fixture() {
  let g = createGame('IXCARDS2', newPlayer('a', 'Atreides', 'atreides'));
  for (const [id, f] of [
    ['g', 'guild'],
    ['e', 'emperor'],
    ['b', 'beneGesserit'],
  ] as const)
    joinGame(g, newPlayer(id, f, f));
  g.players.forEach((p) => (p.ready = true));
  g = applyAction(g, 'a', { type: 'start' });
  g = applyAction(g, 'b', { type: 'predict', faction: 'atreides', turn: 5 });
  for (const p of g.players)
    if (p.traitorChoices.length)
      g = applyAction(g, p.id, {
        type: 'traitor',
        leader: p.traitorChoices[0],
      });
  assert.equal(g.status, 'playing');
  g.phase = 6;
  g.active = 'a';
  g.order = ['a', 'g', 'e', 'b'];
  g.storm = 18;
  // Return dealt cards before replacing setup hands for this battle fixture.
  g.deck.push(...g.players.flatMap((p) => p.hand));
  g.deck.push(...ixBattleCards());
  g.players.forEach((p) => {
    p.forces = ['a', 'g'].includes(p.id) ? { 'arrakeen:10': 5 } : {};
    p.reserves = Object.keys(p.forces).length ? 15 : 20;
    p.hand = [];
    p.traitors = [];
    p.spice = 20;
  });
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
const choose = (g: Game) =>
  allow(
    applyAction(g, 'a', {
      type: 'chooseBattle',
      territory: 'arrakeen',
      target: 'g',
    }),
  );
function prepared(state: Game) {
  let g = choose(state);
  while (g.battle?.preparation)
    g = applyAction(g, g.battle.preparation.owner, {
      type: 'declineBattlePower',
    });
  return g;
}
function plan(g: Game, id: string, choices: Partial<Action> = {}) {
  return applyAction(g, id, {
    type: 'battlePlan',
    dial: 0,
    leader: id === 'a' ? 'atreides-0' : 'guild-0',
    ...choices,
  });
}
function resolve(g: Game) {
  g = applyAction(g, 'a', { type: 'traitorCall', call: false });
  return applyAction(g, 'g', { type: 'traitorCall', call: false });
}
function battle(
  weapon: Card['kind'],
  ownDefense?: Card['kind'],
  otherDefense?: Card['kind'],
  ownDial = 0,
  otherDial = 0,
  otherWeapon?: Card['kind'],
) {
  const before = fixture();
  setHand(before, 0, [card(weapon), ...(ownDefense ? [card(ownDefense)] : [])]);
  // When both sides use a Shield, they must use distinct printed copies.
  const opposingDefense = otherDefense
    ? before.deck.find((c) => c.kind === otherDefense)!
    : undefined;
  setHand(before, 1, [
    ...(opposingDefense ? [opposingDefense] : []),
    ...(otherWeapon ? [card(otherWeapon)] : []),
  ]);
  const g = plan(prepared(before), 'a', {
    weapon: card(weapon).id,
    defense: ownDefense ? card(ownDefense).id : null,
    dial: ownDial,
  });
  return plan(g, 'g', {
    defense: opposingDefense?.id ?? null,
    weapon: otherWeapon ? card(otherWeapon).id : null,
    dial: otherDial,
  });
}
const tooth = (g: Game, activate: boolean) =>
  applyAction(g, 'a', { type: 'decision', activate });
void test('Poison Tooth waits for revealed plans, an owner-only decision and then traitor choices, with no premature casualties', () => {
  const before = fixture();
  setHand(before, 0, [card('poisonTooth')]);
  let g = plan(prepared(before), 'a', { weapon: card('poisonTooth').id });
  assert.equal(g.decision, null);
  assert.equal(viewGame(g, 'g').battle!.plans.a, undefined);
  assert.throws(() => tooth(g, true));
  g = plan(g, 'g');
  assert.equal(g.decision?.kind, 'poisonTooth');
  assert.equal(g.battle?.revealed, true);
  assert.throws(
    () => applyAction(g, 'g', { type: 'decision', activate: true }),
    /pending decision/,
  );
  assert.throws(
    () => applyAction(g, 'g', { type: 'traitorCall', call: false }),
    /pending decision/,
  );
  assert.throws(
    () => applyAction(g, 'a', { type: 'decision', activate: 'yes' }),
    /activate Poison Tooth/,
  );
  g = tooth(JSON.parse(JSON.stringify(g)), true);
  for (const p of g.players) assert.equal(p.leaders[0].dead, false);
  for (const p of g.players)
    assert.equal(viewGame(g, p.id).battle!.poisonTooth.a, true);
  assert.equal(g.decision, null);
  assert.throws(() => tooth(g, false));
  g = resolve(g);
  assert.equal(g.players[0].leaders[0].dead, true);
  assert.equal(g.players[1].leaders[0].dead, true);
  assert.equal(g.players[0].spice, 30);
  assert.ok(g.discard.some((c) => c.kind === 'poisonTooth'));
});
void test('Chemistry protects either leader from the tooth, whereas Snooper and Shield Snooper do not', () => {
  for (const defense of ['chemistry', 'snooper', 'shieldSnooper'] as const) {
    let g = tooth(battle('poisonTooth', defense), true);
    g = resolve(g);
    assert.equal(g.players[0].leaders[0].dead, defense !== 'chemistry');
    assert.equal(g.players[1].leaders[0].dead, true);
    let other = tooth(battle('poisonTooth', undefined, defense), true);
    other = resolve(other);
    assert.equal(other.players[0].leaders[0].dead, true);
    assert.equal(other.players[1].leaders[0].dead, defense !== 'chemistry');
  }
});
void test('an unused tooth has no poison effect and may be retained only by the winner', () => {
  let g = resolve(tooth(battle('poisonTooth'), false));
  assert.equal(g.players[0].leaders[0].dead, false);
  assert.equal(g.players[1].leaders[0].dead, false);
  assert.equal(g.decision?.kind, 'battleCards');
  g = applyAction(g, 'a', { type: 'decision', discard: [] });
  assert.ok(g.players[0].hand.some((c) => c.kind === 'poisonTooth'));
  const lost = resolve(
    tooth(battle('poisonTooth', undefined, undefined, 0, 2), false),
  );
  assert.ok(lost.discard.some((c) => c.kind === 'poisonTooth'));
});
void test('activating a tooth never supplies poison defense to its user', () => {
  const g = resolve(
    tooth(battle('poisonTooth', undefined, 'chemistry', 0, 0, 'poison'), true),
  );
  assert.equal(g.players[0].leaders[0].dead, true);
  assert.equal(g.players[1].leaders[0].dead, false);
  assert.equal(g.players[0].forces['arrakeen:10'], undefined);
});
void test('Artillery kills unshielded leaders, suppresses all leader strength, grants no bounty and is discarded by a winner', () => {
  const g = resolve(battle('artillery'));
  assert.equal(g.players[0].leaders[0].dead, true);
  assert.equal(g.players[1].leaders[0].dead, true);
  assert.equal(g.players[0].spice, 20);
  assert.equal(g.players[1].spice, 20);
  assert.ok(g.discard.some((c) => c.kind === 'artillery'));
  assert.equal(g.decision, null);
  const shielded = resolve(battle('artillery', 'shield', undefined, 0, 1));
  assert.equal(shielded.players[0].leaders[0].dead, false);
  assert.equal(shielded.players[0].forces['arrakeen:10'], undefined);
  assert.equal(shielded.players[1].forces['arrakeen:10'], 4);
});
void test('each side can shield against artillery; Weirding Way cannot protect from it', () => {
  for (const defense of ['shield', 'shieldSnooper', 'weirdingWay'] as const) {
    const g = resolve(
      battle('artillery', 'shield', defense, 0, 0, 'worthless'),
    );
    assert.equal(g.players[0].leaders[0].dead, false);
    assert.equal(g.players[1].leaders[0].dead, defense === 'weirdingWay');
    assert.equal(g.players[0].spice, 20);
  }
});
void test('artillery does not cancel an opposing poison weapon and suppresses bounty for that death too', () => {
  const g = resolve(
    battle('artillery', 'shield', 'shieldSnooper', 2, 0, 'poison'),
  );
  assert.equal(g.players[0].leaders[0].dead, true);
  assert.equal(g.players[1].leaders[0].dead, false);
  assert.equal(g.players[0].spice, 20);
  assert.equal(g.players[0].forces['arrakeen:10'], 3);
});
void test('traitor wins override tooth/artillery effects and retain the winner’s otherwise single-use weapon', () => {
  for (const weapon of ['poisonTooth', 'artillery'] as const) {
    let g = battle(weapon);
    g.players[0].traitors = ['guild-0'];
    if (weapon === 'poisonTooth') g = tooth(g, true);
    g = applyAction(g, 'a', { type: 'traitorCall', call: true });
    g = applyAction(g, 'g', { type: 'traitorCall', call: false });
    assert.equal(g.players[0].leaders[0].dead, false);
    assert.equal(g.players[0].forces['arrakeen:10'], 5);
    assert.equal(g.players[0].spice, 25);
    assert.equal(g.decision?.kind, 'battleCards');
    g = applyAction(g, 'a', { type: 'decision', discard: [] });
    assert.ok(g.players[0].hand.some((c) => c.kind === weapon));
  }
});
void test('lasgun/shield explosion overrides artillery and destroys bystanding armies and spice', () => {
  let g = battle('artillery', 'shield', undefined, 0, 0, 'lasgun');
  g.players[2].forces = { 'arrakeen:10': 2 };
  g.players[2].reserves = 18;
  g.spice['arrakeen:10'] = 8;
  g = resolve(g);
  assert.ok(g.players.every((p) => !p.forces['arrakeen:10']));
  assert.equal(g.spice['arrakeen:10'], undefined);
  assert.equal(g.players[0].spice, 20);
  assert.equal(g.players[1].spice, 20);
});
void test('Voice addresses Tooth as poison or by name, while Artillery must be named specifically', () => {
  for (const [weapon, kind, forbidden] of [
    ['poisonTooth', 'poison', true],
    ['poisonTooth', 'poisonTooth', true],
    ['artillery', 'artillery', true],
    ['artillery', 'projectile', false],
  ] as const) {
    const before = fixture();
    setHand(before, 1, [card(weapon)]);
    before.players[0].ally = 'b';
    before.players[3].ally = 'a';
    let g = choose(before);
    g = allow(applyAction(g, 'b', { type: 'voice', kind, must: false }));
    g = applyAction(g, 'a', { type: 'declineBattlePower' });
    if (forbidden)
      assert.throws(() => plan(g, 'g', { weapon: card(weapon).id }), /Voice/);
    else assert.ok(plan(g, 'g', { weapon: card(weapon).id }).battle?.plans.g);
  }
});
void test('AI chooses legally at every difficulty and stronger policies preserve a tooth when already winning', () => {
  for (const difficulty of DIFFICULTIES) {
    const g = battle('poisonTooth');
    g.players[0].bot = difficulty;
    const action = botActions(viewGame(g, 'a'))[0];
    assert.equal(action.type, 'decision');
    const result = applyAction(g, 'a', action);
    assert.equal(result.decision, null);
    if (difficulty !== 'Easy') assert.equal(action.activate, false);
    const losing = battle('poisonTooth', undefined, undefined, 2, 0);
    // A weak Atreides leader loses without the tooth but wins by dial when it kills both leaders.
    losing.battle!.plans.a.leader = 'atreides-4';
    losing.players[0].bot = difficulty;
    const choice = botActions(viewGame(losing, 'a'))[0];
    if (difficulty !== 'Easy') assert.equal(choice.activate, true);
    assert.equal(applyAction(losing, 'a', choice).decision, null);
  }
});

void test('advanced artillery preserves spice costs and automatic casualties while suppressing a surviving leader and KH bonus', () => {
  const before = fixture();
  before.advanced = true;
  before.players[0].specialKaramaUsed = true;
  before.players[0].battleLosses = 7;
  setHand(before, 0, [card('artillery'), card('shield')]);
  // Keep another battle pending so phase-7 stronghold income does not obscure
  // the support payments now that the sole casualty outcome settles immediately.
  for (const player of before.players.slice(2)) {
    player.forces = { 'carthag:11': 1 };
    player.reserves = 19;
  }
  let g = prepared(before);
  g = plan(g, 'a', {
    weapon: card('artillery').id,
    defense: card('shield').id,
    dial: 1,
    support: 1,
    kwisatz: true,
  });
  g = plan(g, 'g', { dial: 2, support: 2 });
  g = resolve(g);
  assert.notEqual(g.decision?.kind, 'battleLosses');
  assert.equal(g.phase, 6);
  assert.equal(g.players[0].leaders[0].dead, false);
  assert.equal(g.players[0].kwisatz?.dead, false);
  assert.equal(g.players[0].kwisatz?.usedAt, 'arrakeen');
  assert.equal(g.players[0].spice, 19);
  assert.equal(g.players[1].spice, 18);
  assert.equal(g.players[1].forces['arrakeen:10'], 3);
  assert.equal(g.players[1].tanks, 2);
  for (const p of g.players)
    assert.equal(
      p.reserves + p.tanks + Object.values(p.forces).reduce((a, b) => a + b, 0),
      20,
    );
});
