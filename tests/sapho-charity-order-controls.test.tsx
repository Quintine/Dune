import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { Children, createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CharityClaim } from '../components/charity-claim';
import { viewGame, type Action, type GameView } from '../game/engine';
import {
  createSaphoCharityOrderFixture, actSaphoCharityOrder, saphoCharityOrderAction,
  saphoCharityOrderPlayer, type SaphoCharityOrderFixture,
} from './fixture-sapho-charity-order';

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
const { JuiceOfSapho, SaphoOrderButton } = await import('../components/juice-of-sapho');
aliases.deregister();

const sources = new Map<string, SaphoCharityOrderFixture>();
function native(advanced = true, started = false) {
  const key = `${advanced}:${started}`;
  let source = sources.get(key);
  if (!source) { source = createSaphoCharityOrderFixture({ advanced, started }); sources.set(key, source); }
  return { ...source, game: structuredClone(source.game) };
}
function panel(game: GameView, busy = false) {
  return renderToStaticMarkup(createElement(JuiceOfSapho, { game, busy, act() {} }));
}
function charity(game: GameView, busy = false) {
  return renderToStaticMarkup(createElement(CharityClaim, { game, busy, act() {} }));
}
function optionFor(game: GameView, mode: 'first' | 'last') {
  const option = game.saphoOptions.find(candidate => candidate.scope === 'charity' && candidate.mode === mode);
  assert.ok(option?.scope === 'charity');
  return option;
}
function pressSapho(card: string, option: ReturnType<typeof optionFor>, busy = false) {
  const sent: Action[] = [];
  SaphoOrderButton({ card, option, busy, act(action) { sent.push(action); } }).props.onClick();
  return sent;
}
type ClickProps = { children?: ReactNode; disabled?: boolean; onClick?: () => void; 'data-testid'?: string };
function findButton(node: ReactNode, id: string): ReactElement<ClickProps> | null {
  for (const child of Children.toArray(node)) {
    if (!isValidElement<ClickProps>(child)) continue;
    if (child.props['data-testid'] === id) return child;
    const nested = findButton(child.props.children, id);
    if (nested) return nested;
  }
  return null;
}
function pressCharity(game: GameView, id: 'charity-claim-submit' | 'charity-turn-finish', busy = false) {
  const sent: Action[] = [];
  const tree = CharityClaim({ game, busy, act(action) { sent.push(action); } });
  const button = findButton(tree, id); assert.ok(button);
  button.props.onClick?.();
  return { sent, disabled: button.props.disabled };
}

void test('native clean Charity first and last render their scope and submit only five fields; busy cannot play', () => {
  for (const mode of ['first', 'last'] as const) {
    const source = native(), game = viewGame(source.game, source.owner), option = optionFor(game, mode);
    const html = panel(game);
    assert.match(html, new RegExp(`Take your Charity turn ${mode} and discard Juice of Sapho`));
    assert.match(html, /Completed Charity turns stay finished/);
    assert.match(html, /changing order does not grant another claim or reopen completed turns/);
    assert.doesNotMatch(html, /Provisional queued Charity order/);
    assert.equal(option.afterCurrent, undefined);
    const sent = pressSapho(source.card, option), action = sent[0]; assert.ok(action);
    assert.deepEqual(sent, [saphoCharityOrderAction(source.game, mode, source.owner)]);
    assert.deepEqual(Object.keys(action).sort(), ['card', 'event', 'mode', 'scope', 'type']);
    assert.deepEqual(pressSapho(source.card, option, true), []);
    const after = actSaphoCharityOrder(source.game, source.owner, action);
    assert.ok(after.charityOrder?.version === 2);
    assert.equal(mode === 'first' ? after.charityOrder.remaining[0] : after.charityOrder.remaining.at(-1), source.owner);
  }
});

void test('own started Charity pause displays the retained claim and submits its native action', () => {
  const source = native(true, true), game = source.game;
  // Controlled custody: transfer the one physical Sapho to the actual claimant.
  const donor = saphoCharityOrderPlayer(game, source.owner);
  const claimant = saphoCharityOrderPlayer(game, source.current);
  const index = donor.hand.findIndex(card => card.id === source.card);
  assert.ok(index >= 0);
  claimant.hand.push(donor.hand.splice(index, 1)[0]);
  const view = viewGame(game, source.current), option = optionFor(view, 'last');
  assert.equal(option.resumeOwn, true);
  const html = panel(view);
  assert.match(html, /Resume your charity last and discard Juice of Sapho/);
  assert.match(html, /Your completed claim and its payment remain unchanged/);
  assert.deepEqual(pressSapho(source.card, option), [{ type: 'card', card: source.card,
    scope: 'charity', event: option.event, mode: 'last' }]);
  assert.deepEqual(pressSapho(source.card, option, true), []);
});

void test('actual v3 Charity queue enables the current player and blocks the paused player', () => {
  const source = native(true, true);
  let game = source.game;
  // The already-paid original Sapho changes hands without creating a card.
  const donor = saphoCharityOrderPlayer(game, source.owner);
  const claimant = saphoCharityOrderPlayer(game, source.current);
  const cardIndex = donor.hand.findIndex(card => card.id === source.card);
  assert.ok(cardIndex >= 0);
  claimant.hand.push(donor.hand.splice(cardIndex, 1)[0]);
  const pause = optionFor(viewGame(game, source.current), 'last');
  game = actSaphoCharityOrder(game, source.current, pressSapho(source.card, pause)[0]!);
  assert.ok(game.charityOrder && game.charityOrder.version === 3);
  const actor = game.charityOrder.remaining[0]; assert.notEqual(actor, source.current);
  const recipient = game.players.find(player => player.id !== actor)!.id;
  const purse = saphoCharityOrderPlayer(game, actor).spice;
  if (purse) game = actSaphoCharityOrder(game, actor, { type: 'bribe', target: recipient, amount: purse });
  const active = viewGame(game, actor), waiting = viewGame(game, source.current);
  assert.match(charity(active), /It is your Charity turn/);
  assert.match(charity(waiting), /Your turn comes later/);
  assert.deepEqual(pressCharity(waiting, 'charity-claim-submit'), { sent: [], disabled: true });
  assert.deepEqual(pressCharity(waiting, 'charity-turn-finish'), { sent: [], disabled: true });
  const claim = pressCharity(active, 'charity-claim-submit');
  assert.deepEqual(claim, { sent: [{ type: 'charity' }], disabled: false });
  game = actSaphoCharityOrder(game, actor, claim.sent[0]!);
  const finish = pressCharity(viewGame(game, actor), 'charity-turn-finish');
  assert.deepEqual(finish, { sent: [{ type: 'ready' }], disabled: false });
  game = actSaphoCharityOrder(game, actor, finish.sent[0]!);
  while (game.charityOrder?.remaining[0] !== source.current) {
    const current = game.charityOrder?.remaining[0]; assert.ok(current);
    game = actSaphoCharityOrder(game, current, { type: 'ready' });
  }
  const resumed = viewGame(game, source.current);
  assert.deepEqual(pressCharity(resumed, 'charity-claim-submit'), { sent: [], disabled: true });
  assert.deepEqual(pressCharity(resumed, 'charity-turn-finish'), { sent: [{ type: 'ready' }], disabled: false });
});

void test('native claimed current actor stays first while Sapho first or last queues only its later tail', () => {
  for (const mode of ['first', 'last'] as const) {
    const source = native(true, true), game = viewGame(source.game, source.owner), option = optionFor(game, mode);
    const currentName = game.players.find(player => player.id === source.current)!.name;
    assert.equal(option.afterCurrent, source.current);
    for (let render = 0; render < 2; render++) {
      const html = panel(game);
      assert.match(html, /aria-label="Provisional queued Charity order"/);
      assert.ok(html.includes(`${currentName} finishes the current Charity turn unchanged`));
      assert.match(html, new RegExp(`Your ${mode} position applies among later unstarted Charity turns`));
      assert.match(html, /Completed turns and claims stay finished; each player still has only one Charity claim/);
    }
    const sent = pressSapho(source.card, option), action = sent[0]; assert.ok(action);
    assert.deepEqual(Object.keys(action).sort(), ['card', 'event', 'mode', 'scope', 'type']);
    const purse = saphoCharityOrderPlayer(source.game, source.current).spice;
    const after = actSaphoCharityOrder(source.game, source.owner, action);
    assert.ok(after.charityOrder?.version === 2);
    assert.equal(after.charityOrder.remaining[0], source.current);
    assert.equal(after.charityOrder.remaining[mode === 'first' ? 1 : after.charityOrder.remaining.length - 1], source.owner);
    assert.equal(saphoCharityOrderPlayer(after, source.current).spice, purse);
    assert.equal(saphoCharityOrderPlayer(after, source.current).charityTurn, after.turn);
  }
});

void test('actual v2 Charity callbacks wait, claim once and Finish without reopening a completed turn', () => {
  const source = native();
  let game = actSaphoCharityOrder(source.game, source.owner, saphoCharityOrderAction(source.game, 'first', source.owner));
  const actor = game.charityOrder?.remaining[0]; assert.equal(actor, source.owner); assert.ok(actor);
  const recipient = game.players.find(player => player.id !== actor && player.id === 'atreides')?.id; assert.ok(recipient);
  const purse = saphoCharityOrderPlayer(game, actor).spice; assert.ok(purse > 0);
  game = actSaphoCharityOrder(game, actor, { type: 'bribe', target: recipient, amount: purse });
  const current = viewGame(game, actor), waiting = viewGame(game, source.current);
  assert.match(charity(current), /Juice of Sapho changed the remaining Charity order/);
  assert.match(charity(current), /It is your Charity turn/);
  assert.match(charity(waiting), /Waiting for .* to finish Charity/);
  assert.deepEqual(pressCharity(waiting, 'charity-claim-submit'), { sent: [], disabled: true });
  assert.deepEqual(pressCharity(waiting, 'charity-turn-finish'), { sent: [], disabled: true });
  assert.deepEqual(pressCharity(current, 'charity-claim-submit', true), { sent: [], disabled: true });
  const claim = pressCharity(current, 'charity-claim-submit');
  assert.deepEqual(claim, { sent: [{ type: 'charity' }], disabled: false });
  game = actSaphoCharityOrder(game, actor, claim.sent[0]!);
  assert.equal(saphoCharityOrderPlayer(game, actor).spice, 2);
  const claimed = viewGame(game, actor);
  assert.deepEqual(pressCharity(claimed, 'charity-claim-submit'), { sent: [], disabled: true });
  assert.deepEqual(pressCharity(claimed, 'charity-turn-finish', true), { sent: [], disabled: true });
  const finish = pressCharity(claimed, 'charity-turn-finish');
  assert.deepEqual(finish, { sent: [{ type: 'ready' }], disabled: false });
  game = actSaphoCharityOrder(game, actor, finish.sent[0]!);
  const completed = viewGame(game, actor);
  assert.match(charity(completed), /Your Charity turn is complete/);
  assert.deepEqual(pressCharity(completed, 'charity-turn-finish'), { sent: [], disabled: true });
});

void test('Basic unstamped and genuinely completed views filter stale Charity options without adding Finish', () => {
  const source = native(), original = viewGame(source.game, source.owner), stale = optionFor(original, 'first');
  const basicSource = native(false), basic = viewGame(basicSource.game, basicSource.owner);
  const unstamped = viewGame(source.game, source.owner);
  unstamped.charityOrder = null;
  let completedGame = source.game;
  for (let count = 0; count < completedGame.players.length && completedGame.charityOrder?.remaining.includes(source.owner); count++) {
    const actor = completedGame.charityOrder.remaining[0]; assert.ok(actor);
    completedGame = actSaphoCharityOrder(completedGame, actor, { type: 'ready' });
  }
  const completed = viewGame(completedGame, source.owner);
  assert.ok(completed.charityOrder && !completed.charityOrder.remaining.includes(source.owner));
  // Stale public projection supplements only: the native Basic/completed
  // sources keep their actual custody, while the unstamped display is synthetic.
  for (const game of [basic, unstamped, completed]) {
    game.saphoOptions = [stale];
    assert.doesNotMatch(panel(game), /Take your Charity turn (first|last) and discard/);
    assert.match(panel(game), /existing timing|Completed turns stay finished/);
  }
  assert.doesNotMatch(charity(basic), /Finish Charity turn/);
  assert.doesNotMatch(charity(unstamped), /Finish Charity turn/);
});
