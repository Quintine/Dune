import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { DUKE_VIDAL_ID } from '../game/duke-vidal';
import {
  createMoritaniAssassinateTargetFixture as fixture,
  actAssassinateTarget as act,
  assassinateTargetPlayer as player,
  assassinateTargetInventory as inventory,
  assassinateTargetTraitors as traitors,
  finishMoritaniAssassinateTarget as finish,
} from './fixture-moritani-assassinate-target';

function rejected(game: Game, actor: string, action: Action) {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before);
}

void test('a genuinely captured native target is publicly assassinated once for its printed bounty and replaced at Mentat', () => {
  const f = fixture();
  const target = player(f.game, f.opponent).leaders.find(l => l.id === f.target)!;
  assert.equal(target.capturedBy, f.captor);
  assert.equal(target.dead, false);
  assert.ok(target.concealed);
  assert.notEqual(f.game.moritaniAssassinate!.opportunities.at(-1)!.opposingLeader, f.target);
  const choice = viewGame(f.game, f.owner).moritaniAssassinate!.pending!;
  assert.equal(choice.blocked, null);
  assert.deepEqual(choice.cards.find(card => card.card === f.target), {
    card: f.target, name: target.name, potentialBounty: target.strength,
  });
  const money = player(f.game, f.owner).spice;
  const captorMoney = player(f.game, f.captor).spice;
  const done = act(f.game, f.owner, f.action);
  const dead = player(done, f.opponent).leaders.find(l => l.id === f.target)!;
  assert.equal(dead.dead, true);
  assert.equal(dead.deaths, target.deaths + 1);
  assert.equal(dead.capturedBy, undefined);
  assert.equal(dead.concealed, undefined);
  assert.equal(dead.usedAt, undefined);
  assert.equal(player(done, f.owner).spice, money + f.potentialBounty);
  assert.equal(done.phase, 7);
  assert.equal(player(done, f.captor).spice, captorMoney + 2);
  assert.ok(done.log.some(row => row.text === 'Harkonnen received 2 spice from strongholds.'));
  assert.equal(done.moritaniAssassinate!.opportunities.at(-1)!.bounty, f.potentialBounty);
  assert.equal(player(done, f.opponent).leaders.find(l => l.id === f.winningDisc)!.dead, false);
  rejected(done, f.owner, f.action);
  const mentat = finish(done, f);
  const receipt = mentat.moritaniAssassinate!.opportunities.find(r => r.event === f.event)!;
  assert.equal(receipt.stage, 'replaced');
  assert.ok(receipt.replacement);
  assert.notEqual(receipt.replacement, f.target);
  assert.equal(player(mentat, f.owner).traitors.includes(f.target), false);
  assert.deepEqual(inventory(mentat), f.originalInventory);
  assert.deepEqual(traitors(mentat), f.originalTraitors);
});

void test('a genuinely concealed execution has the same pending choices and resolves publicly with zero bounty and no repeated death', () => {
  const live = fixture();
  const f = fixture({ execute: true });
  const target = player(f.game, f.opponent).leaders.find(l => l.id === f.target)!;
  assert.equal(target.dead, true);
  assert.equal(target.deaths, 2);
  assert.ok(target.concealed);
  const visible = viewGame(f.game, f.owner).moritaniAssassinate!.pending!;
  const liveVisible = viewGame(live.game, live.owner).moritaniAssassinate!.pending!;
  assert.deepEqual(visible.cards, liveVisible.cards);
  assert.equal(visible.blocked, liveVisible.blocked);
  for (const card of visible.cards)
    assert.deepEqual(Object.keys(card).sort(), ['card', 'name', 'potentialBounty']);
  const money = player(f.game, f.owner).spice;
  const done = act(f.game, f.owner, f.action);
  const dead = player(done, f.opponent).leaders.find(l => l.id === f.target)!;
  assert.equal(dead.dead, true);
  assert.equal(dead.deaths, target.deaths);
  assert.equal(dead.concealed, undefined);
  assert.equal(dead.capturedBy, undefined);
  assert.equal(player(done, f.owner).spice, money);
  assert.equal(done.moritaniAssassinate!.opportunities.at(-1)!.bounty, 0);
  assert.ok(done.log.some(row => row.text.includes('already in the Tanks; no new death or spice')));
  for (const actor of [f.owner, f.opponent, f.captor]) {
    const actual = viewGame(done, actor).players.find(p => p.id === f.opponent)!.leaders.find(l => l.id === f.target)!;
    assert.equal(actual.dead, true);
    assert.equal(viewGame(done, actor).moritaniAssassinate!.history.at(-1)!.bounty, 0);
  }
  const mentat = finish(done, f);
  assert.equal(mentat.moritaniAssassinate!.opportunities.at(-1)!.stage, 'replaced');
  assert.deepEqual(traitors(mentat), f.originalTraitors);
});

for (const execute of [false, true]) {
  void test(`declining the ${execute ? 'concealed-executed' : 'living captive'} target preserves its original custody and physical Traitor`, () => {
    const f = fixture({ execute });
    const target = structuredClone(player(f.game, f.opponent).leaders.find(l => l.id === f.target)!);
    const money = player(f.game, f.owner).spice;
    const done = act(f.game, f.owner, f.decline);
    assert.deepEqual(player(done, f.opponent).leaders.find(l => l.id === f.target), target);
    assert.equal(player(done, f.owner).spice, money);
    const mentat = finish(done, f);
    assert.equal(mentat.moritaniAssassinate!.opportunities.at(-1)!.stage, 'declined');
    assert.ok(player(mentat, f.owner).traitors.includes(f.target));
    assert.deepEqual(player(mentat, f.opponent).leaders.find(l => l.id === f.target), target);
    assert.deepEqual(traitors(mentat), f.originalTraitors);
  });
}

void test('the target remains event-bound and owner-only with the original winning-disc restriction', () => {
  const f = fixture();
  rejected(f.game, f.captor, f.action);
  rejected(f.game, f.owner, { ...f.action, event: 'other-battle' });
  rejected(f.game, f.owner, { ...f.action, card: f.winningDisc });
  rejected(f.game, f.owner, { ...f.action, card: DUKE_VIDAL_ID });
  for (const actor of [f.opponent, f.captor])
    assert.deepEqual(viewGame(f.game, actor).moritaniAssassinate!.pending!.cards, []);
});

for (const profile of DIFFICULTIES) {
  void test(`${profile} legally uses the uniform potential-bounty choice for both genuine capture outcomes`, () => {
    for (const execute of [false, true]) {
      const f = fixture({ execute });
      const own = viewGame(f.game, f.owner);
      own.players.find(p => p.id === f.owner)!.bot = profile;
      const actions = botActions(own);
      assert.deepEqual(actions, [f.action]);
      const done = act(f.game, f.owner, actions[0]);
      assert.equal(done.moritaniAssassinate!.opportunities.at(-1)!.bounty, execute ? 0 : f.potentialBounty);
      assert.equal(finish(done, f).moritaniAssassinate!.opportunities.at(-1)!.stage, 'replaced');
    }
  });
}

void test('an actual paid foreign-ghola target keeps native identity and Tleilaxu return custody after the controlled later battle', async () => {
  const { createMoritaniAssassinateGholaTargetFixture } = await import('./fixture-moritani-assassinate-ghola-target');
  const f = createMoritaniAssassinateGholaTargetFixture();
  const target = player(f.game, f.opponent).leaders.find(l => l.id === f.target)!;
  assert.equal(target.dead, false);
  assert.ok(target.gholaBy);
  const controller = target.gholaBy;
  const money = player(f.game, f.owner).spice;
  const controllerMoney = player(f.game, controller).spice;
  const done = applyAction(f.game, f.owner, f.action);
  const killed = player(done, f.opponent).leaders.find(l => l.id === f.target)!;
  assert.equal(killed.faction, target.faction);
  assert.equal(killed.dead, true);
  assert.equal(killed.deaths, target.deaths + 1);
  assert.equal(killed.gholaBy, controller);
  assert.equal(killed.concealed, undefined);
  assert.equal(player(done, f.owner).spice, money + f.potentialBounty);
  assert.equal(player(done, controller).spice, controllerMoney);
});
