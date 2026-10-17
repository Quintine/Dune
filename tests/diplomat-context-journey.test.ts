import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame } from '../game/engine';
import { weaponKills } from '../game/battle-cards';
import {
  applyDiplomatContextStep, assertDiplomatContextCustody, copyDiplomatContextJourney,
  createDiplomatContextJourney, diplomatContextPlayer, finishDiplomatContextJourney,
  revealDiplomatContextJourney, settleDiplomatContextJourney,
} from './fixture-diplomat-context-journey';

void test('original native World vote closes, invader uses actual late Portable, and Diplomat copies only its poison role before typed custody settles', () => {
  const fixture = createDiplomatContextJourney();
  const { game, owner, opponent, trainer, enemyLeader, source, worthless, territory } = fixture;
  assert.ok(source);
  const shipment = fixture.shipments[0];
  assert.equal(diplomatContextPlayer(shipment.before, opponent).spice -
    diplomatContextPlayer(shipment.after, opponent).spice, 2);
  assert.equal(diplomatContextPlayer(shipment.before, opponent).reserves -
    diplomatContextPlayer(shipment.after, opponent).reserves, 3);
  const worlds = viewGame(game, owner).homeworlds!.worlds!;
  const nativeWorld = worlds.find(world => world.id === territory)!;
  const salusa = worlds.find(world => world.id === 'homeworld:emperor:salusa')!;
  assert.equal(nativeWorld.card, 'kaitain');
  assert.deepEqual(nativeWorld.forces[owner], { normal: 15, elite: 0 });
  assert.deepEqual(nativeWorld.forces[opponent], { normal: 3, elite: 0 });
  assert.deepEqual(salusa.forces[owner], { normal: 0, elite: 5 });

  const revealed = revealDiplomatContextJourney(fixture);
  assert.equal(revealed.battle!.diplomatDefense, undefined);
  assert.deepEqual(viewGame(revealed, owner).battle!.traitorVoters, [owner]);
  assert.equal(revealed.battle!.plans[opponent].defense, null);
  const nativeVoted = applyAction(revealed, owner, { type: 'traitorCall', call: false });
  assert.equal(nativeVoted.decision?.kind, 'homeworldDefense');
  assert.equal(nativeVoted.decision?.player, opponent);
  assert.equal(nativeVoted.battle!.traitorCalls[owner], false);
  assert.equal(nativeVoted.battle!.traitorCalls[opponent], undefined);
  assert.ok(nativeVoted.decision?.kind === 'homeworldDefense');
  const used = applyDiplomatContextStep(nativeVoted, { actor: opponent,
    action: { type: 'decision', event: nativeVoted.decision.event, use: true } });
  assert.equal(used.decision?.kind, 'diplomatDefense');
  assert.equal(used.battle!.lateDefense![opponent], source);
  assert.deepEqual(used.battle!.homeworldDefensePassed, [opponent]);
  assert.equal(used.battle!.traitorCalls[owner], false);
  assert.deepEqual(used.battle!.diplomatDefense!.cards, [worthless]);
  assert.equal(used.battle!.diplomatDefense!.source, source);
  assert.equal(used.battle!.diplomatDefense!.kind, 'snooper');
  assert.deepEqual(used.battle!.plans, revealed.battle!.plans);
  const copied = copyDiplomatContextJourney(used, worthless);
  assert.throws(() => applyAction(copied, owner, { type: 'traitorCall', call: false }),
    'The submitted native-only vote cannot be reopened after the copied defense.');
  const settled = settleDiplomatContextJourney(copied);
  assert.equal(settled.lastBattleContext!.winner, owner);
  assert.equal(diplomatContextPlayer(settled, owner).leaders.find(l => l.id === trainer)!.dead, false);
  assert.equal(diplomatContextPlayer(settled, opponent).leaders.find(l => l.id === enemyLeader)!.dead, false);
  const finalWorlds = viewGame(settled, owner).homeworlds!.worlds!;
  assert.deepEqual(finalWorlds.find(world => world.id === territory)!.forces[owner], nativeWorld.forces[owner]);
  assert.deepEqual(finalWorlds.find(world => world.id === 'homeworld:emperor:salusa')!.forces[owner],
    { normal: 0, elite: 5 }, 'Copying a defense never spends or relabels Sardaukar.');
  assert.deepEqual(finalWorlds.find(world => world.id === territory)!.forces[opponent] ?? { normal: 0, elite: 0 },
    { normal: 0, elite: 0 });
  assert.equal(diplomatContextPlayer(settled, opponent).tanks, 3);
  assert.equal(diplomatContextPlayer(settled, owner).elites!.tanks, 0);
  assert.equal(settled.discard.filter(card => card.id === worthless).length, 1);
  assert.equal(settled.discard.filter(card => card.id === source).length, 1);
  assert.equal(diplomatContextPlayer(settled, owner).hand.some(card => card.id === worthless), false);
  assertDiplomatContextCustody(settled);
  assert.equal(finishDiplomatContextJourney(settled).phase, 7);
});

void test('an actually earned Carthag layers its own Snooper onto a copied printed Shield while preserving physical custody', () => {
  const fixture = createDiplomatContextJourney({ kind: 'held-carthag' });
  const { owner, opponent, trainer, enemyLeader, worthless, source, firstMentat } = fixture;
  assert.ok(firstMentat && source);
  assert.equal(firstMentat.before.strongholdCards!.owners.carthag, null);
  assert.equal(firstMentat.before.players.find(p => p.id === owner)!.forces['carthag:11'], 1);
  assert.equal(firstMentat.after.strongholdCards!.owners.carthag, owner);
  assert.equal(fixture.game.strongholdCards!.owners.carthag, owner);
  assert.equal(fixture.game.players.find(p => p.id === opponent)!.forces['carthag:11'], 1);
  for (const shipment of fixture.shipments) {
    assert.equal(diplomatContextPlayer(shipment.before, shipment.step.actor).reserves -
      diplomatContextPlayer(shipment.after, shipment.step.actor).reserves, 1);
    assert.equal(diplomatContextPlayer(shipment.before, shipment.step.actor).spice -
      diplomatContextPlayer(shipment.after, shipment.step.actor).spice, 1);
  }
  assert.equal(weaponKills(
    diplomatContextPlayer(fixture.game, opponent).hand.find(card => card.id === fixture.enemyWeapon),
    diplomatContextPlayer(fixture.game, opponent).hand.find(card => card.id === source),
  ), true, 'The exact copied printed Shield by itself does not protect against the exact poison weapon.');
  const revealed = revealDiplomatContextJourney(fixture);
  assert.equal(revealed.battle!.diplomatDefense!.source, source);
  assert.equal(revealed.battle!.diplomatDefense!.kind, 'shield');
  const settled = settleDiplomatContextJourney(copyDiplomatContextJourney(revealed, worthless));
  assert.equal(settled.lastBattleContext!.winner, owner);
  assert.equal(diplomatContextPlayer(settled, owner).leaders.find(l => l.id === trainer)!.dead, false,
    'Shield alone cannot stop poison: the holder’s original Carthag independently supplies Snooper.');
  assert.equal(diplomatContextPlayer(settled, opponent).leaders.find(l => l.id === enemyLeader)!.dead, false);
  assert.equal(diplomatContextPlayer(settled, owner).forces['carthag:11'], 1);
  assert.equal(diplomatContextPlayer(settled, owner).tanks, 0);
  assert.equal(diplomatContextPlayer(settled, owner).elites!.tanks, 0);
  assert.equal(diplomatContextPlayer(settled, opponent).tanks, 1);
  assert.equal(settled.strongholdCards!.owners.carthag, owner);
  assert.equal(settled.discard.filter(card => card.id === worthless).length, 1);
  assert.equal(settled.discard.filter(card => card.id === source).length, 1);
  assert.equal(diplomatContextPlayer(settled, owner).hand.some(card => card.id === source), false);
  assertDiplomatContextCustody(settled);
  assert.equal(finishDiplomatContextJourney(settled).phase, 7);
});

void test('an earned Carthag with only a physical Worthless and no opposing actual defense supplies neither a copy source nor poison protection', () => {
  const fixture = createDiplomatContextJourney({ kind: 'empty-carthag' });
  const { owner, opponent, trainer, worthless } = fixture;
  assert.equal(fixture.firstMentat!.after.strongholdCards!.owners.carthag, owner);
  const revealed = revealDiplomatContextJourney(fixture);
  assert.equal(revealed.battle!.plans[owner].weapon, worthless);
  assert.equal(revealed.battle!.plans[owner].defense, null);
  assert.equal(revealed.battle!.plans[opponent].defense, null);
  assert.equal(revealed.battle!.diplomatDefense, undefined);
  assert.notEqual(revealed.decision?.kind, 'diplomatDefense');
  const settled = settleDiplomatContextJourney(revealed);
  assert.equal(diplomatContextPlayer(settled, owner).leaders.find(l => l.id === trainer)!.dead, true);
  assert.equal(settled.lastBattleContext!.winner, opponent);
  assert.equal(settled.strongholdCards!.owners.carthag, owner,
    'Battle occupancy does not replace the original END Mentat card owner.');
  assert.equal(diplomatContextPlayer(settled, owner).forces['carthag:11'] ?? 0, 0);
  assert.equal(diplomatContextPlayer(settled, owner).tanks, 1);
  assert.equal(diplomatContextPlayer(settled, owner).elites!.tanks, 0);
  assert.equal(settled.discard.filter(card => card.id === worthless).length, 1);
  assertDiplomatContextCustody(settled);
});

