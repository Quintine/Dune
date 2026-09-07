import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  newPlayer,
  viewGame,
  type Game,
  type GameView,
} from '../game/engine';
import { baseDeck, ixBattleCards, type Card } from '../game/cards';
import { richeseCards } from '../game/richese-cards';
import { botActions } from '../game/bots';
import { DIFFICULTIES, type Difficulty } from '../game/bot-profiles';

const portable = () =>
  richeseCards().find((c) => c.effect === 'portableSnooper')!;
const weapon = (kind: Card['kind']) =>
  [...baseDeck(), ...ixBattleCards()].find((c) => c.kind === kind)!;
function fixture(kind: Card['kind'] = 'poison', reverse = false) {
  const g = createGame('PORTABLEBOT', newPlayer('p', 'Pilot', 'emperor'));
  g.players.push(newPlayer('q', 'Opponent', 'guild'));
  g.status = 'playing';
  g.phase = 6;
  g.turn = 2;
  g.active = reverse ? 'q' : 'p';
  g.order = reverse ? ['q', 'p'] : ['p', 'q'];
  g.storm = 18;
  for (const p of g.players) {
    p.hand = [];
    p.forces = { 'arrakeen:10': 4 };
    p.reserves = 16;
    p.spice = 10;
    p.traitors = [];
  }
  g.players[0].hand = [portable()];
  g.players[1].hand = [weapon(kind)];
  g.deck = g.deck.filter(
    (c) => !g.players.some((p) => p.hand.some((h) => h.id === c.id)),
  );
  return applyAction(g, g.active, {
    type: 'chooseBattle',
    territory: 'arrakeen',
    target: reverse ? 'p' : 'q',
  });
}
function reveal(g: Game) {
  for (const id of ['p', 'q'])
    g = applyAction(g, id, {
      type: 'battlePlan',
      leader: id === 'p' ? 'emperor-0' : 'guild-0',
      dial: id === 'p' ? 1 : 0,
      weapon: id === 'q' ? g.players[1].hand[0].id : null,
    });
  return g;
}
function view(g: Game, difficulty: Difficulty, id = 'p') {
  const v = viewGame(g, id);
  v.players.find((p) => p.id === id)!.bot = difficulty;
  return v;
}
const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));

function kwisatzHeroBattle(useKwisatz: boolean) {
  let g = createGame('PORTABLEKH', newPlayer('p', 'Atreides', 'atreides'));
  g.players.push(newPlayer('q', 'Opponent', 'guild'));
  g.status = 'playing';
  g.advanced = true;
  g.phase = 6;
  g.turn = 2;
  g.active = 'p';
  g.order = ['p', 'q'];
  g.storm = 18;
  for (const p of g.players) {
    p.forces = { 'arrakeen:10': 4 };
    p.reserves = 16;
    p.spice = 10;
    p.traitors = [];
  }
  const hero = weapon('hero');
  g.players[0].battleLosses = 7;
  g.players[0].hand = [hero, portable()];
  g.players[1].hand = [weapon('poison')];
  g.deck = g.deck.filter(
    (c) => !g.players.some((p) => p.hand.some((h) => h.id === c.id)),
  );
  g = applyAction(g, 'p', {
    type: 'chooseBattle',
    territory: 'arrakeen',
    target: 'q',
  });
  assert.equal(g.battle!.preparation?.kind, 'prescience');
  g = applyAction(g, 'p', { type: 'declineBattlePower' });
  if (g.decision?.kind === 'fullPlanOffer') {
    g = applyAction(g, 'p', { type: 'decision', decline: true });
  }
  assert.equal(g.decision, null);
  assert.equal(g.response, null);
  assert.equal(g.battle!.preparation, undefined);
  g = applyAction(g, 'p', {
    type: 'battlePlan',
    leader: hero.id,
    kwisatz: useKwisatz,
    dial: 1,
    support: 1,
  });
  g = applyAction(g, 'q', {
    type: 'battlePlan',
    leader: 'guild-2',
    dial: 0,
    weapon: weapon('poison').id,
  });
  assert.equal(g.battle!.revealed, true);
  return g;
}

void test('all profiles save a revealed Cheap Hero with KH to turn an Advanced defeat into victory, but spare the card for an ordinary hero', () => {
  for (const difficulty of DIFFICULTIES) {
    const g = kwisatzHeroBattle(true);
    let without = applyAction(g, 'p', { type: 'traitorCall', call: false });
    without = applyAction(without, 'q', { type: 'traitorCall', call: false });
    assert.equal(without.players[0].forces['arrakeen:10'] ?? 0, 0);
    assert.equal(without.players[1].forces['arrakeen:10'], 4);
    const v = view(g, difficulty);
    assert.equal(v.battle!.plans.p.kwisatz, true);
    assert.equal(
      v.battle!.cards.find((c) => c.id === v.battle!.plans.p.leader)!.kind,
      'hero',
    );
    const action = botActions(v)[0];
    assert.equal(action.type, 'portableSnooper');
    let protectedGame = applyAction(g, 'p', action);
    protectedGame = applyAction(
      reload(protectedGame),
      'p',
      botActions(view(protectedGame, difficulty))[0],
    );
    protectedGame = applyAction(protectedGame, 'q', {
      type: 'traitorCall',
      call: false,
    });
    assert.equal(protectedGame.players[0].forces['arrakeen:10'], 3);
    assert.equal(protectedGame.players[1].forces['arrakeen:10'] ?? 0, 0);
    assert.equal(protectedGame.players[0].kwisatz?.dead, false);
    assert.equal(protectedGame.players[0].spice, 9);
    assert.equal(
      protectedGame.discard.filter((c) => c.id === weapon('hero').id).length,
      1,
    );
    assert.equal(
      botActions(view(kwisatzHeroBattle(false), difficulty))[0].type,
      'traitorCall',
    );
  }
});

void test('all profiles use eligible late poison protection on either side, preserve the original plan and proceed without replay', () => {
  for (const difficulty of DIFFICULTIES)
    for (const reverse of [false, true]) {
      let g = reveal(fixture('poison', reverse));
      const v = view(g, difficulty),
        snapshot = structuredClone(v),
        action = botActions(v)[0];
      assert.equal(action.type, 'portableSnooper');
      assert.equal(action.card, portable().id);
      assert.equal(action.event, v.battle!.event);
      assert.deepEqual(v, snapshot);
      const plans = structuredClone(g.battle!.plans);
      g = applyAction(g, 'p', action);
      assert.deepEqual(g.battle!.plans, plans);
      assert.equal(g.battle!.lateDefense!['p'], portable().id);
      assert.throws(() => applyAction(g, 'p', action));
      const next = botActions(view(reload(g), difficulty))[0];
      assert.equal(next.type, 'traitorCall');
      assert.equal(next.call, false);
      g = applyAction(g, 'p', next);
      g = applyAction(g, 'q', { type: 'traitorCall', call: false });
      assert.equal(
        g.players[0].leaders.find((l) => l.id === 'emperor-0')!.dead,
        false,
      );
      assert.equal(g.players[0].forces['arrakeen:10'], 3);
      assert.equal(
        g.players[0].hand.filter((c) => c.id === portable().id).length +
          g.discard.filter((c) => c.id === portable().id).length,
        1,
      );
    }
});

void test('normal defense candidates include only the exact canonical Portable Snooper and remain authoritative legal plans', () => {
  for (const difficulty of DIFFICULTIES) {
    const g = fixture(),
      v = view(g, difficulty);
    const candidates = botActions(v).filter(
      (a) => a.type === 'battlePlan' && a.defense === portable().id && a.leader,
    );
    assert.ok(candidates.length);
    for (const candidate of candidates)
      assert.doesNotThrow(() => applyAction(g, 'p', candidate));
    const forged = view(g, difficulty);
    forged.players[0].hand = [{ ...portable(), id: 'forged-portable' }];
    assert.ok(botActions(forged).every((a) => a.defense !== 'forged-portable'));
  }
});

void test('late defense uses public revealed threats without opponent hand inference and skips ineffectual protection', () => {
  for (const difficulty of DIFFICULTIES) {
    const g = reveal(fixture()),
      v = view(g, difficulty),
      action = botActions(v)[0];
    v.players[1].hand = richeseCards();
    v.players[1].spice = 999;
    assert.deepEqual(botActions(v)[0], action);
    for (const kind of [
      'projectile',
      'lasgun',
      'poisonBlade',
      'artillery',
    ] as const) {
      const other = reveal(fixture(kind));
      assert.ok(
        botActions(view(other, difficulty)).every(
          (a) => a.type !== 'portableSnooper',
        ),
      );
    }
    const traitor = view(g, difficulty);
    traitor.players[0].traitors = ['guild-0'];
    assert.deepEqual(botActions(traitor)[0], {
      type: 'traitorCall',
      call: true,
    });
  }
});

void test('blocked, stale and nonowner views never play the card and genuine interactions retain priority', () => {
  for (const difficulty of DIFFICULTIES) {
    const g = reveal(fixture());
    for (const change of [
      (v: GameView) => {
        v.portableSnooper!.blocked = 'The revealed plan has no spare slot.';
      },
      (v: GameView) => {
        v.portableSnooper!.event = 'old-battle';
      },
      (v: GameView) => {
        v.portableSnooper = null;
      },
    ]) {
      const v = view(g, difficulty);
      change(v);
      assert.equal(botActions(v)[0].type, 'traitorCall');
    }
    assert.equal(viewGame(g, 'q').portableSnooper, null);
    const truth = view(g, difficulty);
    truth.truthtrance = {
      stage: 'priority',
      queue: [],
      passed: [],
    } as unknown as NonNullable<GameView['truthtrance']>;
    assert.equal(botActions(truth)[0].type, 'truthPass');
    const response = view(g, difficulty);
    response.response = { kind: 'emperorIncome', owner: 'q', passed: [] };
    assert.ok(botActions(response).every((a) => a.type !== 'portableSnooper'));
    const decision = view(g, difficulty);
    decision.decision = { kind: 'richeseDeclaration', player: 'q' };
    assert.deepEqual(botActions(decision), []);
  }
});

void test('Tooth evaluation includes an explicitly projected supplemental defense without rewriting the sealed defense slot', () => {
  let g = fixture();
  const tooth = weapon('poisonTooth');
  g.players[0].hand.push(tooth);
  g = applyAction(g, 'p', {
    type: 'battlePlan',
    leader: 'emperor-0',
    dial: 1,
    weapon: tooth.id,
  });
  g = applyAction(g, 'q', {
    type: 'battlePlan',
    leader: 'guild-0',
    dial: 0,
    weapon: weapon('poison').id,
  });
  assert.equal(g.decision?.kind, 'poisonTooth');
  for (const difficulty of DIFFICULTIES.filter((d) => d !== 'Easy')) {
    const without = view(g, difficulty);
    assert.equal(botActions(without)[0].activate, true);
    // A projection-level scoring regression: normal live timing resolves Tooth
    // before late defense. Do not bypass that authoritative action ordering.
    const withDefense = structuredClone(without);
    withDefense.battle!.lateDefense['p'] = portable().id;
    withDefense.battle!.cards.push(portable());
    assert.equal(withDefense.battle!.plans['p'].defense, null);
    assert.equal(botActions(withDefense)[0].activate, false);
  }
});
