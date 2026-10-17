import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { DUKE_VIDAL_ID } from '../game/duke-vidal';
import { quoteEcazDukeAcquisition } from '../game/ecaz-duke-acquisition';
import { nexusEcazDukeModeSupported } from '../game/nexus-ecaz-duke';
import { nexusEcazDukeAction } from '../game/nexus-ecaz-duke-options';
import { initialIxianBetrayalCursor, validateIxianBetrayalHistory } from '../game/nexus-ixian-betrayal';
import { createIndependentCardModulesFixture } from './fixture-independent-card-modules';
import {
  createE3IndependentNexusDuke, createE3IndependentTwoSeatNexus, e3IndependentDukePlayer as player,
  expireE3IndependentNexusDuke, useE3IndependentNexusDuke,
} from './fixture-e3-independent-nexus-duke';

for (const advanced of [false, true]) {
  void test(`${advanced ? 'Advanced all14 World/phase' : 'Basic independent36'} Ecaz draws through a real Nexus, acquires the actual Duke and consumes him in one funded battle`, () => {
    const f = createE3IndependentNexusDuke({ advanced, homeworlds: advanced, skills: advanced,
      tech: advanced, strongholds: advanced });
    assert.equal(f.afterSetup.ecazTreachery, true);
    assert.equal(f.afterSetup.dukeVidal!.controller, null);
    assert.equal(f.afterSetup.dukeVidal!.leader.id, DUKE_VIDAL_ID);
    assert.equal(player(f.alliance, f.owner).ally, null);
    assert.equal(player(f.alliance, f.others[0]).ally, f.others[1]);
    assert.equal(player(f.alliance, f.others[1]).ally, f.others[0]);
    assert.equal(f.beforeDraw.nexusCards!.cards!.hands[f.owner], null);
    assert.equal(f.afterDraw.nexusCards!.cards!.hands[f.owner], 'ecaz');
    assert.equal(f.game.nexusCards!.cards!.hands[f.owner], null);
    assert.equal(f.game.nexusCards!.cards!.discard.filter(card => card === 'ecaz').length, 1);
    assert.equal(f.game.dukeVidal!.controller, f.owner);
    assert.equal(f.game.dukeVidal!.source, 'ecazNexus');
    assert.equal(f.game.dukeVidal!.acquiredTurn, f.game.turn);
    assert.deepEqual(f.game.players, f.beforeCunning.players,
      'The shared-disc acquisition does not pay spice, move forces or add a sixth native disc.');
    assert.ok(viewGame(f.game, f.owner).players.find(seat => seat.id === f.owner)!.leaders
      .some(leader => leader.id === DUKE_VIDAL_ID));

    for (const difficulty of DIFFICULTIES) {
      const game = structuredClone(f.beforeCunning), own = viewGame(game, f.owner);
      own.players.find(seat => seat.id === f.owner)!.bot = difficulty;
      const action = botActions(own).find(candidate => candidate.type === 'nexusEcazDuke'); assert.ok(action, difficulty);
      assert.equal(applyAction(game, f.owner, action).dukeVidal!.controller, f.owner);
    }

    const used = useE3IndependentNexusDuke(f);
    assert.equal(player(used.beforePlans, f.owner).spice, player(used.beforeShipment, f.owner).spice - 1);
    assert.equal(used.revealed.battle!.plans[f.owner].leader, DUKE_VIDAL_ID);
    assert.equal(used.game.lastBattleContext!.winner, f.owner);
    assert.equal(used.game.dukeVidal!.controller, null);
    assert.equal(used.game.dukeVidal!.source, null);
    assert.equal(used.game.dukeVidal!.leader.dead, false);
    assert.equal(used.game.dukeVidal!.leader.usedAt, used.territory);
    assert.equal(player(used.game, f.owner).tanks, player(used.beforePlans, f.owner).tanks + 1);
    assert.equal(used.game.nexusEcazDukeHistory!.length, 1);
    assert.equal(used.game.nexusCards!.cards!.discard.filter(card => card === 'ecaz').length, 1);

    const unused = expireE3IndependentNexusDuke(f);
    assert.equal(unused.game.turn, f.game.turn + 1);
    assert.equal(unused.game.dukeVidal!.controller, null);
    assert.equal(unused.game.dukeVidal!.source, null);
    assert.equal(unused.game.dukeVidal!.leader.dead, false);
    assert.equal(unused.game.dukeVidal!.leader.usedAt, undefined);
    assert.equal(unused.game.nexusEcazDukeHistory!.length, 1);
    assert.equal(unused.game.nexusCards!.cards!.discard.filter(card => card === 'ecaz').length, 1);
  });

  void test(`${advanced ? 'Advanced' : 'Basic'} two-seat original Nexus setup closes a real worm without inventing an alliance or closing draw`, () => {
    const f = createE3IndependentTwoSeatNexus(advanced);
    assert.equal(f.game.players.length, 2);
    assert.equal(f.opened.nexus, true);
    assert.ok(f.opened.players.every(seat => seat.ally === null));
    assert.ok(f.game.players.every(seat => seat.ally === null));
    assert.equal(f.game.nexus, false);
    assert.equal(f.game.phase, 2);
    assert.equal(f.game.nexusCards!.cards!.deck.length, 12);
    assert.ok(Object.values(f.game.nexusCards!.cards!.hands).every(card => card === null));
    assert.deepEqual(f.game.nexusCards!.cards, f.afterSetup.nexusCards!.cards);
    assert.equal(f.actions.some(step => step.action.type === 'nexusCardChoice'), false);
    assert.equal(nexusEcazDukeModeSupported(f.game), true, 'The selected module still accepts a normal two-seat table.');
    assert.equal(nexusEcazDukeAction(viewGame(f.game, 'ecaz')), null);
    assert.equal(f.game.dukeVidal!.controller, null);
  });
}

void test('Advanced independent Ecaz/Harkonnen keeps the shared Duke acquisition table permission without Skills', () => {
  const f = createE3IndependentNexusDuke({ advanced: true, factions: ['ecaz', 'guild', 'harkonnen'],
    tech: true, homeworlds: true, strongholds: true });
  const before = structuredClone(f.beforeCunning);
  const acquisition = quoteEcazDukeAcquisition(f.beforeCunning, f.owner);
  assert.equal(acquisition.controller, f.owner);
  assert.deepEqual(f.beforeCunning, before, 'An ordinary acquisition quote does not itself commit an Ambassador or a second Duke.');
  assert.equal(f.game.dukeVidal!.controller, f.owner);
  assert.equal(f.game.nexusEcazDukeHistory!.length, 1);
});

for (const richese of [false, true]) {
  void test(`original E3/Ix${richese ? '/CHOAM with Richese cache' : ''} stock feeds the native Ixian cancellation catalogue without changing legacy defaults`, () => {
    const expansions = richese ? ['ecaz', 'ix', 'choam'] : ['ecaz', 'ix'];
    const f = createIndependentCardModulesFixture({ advanced: false, expansions,
      factions: richese ? ['ecaz', 'moritani', 'ixians', 'richese'] : ['ecaz', 'moritani', 'ixians', 'guild'],
      independent: true, nexus: true, homeworlds: true, tech: true });
    const game = f.game;
    const physical = [...game.deck, ...game.discard, ...game.players.flatMap(seat => seat.hand),
      ...(game.ixSetupCards ?? []), ...(game.richeseCache ?? []), ...(game.richeseRemoved ?? [])];
    assert.equal(physical.length, richese ? 60 : 50);
    const cursor = initialIxianBetrayalCursor();
    validateIxianBetrayalHistory([], cursor, physical, { expansions, ecazTreachery: true, richese });
    assert.throws(() => validateIxianBetrayalHistory([], cursor, physical),
      'An original Ix47 caller cannot silently gain the independent cards or an unselected cache.');
    assert.throws(() => validateIxianBetrayalHistory([], cursor, physical,
      { expansions, ecazTreachery: false, richese }), 'Selected E3 admission here requires the explicit independent variant.');
  });
}
