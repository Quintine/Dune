import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  newPlayer,
  viewGame,
  type Game,
} from '../game/engine';
import { baseDeck } from '../game/cards';
import { createAmbassadors, validateAmbassadors } from '../game/ecaz-ambassadors';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { registerHooks } from 'node:module';

/** A genuine Ecaz arrival whose Tleilaxu token is assigned to an elite ally. */
function fixture() {
  const g = createGame('TLEIAMBA', newPlayer('ecaz', 'Ecaz', 'ecaz'));
  g.players.push(
    newPlayer('entrant', 'Entrant', 'atreides'),
    newPlayer('ally', 'Ally', 'emperor'),
  );
  Object.assign(g, {
    status: 'playing',
    phase: 5,
    turn: 2,
    storm: 18,
    order: ['entrant', 'ecaz', 'ally'],
    active: 'entrant',
  });
  g.movementRemaining = [...g.order];
  g.deck = baseDeck();
  for (const p of g.players) {
    p.hand = [];
    p.forces = {};
    p.reserves = 20;
    p.spice = 10;
    p.traitors = [p.leaders[0].id];
  }
  const ecaz = g.players[0], ally = g.players[2];
  ecaz.ally = ally.id;
  ally.ally = ecaz.id;
  ally.tanks = 3;
  ally.reserves = 15;
  ally.elites = { reserves: 2, tanks: 1, forces: {}, revived: 0 };
  const state = createAmbassadors(() => 0);
  const token = state.tokens.find((t) => t.effect === 'tleilaxu')!;
  const cohortEffects = [
    'tleilaxu',
    ...state.tokens
      .map((t) => t.effect)
      .filter((e) => e !== 'tleilaxu' && e !== 'ecaz'),
  ].slice(0, 5);
  state.cohort = state.tokens
    .filter((t) => cohortEffects.includes(t.effect))
    .map((t) => t.id);
  for (const other of state.tokens) {
    other.zone =
      other.effect === 'ecaz' || state.cohort.includes(other.id)
        ? 'supply'
        : 'pool';
    other.location = null;
  }
  token.zone = 'placed';
  token.location = 'arrakeen';
  validateAmbassadors(state);
  g.ecazAmbassadors = state;
  return g;
}
const ship = (g: Game) =>
  applyAction(g, 'entrant', { type: 'ship', amount: 1, territory: 'arrakeen', sector: 10 });
const trigger = (g: Game) => {
  const event = g.pendingAmbassador!.event;
  return applyAction(g, 'ecaz', {
    type: 'decision',
    event,
    trigger: true,
    beneficiary: 'ally',
    choice: 'effect',
  });
};
const counters = (g: Game, id: string) => {
  const p = g.players.find((seat) => seat.id === id)!;
  return {
    reserves: p.reserves,
    tanks: p.tanks,
    eliteReserves: p.elites?.reserves ?? 0,
    eliteTanks: p.elites?.tanks ?? 0,
    eliteRevived: p.elites?.revived ?? 0,
    spice: p.spice,
  };
};

void test('the Tleilaxu Ambassador returns typed forces from the Tanks for free and spends the shared elite option', () => {
  const offered = trigger(ship(fixture()));
  assert.equal(offered.pendingAmbassador?.stage, 'revival');
  assert.equal(offered.pendingAmbassador?.effect, 'tleilaxu');
  assert.equal(offered.decision?.kind, 'ecazAmbassador');
  assert.equal(offered.decision?.player, 'ally');
  const view = viewGame(offered, 'ally').ambassadorEntry!;
  assert.equal(view.revival?.maximum, 3);
  assert.equal(view.revival?.eliteTanks, 1);
  assert.equal(view.revival?.blocked, null);
  assert.equal(viewGame(offered, 'ecaz').ambassadorEntry!.revival, null);
  assert.equal(viewGame(offered, 'entrant').ambassadorEntry!.revival, null);
  const before = counters(offered, 'ally');
  const event = offered.pendingAmbassador!.event;
  // A second elite return is rejected by the shared one-per-turn limit.
  const spent = structuredClone(offered);
  spent.players.find((p) => p.id === 'ally')!.elites!.revived = 1;
  assert.throws(
    () =>
      applyAction(spent, 'ally', {
        type: 'decision',
        event,
        forces: 1,
        elite: 1,
      }),
    /Only one Fedaykin or Sardaukar may be revived per turn/,
  );
  assert.deepEqual(spent.players.find((p) => p.id === 'ally')!.tanks, 3);
  for (const bad of [
    { forces: 0 },
    { forces: 5 },
    { forces: 2, elite: 1.5 },
  ]) {
    const copy = structuredClone(offered);
    assert.throws(() =>
      applyAction(copy, 'ally', { type: 'decision', event, ...bad }),
    );
    assert.deepEqual(copy, offered);
  }
  const returned = applyAction(offered, 'ally', {
    type: 'decision',
    event,
    forces: 2,
    elite: 1,
  });
  assert.deepEqual(counters(returned, 'ally'), {
    reserves: before.reserves + 2,
    tanks: before.tanks - 2,
    eliteReserves: before.eliteReserves + 1,
    eliteTanks: before.eliteTanks - 1,
    eliteRevived: 1,
    spice: before.spice,
  });
  assert.equal(returned.pendingAmbassador, null);
  assert.equal(
    returned.ecazAmbassadors!.tokens.find((t) => t.effect === 'tleilaxu')!.zone,
    'used',
  );
  assert.equal(
    returned.log.some((line) =>
      line.text.includes('Tleilaxu Ambassador') &&
      line.text.includes('Ordinary revival allowances'),
    ),
    true,
  );
});

void test('the Tleilaxu Ambassador can return only ordinary forces and can return none at all', () => {
  const offered = trigger(ship(fixture()));
  const event = offered.pendingAmbassador!.event;
  const ordinary = applyAction(offered, 'ally', {
    type: 'decision',
    event,
    forces: 2,
    elite: 0,
  });
  const ally = ordinary.players.find((p) => p.id === 'ally')!;
  assert.equal(ally.tanks, 1);
  assert.equal(ally.reserves, 17);
  assert.equal(ally.elites!.tanks, 1);
  assert.equal(ally.elites!.revived, 0);
  assert.equal(ally.spice, 10);
  const fresh = trigger(ship(fixture()));
  const declined = applyAction(fresh, 'ally', {
    type: 'decision',
    event: fresh.pendingAmbassador!.event,
    decline: true,
  });
  assert.equal(declined.pendingAmbassador, null);
  const seat = declined.players.find((p) => p.id === 'ally')!;
  assert.equal(seat.tanks, 3);
  assert.equal(seat.reserves, 15);
});

void test('the entry control offers each legal count, the elite-aware return and an explicit decline', async () => {
  const aliases = registerHooks({
    resolve(specifier, context, next) {
      return next(
        specifier === 'next/image' ? 'vinext/shims/image' : specifier,
        context,
      );
    },
  });
  const { EcazEntry } = await import('../components/ecaz-entry');
  aliases.deregister();
  const offered = trigger(ship(fixture()));
  const view = viewGame(offered, 'ally') as unknown as Parameters<typeof EcazEntry>[0]['game'];
  const actions: unknown[] = [];
  const markup = renderToStaticMarkup(
    createElement(EcazEntry, {
      game: view,
      act: (action: unknown) => actions.push(action),
      busy: false,
    }),
  );
  for (const label of ['Return 1 force', 'Return 2 forces', 'Return 3 forces', 'Return no forces'])
    assert.ok(markup.includes(label), label);
  assert.ok(markup.includes('Tleilaxu Ambassador'));
  const blocked = structuredClone(offered);
  blocked.players.find((p) => p.id === 'ally')!.tanks = 0;
  const blockedView = viewGame(blocked, 'ally') as unknown as Parameters<typeof EcazEntry>[0]['game'];
  const blockedMarkup = renderToStaticMarkup(
    createElement(EcazEntry, {
      game: blockedView,
      act: (action: unknown) => actions.push(action),
      busy: false,
    }),
  );
  assert.equal(blockedMarkup.includes('Return 1 force'), false);
  assert.ok(blockedMarkup.includes('Return no forces'));
});
