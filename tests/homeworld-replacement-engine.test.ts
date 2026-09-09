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
import type { FactionId } from '../game/catalog';
import { baseDeck } from '../game/cards';
import {
  homeworldContext,
  homeworldGameIntegrity,
} from '../game/homeworld-game';
import {
  homeworldForceGroups,
  quoteHomeworldCustody,
  type HomeworldCustodyChange,
} from '../game/homeworld-custody';

const seat = (g: Game, id: string) =>
  g.players.find((player) => player.id === id)!;
const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));
const sum = (counts: Record<string, number>) =>
  Object.values(counts).reduce((a, b) => a + b, 0);

function inventory(g: Game, supplementalCards = 0) {
  homeworldGameIntegrity(g);
  const groups = homeworldForceGroups(
    homeworldContext(g),
    g.homeworlds!.custody!,
  );
  for (const player of g.players) {
    const visitors = groups
      .filter((home) => home.native !== player.id)
      .map((home) => home.forces[player.id] ?? { normal: 0, elite: 0 });
    assert.equal(
      player.reserves +
        player.tanks +
        sum(player.forces) +
        visitors.reduce((n, pool) => n + pool.normal + pool.elite, 0),
      20,
    );
    if (player.elites)
      assert.equal(
        player.elites.reserves +
          player.elites.tanks +
          sum(player.elites.forces) +
          visitors.reduce((n, pool) => n + pool.elite, 0),
        player.faction === 'emperor' ? 5 : player.faction === 'fremen' ? 3 : 7,
      );
  }
  const cards = [
    ...g.deck,
    ...g.discard,
    ...g.players.flatMap((player) => player.hand),
  ];
  assert.equal(cards.length, baseDeck().length + supplementalCards);
  assert.equal(new Set(cards.map((card) => card.id)).size, cards.length);
}
function setup(roster: FactionId[], advanced = false) {
  let g = createGame(
    'HOMEWORLDBATTLEENGINE',
    newPlayer(roster[0], roster[0], roster[0]),
    advanced,
  );
  for (const faction of roster.slice(1))
    joinGame(g, newPlayer(faction, faction, faction));
  g = applyAction(g, g.host, { type: 'homeworlds', enabled: true });
  for (const player of g.players)
    g = applyAction(g, player.id, { type: 'ready' });
  g = initializeHomeworldGameForAudit(g);
  for (let step = 0; g.status === 'setup' && step < 30; step++) {
    let next: Game | undefined;
    for (const player of g.players) {
      const view = viewGame(g, player.id);
      view.players.find((owner) => owner.id === player.id)!.bot = 'Easy';
      const action = botActions(view)[0];
      if (action) {
        next = applyAction(g, player.id, action);
        break;
      }
    }
    assert.ok(next, 'Genuine audit setup must have a legal decision.');
    g = next;
  }
  assert.equal(g.status, 'playing');
  for (const player of g.players) g.deck.push(...player.hand.splice(0));
  Object.assign(g, {
    phase: 6,
    phaseOpening: null,
    response: null,
    decision: null,
    active: roster[0],
    order: roster,
    ready: [],
    storm: 18,
  });
  inventory(g);
  return g;
}
function custody(g: Game, changes: HomeworldCustodyChange[]) {
  const quote = quoteHomeworldCustody(
    homeworldContext(g),
    g.homeworlds!.custody!,
    changes,
  );
  g.homeworlds!.custody = quote.state;
  for (const update of quote.players) {
    const player = seat(g, update.id);
    player.reserves = update.reserves;
    if (player.elites) player.elites.reserves = update.eliteReserves;
  }
  inventory(g);
}
function invade(
  g: Game,
  player: string,
  destination: string,
  normal: number,
  elite = 0,
) {
  // Explicit conserved invasion position, not a claim that invasion shipment
  // actions are open: withdraw the exact native pieces before depositing them.
  custody(g, [
    {
      homeworld: `homeworld:${seat(g, player).faction}`,
      player,
      withdraw: { normal, elite },
      deposit: { normal: 0, elite: 0 },
    },
    {
      homeworld: destination,
      player,
      withdraw: { normal: 0, elite: 0 },
      deposit: { normal, elite },
    },
  ]);
}
function hold(g: Game, player: string, kind: string) {
  const index = g.deck.findIndex((card) => card.kind === kind);
  assert.ok(index >= 0);
  const [card] = g.deck.splice(index, 1);
  seat(g, player).hand.push(card);
  return card.id;
}
function prepared(state: Game, actor: string, target: string, home: string) {
  let g = applyAction(state, actor, {
    type: 'chooseBattle',
    territory: home,
    target,
  });
  for (
    let step = 0;
    (g.response || g.battle?.preparation || g.decision) && step < 30;
    step++
  ) {
    if (g.response) {
      const owner = g.players.find(
        (player) => !g.response!.passed.includes(player.id),
      )!;
      g = applyAction(g, owner.id, { type: 'passResponse' });
    } else if (g.battle?.preparation)
      g = applyAction(g, g.battle.preparation.owner, {
        type: 'declineBattlePower',
      });
    else {
      assert.equal(g.decision!.kind, 'fullPlanOffer');
      g = applyAction(g, g.decision!.player, {
        type: 'decision',
        decline: true,
      });
    }
  }
  assert.equal(g.response, null);
  assert.equal(g.decision, null);
  assert.equal(g.battle!.territory, home);
  assert.equal(g.battle!.preparation ?? null, null);
  inventory(g);
  return g;
}
function commit(
  g: Game,
  player: string,
  dial = 0,
  extras: Partial<Action> = {},
) {
  const leader =
    seat(g, player).leaders.find((leader) => leader.strength === 1) ??
    seat(g, player).leaders[0];
  return applyAction(g, player, {
    type: 'battlePlan',
    dial,
    support: 0,
    leader: leader.id,
    ...extras,
  });
}
function reject(g: Game, player: string, action: Action) {
  const before = structuredClone(g);
  assert.throws(() => applyAction(g, player, action));
  assert.deepEqual(g, before);
}

function passAll(state: Game) {
  let g = state;
  for (let n = 0; g.response && n < 20; n++) {
    const player = g.players.find((p) => !g.response!.passed.includes(p.id))!;
    g = applyAction(reload(g), player.id, { type: 'passResponse' });
  }
  assert.equal(g.response, null);
  return g;
}
function strongest(g: Game, id: string) {
  return seat(g, id)
    .leaders.slice()
    .sort((a, b) => b.strength - a.strength)[0].id;
}
function actualIx(native: boolean, advanced: boolean) {
  let g = setup(['ixians', 'atreides'], advanced);
  const home = native ? 'homeworld:ixians' : 'homeworld:atreides';
  if (native) invade(g, 'atreides', home, 2);
  else invade(g, 'ixians', home, 6, 2);
  const shield = hold(g, 'ixians', 'shield');
  const index = g.deck.findIndex((card) => card.effect === 'karama');
  assert.ok(index >= 0);
  const [card] = g.deck.splice(index, 1);
  seat(g, 'atreides').hand.push(card);
  seat(g, 'ixians').spice = 10;
  g = prepared(g, 'ixians', 'atreides', home);
  g = commit(g, 'ixians', 6, {
    leader: strongest(g, 'ixians'),
    support: advanced ? 2 : 0,
    defense: shield,
  });
  g = commit(reload(g), 'atreides');
  const voter = native ? 'ixians' : 'atreides';
  g = applyAction(g, voter, { type: 'traitorCall', call: false });
  assert.equal(g.lastBattleContext?.winner, 'ixians');
  if (g.decision?.kind === 'battleLosses') {
    const choice = g.decision.options.findIndex(
      (loss) => loss.normal === 4 && loss.elite === 2,
    );
    assert.ok(
      choice >= 0,
      'Actual dial six must allow four Suboids plus two Cyborgs.',
    );
    g = applyAction(reload(g), 'ixians', { type: 'decision', choice });
  }
  assert.equal(g.decision?.kind, 'ixSubstitution');
  assert.equal(g.pendingIxSubstitution!.homeworld!.cyborgsLost, 2);
  inventory(g);
  return { g, home, shield, karama: card.id };
}
for (const native of [true, false])
  for (const advanced of [true, false]) {
    void test(`actual ${advanced ? 'Advanced' : 'Basic'} ${native ? 'native' : 'visitor'} Homeworld Ixian substitution survives declaration and cleanup reload`, () => {
      const f = actualIx(native, advanced);
      const original = reload(f.g);
      const before = seat(original, 'ixians');
      for (const level of DIFFICULTIES) {
        const view = viewGame(reload(original), 'ixians');
        view.players.find((p) => p.id === 'ixians')!.bot = level;
        const actions = botActions(view);
        assert.ok(
          actions.length,
          `${level} must supply an Ixian substitution choice.`,
        );
        for (const action of actions)
          inventory(applyAction(reload(original), 'ixians', action));
      }
      reject(original, 'ixians', {
        type: 'decision',
        sources: { [`${f.home}:0`]: 1 },
        recover: { [f.home]: 1 },
      });
      let g = applyAction(reload(original), 'ixians', {
        type: 'decision',
        sources: { [f.home]: 2 },
        recover: { [f.home]: 2 },
      });
      assert.equal(g.response?.kind, 'ixSubstitution');
      g = passAll(reload(g));
      assert.equal(g.pendingIxSubstitution, null);
      const after = seat(g, 'ixians');
      assert.equal(after.tanks, before.tanks);
      assert.equal(after.battleLosses, before.battleLosses);
      assert.equal(after.elites!.tanks, before.elites!.tanks - 2);
      assert.equal(
        after.elites!.reserves,
        before.elites!.reserves + (native ? 2 : 0),
      );
      assert.deepEqual(after.forces, before.forces);
      assert.deepEqual(after.elites!.forces, before.elites!.forces);
      if (!native)
        assert.deepEqual(g.homeworlds!.custody!.visitors[f.home].ixians, {
          normal: 0,
          elite: 2,
        });
      assert.equal(g.decision?.kind, 'battleCards');
      g = applyAction(reload(g), 'ixians', { type: 'decision', discard: [] });
      assert.equal(
        seat(g, 'ixians').hand.filter((card) => card.id === f.shield).length,
        1,
      );
      inventory(g);
      assert.deepEqual(reload(normalizeAutomaticGame(reload(g))), reload(g));
    });
  }

for (const native of [true, false]) {
  void test(`actual ${native ? 'native' : 'visitor'} Homeworld Karama denies Ixian substitution without repeating casualties or payment`, () => {
    const f = actualIx(native, true);
    let g = applyAction(reload(f.g), 'ixians', {
      type: 'decision',
      sources: { [f.home]: 1 },
      recover: { [f.home]: 1 },
    });
    const before = g.players.map((p) => ({
      reserves: p.reserves,
      tanks: p.tanks,
      elites: structuredClone(p.elites),
      losses: p.battleLosses,
    }));
    const custodyBefore = structuredClone(g.homeworlds!.custody);
    g = applyAction(reload(g), 'atreides', {
      type: 'card',
      card: f.karama,
      mode: 'cancel',
    });
    g = passAll(reload(g));
    assert.deepEqual(g.homeworlds!.custody, custodyBefore);
    assert.deepEqual(
      g.players.map((p) => ({
        reserves: p.reserves,
        tanks: p.tanks,
        elites: p.elites,
        losses: p.battleLosses,
      })),
      before,
    );
    assert.equal(g.pendingIxSubstitution, null);
    assert.equal(g.discard.filter((card) => card.id === f.karama).length, 1);
    assert.equal(g.decision?.kind, 'battleCards');
    reject(g, 'atreides', { type: 'card', card: f.karama, mode: 'cancel' });
    inventory(g);
  });
}

function actualFaceDance() {
  let g = setup(['tleilaxu', 'atreides', 'guild']);
  g.order = ['atreides', 'guild', 'tleilaxu'];
  g.active = 'atreides';
  const home = 'homeworld:tleilaxu';
  invade(g, 'atreides', home, 4);
  invade(g, 'guild', home, 2);
  const native = seat(g, 'tleilaxu');
  // A conserved earlier shipment supplies real external replacement counters.
  native.reserves -= 3;
  native.forces['polar_sink:0'] = 3;
  const leader = strongest(g, 'atreides');
  const dancer = native.faceDancers![0];
  if (!native.faceDancers!.some((card) => card.leader === leader)) {
    const reserve = g.traitorReserve!.indexOf(leader);
    if (reserve >= 0) g.traitorReserve![reserve] = dancer.leader;
    else {
      const owner = g.players.find((p) => p.traitors.includes(leader))!;
      assert.ok(
        owner,
        'The matching physical traitor card must exist in a setup zone.',
      );
      owner.traitors[owner.traitors.indexOf(leader)] = dancer.leader;
    }
    dancer.leader = leader;
  }
  inventory(g);
  g = prepared(g, 'atreides', 'guild', home);
  assert.deepEqual(viewGame(g, 'tleilaxu').battle!.traitorVoters, []);
  g = commit(g, 'atreides', 1, { leader });
  g = commit(reload(g), 'guild');
  assert.equal(g.lastBattleContext!.winner, 'atreides');
  // This fixture tests Face Dance after the winner explicitly declines its
  // new Caladan option; it does not resolve the pending placement-order ruling.
  assert.equal(g.decision?.kind, 'caladanReinforcement');
  assert.match(viewGame(g, 'atreides').caladanReinforcement!.blocked!, /ordering ruling/);
  const beforeReinforcement = structuredClone(g.players);
  g = applyAction(reload(g), 'atreides', {
    type: 'decision',
    event: g.homeworldVictoryReinforcement!.event,
    decline: true,
  });
  assert.deepEqual(g.players, beforeReinforcement);
  assert.equal(g.decision?.kind, 'faceDance');
  assert.equal(g.decision!.player, 'tleilaxu');
  inventory(g);
  return { g, home, leader };
}

void test('native noncombatant Tleilaxu Face Dance returns a foreign winner and adds only selected Arrakis replacements', () => {
  const f = actualFaceDance();
  const before = reload(f.g);
  for (const level of DIFFICULTIES) {
    const view = viewGame(reload(before), 'tleilaxu');
    view.players.find((p) => p.id === 'tleilaxu')!.bot = level;
    const snapshot = structuredClone(view);
    const actions = botActions(view);
    assert.ok(
      actions.length,
      `${level} must supply the native Face Dance choice.`,
    );
    for (const action of actions)
      inventory(applyAction(reload(before), 'tleilaxu', action));
    assert.deepEqual(view, snapshot);
  }
  assert.equal(
    viewGame(before, 'atreides').players.find((p) => p.id === 'tleilaxu')!
      .faceDancers,
    undefined,
  );
  const nativeReserves = seat(before, 'tleilaxu').reserves;
  const winnerReserves = seat(before, 'atreides').reserves;
  const winnerSpice = seat(before, 'atreides').spice;
  reject(before, 'guild', { type: 'decision', reveal: true, sources: {} });
  reject(before, 'tleilaxu', {
    type: 'decision',
    reveal: true,
    sources: { [f.home]: 1 },
  });
  reject(before, 'tleilaxu', {
    type: 'decision',
    reveal: true,
    sources: { 'polar_sink:0': 4 },
  });
  const g = applyAction(reload(before), 'tleilaxu', {
    type: 'decision',
    reveal: true,
    sources: { 'polar_sink:0': 2, reserves: 1 },
  });
  assert.equal(seat(g, 'tleilaxu').reserves, nativeReserves + 2);
  assert.equal(seat(g, 'tleilaxu').forces['polar_sink:0'], 1);
  assert.equal(seat(g, 'atreides').reserves, winnerReserves + 3);
  assert.equal(seat(g, 'atreides').spice, winnerSpice);
  assert.equal(g.homeworlds!.custody!.visitors[f.home], undefined);
  assert.equal(g.lastBattleContext!.winner, 'atreides');
  assert.equal(
    seat(g, 'atreides').leaders.find((leader) => leader.id === f.leader)!.dead,
    true,
  );
  assert.equal(
    seat(g, 'tleilaxu').faceDancers!.find((card) => card.leader === f.leader)!
      .revealed,
    true,
  );
  assert.deepEqual(seat(g, 'guild').forces, seat(before, 'guild').forces);
  inventory(g);
  assert.deepEqual(reload(normalizeAutomaticGame(reload(g))), reload(g));
});

void test('native Face Dance permits zero replacement and does not manufacture forces from its already present reserves', () => {
  const f = actualFaceDance();
  for (const sources of [{}, { reserves: 3 }]) {
    const g = applyAction(reload(f.g), 'tleilaxu', {
      type: 'decision',
      reveal: true,
      sources,
    });
    assert.equal(seat(g, 'tleilaxu').reserves, seat(f.g, 'tleilaxu').reserves);
    assert.deepEqual(seat(g, 'tleilaxu').forces, seat(f.g, 'tleilaxu').forces);
    assert.equal(
      seat(g, 'atreides').reserves,
      seat(f.g, 'atreides').reserves + 3,
    );
    inventory(g);
  }
});

void test('saved Homeworld substitution rejects changed survivors, Tanks and battle identity before a Karama discard', () => {
  const f = actualIx(false, true);
  const declared = applyAction(reload(f.g), 'ixians', {
    type: 'decision',
    sources: { [f.home]: 1 },
    recover: { [f.home]: 1 },
  });
  const mutations: ((g: Game) => void)[] = [
    (g) => {
      g.pendingIxSubstitution!.homeworld!.pool.normal++;
    },
    (g) => {
      g.pendingIxSubstitution!.homeworld!.eliteTanks--;
    },
    (g) => {
      g.pendingIxSubstitution!.homeworld!.normalTanks++;
    },
    (g) => {
      g.pendingIxSubstitution!.homeworld!.battleLosses++;
    },
    (g) => {
      g.lastBattleContext!.winner = 'atreides';
    },
    (g) => {
      g.pendingIxSubstitution!.recover = { [`${f.home}:0`]: 1 };
    },
  ];
  for (const mutate of mutations) {
    const g = reload(declared);
    mutate(g);
    reject(g, 'atreides', { type: 'card', card: f.karama, mode: 'cancel' });
    assert.equal(
      seat(g, 'atreides').hand.filter((card) => card.id === f.karama).length,
      1,
    );
  }
});
