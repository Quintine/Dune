import assert from 'node:assert/strict';
import test from 'node:test';
import { handLimit } from '../game/engine';
import { DUKE_VIDAL_ID } from '../game/duke-vidal';
import { createMoritaniEcazDukeWinner, settleMoritaniEcazDukeWinner } from './fixture-moritani-ecaz-duke-winner';
import { pairedE3NexusInventory, pairedE3NexusPlayer, revealPairedE3Nexus, stepPairedE3Nexus } from './fixture-paired-e3-nexus-modules';

/** Controlled supplement on a genuine Advanced Ecaz/Moritani/Guild setup and
 * earned Duke acquisition. Stage only the prior set-aside Duke history and
 * physical Lasgun/Shield custody; battle choice, plans and votes are real. */
function source(setAside: boolean) {
  const f = createMoritaniEcazDukeWinner();
  const game = structuredClone(f.beforeBattle);
  const duke = game.dukeVidal!;
  assert.equal(duke.leader.id, DUKE_VIDAL_ID);
  assert.equal(duke.leader.dead, false);
  assert.equal(duke.controller, f.ecaz);
  if (setAside) {
    duke.controller = null;
    duke.acquiredTurn = null;
    duke.source = null;
    duke.leader.usedAt = f.location;
  }
  const take = (kind: 'lasgun' | 'shield', actor: string) => {
    const recipient = pairedE3NexusPlayer(game, actor);
    const already = recipient.hand.find(card => card.kind === kind);
    if (already) return already;
    const pools = [game.deck, game.discard, ...game.players.map(player => player.hand)];
    const pool = pools.find(cards => cards.some(card => card.kind === kind));
    assert.ok(pool, `The original ${kind} remains in physical custody`);
    const index = pool.findIndex(card => card.kind === kind);
    const [card] = pool.splice(index, 1);
    if (recipient.hand.length >= handLimit(recipient)) {
      const replacement = recipient.hand.pop(); assert.ok(replacement);
      pool.push(replacement);
    }
    recipient.hand.push(card);
    return card;
  };
  const lasgun = take('lasgun', f.ecaz), shield = take('shield', f.moritani);
  pairedE3NexusInventory(game);
  const native = pairedE3NexusPlayer(game, f.ecaz).leaders.find(leader => !leader.dead && !leader.usedAt);
  assert.ok(native);
  const chosen = stepPairedE3Nexus(game, f.choice);
  const plans = f.plans.map(step => step.actor === f.ecaz
    ? { ...step, action: { ...step.action, leader: setAside ? native.id : DUKE_VIDAL_ID, weapon: lasgun.id } }
    : { ...step, action: { ...step.action, defense: shield.id } });
  const ready = revealPairedE3Nexus(chosen, plans);
  return { f, game, ready, priorDuke: structuredClone(duke), lasgun: lasgun.id, shield: shield.id };
}

void test('Advanced later explosion does not kill a surviving Duke already set beside the board', () => {
  const s = source(true);
  assert.equal(s.priorDuke.controller, null);
  assert.equal(s.priorDuke.leader.usedAt, s.f.location);
  const done = settleMoritaniEcazDukeWinner(s.ready);
  assert.equal(done.lastBattleContext?.result, 'explosion');
  assert.equal(done.dukeVidal!.leader.id, DUKE_VIDAL_ID);
  assert.equal(done.dukeVidal!.leader.dead, false);
  assert.equal(done.dukeVidal!.leader.deaths, s.priorDuke.leader.deaths);
  assert.equal(done.dukeVidal!.controller, null);
  assert.ok(done.players.every(player => player.leaders.every(leader => leader.id !== DUKE_VIDAL_ID)));
  pairedE3NexusInventory(done);
});

void test('Advanced current-plan Duke still dies in a resolved Lasgun–Shield explosion', () => {
  const s = source(false);
  assert.equal(s.priorDuke.controller, s.f.ecaz);
  const done = settleMoritaniEcazDukeWinner(s.ready);
  assert.equal(done.lastBattleContext?.result, 'explosion');
  assert.equal(done.dukeVidal!.leader.id, DUKE_VIDAL_ID);
  assert.equal(done.dukeVidal!.leader.dead, true);
  assert.equal(done.dukeVidal!.leader.deaths, s.priorDuke.leader.deaths + 1);
  assert.equal(done.dukeVidal!.controller, null);
  assert.ok(done.players.every(player => player.leaders.every(leader => leader.id !== DUKE_VIDAL_ID)));
  pairedE3NexusInventory(done);
});
