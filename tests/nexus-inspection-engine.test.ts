import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  viewGame,
  normalizeAutomaticGame,
  type Action,
  type Game,
} from '../game/engine';
import {
  nexusInspectionFixture,
  inspectionHold,
  inspectionNative,
  inspectionInventory,
  inspectionResidual,
} from './fixture-nexus-inspection';
import {
  nexusAllow,
  nexusInventory,
  nexusPlayer,
  nexusReload,
  nexusReject,
} from './fixture-nexus-cards';

function play(g: Game, field = 'weapon', mode = 'cunning'): Game {
  return applyAction(g, 'a', {
    type: 'nexusAtreides',
    event: g.battle!.event,
    mode,
    field,
  });
}
function answer(g: Game, value: string | number | null): Game {
  return applyAction(g, 'h', {
    type: 'nexusPrescienceAnswer',
    event: g.battle!.event,
    value,
  });
}
function plan(g: Game, id: string, extra: Partial<Action> = {}): Action {
  return {
    type: 'battlePlan',
    dial: 0,
    leader: nexusPlayer(g, id).leaders[0].id,
    ...extra,
  };
}
function karama(g: Game, id: string) {
  const index = g.deck.findIndex((card) => card.effect === 'karama');
  assert.ok(index >= 0);
  const card = g.deck.splice(index, 1)[0];
  nexusPlayer(g, id).hand.push(card);
  return card;
}

void test('Cunning spends one physical Nexus card and keeps both plan elements binding across JSON recovery', () => {
  let g = inspectionNative(nexusInspectionFixture());
  const weapon = inspectionHold(g, 'h', 'projectile');
  const defense = inspectionHold(g, 'h', 'shield');
  const first = { ...g.battle!.prescience! };
  g = nexusAllow(play(g));
  assert.equal(g.battle!.preparation?.kind, 'nexusPrescienceAnswer');
  g = answer(nexusReload(g), weapon.id);
  assert.deepEqual(g.battle!.prescience, first);
  assert.deepEqual(g.battle!.nexusInspection!.answers, [weapon.id]);
  assert.equal(g.nexusCards!.cards!.hands.a, null);
  assert.equal(
    g.nexusCards!.cards!.discard.filter((card) => card === 'atreides').length,
    1,
  );
  assert.equal(viewGame(g, 'h').battle!.ownCommitments.length, 2);
  nexusReject(
    g,
    'h',
    plan(g, 'h', { dial: 1, weapon: weapon.id }),
    /unchanged|commitment/,
  );
  nexusReject(g, 'h', plan(g, 'h'), /unchanged|commitment/);
  g = applyAction(
    g,
    'h',
    plan(g, 'h', { weapon: weapon.id, defense: defense.id }),
  );
  assert.equal(g.battle!.revealed, false);
  assert.deepEqual(viewGame(g, 'a').battle!.plans, {});
  const restored = normalizeAutomaticGame(nexusReload(g));
  assert.deepEqual(restored.battle, g.battle);
  nexusInventory(restored);
});

void test('only the two combatants receive the selected Nexus answer, without exposing the rest of the target hand', () => {
  let g = inspectionNative(nexusInspectionFixture());
  const weapon = inspectionHold(g, 'h', 'poison');
  const defense = inspectionHold(g, 'h', 'shield');
  g = answer(nexusAllow(play(g)), weapon.id);
  for (const id of ['a', 'h'])
    assert.equal(viewGame(g, id).battle!.nexusInsights[0].value, weapon.id);
  const outsider = viewGame(g, 'f');
  assert.deepEqual(outsider.battle!.nexusInsights, []);
  assert.deepEqual(outsider.battle!.ownCommitments, []);
  assert.equal(JSON.stringify(outsider.battle).includes(weapon.id), false);
  assert.equal(
    JSON.stringify(viewGame(g, 'a').battle).includes(defense.id),
    false,
  );
  assert.equal(
    Object.hasOwn(outsider.battle!.nexusInspection!, 'answers'),
    false,
  );
  nexusInventory(g);
});

void test('Cunning rejects duplicate fields, stale events, foreign ownership and replay without changing custody', () => {
  let g = inspectionNative(nexusInspectionFixture());
  const event = g.battle!.event;
  for (const [id, action] of [
    ['a', { type: 'nexusAtreides', event, mode: 'cunning', field: 'dial' }],
    [
      'a',
      {
        type: 'nexusAtreides',
        event: 'old-event',
        mode: 'cunning',
        field: 'weapon',
      },
    ],
    ['h', { type: 'nexusAtreides', event, mode: 'cunning', field: 'weapon' }],
    [
      'a',
      { type: 'nexusAtreides', event, mode: 'secretAlly', field: 'weapon' },
    ],
    ['a', { type: 'nexusAtreides', event, mode: 'cunning', field: 'support' }],
  ] as Array<[string, Action]>)
    nexusReject(g, id, action, /Nexus|inspection/);
  g = nexusAllow(play(g));
  nexusReject(
    g,
    'a',
    { type: 'nexusPrescienceAnswer', event, value: null },
    /answer|inspection/,
  );
  nexusReject(
    g,
    'h',
    { type: 'nexusPrescienceAnswer', event: 'old-event', value: null },
    /answer|inspection/,
  );
  g = answer(g, null);
  nexusReject(
    g,
    'a',
    { type: 'nexusAtreides', event, mode: 'cunning', field: 'defense' },
    /Nexus|inspection/,
  );
  nexusReject(
    g,
    'h',
    { type: 'nexusPrescienceAnswer', event, value: null },
    /answer|inspection/,
  );
  nexusInventory(g);
});

void test('ordinary Karama cancels only the extra Cunning attempt and preserves the first native commitment', () => {
  let g = inspectionNative(nexusInspectionFixture());
  const card = karama(g, 'f');
  g = play(g);
  assert.equal(g.response?.kind, 'nexusPrescience');
  g = applyAction(g, 'f', { type: 'card', card: card.id, mode: 'cancel' });
  assert.equal(g.battle!.nexusInspection!.stage, 'canceled');
  assert.deepEqual(g.battle!.nexusInspection!.answers, []);
  assert.equal(g.battle!.prescience!.value, 0);
  assert.equal(g.battle!.preparation, undefined);
  assert.equal(viewGame(g, 'h').battle!.ownCommitments.length, 1);
  nexusReject(g, 'h', plan(g, 'h', { dial: 1 }), /unchanged|commitment/);
  g = applyAction(nexusReload(g), 'h', plan(g, 'h'));
  nexusInventory(g);
});

void test('Secret Ally uses a genuinely absent Atreides roster and reveals only the selected element of an already sealed plan', () => {
  let g = nexusInspectionFixture(true);
  assert.equal(
    g.players.some((p) => p.faction === 'atreides'),
    false,
  );
  const weapon = inspectionHold(g, 'h', 'projectile');
  const defense = inspectionHold(g, 'h', 'shield');
  g = applyAction(
    g,
    'h',
    plan(g, 'h', { dial: 2, weapon: weapon.id, defense: defense.id }),
  );
  assert.deepEqual(viewGame(g, 'a').battle!.plans, {});
  g = play(g, 'weapon', 'secretAlly');
  assert.equal(g.battle!.nexusInspection!.stage, 'answered');
  assert.deepEqual(g.battle!.nexusInspection!.answers, [weapon.id]);
  assert.equal(g.battle!.prescience, undefined);
  const own = viewGame(g, 'a').battle!;
  assert.deepEqual(own.plans, {});
  assert.equal(own.nexusInsights[0].value, weapon.id);
  assert.equal(JSON.stringify(own).includes(defense.id), false);
  assert.deepEqual(viewGame(g, 'f').battle!.nexusInsights, []);
  nexusInventory(normalizeAutomaticGame(nexusReload(g)));
});

void test('missing, rewound and rebound Nexus inspection records reject read, normalization and action', () => {
  let g = inspectionNative(nexusInspectionFixture());
  g = answer(nexusAllow(play(g)), null);
  for (const mutate of [
    (copy: Game) => {
      delete copy.battle!.nexusInspection;
    },
    (copy: Game) => {
      delete copy.battle!.nexusInspectionUsed;
    },
    (copy: Game) => {
      copy.battle!.nexusInspection!.stage = 'answer';
    },
    (copy: Game) => {
      copy.battle!.nexusInspection!.target = 'f';
    },
    (copy: Game) => {
      copy.battle!.nexusInspection!.first!.value = 1;
    },
  ]) {
    const copy = nexusReload(g);
    mutate(copy);
    const before = nexusReload(copy);
    assert.throws(() => viewGame(copy, 'a'));
    assert.throws(() => normalizeAutomaticGame(copy));
    assert.throws(() => applyAction(copy, 'h', plan(copy, 'h')));
    assert.deepEqual(copy, before);
  }
});

void test('Betrayal remains explicitly unavailable while its reaction policy is unresolved, preserving the held card and native attempt', () => {
  let g = nexusInspectionFixture(false, 'f');
  karama(g, 'h');
  g = applyAction(g, 'a', { type: 'prescience', field: 'weapon' });
  assert.equal(g.response?.kind, 'prescience');
  assert.equal(Object.hasOwn(g.battle!.prescience!, 'value'), false);
  const offer = viewGame(g, 'f').nexusAtreides!;
  assert.equal(offer.mode, 'betrayal');
  assert.match(offer.blocked!, /reaction|policy|unfinished|not.*available/i);
  nexusReject(
    g,
    'f',
    { type: 'nexusAtreides', event: g.battle!.event, mode: 'betrayal' },
    /reaction|policy|unfinished|not.*available/i,
  );
  assert.equal(g.nexusCards!.cards!.hands.f, 'atreides');
  assert.equal(g.battle!.nexusInspection, undefined);
  assert.equal(g.response?.kind, 'prescience');
  nexusInventory(normalizeAutomaticGame(nexusReload(g)));
});

void test('Secret Ally weapon answer reopens after Residual kills the last usable leader and preserves inactive answer history', () => {
  let g = nexusInspectionFixture(true, 'a', { richese: true });
  const residual = inspectionResidual(g);
  const weapon = inspectionHold(g, 'h', 'projectile');
  const target = nexusPlayer(g, 'h');
  target.leaders.forEach((leader, i) => {
    leader.dead = i !== 0;
    leader.deaths = i === 0 ? 0 : 1;
  });
  g = answer(play(g, 'weapon', 'secretAlly'), weapon.id);
  g = applyAction(g, 'a', {
    type: 'card',
    card: residual,
    target: 'h',
    event: g.battle!.event,
  });
  assert.equal(
    nexusPlayer(g, 'h').leaders.every((l) => l.dead),
    true,
  );
  assert.equal(g.battle!.nexusInspection!.stage, 'answer');
  assert.deepEqual(g.battle!.nexusInspection!.answers, [weapon.id]);
  assert.equal(viewGame(g, 'a').battle!.nexusInsights[0].active, false);
  assert.deepEqual(viewGame(g, 'h').battle!.ownCommitments, []);
  g = answer(nexusReload(g), null);
  assert.deepEqual(g.battle!.nexusInspection!.answers, [weapon.id, null]);
  assert.deepEqual(
    viewGame(g, 'a').battle!.nexusInsights.map((i) => i.active),
    [false, true],
  );
  assert.deepEqual(viewGame(g, 'f').battle!.nexusInsights, []);
  nexusReject(
    g,
    'h',
    plan(g, 'h', { leader: null, weapon: weapon.id }),
    /leader|unchanged|commitment/i,
  );
  g = applyAction(g, 'h', plan(g, 'h', { leader: null }));
  inspectionInventory(normalizeAutomaticGame(nexusReload(g)));
});

void test('Residual retains a Secret Ally weapon answer when a surviving leader, Cheap Hero or Ghola still permits that plan', () => {
  for (const alternative of ['leader', 'hero', 'ghola'] as const) {
    let g = nexusInspectionFixture(true, 'a', { richese: true });
    const residual = inspectionResidual(g);
    const weapon = inspectionHold(g, 'h', 'projectile');
    nexusPlayer(g, 'h').leaders.forEach((leader, i) => {
      leader.dead = i >= (alternative === 'leader' ? 2 : 1);
      leader.deaths = leader.dead ? 1 : 0;
    });
    if (alternative === 'hero') inspectionHold(g, 'h', 'hero');
    if (alternative === 'ghola') {
      const index = g.deck.findIndex((card) => card.effect === 'ghola');
      assert.ok(index >= 0);
      nexusPlayer(g, 'h').hand.push(g.deck.splice(index, 1)[0]);
    }
    g = answer(play(g, 'weapon', 'secretAlly'), weapon.id);
    g = applyAction(g, 'a', {
      type: 'card',
      card: residual,
      target: 'h',
      event: g.battle!.event,
    });
    assert.equal(g.battle!.nexusInspection!.stage, 'answered', alternative);
    assert.deepEqual(g.battle!.nexusInspection!.answers, [weapon.id]);
    assert.equal(viewGame(g, 'h').battle!.ownCommitments[0].value, weapon.id);
    assert.equal(viewGame(g, 'a').battle!.nexusInsights[0].active, true);
    inspectionInventory(g);
  }
});

void test('an answered Secret Ally leader inspection blocks Residual before card loss or random casualty', () => {
  let g = nexusInspectionFixture(true, 'a', { richese: true });
  const residual = inspectionResidual(g);
  const leader = nexusPlayer(g, 'h').leaders[0].id;
  g = answer(play(g, 'leader', 'secretAlly'), leader);
  assert.match(
    viewGame(g, 'a').residualPoison!.blocked!,
    /leader|inspection|Prescience/i,
  );
  nexusReject(
    g,
    'a',
    { type: 'card', card: residual, target: 'h', event: g.battle!.event },
    /leader|inspection|Prescience/i,
  );
  inspectionInventory(g);
});

void test('the same genuine Richese No-Field marker blocks native Cunning dial inspection but allows Secret Ally dial', () => {
  let native = nexusInspectionFixture(false, 'a', { noField: true });
  assert.ok(native.battle!.noFieldPlayers?.includes('h'));
  native = inspectionNative(native, 'weapon', null);
  assert.equal(
    viewGame(native, 'a').nexusAtreides!.fields.includes('dial'),
    false,
  );
  nexusReject(
    native,
    'a',
    {
      type: 'nexusAtreides',
      event: native.battle!.event,
      mode: 'cunning',
      field: 'dial',
    },
    /field|No-Field/i,
  );
  let secret = nexusInspectionFixture(true, 'a', { noField: true });
  assert.ok(secret.battle!.noFieldPlayers?.includes('h'));
  assert.equal(
    viewGame(secret, 'a').nexusAtreides!.fields.includes('dial'),
    true,
  );
  secret = answer(play(secret, 'dial', 'secretAlly'), 1);
  assert.deepEqual(secret.battle!.nexusInspection!.answers, [1]);
  inspectionInventory(secret);
});

void test('canceled Cunning preserves its original disclosure while Residual legitimately reopens and replaces the native answer', () => {
  let g = nexusInspectionFixture(false, 'a', { richese: true });
  const residual = inspectionResidual(g);
  const weapon = inspectionHold(g, 'h', 'projectile');
  const cancel = karama(g, 'f');
  nexusPlayer(g, 'h').leaders.forEach((leader, i) => {
    leader.dead = i !== 0;
    leader.deaths = leader.dead ? 1 : 0;
  });
  g = inspectionNative(g, 'weapon', weapon.id);
  g = play(g, 'defense');
  g = applyAction(g, 'f', { type: 'card', card: cancel.id, mode: 'cancel' });
  assert.equal(g.battle!.nexusInspection!.stage, 'canceled');
  g = applyAction(g, 'a', {
    type: 'card',
    card: residual,
    target: 'h',
    event: g.battle!.event,
  });
  assert.equal(g.battle!.preparation?.kind, 'prescienceAnswer');
  assert.equal(Object.hasOwn(g.battle!.prescience!, 'value'), false);
  assert.equal(
    Object.hasOwn(g.battle!.nexusInspection!, 'firstCurrent'),
    false,
  );
  assert.equal(g.battle!.nexusInspection!.first!.value, weapon.id);
  g = applyAction(nexusReload(g), 'h', {
    type: 'prescienceAnswer',
    value: null,
  });
  assert.equal(g.battle!.nexusInspection!.stage, 'canceled');
  assert.deepEqual(g.battle!.nexusInspection!.firstCurrent, { value: null });
  assert.equal(g.battle!.nexusInspection!.first!.value, weapon.id);
  assert.equal(g.battle!.prescience!.value, null);
  inspectionInventory(normalizeAutomaticGame(nexusReload(g)));
});

void test('a pending Cunning second answer waits behind a legitimate native Residual reanswer without losing either receipt', () => {
  let g = nexusInspectionFixture(false, 'a', { richese: true });
  const residual = inspectionResidual(g);
  const weapon = inspectionHold(g, 'h', 'projectile');
  nexusPlayer(g, 'h').leaders.forEach((leader, i) => {
    leader.dead = i !== 0;
    leader.deaths = leader.dead ? 1 : 0;
  });
  g = inspectionNative(g, 'weapon', weapon.id);
  g = nexusAllow(play(g, 'defense'));
  assert.equal(g.battle!.nexusInspection!.stage, 'answer');
  g = applyAction(g, 'a', {
    type: 'card',
    card: residual,
    target: 'h',
    event: g.battle!.event,
  });
  assert.equal(g.battle!.preparation?.kind, 'prescienceAnswer');
  assert.equal(g.battle!.nexusInspection!.stage, 'answer');
  assert.deepEqual(g.battle!.nexusInspection!.answers, []);
  assert.equal(
    Object.hasOwn(g.battle!.nexusInspection!, 'firstCurrent'),
    false,
  );
  g = applyAction(nexusReload(g), 'h', {
    type: 'prescienceAnswer',
    value: null,
  });
  assert.equal(g.battle!.preparation?.kind, 'nexusPrescienceAnswer');
  assert.deepEqual(g.battle!.nexusInspection!.firstCurrent, { value: null });
  g = answer(nexusReload(g), null);
  assert.deepEqual(g.battle!.nexusInspection!.answers, [null]);
  assert.equal(g.battle!.nexusInspection!.first!.value, weapon.id);
  assert.equal(viewGame(g, 'h').battle!.ownCommitments.length, 2);
  inspectionInventory(normalizeAutomaticGame(nexusReload(g)));
});
