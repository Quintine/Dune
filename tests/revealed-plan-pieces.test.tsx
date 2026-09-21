import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { applyAction, viewGame, type Game } from '../game/engine';
import { baseDeck } from '../game/cards';
import { leaderSkillBattle } from './leader-skill-battle-fixture';
import { takeBattleCard, diplomatDefenseGame, revealDiplomatPlans } from './diplomat-defense-fixture';
const aliases = registerHooks({ resolve(specifier, context, next) {
  return next(specifier === 'next/image' ? 'vinext/shims/image' : specifier === 'next/link' ? 'vinext/shims/link' : specifier, context);
}, load(url, context, next) {
  if (!url.endsWith('.module.css')) return next(url, context);
  const css = readFileSync(new URL(url), 'utf8');
  const classes = Object.fromEntries([...css.matchAll(/\.([a-zA-Z_][\w-]*)/g)].map(m => [m[1], m[1]]));
  return { format: 'module', source: `export default ${JSON.stringify(classes)}`, shortCircuit: true };
} });
const { GameTable } = await import('../components/game-table');
const { RevealedBattle } = await import('../components/revealed-battle');
const { RevealedPlanPieces } = await import('../components/revealed-plan-pieces');
aliases.deregister();
const render = (g: Game, player: string) => renderToStaticMarkup(createElement(RevealedBattle, { game: viewGame(g, player) }));

void test('public plan pieces stay absent before both real plans are revealed, including for their owners', () => {
  let g = leaderSkillBattle({ skill: 'warmaster', unsealed: true, hide: false, advanced: true });
  const weapon = takeBattleCard(g, 'd', 'poison');
  for (const p of g.players) assert.equal(render(g, p.id), '');
  g = applyAction(g, 'd', { type: 'battlePlan', dial: .5, support: 0, leader: 'guild-1', weapon: weapon.id });
  assert.ok(!g.battle!.revealed);
  for (const p of g.players) assert.equal(render(g, p.id), '');
});

void test('actual revealed plans show physical faces in attacker/defender order and never include unplayed cards', () => {
  let g = leaderSkillBattle({ skill: 'warmaster', unsealed: true, hide: false, advanced: true });
  const ownWeapon = takeBattleCard(g, 'a', 'projectile');
  const secret = takeBattleCard(g, 'a', 'lasgun');
  const otherWeapon = takeBattleCard(g, 'd', 'poison');
  const otherDefense = takeBattleCard(g, 'd', 'snooper');
  g = applyAction(g, 'd', { type: 'battlePlan', dial: .5, support: 0, leader: 'guild-1', weapon: otherWeapon.id, defense: otherDefense.id });
  g = applyAction(g, 'a', { type: 'battlePlan', dial: 1, support: 1, leader: 'emperor-1', weapon: ownWeapon.id });
  assert.ok(g.battle!.revealed);
  const before = JSON.stringify(g);
  for (const p of g.players) {
    const html = render(g, p.id);
    assert.ok(html.indexOf('aria-label="Attacker plan"') < html.indexOf('aria-label="Defender plan"'));
    assert.equal((html.match(/aria-label="Revealed force dial"/g) ?? []).length, 2);
    assert.match(html, /<dd>0.5<\/dd>/);
    for (const card of [ownWeapon, otherWeapon, otherDefense]) assert.ok(html.includes(`Inspect card: ${card.name}`));
    assert.ok(!html.includes(`Inspect card: ${secret.name}`));
    assert.match(html, /aria-label="Defense in original plan: None"/);
    assert.match(html, /Printed strength/);
    assert.match(html, /Inspect leader: Captain Aramsham/);
    assert.match(html, /emperor/);
    assert.match(html, /href="\/rules\?topic=battle#battle"/);
    assert.doesNotMatch(html, /type="range"|type="number"|Seal battle plan|Your private status/);
    assert.equal(render(JSON.parse(before), p.id), html);
  }
  assert.equal(JSON.stringify(g), before);
});

void test('Cheap Hero, Worthless-slot use and late defense retain printed faces and explicit slot labels', () => {
  const cards = baseDeck();
  const hero = cards.find(c => c.kind === 'hero')!;
  const worthless = cards.find(c => c.kind === 'worthless')!;
  const defense = cards.find(c => c.kind === 'snooper')!;
  // Presentation-only: rules for late defense and physical slot legality have engine tests.
  const html = renderToStaticMarkup(createElement(RevealedPlanPieces, { dial: 0, leaderCard: hero, weapon: worthless, lateDefense: defense }));
  assert.ok(html.includes(`aria-label="Leader: ${hero.name}"`));
  assert.ok(html.includes(`aria-label="Weapon: ${worthless.name}"`));
  assert.match(html, /Weapon · Worthless/);
  assert.match(html, /Defense in original plan: None/);
  assert.ok(html.includes(`aria-label="Added after reveal: ${defense.name}"`));
  assert.ok(html.includes(`Inspect card: ${hero.name}`));
  assert.doesNotMatch(html, /Inspect leader:/);
});

void test('an empty revealed plan has clear empty slots and no invented leader or card inspector', () => {
  const html = renderToStaticMarkup(createElement(RevealedPlanPieces, { dial: 0 }));
  for (const label of ['Leader', 'Weapon', 'Defense in original plan']) assert.ok(html.includes(`aria-label="${label}: None"`));
  assert.doesNotMatch(html, /Inspect card:|Inspect leader:|Added after reveal/);
});

void test('both seats retain one shared public plan display while an owned post-reveal choice is pending', () => {
  const game = revealDiplomatPlans(diplomatDefenseGame());
  assert.equal(game.decision?.kind, 'diplomatDefense');
  const before = JSON.stringify(game);
  for (const player of game.players) {
    const html = renderToStaticMarkup(createElement(GameTable, { game: viewGame(game, player.id), busy: true,
      send: async () => { assert.fail('Public inspection must not submit an action.'); }, onExit() {},
    }));
    assert.equal((html.match(/aria-label="Revealed battle plans"/g) ?? []).length, 1);
    assert.equal((html.match(/aria-label="Attacker plan"/g) ?? []).length, 1);
    assert.equal((html.match(/aria-label="Defender plan"/g) ?? []).length, 1);
    assert.match(html, /href="#revealed-battle-plans"/);
    assert.match(html, /href="#table-decisions"/);
  }
  assert.equal(JSON.stringify(game), before);
});
