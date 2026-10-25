import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import {
  createHomeworldEcazDukeFixture as fixture,
  homeworldEcazDukePlayer as player,
  homeworldEcazDukeInventory as inventory,
  homeworldEcazDukePhysical as physical,
} from './fixture-homeworld-ecaz-duke';

const cards = (game: Game) => ({
  deck: game.deck, discard: game.discard, auction: game.auction,
  hands: game.players.map(p => ({ id: p.id, hand: p.hand })),
});

for (const advanced of [false, true]) void test(
  `all four minimal profiles natively grant the ${advanced ? 'Advanced' : 'Basic'} occupied Ecaz Duke to an offered recipient`, () => {
    const f = fixture({ advanced, allied: true }), before = structuredClone(f.game);
    assert.ok(f.ally); assert.equal(player(f.game, f.occupier).ally, f.ally);
    assert.equal(player(f.game, f.ally).ally, f.occupier);
    assert.equal(f.game.dukeVidal?.controller, null); assert.equal(f.game.dukeVidal?.leader.dead, false);
    assert.equal(f.game.dukeVidal?.leader.id, f.dukeId);
    assert.deepEqual(f.game.battle?.plans, {}); assert.equal(f.game.battle?.revealed, false);
    assert.deepEqual(inventory(f.game), f.originalInventory);
    const originalPhysical = structuredClone(physical(f.game)), originalCards = structuredClone(cards(f.game));
    for (const profile of DIFFICULTIES) {
      const own = viewGame(f.game, f.occupier), offer = own.homeworldEcazDuke;
      assert.ok(offer && offer.event); assert.equal(offer.blocked, null); assert.equal(offer.occupier, f.occupier);
      assert.deepEqual(offer.recipients.map(recipient => recipient.id).sort(), [f.occupier, f.ally].sort());
      own.players.find(p => p.id === f.occupier)!.bot = profile;
      const projected = structuredClone(own), proposals = botActions(own);
      assert.deepEqual(own, projected, profile); assert.equal(proposals.length, 1, profile);
      const action = proposals[0];
      assert.equal(action.type, 'homeworldDuke'); assert.equal(action.event, offer.event);
      assert.equal(typeof action.recipient, 'string');
      assert.ok(offer.recipients.some(recipient => recipient.id === action.recipient), profile);
      assert.deepEqual(action, { type: 'homeworldDuke', event: offer.event, recipient: action.recipient });
      const granted = applyAction(f.game, f.occupier, action);
      assert.deepEqual(f.game, before, 'Bot metadata and native application leave the original genuine source unchanged');
      assert.equal(granted.dukeVidal?.leader.id, f.dukeId);
      assert.deepEqual(granted.dukeVidal?.leader, before.dukeVidal!.leader);
      assert.equal(granted.dukeVidal?.controller, action.recipient);
      assert.equal(granted.dukeVidal?.source, 'homeworldEcaz');
      assert.equal(granted.dukeVidal?.acquiredTurn, f.game.turn);
      assert.deepEqual(granted.homeworldEcazDukeGrants, [{
        turn: f.game.turn, qualification: f.qualification.event,
        occupier: f.occupier, recipient: action.recipient,
      }]);
      assert.deepEqual(physical(granted), originalPhysical); assert.deepEqual(cards(granted), originalCards);
      assert.deepEqual(granted.battle, before.battle); assert.deepEqual(inventory(granted), f.originalInventory);
      const unavailable = viewGame(granted, f.occupier).homeworldEcazDuke;
      assert.ok(unavailable?.blocked); assert.equal(unavailable.event, null);
    }
  },
);

void test('minimal profiles propose no occupied Ecaz Duke grant from blocked missing-event or foreign projections', () => {
  const f = fixture({ allied: true }), before = structuredClone(f.game);
  for (const profile of DIFFICULTIES) {
    // Deliberately controlled projection-only priority states. Native custody,
    // occupation, battle and the original two-choice source remain untouched.
    for (const unavailable of ['blocked', 'event', 'absent'] as const) {
      const own = viewGame(f.game, f.occupier); assert.ok(own.homeworldEcazDuke);
      own.players.find(p => p.id === f.occupier)!.bot = profile;
      if (unavailable === 'blocked') own.homeworldEcazDuke.blocked = 'Finish the current interaction before granting Duke Vidal.';
      if (unavailable === 'event') own.homeworldEcazDuke.event = null;
      if (unavailable === 'absent') own.homeworldEcazDuke = null;
      const projected = structuredClone(own);
      assert.ok(botActions(own).every(action => action.type !== 'homeworldDuke'), `${profile}: ${unavailable}`);
      assert.deepEqual(own, projected);
    }
    const foreign = viewGame(f.game, f.ally!); assert.equal(foreign.homeworldEcazDuke, null);
    foreign.players.find(p => p.id === f.ally)!.bot = profile;
    assert.ok(botActions(foreign).every(action => action.type !== 'homeworldDuke'), profile);
  }
  assert.deepEqual(f.game, before); assert.deepEqual(inventory(f.game), f.originalInventory);
});
