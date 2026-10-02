import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { MOBILE_LOCATION, MOBILE_STRONGHOLD, splitLocation, territory } from '../game/board';
import { treacheryDeck } from '../game/cards';
import { strongholdBenefit, strongholdControllers } from '../game/stronghold-cards';
import { quoteStrongholdFactionsBattle } from './fixture-stronghold-factions';
import { createTleilaxuStrongholdsFixture, finishTleilaxuStrongholdsTurn, tleilaxuStrongholdsPlayer as player, type TleilaxuStrongholdsFixture } from './fixture-tleilaxu-strongholds';

function at(game: Game, actor: string, site: string) {
  return Object.entries(player(game, actor).forces).filter(([key]) => splitLocation(key).territory === site).reduce((sum, [, count]) => sum + count, 0);
}
function replace(fixture: TleilaxuStrongholdsFixture, sources: Record<string, number>): Game {
  return applyAction(fixture.faceDance, fixture.tleilaxu, { type: 'decision', reveal: true, sources, sector: territory(fixture.kind).sectors[0] });
}
function returnedWinner(fixture: TleilaxuStrongholdsFixture, after: Game) {
  const before = player(fixture.faceDance, fixture.ix), winner = player(after, fixture.ix);
  const remaining = at(fixture.faceDance, fixture.ix, fixture.kind);
  const elite = Object.entries(before.elites!.forces).filter(([key]) => splitLocation(key).territory === fixture.kind).reduce((sum, [, count]) => sum + count, 0);
  assert.equal(at(after, fixture.ix, fixture.kind), 0);
  assert.equal(winner.reserves, before.reserves + remaining);
  assert.equal(winner.elites!.reserves, before.elites!.reserves + elite);
  assert.equal(winner.tanks, before.tanks, 'Face Dance returns survivors, not a second set of battle casualties');
  assert.equal(winner.elites!.tanks, before.elites!.tanks);
  assert.equal(winner.forces[fixture.pointer], before.forces[fixture.pointer], 'forces outside the HMS pointer are not inside its battle');
  assert.equal(winner.elites!.forces[fixture.pointer], before.elites!.forces[fixture.pointer]);
  assert.equal(winner.spice, before.spice, 'the Face Dancer leader earns no extra bounty or clawback');
  assert.deepEqual(winner.hand, before.hand, 'original winner keeps its actual physical battle cards');
  const leader = winner.leaders.find(l => l.id === fixture.winnerLeader)!;
  assert.equal(leader.dead, true); assert.equal(leader.deaths, before.leaders.find(l => l.id === fixture.winnerLeader)!.deaths + 1);
  assert.equal(after.lastBattleContext!.winner, fixture.ix);
  assert.deepEqual(after.strongholdCards, fixture.faceDance.strongholdCards);
  assert.equal(player(after, fixture.tleilaxu).faceDancers!.find(c => c.leader === fixture.winnerLeader)!.revealed, true);
}

void test('actual native Ix/Tleilaxu setup draws its matching Face Dancer and first END Mentat awards the Stronghold Cards', () => {
  const fixture = createTleilaxuStrongholdsFixture();
  assert.equal(fixture.afterSetup.advanced, true);
  assert.deepEqual(fixture.afterSetup.players.map(p => p.faction), ['ixians', 'tleilaxu', 'guild']);
  const cards = [...fixture.afterSetup.deck, ...fixture.afterSetup.discard, ...fixture.afterSetup.players.flatMap(p => p.hand)];
  assert.deepEqual(cards.map(c => c.id).sort(), treacheryDeck(fixture.afterSetup.expansions).map(c => c.id).sort());
  assert.equal(player(fixture.afterSetup, fixture.ix).elites!.forces[MOBILE_LOCATION], 3);
  assert.ok(player(fixture.afterSetup, fixture.tleilaxu).faceDancers!.some(c => c.leader === fixture.winnerLeader && !c.revealed), 'match came from actual first native draw');
  assert.equal(fixture.beforeFirstMentat.strongholdCards!.claimedTurn, 0);
  assert.ok(Object.values(fixture.beforeFirstMentat.strongholdCards!.owners).every(owner => owner === null));
  const claimed = applyAction(fixture.beforeFirstMentat, fixture.firstMentatStep.actor, fixture.firstMentatStep.action);
  assert.equal(claimed.turn, 2);
  assert.deepEqual(claimed.strongholdCards!.owners, strongholdControllers(fixture.beforeFirstMentat.players, true));
  assert.deepEqual(claimed.strongholdCards, fixture.afterFirstMentat.strongholdCards);
});

void test('original undealt CLI setup is not mutated, reinitialized or deterministically redealt', () => {
  const original = createTleilaxuStrongholdsFixture().initial, before = structuredClone(original);
  const fixture = createTleilaxuStrongholdsFixture({ initial: original });
  assert.deepEqual(original, before); assert.deepEqual(fixture.initial, before);
  assert.ok(player(fixture.faceDance, fixture.tleilaxu).faceDancers!.some(c => c.leader === fixture.winnerLeader && !c.revealed));
  assert.equal(fixture.faceDance.decision?.kind, 'faceDance');
});

void test('original winner receives native casualties, leader bounty, physical card choice and retained Tabr income before Face Dance', () => {
  for (const kind of ['sietch_tabr', MOBILE_STRONGHOLD] as const) {
    const fixture = createTleilaxuStrongholdsFixture({ kind });
    const quote = quoteStrongholdFactionsBattle(fixture.revealed);
    assert.equal(quote.winner, fixture.ix);
    assert.deepEqual(quote.strongholdIncome, [{ player: fixture.ix, amount: 1 }]);
    assert.deepEqual(quote.bounty, { player: fixture.ix, amount: player(fixture.revealed, fixture.opponent).leaders.find(l => l.id === fixture.loserLeader)!.strength });
    const original = player(fixture.revealed, fixture.ix), winner = player(fixture.faceDance, fixture.ix), losses = quote.casualties!.options[0];
    assert.equal(winner.tanks, original.tanks + losses.normal + losses.elite);
    assert.equal(winner.elites!.tanks, original.elites!.tanks + losses.elite);
    assert.equal(at(fixture.faceDance, fixture.ix, kind), 6 - losses.normal - losses.elite);
    assert.equal(winner.spice, original.spice - quote.payments.find(p => p.player === fixture.ix)!.ownPayment + quote.bounty!.amount + 1);
    assert.ok(winner.hand.some(c => c.id === fixture.weapon)); assert.ok(winner.hand.some(c => c.id === fixture.defense));
    assert.equal(player(fixture.faceDance, fixture.opponent).tanks, 6);
    assert.equal(player(fixture.faceDance, fixture.opponent).leaders.find(l => l.id === fixture.loserLeader)!.dead, true);
    assert.equal(winner.leaders.find(l => l.id === fixture.winnerLeader)!.dead, false);
    assert.equal(fixture.faceDance.decision?.kind, 'faceDance');
    assert.equal(fixture.faceDance.decision!.identity, fixture.winnerLeader);
    assert.deepEqual(fixture.faceDance.strongholdCards, fixture.beforeBattle.strongholdCards);
    if (kind === MOBILE_STRONGHOLD) assert.equal(fixture.revealed.battle!.strongholdCopy, 'sietch_tabr');
  }
});

void test('native replacement permits zero, partial and full quantities from actual reserves and board, without transferring cards mid-turn', () => {
  const fixture = createTleilaxuStrongholdsFixture(), maximum = at(fixture.faceDance, fixture.ix, fixture.kind);
  const board = `arrakeen:${territory('arrakeen').sectors[0]}`;
  const choices: Record<string, number>[] = [{}, { reserves: 1 }, { [board]: 2 }, { reserves: maximum - 2, [board]: 2 }];
  for (const sources of choices) {
    const after = replace(fixture, sources), total = Object.values(sources).reduce((sum, count) => sum + count, 0);
    returnedWinner(fixture, after);
    assert.equal(at(after, fixture.tleilaxu, fixture.kind), total);
    assert.equal(player(after, fixture.tleilaxu).reserves, player(fixture.faceDance, fixture.tleilaxu).reserves - (sources.reserves ?? 0));
    assert.equal(player(after, fixture.tleilaxu).forces[board], 3 - (sources[board] ?? 0));
    assert.equal(strongholdControllers(after.players, true)[fixture.kind], total ? fixture.tleilaxu : null);
    assert.equal(strongholdBenefit(after.strongholdCards, fixture.ix, fixture.kind), fixture.kind);
    assert.equal(strongholdBenefit(after.strongholdCards, fixture.tleilaxu, fixture.kind), null);
    const next = finishTleilaxuStrongholdsTurn(after);
    assert.equal(next.strongholdCards!.claimedTurn, after.turn);
    assert.equal(next.strongholdCards!.owners[fixture.kind], total ? fixture.tleilaxu : null);
    assert.equal(strongholdBenefit(next.strongholdCards, fixture.tleilaxu, fixture.kind), total ? fixture.kind : null);
  }
});

void test('HMS replacement returns inside subtypes only, leaving the outside pointer and copied benefit intact until END Mentat', () => {
  const fixture = createTleilaxuStrongholdsFixture({ kind: MOBILE_STRONGHOLD });
  const maximum = at(fixture.faceDance, fixture.ix, MOBILE_STRONGHOLD);
  const after = replace(fixture, { reserves: maximum }); returnedWinner(fixture, after);
  assert.equal(at(after, fixture.tleilaxu, MOBILE_STRONGHOLD), maximum);
  assert.equal(after.mobileStronghold!.location, fixture.pointer);
  assert.equal(player(after, fixture.ix).forces[fixture.pointer], 2);
  assert.equal(player(after, fixture.ix).elites!.forces[fixture.pointer], 1);
  assert.equal(after.strongholdCards!.owners[MOBILE_STRONGHOLD], fixture.ix);
  assert.equal(after.strongholdCards!.owners.sietch_tabr, fixture.ix);
  const next = finishTleilaxuStrongholdsTurn(after);
  assert.equal(next.strongholdCards!.owners[MOBILE_STRONGHOLD], fixture.tleilaxu);
  assert.equal(next.strongholdCards!.owners.sietch_tabr, fixture.ix);
});

void test('army cap and physical source availability reject illegal replacement without consuming the actual Face Dancer', () => {
  const fixture = createTleilaxuStrongholdsFixture(), before = structuredClone(fixture.faceDance);
  const maximum = at(before, fixture.ix, fixture.kind), board = `arrakeen:${territory('arrakeen').sectors[0]}`;
  for (const sources of [{ reserves: maximum + 1 }, { [board]: 4 }, { reserves: -1 }, { reserves: 0.5 }, { [fixture.location]: 1 }]) {
    assert.throws(() => replace(fixture, sources));
    assert.deepEqual(fixture.faceDance, before);
  }
});

void test('declining the genuine matching Face Dancer leaves the winner, leader and end-turn control unchanged', () => {
  const fixture = createTleilaxuStrongholdsFixture();
  const after = applyAction(fixture.faceDance, fixture.tleilaxu, { type: 'decision', reveal: false });
  assert.equal(at(after, fixture.ix, fixture.kind), at(fixture.faceDance, fixture.ix, fixture.kind));
  assert.equal(player(after, fixture.ix).leaders.find(l => l.id === fixture.winnerLeader)!.dead, false);
  assert.equal(player(after, fixture.tleilaxu).faceDancers!.find(c => c.leader === fixture.winnerLeader)!.revealed, false);
  assert.equal(finishTleilaxuStrongholdsTurn(after).strongholdCards!.owners[fixture.kind], fixture.ix);
});

void test('all four native policies execute the actual Stronghold Face Dance using legal physical sources', () => {
  for (const kind of ['sietch_tabr', MOBILE_STRONGHOLD] as const) {
    const fixture = createTleilaxuStrongholdsFixture({ kind });
    for (const level of DIFFICULTIES) {
      const view = viewGame(fixture.faceDance, fixture.tleilaxu); view.players.find(p => p.id === fixture.tleilaxu)!.bot = level;
      const action: Action | undefined = botActions(view).find(a => a.type === 'decision'); assert.ok(action);
      assert.equal(action.reveal, true);
      const sources = action.sources as Record<string, number>, count = Object.values(sources).reduce((sum, n) => sum + n, 0);
      assert.equal(count, at(fixture.faceDance, fixture.ix, kind));
      const after = applyAction(fixture.faceDance, fixture.tleilaxu, action); returnedWinner(fixture, after);
      assert.equal(at(after, fixture.tleilaxu, kind), count);
      assert.equal(finishTleilaxuStrongholdsTurn(after).strongholdCards!.owners[kind], fixture.tleilaxu);
    }
  }
});
