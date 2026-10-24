import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame, type Action } from '../game/engine';
import { leaders } from '../game/cards';
import {
  FOREIGN_GHOLA_DISC, createMoritaniForeignGholaWinnerFixture,
  rejectForeignGholaWinnerAction, revealMoritaniForeignGholaWitness,
} from './fixture-moritani-foreign-ghola-winner';
import { mixedE3MoritaniPlayer } from './fixture-mixed-e3-moritani-nexus';

/**
 * The consumer-visible regression for one actual physical winning disc whose
 * printed faction differs from the victorious player: a Guild native disc dies
 * in original combat, Tleilaxu legally revives it as a foreign ghola, and that
 * surviving disc then wins a real battle against Moritani. Before the played-
 * disc registry admitted ordinary canonical identities independently of the
 * winner’s faction, no private opportunity was produced at all.
 */
void test('a real Tleilaxu foreign ghola victory opens Moritani’s private loss choice against the opposing native Tleilaxu Traitor', () => {
  const f = createMoritaniForeignGholaWinnerFixture();
  assert.equal(mixedE3MoritaniPlayer(f.afterSetup, f.moritani).traitors.includes(f.target), true);

  // Authentic acquisition: the disc really died and the return is a real action.
  assert.equal(f.guildBattle.winner, f.tleilaxu);
  assert.equal(mixedE3MoritaniPlayer(f.guildBattle.after, f.guild)
    .leaders.find((l) => l.id === FOREIGN_GHOLA_DISC)!.dead, true);
  assert.equal(mixedE3MoritaniPlayer(f.revival.after, f.tleilaxu).spice,
    mixedE3MoritaniPlayer(f.revival.before, f.tleilaxu).spice - 3);
  const borrowed = mixedE3MoritaniPlayer(f.window.game, f.guild).leaders.find(l => l.id === FOREIGN_GHOLA_DISC)!;
  assert.equal(borrowed.dead, false);
  assert.equal(borrowed.faction, 'guild');
  assert.equal(borrowed.gholaBy, f.tleilaxu);

  // The real window: the winning disc belongs to no Tleilaxu disc, yet the
  // logical faction and target pool stay the victorious player’s printed one.
  assert.equal(f.window.opposingLeader, FOREIGN_GHOLA_DISC);
  assert.equal(f.window.faction, 'tleilaxu');
  assert.notEqual(f.window.territory, f.guildBattle.territory);
  assert.equal(f.window.opponent, f.tleilaxu);
  assert.equal(f.window.blocked, null);
  assert.equal(f.window.game.moritaniAssassinate!.normalTraitorCall, false);
  assert.ok(f.window.cards.some((choice) => choice.card === f.target));
  assert.equal(f.window.cards.every((choice) =>
    leaders('tleilaxu').some((l) => l.id === choice.card)), true,
  'Only the opposing player’s native Tleilaxu identities are targets.');
  assert.equal(f.window.cards.some((choice) => choice.card === FOREIGN_GHOLA_DISC), false,
    'The borrowed foreign disc never becomes a target identity.');
  assert.equal(f.window.cards.find((choice) => choice.card === f.target)!.potentialBounty, f.bounty);

  // Original continuation: printed bounty, one physical death, Mentat replacement.
  const outcome = revealMoritaniForeignGholaWitness(f);
  assert.notEqual(outcome.replacement, f.target);
  assert.equal(outcome.mentat.traitorReserve!.includes(outcome.replacement), false,
    'The drawn replacement left the reserve for Moritani’s private hand.');
  assert.equal(mixedE3MoritaniPlayer(outcome.mentat, f.moritani)
    .traitors.includes(outcome.replacement), true);
  assert.deepEqual(outcome.mentat.moritaniAssassinate!.opportunities.map((r) => r.stage),
    ['replaced']);
  const ghola = mixedE3MoritaniPlayer(outcome.mentat, f.guild)
    .leaders.find((l) => l.id === FOREIGN_GHOLA_DISC)!;
  assert.equal(ghola.gholaBy, f.tleilaxu, 'The surviving foreign ghola stays in Tleilaxu custody.');
  assert.equal(ghola.dead, false);
  assert.equal(mixedE3MoritaniPlayer(outcome.mentat, f.tleilaxu)
    .leaders.find((l) => l.id === f.target)!.dead, true, 'The revealed native Tleilaxu disc died.');
});

void test('the foreign-ghola window stays private and rejects any borrowed or foreign identity', () => {
  const f = createMoritaniForeignGholaWinnerFixture();
  const rival = viewGame(f.window.game, f.tleilaxu).moritaniAssassinate!;
  assert.equal(rival.pending?.cards.length, 0);
  assert.equal(rival.pending?.blocked, null);
  const owner = viewGame(f.window.game, f.moritani).moritaniAssassinate!;
  assert.equal(owner.history.length, 0, 'Nothing is public until the reveal actually commits.');

  const foreign: Action = { type: 'decision', event: f.window.event, card: 'guild-1' };
  rejectForeignGholaWinnerAction(f.window.game, f.moritani, foreign);
  rejectForeignGholaWinnerAction(f.window.game, f.moritani,
    { type: 'decision', event: 'stale-foreign-ghola', card: f.target });
  rejectForeignGholaWinnerAction(f.window.game, f.tleilaxu,
    { type: 'decision', event: f.window.event, card: f.target });
  rejectForeignGholaWinnerAction(f.window.game, f.moritani,
    { type: 'decision', event: f.window.event, card: f.window.opposingLeader });

  assert.equal(mixedE3MoritaniPlayer(f.window.game, f.tleilaxu)
    .leaders.find((l) => l.id === f.target)!.dead, false,
  'A rejected submission never kills the held target.');
});
