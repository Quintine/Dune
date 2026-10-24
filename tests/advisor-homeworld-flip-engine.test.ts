import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, normalizeAutomaticGame, viewGame, type Action, type Game } from '../game/engine';
import { isAdvisor, fighterCount } from '../game/advisors';
import { homeworldContext } from '../game/homeworld-game';
import { homeworldForceGroups } from '../game/homeworld-custody';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import {
  createAdvisorHomeworldFlipFixture as fixture, actAdvisorHomeworldFlip as act,
  commitAdvisorHomeworldFlip as commit, finishAdvisorHomeworldFlip as finish,
  advisorHomeworldFlipPlayer as player, advisorHomeworldFlipInventory as inventory,
} from './fixture-advisor-homeworld-flip';

const cases = [
  { kind: 'native' as const },
  { kind: 'junction' as const },
  { kind: 'junction' as const, intrusion: true },
  { kind: 'junction' as const, advisorArrival: true },
];
function allow(g: Game) {
  for (let count = 0; g.response?.automaticAdvisorFlip && count < 30; count++) {
    const actor = g.players.find(p => !g.response!.passed.includes(p.id)); assert.ok(actor);
    g = act(g, actor.id, { type: 'passResponse' });
  }
  assert.ok(!g.response?.automaticAdvisorFlip); return g;
}
function rejected(g: Game, actor: string, action: Action) {
  const before = structuredClone(g); assert.throws(() => applyAction(g, actor, action)); assert.deepEqual(g, before);
}
const physical = (g: Game) => ({ custody: g.homeworlds!.custody,
  players: g.players.map(p => ({ id: p.id, forces: p.forces, reserves: p.reserves, tanks: p.tanks,
    spice: p.spice, shipped: p.shipped, moved: p.moved })) });

for (const config of cases) for (const canceled of [false, true]) {
  void test(`${config.kind}${config.intrusion ? ' Intrusion' : config.advisorArrival ? ' advisor arrival' : ' return'} ${canceled ? 'prevention' : 'allowance'} keeps paid transport and resumes only its own arrival`, () => {
    const f = fixture(config), before = structuredClone(f.game), pending = commit(f.game, f).game;
    assert.deepEqual(f.game, before);
    const source = pending.response?.automaticAdvisorFlip; assert.ok(source?.producer === 'homeworldTransport');
    assert.equal(source.transport.kind, config.kind); assert.equal(source.transport.destination, f.to);
    assert.equal(pending.decision, null);
    assert.equal(player(pending, f.shipper).spice, player(before, f.shipper).spice - f.cost);
    assert.equal(player(pending, f.shipper).forces[f.from], undefined);
    assert.equal(player(pending, f.shipper).shipped, true); assert.equal(player(pending, f.shipper).moved, 0);
    assert.equal(fighterCount(player(pending, f.bg), f.territory), 0);
    assert.ok(viewGame(pending, f.holder).responseControls?.cancelCards.includes(f.karama));
    const parent = pending.pendingAutomaticAdvisorHomeworldTransport!;
    assert.ok(parent.sourceEvent.length > 0 && parent.sourceEvent !== source.transport.event);
    const publicResponse = JSON.stringify(viewGame(pending, f.holder).response);
    assert.ok(!publicResponse.includes('sourceEvent') && !publicResponse.includes('signature'));
    assert.ok(!publicResponse.includes(parent.sourceEvent));
    if (f.to.startsWith('homeworld:')) {
      const deposit = homeworldForceGroups(homeworldContext(pending), pending.homeworlds!.custody!)
        .find(world => world.id === f.to)!.forces[f.shipper];
      assert.equal(deposit.normal + deposit.elite, 20);
      assert.equal(parent.arrival, undefined);
    } else assert.equal(player(pending, f.shipper).forces[f.to], f.amount);
    if (config.intrusion) rejected(pending, f.bg, { type: 'decision', accept: false });
    const committed = physical(pending);
    let done = canceled
      ? act(pending, f.holder, { type: 'card', card: f.karama, mode: 'cancel' }) : allow(pending);
    assert.equal(done.pendingAutomaticAdvisorHomeworldTransport, undefined);
    assert.equal(done.pendingAutomaticAdvisorFlips, undefined);
    assert.deepEqual(physical(done), committed);
    assert.equal(isAdvisor(player(done, f.bg), f.territory), canceled);
    if (config.intrusion) {
      assert.equal(done.decision?.kind, 'intrusion');
      assert.equal(done.decision?.player, f.bg);
      done = act(done, f.bg, { type: 'decision', accept: false });
      assert.equal(done.decision, null);
    } else assert.equal(done.decision, null);
    for (let read = 0; read < 3; read++) {
      done = normalizeAutomaticGame(done); assert.equal(done.decision, null);
      assert.deepEqual(physical(done), committed);
    }
    const finished = finish(done);
    assert.ok(finished.phase === 6 || finished.phase === 7);
    assert.deepEqual(inventory(finished), f.originalInventory);
    assert.equal(finished.discard.filter(c => c.id === f.karama).length, canceled ? 1 : 0);
    assert.equal(player(finished, f.shipper).forces[f.from], undefined);
    assert.equal(player(finished, f.shipper).tanks, player(before, f.shipper).tanks);
  });
}

void test('earlier native transport privilege prevention leaves Homeworld payment and the last outsider untouched', () => {
  const f = fixture(); let declared = act(f.game, f.shipper, f.action);
  if (declared.decision?.kind === 'homeworldShipmentGuild') declared = act(declared,
    declared.decision.player, { type: 'decision', event: declared.decision.event, allow: true });
  assert.equal(declared.response?.kind, 'guildTransportPermission');
  const done = act(declared, f.holder, { type: 'card', card: f.karama, mode: 'cancel' });
  assert.equal(done.pendingAutomaticAdvisorHomeworldTransport, undefined);
  assert.equal(player(done, f.shipper).forces[f.from], f.amount);
  assert.equal(player(done, f.shipper).spice, player(f.game, f.shipper).spice);
  assert.equal(player(done, f.shipper).shipped, false);
  assert.equal(isAdvisor(player(done, f.bg), f.territory), true);
});

void test('changed private source or arrival rejects before a conversion counter spends its card', () => {
  const f = fixture({ kind: 'junction', intrusion: true }), pending = commit(f.game, f).game;
  for (const field of ['source', 'arrival'] as const) {
    const invalid = structuredClone(pending);
    if (field === 'source') invalid.pendingAutomaticAdvisorHomeworldTransport!.sourceEvent = 'different-original-source';
    else invalid.pendingAutomaticAdvisorHomeworldTransport!.arrival!.sector = 9;
    rejected(invalid, f.holder, { type: 'card', card: f.karama, mode: 'cancel' });
    assert.deepEqual(physical(invalid), physical(pending));
    assert.ok(player(invalid, f.holder).hand.some(c => c.id === f.karama));
  }
});

void test('all four existing profiles resolve each Homeworld transport conversion legally', () => {
  for (const config of cases) for (const profile of DIFFICULTIES) {
    const f = fixture(config), pending = commit(f.game, f).game, own = viewGame(pending, f.holder);
    own.players.find(p => p.id === f.holder)!.bot = profile;
    const actions = botActions(own); assert.ok(actions.length);
    let done = allow(act(pending, f.holder, actions[0]));
    if (done.decision?.kind === 'intrusion') done = act(done, f.bg, { type: 'decision', accept: false });
    assert.equal(done.pendingAutomaticAdvisorHomeworldTransport, undefined);
    assert.deepEqual(physical(done), physical(pending));
    assert.deepEqual(inventory(done), f.originalInventory);
  }
});
