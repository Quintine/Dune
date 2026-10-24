import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, normalizeAutomaticGame, viewGame, type Game, type Action } from '../game/engine';
import { fighterCount, isAdvisor } from '../game/advisors';
import { strongholdProgress } from '../game/victory-progress';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import {
  createAdvisorGamontFlipFixture as fixture,
  actAdvisorGamontFlip as act,
  commitAdvisorGamontFlip as commit,
  advisorGamontFlipPlayer as player,
  advisorGamontFlipInventory as inventory,
  passAdvisorGamontFlip as pass,
  finishAdvisorGamontFlip as finish,
} from './fixture-advisor-gamont-flip';

function rejected(g: Game, actor: string, action: Action) {
  const before = structuredClone(g); assert.throws(() => applyAction(g, actor, action));
  assert.deepEqual(g, before);
}
const holds = (g: Game, id: string) => strongholdProgress(g).progress.find(p => p.player === id)!.strongholds.length;

for (const final of [false, true]) for (const canceled of [false, true]) {
  void test(`native ${final ? 'final' : 'ordinary'} Gamont ${canceled ? 'prevention' : 'allowance'} keeps the return and changes the genuine victory outcome`, () => {
    const f = fixture({ final }), before = structuredClone(f.game);
    assert.equal(holds(before, f.bg), 2);
    const pending = commit(f.game, f).game;
    assert.deepEqual(f.game, before);
    assert.equal(pending.response?.kind, 'advisorFlip');
    const source = pending.response?.automaticAdvisorFlip;
    assert.ok(source?.producer === 'gamont');
    assert.equal(source.gamont.mentat, final);
    assert.equal(source.gamont.returned, true);
    assert.equal(pending.decision, null);
    assert.equal(pending.status, 'playing');
    assert.deepEqual(pending.winner, []);
    assert.equal(player(pending, f.holder).forces[f.from], undefined);
    assert.equal(player(pending, f.holder).reserves, player(before, f.holder).reserves + 1);
    assert.equal(player(pending, f.holder).tanks, player(before, f.holder).tanks);
    assert.equal(pending.discard.filter(c => c.id === f.card).length, 1);
    assert.equal(fighterCount(player(pending, f.bg), f.territory), 0);
    assert.equal(holds(pending, f.bg), 2);
    rejected(pending, f.choam, { type: 'decision', done: true });
    assert.ok(viewGame(pending, f.holder).responseControls?.cancelCards.includes(f.karama));
    const publicResponse = JSON.stringify(viewGame(pending, f.holder).response);
    assert.ok(!publicResponse.includes(f.card), 'The public conversion never copies the spent fuel card');
    assert.equal(pending.pendingAutomaticAdvisorGamont?.card, f.card);
    const returned = structuredClone(player(pending, f.holder));
    let done = canceled
      ? act(pending, f.holder, { type: 'card', card: f.karama, mode: 'cancel' })
      : pass(pending);
    assert.equal(player(done, f.holder).reserves, returned.reserves);
    assert.equal(player(done, f.holder).tanks, returned.tanks);
    assert.equal(player(done, f.holder).forces[f.from], undefined);
    assert.equal(done.discard.filter(c => c.id === f.card).length, 1);
    assert.equal(done.pendingAutomaticAdvisorGamont, undefined);
    assert.equal(done.pendingAutomaticAdvisorFlips, undefined);
    assert.equal(isAdvisor(player(done, f.bg), f.territory), canceled);
    assert.equal(holds(done, f.bg), canceled ? 2 : 3);
    assert.equal(done.status, 'playing');
    assert.deepEqual(done.winner, []);
    if (final) assert.deepEqual(done.decision, { kind: 'choamMentat', player: f.choam });
    else assert.equal(done.decision, null);
    for (let read = 0; read < 3; read++) {
      done = normalizeAutomaticGame(done);
      assert.equal(done.status, 'playing');
      assert.equal(player(done, f.holder).reserves, returned.reserves);
    }
    assert.deepEqual(inventory(done), f.originalInventory);
    const finished = finish(done);
    if (canceled) {
      assert.equal(finished.status, 'playing');
      assert.equal(finished.turn, before.turn + 1);
      assert.deepEqual(finished.winner, []);
    } else {
      assert.equal(finished.status, 'finished');
      assert.deepEqual(finished.winner, [f.bg]);
      assert.equal(finished.turn, before.turn);
    }
    assert.equal(finished.discard.filter(c => c.id === f.card).length, 1);
  });
}

void test('preventing the original Gamont effect leaves the last outsider and final chooser intact without a conversion parent', () => {
  const f = fixture(), declared = act(f.game, f.choam, f.action);
  assert.equal(declared.response?.kind, 'choamWorthless');
  const done = act(declared, f.holder, { type: 'card', card: f.karama, mode: 'cancel' });
  assert.equal(player(done, f.holder).forces[f.from], 1);
  assert.equal(player(done, f.holder).reserves, player(f.game, f.holder).reserves);
  assert.ok(player(done, f.choam).hand.some(c => c.id === f.card));
  assert.equal(done.pendingAutomaticAdvisorGamont, undefined);
  assert.equal(done.pendingAutomaticAdvisorFlips, undefined);
  assert.deepEqual(done.decision, { kind: 'choamMentat', player: f.choam });
  assert.equal(holds(done, f.bg), 2);
  const next = finish(done);
  assert.equal(next.status, 'playing'); assert.equal(next.turn, f.game.turn + 1);
});

void test('a changed Gamont parent rejects before spending a second card or returning a second force', () => {
  const f = fixture(), pending = commit(f.game, f).game;
  pending.pendingAutomaticAdvisorGamont = { ...pending.pendingAutomaticAdvisorGamont!,
    receipt: { ...pending.pendingAutomaticAdvisorGamont!.receipt, target: f.bg } };
  rejected(pending, f.holder, { type: 'card', card: f.karama, mode: 'cancel' });
  assert.equal(pending.discard.filter(c => c.id === f.card).length, 1);
  assert.ok(player(pending, f.holder).hand.some(c => c.id === f.karama));
});

void test('the existing four profiles resolve ordinary and final conversion responses legally before victory', () => {
  for (const final of [false, true]) for (const profile of DIFFICULTIES) {
    const f = fixture({ final }), pending = commit(f.game, f).game;
    const own = viewGame(pending, f.holder);
    own.players.find(p => p.id === f.holder)!.bot = profile;
    const actions = botActions(own); assert.ok(actions.length);
    const done = pass(act(pending, f.holder, actions[0]));
    assert.equal(done.pendingAutomaticAdvisorGamont, undefined);
    assert.equal(done.status, 'playing');
    assert.equal(player(done, f.holder).reserves, player(f.game, f.holder).reserves + 1);
    const next = finish(done);
    assert.ok(next.status === 'finished' || next.turn === f.game.turn + 1);
    assert.equal(next.discard.filter(c => c.id === f.card).length, 1);
    assert.deepEqual(inventory(next), f.originalInventory);
  }
});
