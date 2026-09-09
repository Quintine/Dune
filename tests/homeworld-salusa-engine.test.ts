import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  initializeHomeworldGameForAudit,
  joinGame,
  newPlayer,
  normalizeAutomaticGame,
  viewGame,
  type Action,
  type Game,
} from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { homeworldGameIntegrity } from '../game/homeworld-game';
import { casualtyOptions, type Casualties } from '../game/combat';
import { baseDeck } from '../game/cards';
import { homeworldSardaukarGholaBlock } from '../game/homeworld-benefits';

const emperor = (g: Game) => g.players.find((player) => player.id === 'e')!;
const atreides = (g: Game) => g.players.find((player) => player.id === 'a')!;
const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));
const sum = (forces: Record<string, number>) =>
  Object.values(forces).reduce((a, b) => a + b, 0);
function inventory(g: Game) {
  homeworldGameIntegrity(g);
  for (const player of g.players)
    assert.equal(player.reserves + player.tanks + sum(player.forces), 20);
  const elites = emperor(g).elites!;
  assert.equal(elites.reserves + elites.tanks + sum(elites.forces), 5);
  const cards = [
    ...g.deck,
    ...g.discard,
    ...g.players.flatMap((player) => player.hand),
  ];
  assert.equal(
    cards.length,
    baseDeck().length,
    'Genuine two-player base setup retains its physical treachery deck.',
  );
  assert.equal(new Set(cards.map((card) => card.id)).size, cards.length);
}
function reject(g: Game, action: Action) {
  const before = structuredClone(g);
  assert.throws(() => applyAction(g, 'e', action));
  assert.deepEqual(g, before);
}
function onlyCityIncome(g: Game) {
  // Completing the last battle enters Collection automatically. The surviving
  // Arrakeen army earns two city spice after its zero-cost battle settlement.
  assert.equal(emperor(g).spice, 2);
  assert.ok(
    g.log.some(
      (entry) => entry.text === 'Emperor received 2 spice from strongholds.',
    ),
  );
}
/** Real Advanced setup and actual typed shipment. Only the later phase and
 * reduced spice balance are staged; no cards, leaders or forces are created. */
function shipped(stars = 3, normal = 1) {
  let g = createGame(
    'SALUSAENGINE',
    newPlayer('e', 'Emperor', 'emperor'),
    true,
  );
  joinGame(g, newPlayer('a', 'Atreides', 'atreides'));
  g = applyAction(g, 'e', { type: 'homeworlds', enabled: true });
  for (const player of g.players)
    g = applyAction(g, player.id, { type: 'ready' });
  g = initializeHomeworldGameForAudit(g);
  while (g.setupStage === 'traitors') {
    const player = g.players.find((player) => player.traitorChoices.length)!;
    g = applyAction(g, player.id, {
      type: 'traitor',
      leader: player.traitorChoices[0],
    });
  }
  assert.equal(g.status, 'playing');
  for (const player of g.players) g.deck.push(...player.hand.splice(0));
  Object.assign(g, {
    phase: 5,
    phaseOpening: null,
    response: null,
    decision: null,
    active: 'e',
    order: ['e', 'a'],
    movementRemaining: ['e', 'a'],
    ready: [],
    storm: 18,
  });
  emperor(g).spice = stars + normal;
  g = applyAction(g, 'e', {
    type: 'ship',
    territory: 'arrakeen',
    sector: 10,
    amount: stars + normal,
    elite: stars,
    homeworldSources: {
      'homeworld:emperor': { normal, elite: 0 },
      'homeworld:emperor:salusa': { normal: 0, elite: stars },
    },
  });
  assert.equal(emperor(g).spice, 0);
  assert.equal(emperor(g).forces['arrakeen:10'], stars + normal);
  assert.equal(emperor(g).elites!.forces['arrakeen:10'], stars);
  assert.equal(g.homeworlds!.custody!.salusa!.elite, 5 - stars);
  assert.ok(atreides(g).forces['arrakeen:10'] > 0);
  inventory(g);
  return g;
}
function prepared(stars = 3, normal = 1, cancel = false) {
  let g = shipped(stars, normal);
  let karama: string | undefined;
  if (cancel) {
    const index = g.deck.findIndex((card) => card.effect === 'karama');
    assert.ok(index >= 0);
    const [card] = g.deck.splice(index, 1);
    atreides(g).hand.push(card);
    karama = card.id;
  }
  Object.assign(g, { phase: 6, active: 'e', movementRemaining: [], ready: [] });
  g = applyAction(g, 'e', {
    type: 'chooseBattle',
    territory: 'arrakeen',
    target: 'a',
  });
  let canceled = false;
  for (
    let step = 0;
    (g.response || g.battle?.preparation || g.decision) && step < 30;
    step++
  ) {
    if (g.response) {
      if (
        cancel &&
        g.response.kind === 'eliteStrength' &&
        g.response.owner === 'e'
      ) {
        g = applyAction(g, 'a', {
          type: 'card',
          card: karama!,
          mode: 'cancel',
        });
        canceled = true;
      } else {
        const owner = g.players.find(
          (player) => !g.response!.passed.includes(player.id),
        )!;
        assert.ok(owner);
        g = applyAction(g, owner.id, { type: 'passResponse' });
      }
    } else if (g.decision) {
      assert.equal(g.decision.kind, 'fullPlanOffer');
      g = applyAction(g, g.decision.player, {
        type: 'decision',
        decline: true,
      });
    } else
      g = applyAction(g, g.battle!.preparation!.owner, {
        type: 'declineBattlePower',
      });
  }
  assert.equal(g.response, null);
  assert.equal(g.battle!.preparation ?? null, null);
  assert.equal(canceled, cancel);
  if (cancel)
    assert.equal(g.discard.filter((card) => card.id === karama).length, 1);
  inventory(g);
  return g;
}
function plan(g: Game, dial: number, support = 0): Action {
  return {
    type: 'battlePlan',
    dial,
    support,
    leader: emperor(g)
      .leaders.slice()
      .sort((a, b) => b.strength - a.strength)[0].id,
  };
}
function resolve(state: Game, dial: number, support = 0) {
  let g = applyAction(state, 'e', plan(state, dial, support));
  assert.deepEqual(viewGame(reload(g), 'a').battle!.plans, {});
  assert.equal(viewGame(reload(g), 'e').battle!.plans.e.dial, dial);
  assert.deepEqual(
    viewGame(g, 'a').players.find((player) => player.id === 'e')!.hand,
    undefined,
  );
  g = applyAction(reload(g), 'a', {
    type: 'battlePlan',
    dial: 0,
    support: 0,
    leader: atreides(g)
      .leaders.slice()
      .sort((a, b) => a.strength - b.strength)[0].id,
  });
  g = applyAction(g, 'e', { type: 'traitorCall', call: false });
  g = applyAction(reload(g), 'a', { type: 'traitorCall', call: false });
  assert.equal(g.lastBattleContext!.winner, 'e');
  inventory(g);
  return g;
}

void test('actual shipment leaving two Sardaukar on Salusa lets three attacking stars dial six at zero spice while a normal force still needs support', () => {
  const g = prepared();
  const forces = viewGame(g, 'e').battle!.ownForces!;
  assert.equal(forces.normal, 1);
  assert.equal(forces.elite, 3);
  assert.equal(forces.eliteStrength, 2);
  assert.equal(forces.eliteFreeSupport, true);
  assert.equal(forces.freeSupport, false);
  assert.equal(casualtyOptions(forces, 6.5, 0).length, 1);
  assert.equal(casualtyOptions(forces, 7, 0).length, 0);
  reject(g, plan(g, 7));
  reject(g, plan(g, 7, 1));
  const funded = reload(g);
  emperor(funded).spice = 1;
  const paid = applyAction(funded, 'e', plan(funded, 7, 1));
  assert.equal(paid.battle!.plans.e.support, 1);
  const done = resolve(g, 6);
  onlyCityIncome(done);
  assert.equal(emperor(done).elites!.tanks, 3);
  assert.equal(emperor(done).tanks, 3);
  assert.equal(emperor(done).forces['arrakeen:10'], 1);
  assert.equal(done.homeworlds!.custody!.salusa!.elite, 2);
});

void test('actual shipment of a fourth star leaves Salusa low and restores ordinary paid-support battle legality', () => {
  const g = prepared(4);
  const forces = viewGame(g, 'e').battle!.ownForces!;
  assert.equal(forces.eliteFreeSupport, undefined);
  assert.equal(forces.eliteStrength, 2);
  assert.equal(forces.freeSupport, false);
  reject(g, plan(g, 8));
  assert.ok(
    casualtyOptions(forces, 8, 4).some(
      (loss) => loss.elite === 4 && loss.normal === 0 && loss.paidElite === 4,
    ),
  );
  const done = resolve(g, 4);
  onlyCityIncome(done);
  assert.equal(emperor(done).elites!.tanks, 4);
  assert.equal(emperor(done).forces['arrakeen:10'], 1);
  assert.equal(done.homeworlds!.custody!.salusa!.elite, 1);
});

void test('a genuine saved casualty choice preserves full-strength free stars versus four unsupported normal losses', () => {
  const g = resolve(prepared(3, 4), 2);
  assert.equal(g.decision?.kind, 'battleLosses');
  if (g.decision?.kind !== 'battleLosses')
    throw new Error('Missing physical casualty choice.');
  assert.deepEqual(
    g.decision.options.map((option) => [
      option.normal,
      option.elite,
      option.paidNormal,
      option.paidElite,
    ]),
    [
      [4, 0, 0, 0],
      [0, 1, 0, 0],
    ],
  );
  assert.deepEqual(reload(normalizeAutomaticGame(reload(g))), reload(g));
  for (let choice = 0; choice < g.decision.options.length; choice++) {
    const losses: Casualties = g.decision.options[choice];
    const done = applyAction(reload(g), 'e', { type: 'decision', choice });
    assert.equal(emperor(done).tanks, losses.normal + losses.elite);
    assert.equal(emperor(done).elites!.tanks, losses.elite);
    onlyCityIncome(done);
    assert.equal(done.homeworlds!.custody!.salusa!.elite, 2);
    inventory(done);
    reject(done, { type: 'decision', choice });
  }
});

void test('actual ordinary Sardaukar Karama reduces strength but leaves Salusa high free support intact', () => {
  const g = prepared(3, 1, true);
  assert.deepEqual(g.battle!.eliteBlocked, ['e']);
  const forces = viewGame(g, 'e').battle!.ownForces!;
  assert.equal(forces.eliteStrength, 1);
  assert.equal(forces.eliteFreeSupport, true);
  assert.equal(forces.freeSupport, false);
  reject(g, plan(g, 4));
  const done = resolve(g, 3);
  assert.equal(emperor(done).elites!.tanks, 3);
  onlyCityIncome(done);
  assert.equal(emperor(done).forces['arrakeen:10'], 1);
});

void test('all four AI policies use the public Salusa combat descriptor for legal zero-spice plans and restored casualty choices', () => {
  for (const g of [
    prepared(),
    prepared(4),
    prepared(3, 1, true),
    resolve(prepared(3, 4), 2),
  ]) {
    for (const level of DIFFICULTIES) {
      const view = viewGame(reload(g), 'e');
      view.players.find((player) => player.id === 'e')!.bot = level;
      const beforeView = structuredClone(view);
      const actions = botActions(view);
      assert.ok(actions.length, `${level} must supply a decision.`);
      assert.deepEqual(view, beforeView);
      assert.ok(
        actions.some(
          (action) => action.type === (g.decision ? 'decision' : 'battlePlan'),
        ),
      );
      for (const action of actions) {
        const before = structuredClone(g);
        const done = applyAction(g, 'e', action);
        assert.deepEqual(g, before);
        inventory(done);
        if (action.type === 'battlePlan') {
          assert.equal(action.support ?? 0, 0);
          assert.ok(
            casualtyOptions(view.battle!.ownForces!, Number(action.dial), 0)
              .length,
          );
        }
      }
    }
  }
});

function gholaThresholdBattle(normal = 1) {
  const g = prepared(4, normal);
  const player = emperor(g);
  // Conserved later battle position: one of the four shipped Sardaukar died
  // before plans. Salusa still contains its one remaining native Sardaukar.
  player.forces['arrakeen:10']--;
  player.elites!.forces['arrakeen:10']--;
  player.tanks++;
  player.elites!.tanks++;
  player.spice = 3;
  const index = g.deck.findIndex((card) => card.effect === 'ghola');
  assert.ok(index >= 0);
  const [card] = g.deck.splice(index, 1);
  player.hand.push(card);
  inventory(g);
  return { g, card: card.id };
}

void test('unsupported Ghola crossing of Salusa during battle rejects before and after a sealed paid-star plan without corrupting the saved decision', () => {
  const { g: before, card } = gholaThresholdBattle();
  const sealed = applyAction(before, 'e', plan(before, 6, 3));
  for (const state of [before, sealed]) {
    const g = reload(state);
    const reason = homeworldSardaukarGholaBlock(g, 'e');
    assert.ok(
      reason,
      'The unresolved Salusa timing combination must have an explicit reason.',
    );
    const view = viewGame(g, 'e');
    assert.equal(view.ghola.eliteRemaining, 0);
    assert.equal(view.ghola.eliteBlock, reason);
    assert.equal(viewGame(g, 'a').ghola.eliteBlock, null);
    const snapshot = structuredClone(g);
    assert.throws(
      () => applyAction(g, 'e', { type: 'card', card, amount: 1, elite: 1 }),
      (error) => error instanceof Error && error.message === reason,
    );
    assert.deepEqual(g, snapshot);
    assert.deepEqual(reload(normalizeAutomaticGame(reload(g))), g);
    assert.equal(g.homeworlds!.custody!.salusa!.elite, 1);
    assert.equal(g.discard.filter((held) => held.id === card).length, 0);
    assert.deepEqual(viewGame(g, 'a').battle!.plans, {});
  }
  let g = applyAction(reload(sealed), 'a', {
    type: 'battlePlan',
    dial: 0,
    support: 0,
    leader: atreides(sealed)
      .leaders.slice()
      .sort((a, b) => a.strength - b.strength)[0].id,
  });
  g = applyAction(g, 'e', { type: 'traitorCall', call: false });
  g = applyAction(reload(g), 'a', { type: 'traitorCall', call: false });
  assert.equal(g.lastBattleContext!.winner, 'e');
  if (g.decision?.kind === 'battleLosses') {
    const choice = g.decision.options.findIndex(
      (loss) => loss.normal === 0 && loss.elite === 3,
    );
    assert.ok(choice >= 0);
    g = applyAction(reload(g), 'e', { type: 'decision', choice });
  }
  assert.equal(g.battle, null);
  assert.equal(homeworldSardaukarGholaBlock(g, 'e'), null);
  assert.equal(viewGame(g, 'e').ghola.eliteRemaining, 1);
  g = applyAction(reload(g), 'e', { type: 'card', card, amount: 1, elite: 1 });
  assert.equal(g.homeworlds!.custody!.salusa!.elite, 2);
  assert.equal(g.discard.filter((held) => held.id === card).length, 1);
  inventory(g);
});

void test('the temporary Salusa threshold gate leaves normal-force and eligible-leader Ghola choices available during battle', () => {
  for (const kind of ['normal', 'leader'] as const) {
    const { g: before, card } = gholaThresholdBattle();
    const player = emperor(before);
    let command: Action;
    let leaderId: string | undefined;
    if (kind === 'normal') {
      player.reserves--;
      player.tanks++;
      command = { type: 'card', card, amount: 1, elite: 0 };
    } else {
      const leader = player.leaders[0];
      leader.dead = true;
      leader.deaths = 1;
      leaderId = leader.id;
      command = { type: 'card', card, leader: leader.id };
    }
    inventory(before);
    const view = viewGame(before, 'e');
    assert.ok(view.ghola.eliteBlock);
    assert.equal(view.ghola.eliteRemaining, 0);
    if (kind === 'normal') assert.ok(view.ghola.maxForces >= 1);
    else assert.ok(view.ghola.leaders.some((leader) => leader.id === leaderId));
    const done = applyAction(reload(before), 'e', command);
    assert.equal(done.homeworlds!.custody!.salusa!.elite, 1);
    assert.equal(done.discard.filter((held) => held.id === card).length, 1);
    assert.ok(done.battle && !done.battle.revealed);
    if (kind === 'normal') {
      assert.equal(emperor(done).reserves, player.reserves + 1);
      assert.equal(emperor(done).elites!.tanks, player.elites!.tanks);
    } else
      assert.equal(
        emperor(done).leaders.find((leader) => leader.id === leaderId)!.dead,
        false,
      );
    inventory(done);
  }
});

void test('Salusa threshold protection also preserves an answered Prescience dial before either full plan is sealed', () => {
  const fixture = gholaThresholdBattle(0);
  const card = fixture.card;
  let g = fixture.g;
  // Restore the declined preparation opportunity in this conserved fixture,
  // then make the public query and private answer through their actual actions.
  g.battle!.preparation = { kind: 'prescience', owner: 'a', beneficiary: 'a' };
  g = applyAction(g, 'a', { type: 'prescience', field: 'dial' });
  for (let step = 0; g.response && step < 10; step++) {
    const owner = g.players.find(
      (player) => !g.response!.passed.includes(player.id),
    )!;
    g = applyAction(g, owner.id, { type: 'passResponse' });
  }
  assert.equal(g.battle!.preparation!.kind, 'prescienceAnswer');
  g = applyAction(g, 'e', { type: 'prescienceAnswer', value: 1 });
  assert.equal(g.battle!.prescience!.value, 1);
  assert.deepEqual(g.battle!.plans, {});
  const saved = reload(g);
  const reason = viewGame(saved, 'e').ghola.eliteBlock;
  assert.ok(reason);
  assert.throws(
    () => applyAction(saved, 'e', { type: 'card', card, amount: 1, elite: 1 }),
    (error) => error instanceof Error && error.message === reason,
  );
  assert.deepEqual(saved, g);
  assert.equal(saved.battle!.prescience!.value, 1);
  const done = resolve(saved, 1, 0);
  assert.equal(done.lastBattleContext!.winner, 'e');
  assert.equal(done.homeworlds!.custody!.salusa!.elite, 1);
  assert.equal(emperor(done).elites!.tanks, 2);
  assert.equal(done.discard.filter((held) => held.id === card).length, 0);
  inventory(done);
});
