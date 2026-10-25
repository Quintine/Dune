import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { newPlayer, viewGame, type Game } from '../game/engine';
import { createHomeworldCustody, quoteHomeworldCustody, HomeworldCustodyError } from '../game/homeworld-custody';
import { homeworldContext } from '../game/homeworld-game';
import { quoteEcazBattleLead } from '../game/ecaz-homeworld-lead';
import { ecazOccupyLeadOptions, ecazOccupyPolicyActions } from '../game/ecaz-occupy-options';
import { EcazOccupyLeadChoice } from '../components/ecaz-occupy';
import { ecazOccupyFixture } from './fixture-ecaz-occupy';

/** Controlled population and custody contexts isolate the printed chooser;
 * they are not earned battle or setup chronologies. */
function populationContext(population = 7, advanced = false): Pick<Game, 'advanced' | 'players' | 'homeworlds'> {
  const players = [newPlayer('ec', 'Ecaz', 'ecaz'), newPlayer('enemy', 'Guild', 'guild'),
    newPlayer('ally', 'Atreides', 'atreides')];
  players[0].reserves = population;
  players[0].tanks = 20 - population;
  players[0].ally = 'ally'; players[2].ally = 'ec';
  return { advanced, players, homeworlds: { custody: createHomeworldCustody(homeworldContext({ advanced, players })) } };
}

void test('Low Ecaz gives its opponent the choice in Basic and Advanced; seven native counters restore Ecaz choice', () => {
  for (const advanced of [false, true]) for (const population of [0, 6, 7, 14, 20]) {
    const context = populationContext(population, advanced), before = structuredClone(context);
    assert.deepEqual(quoteEcazBattleLead(context, 'ec', 'enemy'), population < 7
      ? { player: 'enemy', lowEcaz: true } : { player: 'ec' });
    assert.deepEqual(context, before);
  }
});

void test('without actual Homeworld custody the ordinary Ecaz chooser remains unchanged', () => {
  const context = populationContext(0);
  assert.deepEqual(quoteEcazBattleLead({ ...context, homeworlds: undefined }, 'ec', 'enemy'), { player: 'ec' });
  assert.deepEqual(quoteEcazBattleLead({ ...context, homeworlds: { custody: null } }, 'ec', 'enemy'), { player: 'ec' });
});

void test('foreign visitors do not raise native Low Ecaz population', () => {
  const context = populationContext(6);
  const visit = quoteHomeworldCustody(homeworldContext(context), context.homeworlds!.custody!, [
    { homeworld: 'homeworld:guild', player: 'enemy', withdraw: { normal: 8, elite: 0 }, deposit: { normal: 0, elite: 0 } },
    { homeworld: 'homeworld:ecaz', player: 'enemy', withdraw: { normal: 0, elite: 0 }, deposit: { normal: 8, elite: 0 } },
  ]);
  for (const next of visit.players) context.players.find(player => player.id === next.id)!.reserves = next.reserves;
  context.homeworlds!.custody = visit.state;
  const before = structuredClone(context);
  assert.deepEqual(quoteEcazBattleLead(context, 'ec', 'enemy'), { player: 'enemy', lowEcaz: true });
  assert.deepEqual(context, before);
});

void test('current native departures and returns determine fresh quotes without changing an earlier captured result', () => {
  const context = populationContext(8);
  const original = quoteEcazBattleLead(context, 'ec', 'enemy');
  const away = quoteHomeworldCustody(homeworldContext(context), context.homeworlds!.custody!, [
    { homeworld: 'homeworld:ecaz', player: 'ec', withdraw: { normal: 2, elite: 0 }, deposit: { normal: 0, elite: 0 } },
    { homeworld: 'homeworld:guild', player: 'ec', withdraw: { normal: 0, elite: 0 }, deposit: { normal: 2, elite: 0 } },
  ]);
  for (const next of away.players) context.players.find(player => player.id === next.id)!.reserves = next.reserves;
  context.homeworlds!.custody = away.state;
  const low = quoteEcazBattleLead(context, 'ec', 'enemy');
  assert.deepEqual(low, { player: 'enemy', lowEcaz: true });
  assert.deepEqual(original, { player: 'ec' });
  const back = quoteHomeworldCustody(homeworldContext(context), context.homeworlds!.custody!, [
    { homeworld: 'homeworld:guild', player: 'ec', withdraw: { normal: 2, elite: 0 }, deposit: { normal: 0, elite: 0 } },
    { homeworld: 'homeworld:ecaz', player: 'ec', withdraw: { normal: 0, elite: 0 }, deposit: { normal: 2, elite: 0 } },
  ]);
  for (const next of back.players) context.players.find(player => player.id === next.id)!.reserves = next.reserves;
  context.homeworlds!.custody = back.state;
  assert.deepEqual(quoteEcazBattleLead(context, 'ec', 'enemy'), { player: 'ec' });
  assert.deepEqual(low, { player: 'enemy', lowEcaz: true });
});

void test('the chooser quote requires distinct seated Ecaz and opponent roles', () => {
  const context = populationContext(6), before = structuredClone(context);
  for (const [ecaz, opponent] of [['missing', 'enemy'], ['enemy', 'ec'], ['ec', 'missing'], ['ec', 'ec'], ['', 'enemy']])
    assert.throws(() => quoteEcazBattleLead(context, ecaz, opponent), HomeworldCustodyError);
  assert.deepEqual(context, before);
});

void test('controlled captured Low chooser projection gives both original lead choices only to the recorded opponent', () => {
  const fixture = ecazOccupyFixture({ allyFaction: 'guild', ecazForces: 3 });
  // Only the public recorded chooser is controlled here. The native engine
  // integration tests own earning Low population and opening this decision.
  const own = viewGame(fixture.game, fixture.opponent);
  assert.equal(own.decision?.kind, 'ecazBattleLead');
  if (own.decision?.kind !== 'ecazBattleLead') throw Error('Expected original lead choice');
  own.decision = { ...own.decision, player: fixture.opponent, lowEcaz: true };
  const before = structuredClone(own), choices = ecazOccupyLeadOptions(own);
  assert.deepEqual(choices.map(choice => choice.lead), [fixture.ecaz, fixture.ally]);
  assert.ok(choices.every(choice => choice.blocked === null));
  assert.deepEqual(ecazOccupyPolicyActions(own), choices.map(choice => choice.action));
  const chooser = own.players.find(player => player.id === fixture.opponent)!.name;
  const other = viewGame(fixture.game, fixture.ecaz);
  other.decision = structuredClone(own.decision);
  assert.ok(ecazOccupyLeadOptions(other).every(choice => choice.blocked === `Only ${chooser} chooses the lead.`));
  assert.deepEqual(ecazOccupyPolicyActions(other), []);
  const html = renderToStaticMarkup(createElement(EcazOccupyLeadChoice, { game: own, busy: false, act() {} }));
  assert.ok(html.includes(chooser));
  assert.match(html, /chooses who forms the plan/);
  assert.match(html, /was at Low population when this battle opened/);
  assert.deepEqual(own, before);
});

void test('an original lead decision without the Low flag keeps its recorded chooser and ordinary explanation', () => {
  const fixture = ecazOccupyFixture({ allyFaction: 'guild', ecazForces: 3 });
  const own = viewGame(fixture.game, fixture.ecaz), before = structuredClone(own);
  assert.ok(ecazOccupyLeadOptions(own).every(choice => choice.blocked === null));
  const html = renderToStaticMarkup(createElement(EcazOccupyLeadChoice, { game: own, busy: false, act() {} }));
  assert.match(html, /chooses who forms the plan/);
  assert.doesNotMatch(html, /Low population/);
  assert.deepEqual(own, before);
});
