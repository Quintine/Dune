import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  newPlayer,
  viewGame,
  type Game,
} from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import {
  createRicheseNoField,
  deployRicheseNoField,
  type NoFieldValue,
} from '../game/richese-no-field';
import { MOBILE_LOCATION } from '../game/board';

function fixture() {
  const g = createGame('BATTLECHOICEQA', newPlayer('e', 'Emperor', 'emperor'));
  g.players.push(
    newPlayer('h', 'Harkonnen', 'harkonnen'),
    newPlayer('b', 'Bene Gesserit', 'beneGesserit'),
    newPlayer('r', 'Richese', 'richese'),
  );
  g.status = 'playing';
  g.phase = 6;
  g.turn = 2;
  g.storm = 18;
  g.order = ['e', 'h', 'b', 'r'];
  g.active = 'e';
  g.battle = null;
  for (const p of g.players) {
    p.hand = [];
    p.forces = {};
    p.reserves = 20;
    p.spice = 10;
    p.traitors = [];
  }
  return g;
}
function army(g: Game, id: string, forces: Record<string, number>) {
  const p = g.players.find((p) => p.id === id)!;
  p.forces = { ...forces };
  p.reserves = 20 - Object.values(forces).reduce((sum, n) => sum + n, 0);
}
function verify(g: Game, expected: string[], viewer = 'e') {
  const all = [];
  for (const level of DIFFICULTIES) {
    const v = viewGame(g, viewer);
    v.players.find((p) => p.id === viewer)!.bot = level;
    const before = structuredClone(v);
    const actions = botActions(v).filter(
      (action) => action.type === 'chooseBattle',
    );
    assert.deepEqual(
      v,
      before,
      `${level}: policy must not mutate its projection`,
    );
    assert.deepEqual(
      actions.map((a) => `${String(a.territory)}/${String(a.target)}`).sort(),
      [...expected].sort(),
      level,
    );
    for (const action of actions) {
      const next = applyAction(g, viewer, action);
      assert.equal(next.battle?.territory, action.territory, level);
      assert.equal(next.battle?.attacker, viewer, level);
      assert.equal(next.battle?.defender, action.target, level);
    }
    all.push(actions);
  }
  return all;
}

void test('all profiles choose every ordinary unresolved battle and never a Polar Sink co-occupancy', () => {
  const g = fixture();
  army(g, 'e', { 'arrakeen:10': 2, 'carthag:11': 2, 'polar_sink:0': 2 });
  army(g, 'h', { 'arrakeen:10': 2, 'polar_sink:0': 2 });
  army(g, 'b', { 'carthag:11': 2 });
  verify(g, ['arrakeen/h', 'carthag/b']);
});

void test('all profiles exclude allied forces and Bene Gesserit advisors while retaining their fighters elsewhere', () => {
  const g = fixture();
  g.advanced = true;
  g.players[0].ally = 'h';
  g.players[1].ally = 'e';
  army(g, 'e', { 'arrakeen:10': 2, 'carthag:11': 2, 'imperial_basin:9': 2 });
  army(g, 'h', { 'arrakeen:10': 2 });
  army(g, 'b', { 'carthag:11': 2, 'imperial_basin:9': 2 });
  g.players[2].advisors = { carthag: {} };
  verify(g, ['imperial_basin/b']);
});

void test('Bene Gesserit profiles do not initiate battle from their advisor territories', () => {
  const g = fixture();
  g.advanced = true;
  g.order = ['b', 'e', 'h', 'r'];
  g.active = 'b';
  army(g, 'b', { 'arrakeen:10': 2, 'carthag:11': 2 });
  army(g, 'e', { 'arrakeen:10': 2, 'carthag:11': 2 });
  g.players[2].advisors = { arrakeen: {} };
  verify(g, ['carthag/e'], 'b');
});

void test('all profiles exclude storm-separated forces in one territory and a storm-covered stronghold', () => {
  const g = fixture();
  g.storm = 10;
  army(g, 'e', { 'imperial_basin:9': 2, 'arrakeen:10': 2, 'carthag:11': 2 });
  army(g, 'h', { 'imperial_basin:11': 2, 'arrakeen:10': 2, 'carthag:11': 2 });
  verify(g, ['carthag/h']);
});

void test('all profiles keep a same-territory battle when one unstopped sector pair remains reachable', () => {
  const g = fixture();
  g.storm = 10;
  army(g, 'e', { 'imperial_basin:9': 2, 'imperial_basin:11': 2 });
  army(g, 'h', { 'imperial_basin:11': 2 });
  verify(g, ['imperial_basin/h']);
});

void test('battle choices respect public aggressor order and decision ownership', () => {
  const g = fixture();
  g.order = ['h', 'e', 'b', 'r'];
  army(g, 'e', { 'arrakeen:10': 2, 'carthag:11': 2 });
  army(g, 'h', { 'arrakeen:10': 2 });
  army(g, 'b', { 'carthag:11': 2 });
  verify(g, ['carthag/b']);
  verify(g, [], 'h');
});

void test('occupied territories from a completed battle are not battles without opposing fighters', () => {
  const g = fixture();
  army(g, 'e', { 'arrakeen:10': 2, 'carthag:11': 2 });
  army(g, 'h', { 'carthag:11': 2 });
  g.lastBattle = ['e', 'h'];
  g.players[0].leaders[0].usedAt = 'arrakeen';
  verify(g, ['carthag/h']);
});

void test('all profiles choose an opaque opposing No-Field identically for every hidden denomination', () => {
  let prior: ReturnType<typeof verify> | undefined;
  for (const value of [0, 3, 5] as NoFieldValue[]) {
    const g = fixture();
    army(g, 'e', { 'imperial_basin:9': 2 });
    const richese = g.players[3];
    richese.noField = createRicheseNoField([
      'hidden-zero',
      'hidden-three',
      'hidden-five',
    ]);
    richese.noField = deployRicheseNoField(richese.noField, {
      tokenId: richese.noField.tokens.find((token) => token.value === value)!
        .id,
      controller: richese.id,
      location: { territory: 'imperial_basin', sector: 9 },
    });
    richese.noFieldEvent = 'same-public-event';
    const choices = verify(g, ['imperial_basin/r']);
    if (prior) assert.deepEqual(choices, prior);
    prior = choices;
  }
});

void test('all profiles use the mobile stronghold pointing sector for storm exclusion', () => {
  const g = fixture();
  g.mobileStronghold = { location: 'imperial_basin:10' };
  army(g, 'e', { [MOBILE_LOCATION]: 2, 'carthag:11': 2 });
  army(g, 'h', { [MOBILE_LOCATION]: 2, 'carthag:11': 2 });
  g.storm = 10;
  verify(g, ['carthag/h']);
  g.storm = 18;
  verify(g, ['hidden_mobile_stronghold/h', 'carthag/h']);
});
