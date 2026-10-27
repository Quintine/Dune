import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { GameView } from '../game/engine';
import { homeworldForceGroups } from '../game/homeworld-custody';
import { homeworldPopulations } from '../game/homeworld-population';
import { emperorHomeworldMoveAction } from '../game/homeworld-options';
import { richeseCards } from '../game/richese-cards';

const aliases = registerHooks({
  resolve(specifier, context, next) {
    return next(specifier === 'next/image' ? 'vinext/shims/image' : specifier === 'next/link' ? 'vinext/shims/link' : specifier, context);
  },
  load(url, context, next) {
    if (!url.endsWith('.module.css')) return next(url, context);
    const css = readFileSync(new URL(url), 'utf8');
    const classes = Object.fromEntries([...css.matchAll(/\.([a-zA-Z_][\w-]*)/g)].map(match => [match[1], match[1]]));
    return { format: 'module', source: `export default ${JSON.stringify(classes)}`, shortCircuit: true };
  },
});
const { EmperorHomeworldMovement } = await import('../components/homeworld-table');
const { OrnithopterMovement } = await import('../components/ornithopter-movement');
aliases.deregister();
const card = richeseCards().find(candidate => candidate.effect === 'ornithopter')!;

/** Controlled public-view rendering and shared-adapter evidence only. The
 * stateful inputs are rendered at their real zero defaults, not operated;
 * physical card acquisition/native engine continuation is separate evidence. */
function fixture(withCard = true): GameView {
  const context = { advanced: true, players: [
    { id: 'e', faction: 'emperor' as const, reserves: 8, eliteReserves: 3 },
    { id: 'a', faction: 'atreides' as const, reserves: 18, eliteReserves: 0 },
  ] };
  const custody = { salusa: { normal: 2, elite: 2 }, visitors: {} };
  const populations = homeworldPopulations(context, custody);
  return { status: 'playing', phase: 5, advanced: true, active: 'e', me: 'e',
    homeworldMove: { event: 'current-world-event', remaining: 1, blocked: null },
    homeworlds: { worlds: homeworldForceGroups(context, custody).map(world => ({ ...world,
      ...populations.find(population => population.location === world.id)! })) },
    players: context.players.map(player => ({ ...player, name: player.faction, ally: null, forces: {},
      elites: { reserves: player.eliteReserves, forces: {} }, hand: player.id === 'e' && withCard ? [{ ...card }] : [], autopilot: null })),
    ornithopter: withCard ? { card: { ...card }, blocked: null,
      modes: [{ mode: 'range3', blocked: null }, { mode: 'twoGroups', blocked: null }], active: null } : null,
  } as unknown as GameView;
}
function html(game: GameView, busy = false) {
  return renderToStaticMarkup(createElement(EmperorHomeworldMovement, { game, busy, act() {} }));
}
const selected = { origin: 'homeworld:emperor' as const, forces: { normal: 0, elite: 1 } };

void test('the shared flight panel labels remaining Imperial World cohorts without parsing them as Arrakis sectors', () => {
  const game = fixture();
  game.ornithopter!.active = { event: 'active-flight-event', mode: 'twoGroups', completed: 1, remaining: 1,
    homeworldCohort: true, cohort: { forces: { 'homeworld:emperor': 1, 'homeworld:emperor:salusa': 2 },
      elites: { 'homeworld:emperor:salusa': 2 } } };
  const markup = renderToStaticMarkup(createElement(OrnithopterMovement, { game, busy: false, act() {}, move: null }));
  assert.match(markup, /Kaitain: 1 forces, including 0 Sardaukar/);
  assert.match(markup, /Salusa Secundus: 2 forces, including 2 Sardaukar/);
  assert.doesNotMatch(markup, /sector NaN|homeworld, sector/);
});

void test('ordinary Imperial inputs keep zero defaults and their unchanged no-card movement packet', () => {
  const game = fixture(false), markup = html(game);
  assert.match(markup, /Move between Imperial Homeworlds/);
  assert.match(markup, /Costs one movement and no spice/);
  assert.equal((markup.match(/type="number"[^>]*value="0"/g) ?? []).length, 2);
  assert.match(markup, /Normal forces \(0–3\)/);
  assert.match(markup, /Sardaukar \(0–1\)/);
  assert.doesNotMatch(markup, /Provisional Ornithopter|Play Ornithopter|next Ornithopter group/);
  assert.deepEqual(emperorHomeworldMoveAction(game, selected), { type: 'emperorHomeworldMove',
    event: 'current-world-event', origin: selected.origin, normal: 0, elite: 1 });
});

void test('held-card World controls expose both explicit modes and persistently explain their native-route limitation', () => {
  const game = fixture(), markup = html(game);
  assert.match(markup, /Play Ornithopter \(range three\) and move to Salusa Secundus/);
  assert.match(markup, /Play Ornithopter \(two groups\) and move to Salusa Secundus/);
  assert.match(markup, /Provisional Ornithopter composition/);
  assert.match(markup, /Range three gives no extra World range or new route/);
  assert.match(markup, /different original typed counters/);
  assert.match(markup, /World group may be paired with a ground group/);
  assert.match(markup, /Existing shipment history and completed movement stay recorded/);
  for (const mode of ['range3', 'twoGroups'] as const)
    assert.deepEqual(emperorHomeworldMoveAction(game, selected, mode), { type: 'emperorHomeworldMove',
      event: 'current-world-event', origin: selected.origin, normal: 0, elite: 1,
      movementCard: card.id, ornithopter: mode });
  const busy = html(game, true);
  assert.match(busy, /<fieldset[^>]*disabled=""/);
  assert.equal((busy.match(/<button[^>]*disabled=""/g) ?? []).length, 3);
});

void test('active World continuation shows only unmoved typed quotas and uses the current flight event without replaying its card', () => {
  const game = fixture();
  game.players[0].hand = [];
  game.homeworldMove!.remaining = 0;
  game.ornithopter!.active = { event: 'active-flight-event', mode: 'twoGroups', completed: 1, remaining: 1,
    homeworldCohort: true, cohort: { forces: { 'homeworld:emperor': 1 }, elites: { 'homeworld:emperor': 1 } } };
  const markup = html(game);
  assert.match(markup, /Move next Ornithopter group to Salusa Secundus/);
  assert.match(markup, /1 group moved · 1 remaining/);
  assert.match(markup, /Normal forces \(0–0\)/);
  assert.match(markup, /Sardaukar \(0–1\)/);
  assert.doesNotMatch(markup, /Play Ornithopter \((range three|two groups)\) and move/);
  assert.deepEqual(emperorHomeworldMoveAction(game, selected), { type: 'emperorHomeworldMove',
    event: 'current-world-event', origin: selected.origin, normal: 0, elite: 1, ornithopterEvent: 'active-flight-event' });
  assert.equal(emperorHomeworldMoveAction(game, { ...selected, forces: { normal: 1, elite: 0 } }), null);
  game.ornithopter!.active!.event = '';
  assert.equal(emperorHomeworldMoveAction(game, selected), null);
});

void test('a still-uncompleted on-table flight offers the native replacement route without inventing a cohort or another card play', () => {
  const game = fixture(); game.players[0].hand = [];
  game.ornithopter!.active = { event: 'replacement-flight-event', mode: 'twoGroups', completed: 0,
    remaining: 2, cohort: undefined };
  const markup = html(game);
  assert.match(markup, /0 group moved · 2 remaining/);
  assert.match(markup, /Normal forces \(0–3\)/);
  assert.match(markup, /Move next Ornithopter group to Salusa Secundus/);
  assert.doesNotMatch(markup, /Play Ornithopter \((range three|two groups)\) and move/);
  assert.deepEqual(emperorHomeworldMoveAction(game, selected), { type: 'emperorHomeworldMove',
    event: 'current-world-event', origin: selected.origin, normal: 0, elite: 1, ornithopterEvent: 'replacement-flight-event' });
});
