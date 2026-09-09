import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { HomeworldRevivalDeployment } from '../components/homeworld-revival-deployment';
import { baseDeck } from '../game/cards';
import {
  createGame,
  joinGame,
  newPlayer,
  viewGame,
  type GameView,
} from '../game/engine';
import {
  homeworldRevivalDeploymentActions,
  homeworldRevivalDeploymentCanAct,
  homeworldRevivalDeploymentChoice,
  homeworldRevivalActionBlock,
} from '../game/homeworld-revival-deployment-options';

// Projected decision fixtures isolate the controls and shared bot policy.
// Engine and recovery suites separately verify revival deposits and custody.
function fixture(kind: 'fedaykin' | 'tleilax' = 'fedaykin'): GameView {
  const game = createGame(
    'REVIVALCONTROLS',
    newPlayer(
      'f',
      'Reviving player',
      kind === 'fedaykin' ? 'fremen' : 'tleilaxu',
    ),
    false,
    ['ix'],
  );
  joinGame(game, newPlayer('a', 'Atreides', 'atreides'));
  game.status = 'playing';
  game.phase = 4;
  game.active = 'a';
  game.players[0].forces = { 'arrakeen:9': 1 };
  const view = viewGame(game, 'f');
  view.decision = {
    kind: 'homeworldRevivalDeployment',
    player: 'f',
    event: 'revival-deployment-1',
  };
  view.homeworldRevivalDeployment = {
    event: 'revival-deployment-1',
    player: 'f',
    kind,
    normal: kind === 'tleilax' ? 3 : 0,
    elite: kind === 'fedaykin' ? 2 : 0,
    blocked: null,
    destinations: [
      {
        id: 'hagga_basin:8',
        name: 'Hagga Basin · sector 8',
        territory: 'hagga_basin',
        sector: 8,
        blocked: null,
      },
      {
        id: 'carthag:10',
        name: 'Carthag · sector 10',
        territory: 'carthag',
        sector: 10,
        blocked: 'The territory already contains two other factions.',
      },
      {
        id: 'arrakeen:9',
        name: 'Arrakeen · sector 9',
        territory: 'arrakeen',
        sector: 9,
        blocked: null,
      },
    ],
  };
  return view;
}

function markup(game: GameView, busy = false) {
  return renderToStaticMarkup(
    createElement(HomeworldRevivalDeployment, { game, busy, act() {} }),
  );
}

void test('revival controls commit the entire eligible typed group to one current destination', () => {
  for (const kind of ['fedaykin', 'tleilax'] as const) {
    const view = fixture(kind);
    const offer = view.homeworldRevivalDeployment!;
    const before = structuredClone(view);
    assert.deepEqual(homeworldRevivalDeploymentChoice(view, 'arrakeen:9'), {
      blocked: null,
      action: {
        type: 'decision',
        event: offer.event,
        destination: 'arrakeen:9',
        amount: offer.normal + offer.elite,
      },
    });
    assert.deepEqual(view, before);
    const html = markup(view);
    assert.match(
      html,
      new RegExp(`${offer.normal} ordinary · ${offer.elite} starred`),
    );
    assert.match(
      html,
      new RegExp(`Place ${offer.normal + offer.elite} revived forces`),
    );
    assert.doesNotMatch(html, /type="number"|type="range"/);
    assert.match(html, /Leave in reserves/);
  }
});

void test('current projected restrictions invalidate stale selections and preserve a decline path', () => {
  const view = fixture();
  assert.equal(
    homeworldRevivalDeploymentChoice(view, 'deleted-destination').action,
    null,
  );
  assert.match(
    homeworldRevivalDeploymentChoice(view, 'carthag:10').blocked!,
    /two other factions/,
  );
  view.homeworldRevivalDeployment!.destinations[2].blocked =
    'Awaiting the entry ruling.';
  assert.equal(
    homeworldRevivalDeploymentChoice(view, 'arrakeen:9').action,
    null,
  );
  view.homeworldRevivalDeployment!.blocked =
    'Awaiting the revival timing ruling.';
  const before = structuredClone(view);
  assert.deepEqual(homeworldRevivalDeploymentActions(view), [
    { type: 'decision', event: 'revival-deployment-1', decline: true },
  ]);
  const html = markup(view);
  assert.match(html, /Awaiting the revival timing ruling/);
  assert.match(
    html,
    /<button[^>]* disabled=""[^>]*>Place 2 revived forces<\/button>/,
  );
  assert.match(
    html,
    /<button(?![^>]* disabled="")[^>]*>Leave in reserves<\/button>/,
  );
  assert.deepEqual(view, before);
  view.homeworldRevivalDeployment!.blocked = null;
  view.homeworldRevivalDeployment!.destinations = [];
  assert.equal(homeworldRevivalDeploymentActions(view)[0].decline, true);
  assert.match(markup(view), /No legal revival destination/);
});

void test('deployment policy uses own public force positions for all profiles without private opponent access', () => {
  for (const profile of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
    const view = fixture('tleilax');
    view.players[0].bot = profile;
    for (const key of ['hand', 'spice', 'traitors', 'forces'])
      Object.defineProperty(view.players[1], key, {
        get() {
          throw new Error(`Read opponent ${key}`);
        },
      });
    const offer = view.homeworldRevivalDeployment!;
    const before = JSON.stringify(offer);
    assert.deepEqual(homeworldRevivalDeploymentActions(view), [
      {
        type: 'decision',
        event: offer.event,
        destination: 'arrakeen:9',
        amount: 3,
      },
    ]);
    offer.destinations[2].blocked = 'Entry unavailable.';
    assert.equal(
      homeworldRevivalDeploymentActions(view)[0].destination,
      'hagga_basin:8',
    );
    offer.destinations[2].blocked = null;
    assert.equal(JSON.stringify(offer), before);
    view.players[0].forces = {};
    offer.destinations = [
      {
        id: 'homeworld:emperor',
        homeworld: 'homeworld:emperor',
        name: 'Kaitain',
        blocked: null,
      },
    ];
    assert.equal(
      homeworldRevivalDeploymentActions(view)[0].destination,
      'homeworld:emperor',
    );
  }
});

void test('owner, decision and interrupt gates suppress actions and hide observer deployment details', () => {
  const view = fixture();
  assert.equal(homeworldRevivalDeploymentCanAct(view), true);
  for (const patch of [
    { me: 'a' },
    { status: 'finished' },
    { decision: null },
    {
      decision: {
        kind: 'homeworldRevivalDeployment',
        player: 'f',
        event: 'old-event',
      },
    },
    { decision: { kind: 'homeworldRevivalDeployment', player: 'a' } },
    { decision: { kind: 'guildShipment', player: 'f' } },
    { response: { kind: 'revivalIncome', owner: 'a', passed: [] } },
    { truthtrance: { stage: 'answer' } },
    { phaseOpening: { kind: 'ix' } },
    { automaticContinuationPending: true },
  ]) {
    const blocked = { ...view, ...patch } as GameView;
    assert.equal(homeworldRevivalDeploymentCanAct(blocked), false);
    assert.deepEqual(homeworldRevivalDeploymentActions(blocked), []);
    assert.equal(
      homeworldRevivalDeploymentChoice(blocked, 'arrakeen:9').action,
      null,
    );
  }
  assert.equal(markup({ ...view, me: 'a' }), '');
  assert.equal(markup({ ...view, homeworldRevivalDeployment: null }), '');
  assert.equal(markup({ ...view, decision: null }), '');
  const html = markup(view, true);
  assert.equal((html.match(/<button[^>]* disabled=""/g) ?? []).length, 2);
  assert.match(html, /<select[^>]*disabled/);
});

void test('invalid revived counts never create a placement action or bot retry loop', () => {
  for (const [normal, elite] of [
    [0, 0],
    [-1, 2],
    [0, 0.5],
    [21, 0],
    [NaN, 2],
  ]) {
    const view = fixture();
    Object.assign(view.homeworldRevivalDeployment!, { normal, elite });
    assert.match(
      homeworldRevivalDeploymentChoice(view, 'arrakeen:9').blocked!,
      /group is no longer available/,
    );
    assert.deepEqual(homeworldRevivalDeploymentActions(view), [
      { type: 'decision', event: 'revival-deployment-1', decline: true },
    ]);
  }
});

void test('the shared action block resolves default Ghola stars and matches only its owned card, source and exact group', () => {
  const view = fixture();
  const own = view.players[0];
  const ghola = baseDeck().find((card) => card.effect === 'ghola')!;
  const karama = baseDeck().find((card) => card.effect === 'karama')!;
  own.hand = [ghola, karama];
  own.tanks = 5;
  own.elites = { reserves: 0, tanks: 3, forces: {}, revived: 0 };
  view.homeworldRevivalBlocks = [
    {
      source: 'normal',
      amount: 5,
      elite: 3,
      reason: 'Ordinary return timing.',
    },
    { source: 'ghola', amount: 5, elite: 3, reason: 'Ghola return timing.' },
    { source: 'ghola', amount: 3, elite: 1, reason: 'One-star Ghola timing.' },
  ];
  const before = structuredClone(view);
  assert.equal(
    homeworldRevivalActionBlock(view, { type: 'card', card: ghola.id }),
    'Ghola return timing.',
  );
  assert.equal(
    homeworldRevivalActionBlock(view, {
      type: 'card',
      card: ghola.id,
      amount: 3,
    }),
    'One-star Ghola timing.',
  );
  assert.equal(
    homeworldRevivalActionBlock(view, { type: 'revive', amount: 5 }),
    'Ordinary return timing.',
  );
  assert.equal(
    homeworldRevivalActionBlock(view, {
      type: 'card',
      card: ghola.id,
      amount: 3,
      elite: 2,
    }),
    null,
  );
  for (const action of [
    { type: 'card', card: ghola.id, leader: 'dead-leader' },
    { type: 'revive', amount: 5, leader: 'dead-leader' },
    { type: 'card', card: karama.id, amount: 5, elite: 3 },
    { type: 'card', card: 'opponent-ghola', amount: 5, elite: 3 },
    { type: 'emperorRevival', amount: 5, elite: 3 },
  ])
    assert.equal(homeworldRevivalActionBlock(view, action), null);
  assert.deepEqual(view, before);
  own.hand = [karama];
  assert.equal(
    homeworldRevivalActionBlock(view, { type: 'card', card: ghola.id }),
    null,
  );
});
