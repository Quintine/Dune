import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FaceDanceActions, faceDanceForceChoices, type FaceDanceActionsProps } from '../components/face-dance-actions';
import { FaceDanceDecision } from '../components/face-dance-decision';
import { createGame, joinGame, newPlayer, viewGame, type Action, type GameView } from '../game/engine';

// These are controlled entitled projections, supplementing the separate native
// Arrakis and controlled conserved Homeworld engine sources. No pending receipt,
// winning army or private card is installed in an authoritative Game here.
// React renders the stateful parent; direct calls enter only the hook-free leaf.
function projected(world = false): GameView {
  const game = createGame('EMPERORFACEDANCECONTROLS', newPlayer('t', 'Tleilaxu', 'tleilaxu'), true, ['ix', 'ecaz']);
  joinGame(game, newPlayer('e', 'Emperor', 'emperor'));
  joinGame(game, newPlayer('a', 'Atreides', 'atreides'));
  joinGame(game, newPlayer('c', 'Ecaz', 'ecaz'));
  const view = viewGame(game, 't');
  view.status = 'playing'; view.phase = 6;
  // Presence of the public Homeworld table identifies the selected module. Its
  // populations are unnecessary to this explanation and never become custody.
  view.homeworlds = { worlds: [] };
  const caller = view.players.find(player => player.id === 't')!;
  caller.reserves = 5;
  caller.forces = { 'arrakeen:10': 2, 'sietch_tabr:14': 3 };
  caller.faceDancers = [{ leader: 'emperor-0', revealed: false }];
  view.players.find(player => player.id === 'e')!.forces = { 'hagga_basin:12': 2, 'hagga_basin:13': 2 };
  view.players.find(player => player.id === 'c')!.forces = { 'hagga_basin:13': 2 };
  view.decision = {
    kind: 'faceDance', player: 't', winner: 'e', leader: 'emperor-0', identity: 'emperor-0',
    territory: world ? 'homeworld:tleilaxu' : 'hagga_basin',
  };
  if (world) view.combatLocations.push({
    id: 'homeworld:tleilaxu', name: 'Tleilax', kind: 'homeworld', native: 't',
    forces: { t: { normal: 5, elite: 0 }, e: { normal: 2, elite: 2 }, a: { normal: 1, elite: 0 } },
  });
  return view;
}
function markup(game: GameView, busy = false) {
  return renderToStaticMarkup(createElement(FaceDanceDecision, { game, busy, act() {} }));
}
function button(html: string, action: 'reveal' | 'decline') {
  const found = html.match(new RegExp(`<button\\b(?=[^>]*data-testid="face-dance-${action}")[^>]*>[\\s\\S]*?<\\/button>`))?.[0];
  assert.ok(found, `The Face Dance ${action} action is present`);
  return found;
}
function propsFor(game: GameView, sources: Record<string, number> = {}): FaceDanceActionsProps {
  return { game, sources, sector: 12, busy: false, act() {} };
}
type ActionButton = { props: { 'data-testid': string; disabled: boolean; onClick: () => void } };
function click(props: FaceDanceActionsProps, action: 'reveal' | 'decline'): Action[] {
  const actions: Action[] = [];
  const leaf = FaceDanceActions({ ...props, act(value) { actions.push(value); } });
  const found = (leaf.props.children as ActionButton[]).find(child => child.props['data-testid'] === `face-dance-${action}`);
  assert.ok(found);
  found.props.onClick();
  return actions;
}
function provisional(html: string) {
  assert.match(html, /aria-label="Provisional Emperor Face Dance return"/);
  assert.match(html, /Provisional return: the Emperor’s normal forces return to Kaitain; Sardaukar return to Salusa Secundus/);
  assert.match(html, /reserve return with no revival fee or income, new battle or additional battle reward/);
  assert.doesNotMatch(html, /Confirm|Acknowledge|countdown/);
}

void test('Advanced Homeworld Emperor returns show persistent provisional typed guidance on Arrakis and a visitor Homeworld', () => {
  for (const world of [false, true]) {
    const game = projected(world), before = structuredClone(game);
    for (let render = 0; render < 3; render++) {
      const html = markup(game); provisional(html);
      assert.match(html, /Their battle rewards remain theirs/);
      assert.match(html, /winner’s 4 remaining forces/);
      assert.match(html, /selected winning leader goes to the tanks without a spice bounty/);
      assert.match(html, /Arrakeen · sector 10/);
      assert.match(html, /Sietch Tabr · sector 14/);
      assert.doesNotMatch(button(html, 'reveal'), /\sdisabled=/);
      assert.doesNotMatch(button(html, 'decline'), /\sdisabled=/);
      if (world) {
        assert.match(html, /Emperor won in Tleilax/);
        assert.match(html, /native forces already at Tleilax remain there/);
        assert.match(html, /0 \/ 4 replacement forces selected/);
        assert.doesNotMatch(html, /face-source-reserves|face-sector|Replacement sector/);
      } else {
        assert.match(html, /Emperor won in Hagga Basin/);
        assert.match(html, /face-source-reserves|Replacement sector/);
        assert.match(html, /4 \/ 4 replacement forces selected/);
        for (const sector of [12, 13]) assert.match(html, new RegExp(`<option value="${sector}"`));
      }
    }
    assert.deepEqual(game, before);
  }
});

void test('an Emperor winning co-side receives the public note and the existing combined fighter maximum', () => {
  const game = projected();
  assert.equal(game.decision?.kind, 'faceDance');
  if (game.decision?.kind !== 'faceDance') return;
  game.decision.winner = 'c'; game.decision.winners = ['c', 'e'];
  const html = markup(game); provisional(html);
  assert.match(html, /winning allied side’s 6 remaining forces/);
  assert.match(html, /5 \/ 6 replacement forces selected/);
  assert.equal(faceDanceForceChoices(game).maximum, 6);
  assert.deepEqual(click(propsFor(game, { reserves: 4, 'arrakeen:10': 2 }), 'reveal'), [
    { type: 'decision', reveal: true, sources: { reserves: 4, 'arrakeen:10': 2 }, sector: 12 },
  ]);
  assert.deepEqual(click(propsFor(game, { reserves: 5, 'arrakeen:10': 2 }), 'reveal'), []);
});

void test('Basic, absent Homeworld and non-Emperor winners receive no misleading typed-return note', () => {
  const basic = projected(); basic.advanced = false;
  const noWorlds = projected(); noWorlds.homeworlds = null;
  const nonEmperor = projected();
  assert.equal(nonEmperor.decision?.kind, 'faceDance');
  if (nonEmperor.decision?.kind === 'faceDance') {
    nonEmperor.decision.winner = 'c'; nonEmperor.decision.winners = ['c', 'a'];
  }
  for (const game of [basic, noWorlds, nonEmperor]) {
    const html = markup(game);
    assert.doesNotMatch(html, /Provisional Emperor Face Dance return|normal forces return to Kaitain|Sardaukar return to Salusa/);
  }
});

void test('occupied-home immunity follows the projected block while retaining the original decline', () => {
  for (const world of [false, true]) {
    const game = projected(world);
    const reason = 'The occupied native Homeworld protects this winner from Face Dancers.';
    assert.equal(game.decision?.kind, 'faceDance');
    if (game.decision?.kind === 'faceDance') game.decision.blocked = reason;
    const html = markup(game); provisional(html);
    assert.ok(html.includes(reason));
    assert.match(html, /<output\b/);
    assert.match(button(html, 'reveal'), /\sdisabled=/);
    assert.doesNotMatch(button(html, 'decline'), /\sdisabled=/);
    assert.deepEqual(click(propsFor(game), 'reveal'), []);
    assert.deepEqual(click(propsFor(game), 'decline'), [{ type: 'decision', reveal: false }]);
  }
});

void test('actual Arrakis reveal callbacks retain exact zero partial and full own-source payloads', () => {
  const game = projected(), before = structuredClone(game);
  for (const sources of [{}, { reserves: 1 }, { 'arrakeen:10': 2 }, { reserves: 1, 'sietch_tabr:14': 3 }] as Record<string, number>[]) {
    const actions = click(propsFor(game, sources), 'reveal');
    assert.deepEqual(actions, [{ type: 'decision', reveal: true, sources, sector: 12 }]);
    assert.deepEqual(Object.keys(actions[0]).sort(), ['reveal', 'sector', 'sources', 'type']);
  }
  assert.deepEqual(click(propsFor(game), 'decline'), [{ type: 'decision', reveal: false }]);
  assert.deepEqual(game, before);
});

void test('Homeworld callbacks omit sector and reserve sources while retaining zero and actual Arrakis replacement sources', () => {
  const game = projected(true), before = structuredClone(game);
  for (const sources of [{}, { 'arrakeen:10': 2 }, { 'arrakeen:10': 1, 'sietch_tabr:14': 3 }] as Record<string, number>[]) {
    const actions = click({ ...propsFor(game, sources), sector: Number.NaN }, 'reveal');
    assert.deepEqual(actions, [{ type: 'decision', reveal: true, sources }]);
    assert.deepEqual(Object.keys(actions[0]).sort(), ['reveal', 'sources', 'type']);
  }
  for (const sources of [{ reserves: 1 }, { reserves: 0 }, { 'homeworld:tleilaxu': 1 }] as Record<string, number>[])
    assert.deepEqual(click(propsFor(game, sources), 'reveal'), []);
  assert.deepEqual(game, before);
});

void test('invalid source objects counts own bounds and current winner maximum guard the actual reveal callback', () => {
  const game = projected();
  const invalid: unknown[] = [
    null, undefined, [], 1, 'reserves',
    { reserves: -1 }, { reserves: 0.5 }, { reserves: Number.NaN }, { reserves: Infinity },
    { reserves: Number.MAX_SAFE_INTEGER + 1 }, { reserves: '1' }, { reserves: null }, { reserves: BigInt(1) },
    { reserves: 6 }, { 'arrakeen:10': 3 }, { 'sietch_tabr:14': 4 },
    { reserves: 3, 'arrakeen:10': 2 }, { 'hagga_basin:10': 1 }, { invented: 0 }, { toString: 0 },
  ];
  for (const sources of invalid) {
    const props = { ...propsFor(game), sources: sources as Record<string, number> };
    assert.deepEqual(click(props, 'reveal'), []);
    const html = renderToStaticMarkup(createElement(FaceDanceActions, props));
    assert.match(button(html, 'reveal'), /\sdisabled=/);
    assert.doesNotMatch(button(html, 'decline'), /\sdisabled=/);
    assert.deepEqual(click(props, 'decline'), [{ type: 'decision', reveal: false }]);
  }
});

void test('Arrakis sector bounds and integers guard callbacks while every offered sector remains usable', () => {
  const game = projected();
  for (const sector of [-1, 0, 10, 11, 19, 10.5, Number.NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])
    assert.deepEqual(click({ ...propsFor(game), sector }, 'reveal'), []);
  for (const sector of [12, 13])
    assert.deepEqual(click({ ...propsFor(game), sector }, 'reveal'), [{ type: 'decision', reveal: true, sources: {}, sector }]);
});

void test('matching identity and unrevealed state guard reveal without restricting decline or public provisional guidance', () => {
  for (const cards of [undefined, [], [{ leader: 'atreides-0', revealed: false }], [{ leader: 'emperor-0', revealed: true }]]) {
    const game = projected(); game.players.find(player => player.id === game.me)!.faceDancers = cards;
    const html = markup(game); provisional(html);
    assert.match(html, /You have no unrevealed Face Dancer matching the winning leader/);
    assert.match(button(html, 'reveal'), /\sdisabled=/);
    assert.doesNotMatch(button(html, 'decline'), /\sdisabled=/);
    assert.deepEqual(click(propsFor(game), 'reveal'), []);
    assert.deepEqual(click(propsFor(game), 'decline'), [{ type: 'decision', reveal: false }]);
  }
});

void test('busy guards both actual callbacks and buttons while leaving guidance and selectors visible', () => {
  for (const world of [false, true]) {
    const game = projected(world), props = { ...propsFor(game), busy: true };
    const html = markup(game, true); provisional(html);
    assert.match(button(html, 'reveal'), /\sdisabled=/);
    assert.match(button(html, 'decline'), /\sdisabled=/);
    assert.match(html, /face-source-arrakeen:10/);
    assert.deepEqual(click(props, 'reveal'), []);
    assert.deepEqual(click(props, 'decline'), []);
  }
});

void test('foreign absent and unrelated decisions expose no parent controls and make both actual callbacks no-ops', () => {
  const foreign = projected(); foreign.me = 'a';
  const absent = projected(); absent.decision = null;
  const unrelated = projected(); unrelated.decision = { kind: 'mobileStronghold', player: 't', placement: false };
  for (const game of [foreign, absent, unrelated]) {
    for (const player of game.players) for (const field of ['faceDancers', 'reserves', 'forces'])
      Object.defineProperty(player, field, { get() { throw Error(`Unowned controls read ${field}`); } });
    assert.equal(markup(game), '');
    for (const action of ['reveal', 'decline'] as const) {
      assert.deepEqual(click(propsFor(game), action), []);
      assert.match(button(renderToStaticMarkup(createElement(FaceDanceActions, propsFor(game))), action), /\sdisabled=/);
    }
  }
});

void test('the parent and real callbacks read only public opponent forces metadata and the caller’s matching private card and local sources', () => {
  for (const world of [false, true]) {
    const game = projected(world);
    for (const field of ['battle', 'pendingFaceDance', 'homeworldOccupationHistory', 'discard', 'response', 'truthtrance'])
      Object.defineProperty(game, field, { get() { throw Error(`Face Dance controls read raw or unrelated ${field}`); } });
    Object.defineProperty(game.homeworlds!, 'custody', { get() { throw Error('Face Dance controls read raw custody'); } });
    for (const player of game.players) {
      const fields = player.id === game.me
        ? ['hand', 'traitors', 'spice', 'leaders', 'elites']
        : ['hand', 'traitors', 'faceDancers', 'spice', 'leaders', 'reserves', 'elites', ...(world ? ['forces'] : [])];
      for (const field of fields)
        Object.defineProperty(player, field, { get() { throw Error(`Face Dance controls read private ${player.id}.${field}`); } });
    }
    const html = markup(game); provisional(html);
    assert.doesNotMatch(button(html, 'reveal'), /\sdisabled=/);
    assert.deepEqual(click(propsFor(game, { 'arrakeen:10': 2 }), 'reveal'), [
      { type: 'decision', reveal: true, sources: { 'arrakeen:10': 2 }, ...(world ? {} : { sector: 12 }) },
    ]);
    assert.deepEqual(click(propsFor(game), 'decline'), [{ type: 'decision', reveal: false }]);
  }
});
