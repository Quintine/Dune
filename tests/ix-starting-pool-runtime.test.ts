import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import type { Difficulty } from '../game/bot-profiles';
import {
  actIxStartingPool as act, createIxStartingPoolFixture as fixture,
  createLegacyIxStartingPoolSupplement as legacy, finishIxStartingPool as finish,
  ixStartingPoolChoice as choice, ixStartingPoolInventory as inventory,
  ixStartingPoolPlayer as p, ixStartingPoolReload as reload, type IxStartingPoolStep,
} from './fixture-ix-starting-pool';

function reject(game: Game, actor: string, action: Action) {
  const before = reload(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before);
}

for (const advanced of [false, true]) for (const skills of [false, true]) {
  void test(`genuine ${advanced ? 'Advanced' : 'Basic'} Ix starting pool ${skills ? 'with all14' : 'without Skills'} preserves original stock and native setup order`, () => {
    const f = fixture({ advanced, skills });
    assert.equal(f.sourceCounts.ready, f.readyActions.length);
    assert.equal(f.sourceCounts.beforeDraft, f.setupActions.length);
    assert.equal(f.sourceCounts.source, f.actions.length);
    assert.equal(f.pool.length, f.game.players.length + (advanced ? 1 : 0));
    assert.equal(f.game.players.every(player => player.hand.length === 0), true);
    assert.deepEqual(viewGame(f.game, 'ixians').ixTechnology?.setup?.map(card => card.id), f.pool.map(card => card.id));
    assert.deepEqual(inventory(f.game).cards, f.stock.cards);
    if (skills) {
      assert.equal(Object.keys(f.game.leaderSkills!.offers).length, 0);
      assert.equal(f.game.leaderSkills!.assignments.length, 0);
      assert.equal(f.actions.some(step => step.action.type === 'leaderSkill' || step.action.type === 'traitor'), false);
    } else assert.ok(f.actions.some(step => step.action.type === 'traitor'));
  });
}

void test('fresh Advanced Ix may choose the actual fourth card and Harkonnen receives two from that same inspected remainder', () => {
  for (const skills of [false, true]) {
    const f = fixture({ advanced: true, skills }), beforeTop = f.game.deck[0].id;
    assert.equal(f.pool[3].id, f.extra);
    const game = finish(act(reload(f.game), 'ixians', choice(f.game, f.extra)));
    assert.deepEqual(p(game, 'ixians').hand.map(card => card.id), [f.extra]);
    const remainder = f.pool.filter(card => card.id !== f.extra).map(card => card.id);
    assert.equal(p(game, 'harkonnen').hand.length, 2);
    assert.ok(p(game, 'harkonnen').hand.every(card => remainder.includes(card.id)));
    assert.deepEqual([...p(game, 'harkonnen').hand, ...p(game, 'atreides').hand].map(card => card.id).sort(), remainder.sort());
    assert.equal(game.deck[0].id, beforeTop);
    assert.equal(game.deck[0].id, f.nextAfterFour, 'Fresh Advanced consumes no extra undealt card after the pool is dealt');
    assert.deepEqual(inventory(game).cards, f.stock.cards);
    assert.deepEqual(inventory(game).skills, f.stock.skills);
  }
});

void test('Basic keeps the fourth card outside Ix inspection and actually deals it as the separate Harkonnen top-deck bonus', () => {
  for (const skills of [false, true]) {
    const f = fixture({ advanced: false, skills });
    assert.equal(f.game.deck[0].id, f.extra);
    assert.equal(f.pool.some(card => card.id === f.extra), false);
    reject(f.game, 'ixians', { type: 'decision', card: f.extra });
    const selected = f.pool[0].id;
    const game = finish(act(reload(f.game), 'ixians', choice(f.game, selected)));
    assert.deepEqual(p(game, 'ixians').hand.map(card => card.id), [selected]);
    assert.equal(p(game, 'harkonnen').hand.length, 2);
    assert.ok(p(game, 'harkonnen').hand.some(card => card.id === f.extra));
    assert.equal(p(game, 'harkonnen').hand.filter(card => f.pool.some(source => source.id === card.id)).length, 1);
    assert.equal(game.deck[0].id, f.nextAfterFour);
    assert.deepEqual(inventory(game).cards, f.stock.cards);
  }
});

void test('without a Harkonnen seat both Basic and Advanced retain the native one-card-per-faction draft', () => {
  for (const advanced of [false, true]) for (const skills of [false, true]) {
    const f = fixture({ advanced, skills, harkonnen: false });
    assert.equal(f.pool.length, f.game.players.length);
    const before = f.game.deck[0].id;
    const game = finish(act(reload(f.game), 'ixians', choice(f.game, f.pool[0].id)));
    assert.ok(game.players.every(player => player.hand.length === 1));
    assert.equal(game.deck[0].id, before);
    assert.deepEqual(inventory(game).cards, f.stock.cards);
  }
});

void test('native Ix choice precedes all real skill offers assignments and Traitor selections in both modes', () => {
  for (const advanced of [false, true]) {
    const f = fixture({ advanced, skills: true }), actions: IxStartingPoolStep[] = [];
    const selected = f.pool.at(-1)!.id;
    let game = act(reload(f.game), 'ixians', choice(f.game, selected), actions);
    assert.equal(game.setupStage, 'leaderSkills');
    assert.equal(Object.keys(game.leaderSkills!.offers).length, game.players.length);
    assert.equal(game.leaderSkills!.assignments.length, 0);
    assert.equal(p(game, 'harkonnen').hand.length, 2);
    game = finish(game, actions);
    assert.equal(actions[0].action.card, selected);
    const firstSkill = actions.findIndex(step => step.action.type === 'leaderSkill');
    const firstTraitor = actions.findIndex(step => step.action.type === 'traitor');
    assert.ok(firstSkill > 0 && firstTraitor > firstSkill);
    assert.equal(game.leaderSkills!.assignments.length, game.players.length);
    assert.deepEqual(inventory(game).cards, f.stock.cards);
    assert.deepEqual(inventory(game).skills, f.stock.skills);
  }
});

void test('native draft rejects another actor foreign card and replay after its actual one choice', () => {
  const f = fixture({ advanced: true, skills: true }), packet = choice(f.game, f.extra);
  reject(f.game, 'harkonnen', packet);
  reject(f.game, 'ixians', { type: 'decision', card: f.game.deck[0].id });
  const game = act(reload(f.game), 'ixians', packet);
  reject(game, 'ixians', packet);
  assert.equal(game.ixSetupCards, null);
  assert.equal(p(game, 'ixians').hand.filter(card => card.id === f.extra).length, 1);
  assert.deepEqual(inventory(game).cards, f.stock.cards);
});

void test('controlled conserved old Advanced N-card draft completes its old separate top-deck Harkonnen bonus', () => {
  for (const skills of [false, true]) {
    const f = legacy(skills);
    assert.match(f.sourceDisclosure, /Controlled conserved old-count unit supplement/);
    assert.equal(f.pool.length, f.game.players.length);
    assert.equal(f.game.deck[0].id, f.extra);
    const game = finish(act(reload(f.game), 'ixians', choice(f.game, f.pool[0].id)));
    assert.equal(p(game, 'harkonnen').hand.length, 2);
    assert.ok(p(game, 'harkonnen').hand.some(card => card.id === f.extra));
    assert.equal(game.deck[0].id, f.nextAfterFour);
    assert.deepEqual(inventory(game).cards, f.stock.cards);
    assert.deepEqual(inventory(game).skills, f.stock.skills);
  }
});

void test('all four minimal profiles legally choose from the fresh Advanced pool and finish original all14 setup', () => {
  const f = fixture({ advanced: true, skills: true });
  for (const difficulty of ['Easy', 'Medium', 'Hard', 'Brutal'] satisfies Difficulty[]) {
    let game = reload(f.game), accepted = 0;
    const own = viewGame(game, 'ixians'); own.players.find(player => player.id === 'ixians')!.bot = difficulty;
    const proposal = botActions(own).find(action => action.type === 'decision' && f.pool.some(card => card.id === action.card));
    assert.ok(proposal, `${difficulty} chooses one actual inspected card`);
    game = act(game, 'ixians', proposal); accepted++;
    for (let count = 0; game.status === 'setup' && count < 100; count++) {
      let progressed = false;
      for (const player of game.players) {
        const view = viewGame(game, player.id); view.players.find(row => row.id === player.id)!.bot = difficulty;
        const action = botActions(view)[0];
        if (!action) continue;
        game = act(game, player.id, action); accepted++; progressed = true; break;
      }
      assert.ok(progressed, `${difficulty} finishes actual original setup`);
    }
    assert.equal(game.status, 'playing'); assert.ok(accepted > 1);
    assert.equal(p(game, 'harkonnen').hand.length, 2);
    assert.equal(game.deck[0].id, f.nextAfterFour);
    assert.deepEqual(inventory(game).cards, f.stock.cards);
    assert.deepEqual(inventory(game).skills, f.stock.skills);
  }
});
