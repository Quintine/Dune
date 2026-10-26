import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { HomeworldRevivalDeployment, HomeworldRevivalDeploymentButtons } from '../components/homeworld-revival-deployment';
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
  homeworldRevivalDeploymentQuantities,
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

function allocated(remaining = 3, placed = 0): GameView {
  const view = fixture(), offer = view.homeworldRevivalDeployment!;
  offer.elite = remaining;
  offer.allocation = { total: remaining + placed, remaining, placed, kept: 0 };
  return view;
}
type ButtonProps = { children?: ReactNode; [key: string]: unknown };
function elements(node: ReactNode): ReactElement<ButtonProps>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<ButtonProps>(node)) return [];
  return [node, ...elements(node.props.children)];
}
function deploymentButton(props: Parameters<typeof HomeworldRevivalDeploymentButtons>[0], action: 'place' | 'reserves') {
  const button = elements(HomeworldRevivalDeploymentButtons(props)).find(element => element.props['data-revival-deployment-action'] === action);
  assert.ok(button); return button;
}
const click = (button: ReactElement<ButtonProps>) => (button.props.onClick as () => void)();

void test('revival controls commit the entire eligible typed group to one current destination', () => {
  for (const kind of ['fedaykin', 'tleilax'] as const) {
    const view = fixture(kind);
    const offer = view.homeworldRevivalDeployment!;
    const before = structuredClone(view);
    assert.deepEqual(homeworldRevivalDeploymentQuantities(view), [offer.normal + offer.elite]);
    assert.equal(homeworldRevivalDeploymentChoice(view, 'arrakeen:9', 1).action, null);
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
  const advanced = fixture(); advanced.advanced = true; advanced.homeworldRevivalDeployment!.elite = 1;
  assert.deepEqual(homeworldRevivalDeploymentQuantities(advanced), [1]);
  assert.equal(homeworldRevivalDeploymentChoice(advanced, 'arrakeen:9').action!.amount, 1);
  assert.doesNotMatch(markup(advanced), /Starred forces to place now|Provisional per-star interpretation/);
});

void test('new Basic Southern allocation defaults to one and enumerates native destinations and quantities for every profile', () => {
  for (const profile of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
    const view = allocated(), offer = view.homeworldRevivalDeployment!; view.players[0].bot = profile;
    for (const key of ['hand', 'spice', 'traitors', 'forces'])
      Object.defineProperty(view.players[1], key, { get() { throw Error(`No foreign ${key} allocation inspection`); } });
    assert.deepEqual(homeworldRevivalDeploymentQuantities(view), [1, 2, 3]);
    assert.deepEqual(homeworldRevivalDeploymentChoice(view, 'hagga_basin:8').action,
      { type: 'decision', event: offer.event, destination: 'hagga_basin:8', amount: 1 });
    const actions = homeworldRevivalDeploymentActions(view);
    assert.deepEqual(actions.slice(0, 3).map(action => [action.destination, action.amount]),
      [['arrakeen:9', 1], ['arrakeen:9', 2], ['arrakeen:9', 3]]);
    assert.deepEqual(actions.slice(3, 6).map(action => [action.destination, action.amount]),
      [['hagga_basin:8', 1], ['hagga_basin:8', 2], ['hagga_basin:8', 3]]);
    assert.deepEqual(actions[6], { type: 'decision', event: offer.event, decline: true });
    const html = markup(view); assert.match(html, /3 starred remaining of 3/);
    assert.match(html, /0 placed · 0 kept in reserves/); assert.match(html, /eligible batch is fixed by this one original revival/);
    assert.match(html, /Provisional per-star interpretation/); assert.match(html, /no publisher clarification/);
    assert.match(html, /Starred forces to place now/); assert.match(html, /<option value="1" selected="">1<\/option>/);
    assert.match(html, /Place 1 revived force/); assert.match(html, /Leave all remaining in reserves/);
  }
});

void test('allocation metadata and amount bounds fail closed instead of reverting to a whole-group action', () => {
  for (const allocation of [null,
    { total: 3, remaining: 2, placed: 0, kept: 0 },
    { total: 3, remaining: 3, placed: -1, kept: 1 },
    { total: 3, remaining: 1.5, placed: 1.5, kept: 0 },
    { total: 21, remaining: 3, placed: 18, kept: 0 },
    { total: 3, remaining: 3, placed: 0, kept: 0, quantity: 1 },
  ]) {
    const view = allocated(); Object.assign(view.homeworldRevivalDeployment!, { allocation });
    assert.deepEqual(homeworldRevivalDeploymentQuantities(view), []);
    assert.match(homeworldRevivalDeploymentChoice(view, 'arrakeen:9').blocked!, /allocation is no longer available/);
    assert.deepEqual(homeworldRevivalDeploymentActions(view), [{ type: 'decision', event: 'revival-deployment-1', decline: true }]);
  }
  for (const amount of [0, -1, 1.5, NaN, Infinity, 4])
    assert.equal(homeworldRevivalDeploymentChoice(allocated(), 'arrakeen:9', amount).action, null);
  for (const change of [
    (view: GameView) => { view.advanced = true; },
    (view: GameView) => { view.homeworldRevivalDeployment!.kind = 'tleilax'; },
    (view: GameView) => { view.homeworldRevivalDeployment!.normal = 1; },
  ]) {
    const view = allocated(); change(view); assert.deepEqual(homeworldRevivalDeploymentQuantities(view), []);
    assert.equal(homeworldRevivalDeploymentChoice(view, 'arrakeen:9', 1).action, null);
  }
});

void test('allocation callbacks submit only the selected native amount or all-remaining decline and honor busy and changed choices', () => {
  const game = allocated(), sent: unknown[] = [];
  const props = { game, busy: false, destination: 'arrakeen:9', amount: 2, act(action: unknown) { sent.push(action); } };
  const place = deploymentButton(props, 'place'), reserves = deploymentButton(props, 'reserves');
  assert.equal(place.props.disabled, false); click(place); click(reserves);
  assert.deepEqual(sent, [{ type: 'decision', event: 'revival-deployment-1', destination: 'arrakeen:9', amount: 2 },
    { type: 'decision', event: 'revival-deployment-1', decline: true }]);
  props.busy = true; click(place); click(reserves); assert.equal(sent.length, 2);
  assert.equal(deploymentButton(props, 'place').props.disabled, true);
  props.busy = false; game.homeworldRevivalDeployment!.destinations[2].blocked = 'The current arrival must finish.';
  click(place); click(reserves); assert.equal(sent.length, 2);
  assert.match(markup(game, true), /<select[^>]*aria-label="Starred forces to place now"[^>]*disabled/);
});

void test('each fresh child event resets the quantity and rejects old callbacks until original arrival children finish', () => {
  const game = allocated(), sent: unknown[] = [];
  const props = { game, busy: false, destination: 'arrakeen:9', amount: 2, act(action: unknown) { sent.push(action); } };
  const oldKey = HomeworldRevivalDeployment(props)!.key;
  const place = deploymentButton(props, 'place'), reserves = deploymentButton(props, 'reserves');
  game.response = { kind: 'revivalIncome', owner: 'a', passed: [] };
  assert.deepEqual(homeworldRevivalDeploymentQuantities(game), []); click(place); click(reserves); assert.equal(sent.length, 0);
  game.response = null;
  game.homeworldRevivalDeployment = { ...game.homeworldRevivalDeployment!, event: 'revival-deployment-2', elite: 1,
    allocation: { total: 3, remaining: 1, placed: 2, kept: 0 } };
  assert.equal(homeworldRevivalDeploymentCanAct(game), false);
  game.decision = { kind: 'homeworldRevivalDeployment', player: 'f', event: 'revival-deployment-2' };
  click(place); click(reserves); assert.equal(sent.length, 0);
  assert.notEqual(HomeworldRevivalDeployment(props)!.key, oldKey);
  assert.deepEqual(homeworldRevivalDeploymentQuantities(game), [1]);
  const html = markup(game); assert.match(html, /1 starred remaining of 3 · 2 placed/);
  assert.match(html, /<option value="1" selected="">1<\/option>/); assert.match(html, /Place 1 revived force/);
  assert.deepEqual(homeworldRevivalDeploymentChoice(game, 'hagga_basin:8').action,
    { type: 'decision', event: 'revival-deployment-2', destination: 'hagga_basin:8', amount: 1 });
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
