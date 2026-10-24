import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { battlePlanCardOptions } from '../components/battle-preparation';
import {
  createBasicNativeMirrorFixture, actBasicNativeMirror as act,
  basicNativeMirrorPlayer as player,
} from './fixture-basic-native-mirror';

const aliases = registerHooks({
  resolve(specifier, context, next) {
    return next(specifier === 'next/image' ? 'vinext/shims/image'
      : specifier === 'next/link' ? 'vinext/shims/link' : specifier, context);
  },
  load(url, context, next) {
    if (!url.endsWith('.module.css')) return next(url, context);
    const css = readFileSync(new URL(url), 'utf8');
    const classes = Object.fromEntries([...css.matchAll(/\.([a-zA-Z_][\w-]*)/g)]
      .map(match => [match[1], match[1]]));
    return { format: 'module', source: `export default ${JSON.stringify(classes)}`, shortCircuit: true };
  },
});
const { GameTable } = await import('../components/game-table');
aliases.deregister();

const table = (game: Game, actor: string, busy = false) => renderToStaticMarkup(
  createElement(GameTable, { game: viewGame(game, actor), busy,
    send: async () => assert.fail('Rendering cannot submit a battle action'), onExit() {} }),
);
function physicalPlan(game: Game, actor: string, weapon: string): Action {
  const view = viewGame(game, actor);
  view.players.find(p => p.id === actor)!.bot = 'Easy';
  const plan = botActions(view).find(action => action.type === 'battlePlan' &&
    action.weapon === weapon && !action.defense && Number(action.support ?? 0) === 0);
  assert.ok(plan, 'The actual Basic plan actor retains a legal plan for this physical weapon');
  return plan;
}
function toothButton(html: string, label: string): string {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const button = html.match(new RegExp(`<button\\b[^>]*>${escaped}[\\s\\S]*?</button>`))?.[0];
  assert.ok(button, `The current decision retains its ${label} control`);
  return button;
}

// These exercise actual-state rendering and event-bound engine actions. The
// Tooth controls are inline GameTable callbacks, not separately invoked here.
for (const role of ['ecaz', 'moritani'] as const) {
  void test(`Basic native ${role} Mirror appears in its real selector and keeps copied Tooth choices explicit`, () => {
    const f = createBasicNativeMirrorFixture({ owner: role, weapon: 'poisonTooth' });
    let game = f.game;
    const view = viewGame(game, f.owner), plan = physicalPlan(game, f.owner, f.mirror);
    assert.equal(game.advanced, false);
    assert.ok(battlePlanCardOptions(view, 'weapon', String(plan.leader), '', '')
      .some(card => card.id === f.mirror));
    const options = table(game, f.owner).match(/<select[^>]*id="battle-weapon"[^>]*>[\s\S]*?<\/select>/)?.[0];
    assert.ok(options);
    assert.match(options, /value="richese-mirror-weapon"/);
    assert.match(options, /Mirror Weapon/);

    game = act(game, f.owner, plan);
    game = act(game, f.opponent, physicalPlan(game, f.opponent, f.original));
    assert.equal(game.battle!.revealed, true);
    assert.equal(game.decision?.kind, 'poisonTooth');
    assert.equal(game.decision.player, f.owner);
    assert.equal(game.decision.physicalId, f.mirror);
    assert.equal(game.decision.copiedFrom, f.original);
    const event = game.decision.event, before = structuredClone(game);
    for (let reading = 0; reading < 2; reading++) {
      const html = table(game, f.owner);
      assert.match(html, /Your physical Mirror Weapon copied the opposing Poison Tooth/);
      assert.match(html, /A Mirror copy chooses before the original Tooth/);
      assert.doesNotMatch(toothButton(html, 'Activate Poison Tooth'), /\sdisabled(?:=|\s|>)/);
      assert.doesNotMatch(toothButton(html, 'Leave it unused'), /\sdisabled(?:=|\s|>)/);
    }
    const busy = table(game, f.owner, true);
    assert.match(toothButton(busy, 'Activate Poison Tooth'), /disabled=""/);
    assert.match(toothButton(busy, 'Leave it unused'), /disabled=""/);
    assert.deepEqual(game, before, 'Repeated rendering leaves the explicit native choice pending');

    assert.throws(() => act(game, f.owner,
      { type: 'decision', event: 'stale-copied-tooth', activate: false }));
    assert.deepEqual(game, before);
    game = act(game, f.owner, { type: 'decision', event, activate: false });
    assert.equal(game.decision?.kind, 'poisonTooth');
    assert.equal(game.decision.player, f.opponent);
    assert.equal(game.decision.physicalId, f.original);
    assert.equal(game.decision.copiedFrom, null);
    assert.equal(game.battle!.poisonTooth![f.owner], false);
    assert.ok(player(game, f.owner).hand.some(card => card.id === f.mirror));
    const original = table(game, f.opponent);
    assert.doesNotMatch(original, /Your physical Mirror Weapon copied the opposing Poison Tooth/);
    toothButton(original, 'Activate Poison Tooth');
    toothButton(original, 'Leave it unused');
    game = act(game, f.opponent, { type: 'decision', event: game.decision.event, activate: false });
    assert.equal(game.battle!.poisonTooth![f.opponent], false);
  });
}
