import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { applyAction, viewGame, type Game } from '../game/engine';
import { ecazTreacheryCards } from '../game/ecaz-cards';
import { botActions } from '../game/bots';
import { nexusFremenRevivalAction } from '../game/nexus-fremen-revival-options';
import { NexusFremenRevival } from '../components/nexus-fremen-revival';
import { nexusInventory, nexusReady, nexusReload, nexusTurnTwo, orderNexusSpice, finishNexusSpice } from './fixture-nexus-cards';

function fixture(advanced = false, elite = 0) {
  let g = nexusTurnTwo({ advanced, hostFaction: advanced ? 'emperor' : 'guild', seatIds: ['q', 'p', 'r'] });
  orderNexusSpice(g, ['worm', 'land', 'land']);
  g = nexusReady(nexusReady(g));
  g = applyAction(g, 'p', { type: 'alliance', target: 'r' });
  g = applyAction(g, 'r', { type: 'alliance', target: 'p' });
  g = finishNexusSpice(g);
  const cards = g.nexusCards!.cards!;
  cards.deck = ['fremen', ...cards.deck.filter(card => card !== 'fremen')];
  g = applyAction(g, 'q', { type: 'nexusCardChoice', turn: g.turn, card: null, choice: 'draw', ownRedraws: 0 });
  for (const id of g.nexusCards!.phase!.eligible)
    if (!g.nexusCards!.phase!.done.includes(id))
      g = applyAction(g, id, { type: 'nexusCardChoice', turn: g.turn, card: null, choice: 'keep', ownRedraws: 0 });
  g = nexusReady(g);
  for (let i = 0; g.phase === 3 && i < 15; i++) {
    if (g.phaseOpening)
      g = applyAction(g, g.players.find(p => !g.phaseOpening!.passed.includes(p.id))!.id, { type: 'ready' });
    else if (g.auction) g = applyAction(g, g.auction.active, { type: 'passBid' });
    else g = nexusReady(g);
  }
  assert.equal(g.phase, 4);
  assert.equal(g.decision, null);
  const p = g.players.find(p => p.id === 'q')!;
  assert.ok(p.reserves >= 4 && (p.elites?.reserves ?? 0) >= elite);
  p.reserves -= 4;
  p.tanks += 4;
  if (p.elites) { p.elites.reserves -= elite; p.elites.tanks += elite; }
  nexusInventory(g);
  const view = viewGame(g, 'q');
  const action = nexusFremenRevivalAction(view, elite)!;
  assert.ok(action);
  return { g, action };
}

for (const advanced of [false, true]) {
  void test(`Fremen Secret Ally returns an exact free ordinary group in ${advanced ? 'Advanced' : 'Basic'} play`, () => {
    const { g, action } = fixture(advanced);
    const before = g.players.find(p => p.id === 'q')!;
    const spice = before.spice, reserves = before.reserves, tanks = before.tanks;
    const observer = viewGame(g, 'r');
    assert.equal(observer.nexusFremenRevival, null);
    assert.equal(observer.nexusCards?.card, null);
    const result = applyAction(nexusReload(g), 'q', action);
    const p = result.players.find(p => p.id === 'q')!;
    assert.equal(p.reserves, reserves + 3);
    assert.equal(p.tanks, tanks - 3);
    assert.equal(p.spice, spice);
    assert.equal(p.revived, 3);
    assert.equal(p.freeForcesRevived, 3);
    assert.equal(result.nexusCards!.cards!.hands.q, null);
    assert.ok(result.nexusCards!.cards!.discard.includes('fremen'));
    assert.equal(viewGame(result, 'q').nexusFremenRevival, null);
    assert.equal(viewGame(result, 'r').nexusFremenRevival, null);
    nexusInventory(result);
    assert.deepEqual(nexusReload(result).nexusFremenRevivalHistory, result.nexusFremenRevivalHistory);
    assert.throws(() => applyAction(nexusReload(result), 'q', action));
  });
}

void test('Advanced elite cap, legal bot participation and accessible control', () => {
  const { g } = fixture(true, 1);
  const view = viewGame(g, 'q');
  assert.deepEqual(view.nexusFremenRevival?.eliteOptions, [0, 1]);
  for (const level of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
    const botView = structuredClone(view);
    botView.players.find(p => p.id === 'q')!.bot = level;
    const action = botActions(botView)[0];
    assert.equal(action?.type, 'nexusFremenRevive');
    const result = applyAction(nexusReload(g), 'q', action);
    const p = result.players.find(p => p.id === 'q')!;
    assert.equal(p.elites?.revived, level === 'Easy' ? 0 : 1);
    assert.equal(p.revived, 3);
  }
  const markup = renderToStaticMarkup(createElement(NexusFremenRevival, { game: view, act: () => {}, busy: false }));
  assert.match(markup, /Fremen Secret Ally revival/);
  assert.match(markup, /ordinary three-force Revival allowance/);
  assert.match(markup, /Elite forces to revive/);
});

void test('rejected stale, illegal elite and unaffordable groups preserve original input', () => {
  const { g, action } = fixture(true, 1);
  for (const change of [
    (copy: Game) => { copy.players.find(p => p.id === 'q')!.revived = 1; },
    (copy: Game) => { copy.players.find(p => p.id === 'q')!.tanks = 2; },
    (copy: Game) => { copy.players.find(p => p.id === 'q')!.elites!.revived = 1; },
  ]) {
    const copy = nexusReload(g);
    change(copy);
    const before = JSON.stringify(copy);
    assert.throws(() => applyAction(copy, 'q', action));
    assert.equal(JSON.stringify(copy), before);
  }
  for (const invalid of [{ ...action, elite: 2 }, { ...action, event: 'old' }, { ...action, bonus: true }]) {
    const copy = nexusReload(g);
    const before = JSON.stringify(copy);
    assert.throws(() => applyAction(copy, 'q', invalid));
    assert.equal(JSON.stringify(copy), before);
  }
});

void test('independent Ecaz Treachery inventory cannot borrow the bounded revival path', () => {
  const { g, action } = fixture();
  g.ecazTreachery = true;
  g.deck.push(...ecazTreacheryCards());
  const offer = viewGame(g, 'q').nexusFremenRevival;
  assert.match(offer?.blocked ?? '', /Combined expansion and module/);
  const before = JSON.stringify(g);
  assert.throws(() => applyAction(g, 'q', action));
  assert.equal(JSON.stringify(g), before);
});
