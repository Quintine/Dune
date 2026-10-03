import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, createGame, joinGame, newPlayer, normalizeAutomaticGame, viewGame, type Game } from '../game/engine';
import { DIFFICULTIES } from '../game/bot-profiles';
import { treacheryDeck } from '../game/cards';
import { STRONGHOLD_CARDS, strongholdControllers } from '../game/stronghold-cards';
import { assassinationPhysical } from './moritani-assassinate-fixture';
import { quoteStrongholdFactionsBattle } from './fixture-stronghold-factions';
import {
  advanceMoritaniStrongholds, createMoritaniStrongholdsFixture, holdMoritaniStrongholdsTraitor,
  moritaniStrongholdsPlayer as player, moritaniStrongholdsPolicy, nextMoritaniStrongholdsStep,
  resolveMoritaniStrongholdsBattle, stageMoritaniStrongholdsBattle,
} from './fixture-moritani-strongholds';

function custody(game: Game) {
  const cards = [...game.deck, ...game.discard, ...(game.auction?.cards.slice(game.auction.index) ?? []), ...game.players.flatMap(p => p.hand)].map(c => c.id).sort();
  assert.deepEqual(cards, treacheryDeck(['ecaz']).map(c => c.id).sort());
  assert.equal(new Set(cards).size, cards.length);
  for (const p of game.players) {
    assert.equal(p.reserves + p.tanks + Object.values(p.forces).reduce((sum, n) => sum + n, 0), 20);
    if (p.elites) assert.equal(p.elites.reserves + p.elites.tanks + Object.values(p.elites.forces).reduce((sum, n) => sum + n, 0), p.faction === 'emperor' ? 5 : 3);
  }
  const traitors = assassinationPhysical(game).traitors;
  assert.equal(new Set(traitors).size, traitors.length);
}
function revealAssassination(game: Game, card: string) {
  const d = game.decision; assert.equal(d?.kind, 'moritaniAssassinate');
  if (d?.kind !== 'moritaniAssassinate') throw Error('Original loss decision is required');
  return applyAction(game, d.player, { type: 'decision', event: d.event, card });
}
function finishBattle(game: Game) {
  return advanceMoritaniStrongholds(game, state => !state.battle && !state.decision && !state.response && !state.pendingTreacheryDiscard);
}

void test('standalone native Advanced Moritani preserves authenticated seats, exact ecaz deck and six real first-Mentat card claims', () => {
  let lobby = createGame('AUTHMORITANI', newPlayer('authenticated-m', 'Original Moritani', 'moritani'), true, ['ecaz']);
  joinGame(lobby, newPlayer('authenticated-g', 'Original Guild', 'guild'));
  joinGame(lobby, newPlayer('authenticated-e', 'Original Emperor', 'emperor'));
  for (const p of lobby.players) lobby = applyAction(lobby, p.id, { type: 'ready' });
  const original = structuredClone(lobby), f = createMoritaniStrongholdsFixture({ initial: lobby });
  assert.deepEqual(lobby, original);
  assert.deepEqual(f.afterSetup.players.map(p => ({ id: p.id, name: p.name, faction: p.faction })), original.players.map(p => ({ id: p.id, name: p.name, faction: p.faction })));
  for (const game of [f.initial, f.afterSetup, f.afterFirstMentat, f.pending]) custody(game);
  assert.equal(f.afterSetup.leaderSkills, undefined);
  assert.equal(f.afterSetup.players.some(p => p.faction === 'ecaz' || p.faction === 'harkonnen'), false);
  assert.equal(f.initial.strongholdCards!.claimedTurn, 0);
  assert.deepEqual(Object.keys(f.initial.strongholdCards!.owners), STRONGHOLD_CARDS.map(c => c.id));
  assert.ok(Object.values(f.initial.strongholdCards!.owners).every(id => id === null));
  assert.equal(f.beforeFirstMentat.phase, 8);
  const claimed = applyAction(structuredClone(f.beforeFirstMentat), f.firstMentatStep.actor, f.firstMentatStep.action);
  assert.equal(claimed.turn, 2);
  assert.deepEqual(claimed.strongholdCards, f.afterFirstMentat.strongholdCards);
  assert.deepEqual(claimed.strongholdCards!.owners, strongholdControllers(f.beforeFirstMentat.players, false));
  assert.deepEqual(f.pending.strongholdCards, claimed.strongholdCards, 'A real loss retains recorded cards until the next end-Mentat checkpoint');
  assert.equal(f.pending.strongholdCards!.owners.tueks_sietch, f.moritani);
  assert.equal(strongholdControllers(f.pending.players, false).tueks_sietch, f.opponent);
});

void test('Tuek pays its actual losing holder for both played Worthless cards, then original assassination pays one printed bounty and one private next-Mentat replacement', () => {
  const f = createMoritaniStrongholdsFixture(), pending = f.pending;
  assert.equal(pending.decision?.kind, 'moritaniAssassinate');
  assert.equal(pending.lastBattleContext?.winner, f.opponent);
  const quote = quoteStrongholdFactionsBattle(f.revealed);
  assert.deepEqual(quote.strongholdIncome, [{ player: f.moritani, amount: 4 }]);
  assert.equal(quote.bounty?.amount ?? 0, 0);
  const moritaniBefore = player(f.revealed, f.moritani).spice, opponentBefore = player(f.revealed, f.opponent).spice;
  assert.equal(player(pending, f.moritani).spice, moritaniBefore - 1 + 4, 'Native wallet minus one actual support plus two printed two-spice Worthless payouts');
  assert.equal(player(pending, f.opponent).spice, opponentBefore - 3, 'The unheld winner Worthless card earns no Tuek payout');
  assert.equal(player(pending, f.moritani).leaders.find(l => l.id === f.moritaniLeader)!.dead, false);
  assert.equal(player(pending, f.opponent).leaders.find(l => l.id === f.opponentLeader)!.dead, false);
  const target = structuredClone(player(pending, f.opponent).leaders.find(l => l.id === f.target)!);
  assert.notEqual(target.id, f.opponentLeader);
  assert.equal(target.dead, false);
  const physical = assassinationPhysical(pending), reserve = [...pending.traitorReserve!], held = [...player(pending, f.moritani).traitors];
  const deaths = pending.players.flatMap(p => p.leaders).map(l => ({ id: l.id, deaths: l.deaths }));
  const tanks = pending.players.map(p => ({ id: p.id, tanks: p.tanks, elites: p.elites?.tanks }));
  let game = revealAssassination(structuredClone(pending), f.target);
  assert.equal(player(game, f.moritani).spice, moritaniBefore - 1 + 4 + target.strength);
  assert.equal(player(game, f.opponent).spice, opponentBefore - 3);
  assert.equal(player(game, f.opponent).leaders.find(l => l.id === f.target)!.deaths, target.deaths + 1);
  assert.equal(game.moritaniAssassinate!.opportunities.at(-1)!.bounty, target.strength);
  assert.equal(game.moritaniAssassinate!.opportunities.at(-1)!.stage, 'revealed');
  assert.deepEqual(game.traitorReserve, reserve);
  assert.deepEqual(player(game, f.moritani).traitors, held, 'Revealed physical card remains held until original Mentat replacement');
  assert.equal(game.decision?.kind, 'battleCards', 'Original saved winner-card cleanup resumes after reveal');
  assert.equal(game.decision?.player, f.opponent);
  game = applyAction(game, f.opponent, { type: 'decision', discard: f.opponentCards });
  game = finishBattle(game);
  for (const card of [...f.moritaniCards, ...f.opponentCards]) assert.equal(game.discard.filter(c => c.id === card).length, 1);
  assert.deepEqual(normalizeAutomaticGame(structuredClone(game)), game);
  game = advanceMoritaniStrongholds(game, state => state.phase === 8);
  const receipt = game.moritaniAssassinate!.opportunities.at(-1)!;
  assert.equal(receipt.stage, 'replaced');
  assert.equal(receipt.replacement, reserve[0]);
  assert.deepEqual(game.traitorReserve, reserve.slice(1));
  assert.deepEqual(player(game, f.moritani).traitors, [...held.filter(id => id !== f.target), reserve[0]]);
  assert.equal(game.players.flatMap(p => p.traitors).includes(f.target), false);
  assert.equal(game.traitorReserve!.includes(f.target), false);
  assert.equal(player(game, f.moritani).spice, moritaniBefore - 1 + 4 + target.strength, 'Neither support debit, Stronghold income nor printed assassination bounty replays');
  assert.deepEqual(game.players.map(p => ({ id: p.id, tanks: p.tanks, elites: p.elites?.tanks })),
    tanks.map(entry => entry.id === f.opponent ? { ...entry, tanks: entry.tanks + 3 } : entry),
    'Original winning Guild dial3 casualties finish after assassination and winner-card cleanup, once only');
  for (const old of deaths) assert.equal(game.players.flatMap(p => p.leaders).find(l => l.id === old.id)!.deaths, old.deaths + (old.id === f.target ? 1 : 0));
  assert.deepEqual(assassinationPhysical(game), physical);
  const rivalReceipt = viewGame(game, f.opponent).moritaniAssassinate!.history.at(-1)!;
  assert.equal(rivalReceipt.card, f.target);
  assert.equal('replacement' in rivalReceipt, false);
  custody(game);
  const suffix = advanceMoritaniStrongholds(structuredClone(game), state => state.turn === 3);
  assert.equal(suffix.traitorReserve!.length, reserve.length - 1, 'End-Mentat card claim does not draw a second replacement');
  assert.equal(player(suffix, f.moritani).spice, player(game, f.moritani).spice);
  assert.equal(suffix.strongholdCards!.claimedTurn, 2);
  assert.equal(suffix.strongholdCards!.owners.tueks_sietch, f.opponent);
  assert.deepEqual(Object.keys(suffix.strongholdCards!.owners), STRONGHOLD_CARDS.map(c => c.id));
});

void test('Tuek follows the actual holder, including a winning Guild plan, rather than paying every native participant', () => {
  const f = createMoritaniStrongholdsFixture({ holder: 'guild' });
  const quote = quoteStrongholdFactionsBattle(f.revealed);
  assert.deepEqual(quote.strongholdIncome, [{ player: f.opponent, amount: 2 }]);
  assert.equal(player(f.pending, f.moritani).spice, player(f.revealed, f.moritani).spice - 1);
  assert.equal(player(f.pending, f.opponent).spice, player(f.revealed, f.opponent).spice - 3 + 2);
  assert.equal(f.pending.decision?.kind, 'moritaniAssassinate');
  assert.equal(player(f.pending, f.moritani).leaders.find(l => l.id === f.moritaniLeader)!.dead, false);
  custody(f.pending);
});

void test('Carthag gives the native holder-plan Shield its printed Snooper property, preserving an ordinary losing Moritani leader with no invented death bounty', () => {
  const f = createMoritaniStrongholdsFixture({ kind: 'carthag' });
  assert.equal(f.pending.lastBattleContext?.winner, f.opponent);
  assert.equal(f.pending.decision?.kind, 'moritaniAssassinate');
  assert.equal(player(f.pending, f.moritani).leaders.find(l => l.id === f.moritaniLeader)!.dead, false);
  assert.equal(player(f.pending, f.opponent).leaders.find(l => l.id === f.opponentLeader)!.dead, false);
  assert.equal(quoteStrongholdFactionsBattle(f.revealed).bounty?.amount ?? 0, 0);
  assert.equal(player(f.pending, f.moritani).spice, player(f.revealed, f.moritani).spice - 1);
  assert.equal(player(f.pending, f.opponent).spice, player(f.revealed, f.opponent).spice - 3);
  const declared = f.pending.decision!;
  let declined = applyAction(f.pending, f.moritani, { type: 'decision', event: declared.kind === 'moritaniAssassinate' ? declared.event : '', decline: true });
  declined = finishBattle(declined);
  assert.equal(declined.moritaniAssassinate!.opportunities.at(-1)!.stage, 'declined');
  assert.equal(player(declined, f.moritani).leaders.find(l => l.id === f.moritaniLeader)!.dead, false);
  custody(declined);
  const unheld = createMoritaniStrongholdsFixture({ kind: 'carthag', holder: 'guild' });
  const killed = player(unheld.pending, unheld.moritani).leaders.find(l => l.id === unheld.moritaniLeader)!;
  assert.equal(killed.dead, true, 'Opponent card custody does not lend Snooper coverage to the losing Shield plan');
  assert.equal(player(unheld.pending, unheld.opponent).spice, player(unheld.revealed, unheld.opponent).spice - 3 + killed.strength, 'An actual poison death, unlike mere defeat, pays its printed bounty');
  custody(unheld.pending);
});

void test('a native normal Traitor reveal forfeits assassination across the actual next turn and a different classic opposing faction', () => {
  const f = createMoritaniStrongholdsFixture({ normalCall: true });
  assert.equal(f.pending.lastBattleContext?.winner, f.moritani);
  assert.equal(f.pending.moritaniAssassinate!.normalTraitorCall, true);
  assert.equal(f.pending.moritaniAssassinate!.opportunities.length, 0);
  assert.equal(player(f.pending, f.opponent).leaders.find(l => l.id === f.opponentLeader)!.dead, true);
  let game = advanceMoritaniStrongholds(f.pending, state => state.turn === 3 && state.phase === 5 && !state.phaseOpening && !state.response && !state.decision);
  const emperor = game.players.find(p => p.faction === 'emperor')!.id;
  stageMoritaniStrongholdsBattle(game, f.moritani, emperor, 'tueks_sietch');
  const loser = player(game, f.moritani).leaders.filter(l => !l.dead).sort((a, b) => a.strength - b.strength)[0];
  const winner = player(game, emperor).leaders.filter(l => !l.dead).sort((a, b) => b.strength - a.strength)[0];
  const target = player(game, emperor).leaders.find(l => !l.dead && l.id !== winner.id)!;
  holdMoritaniStrongholdsTraitor(game, f.moritani, target.id);
  game = advanceMoritaniStrongholds(game, state => state.phase === 6 && !state.phaseOpening && !state.response && !state.decision);
  const actor = game.active!; assert.ok([f.moritani, emperor].includes(actor));
  game = applyAction(game, actor, { type: 'chooseBattle', territory: 'tueks_sietch', target: actor === f.moritani ? emperor : f.moritani });
  game = advanceMoritaniStrongholds(game, state => !!state.battle && !state.battle.revealed && !nextMoritaniStrongholdsStep(state));
  game = applyAction(game, f.moritani, { type: 'battlePlan', leader: loser.id, dial: 0, support: 0 });
  game = applyAction(game, emperor, { type: 'battlePlan', leader: winner.id, dial: 2, support: 2 });
  game = resolveMoritaniStrongholdsBattle(game, f.moritani);
  assert.equal(game.lastBattleContext?.winner, emperor);
  assert.equal(game.moritaniAssassinate!.normalTraitorCall, true);
  assert.equal(game.moritaniAssassinate!.opportunities.length, 0);
  assert.notEqual(game.decision?.kind, 'moritaniAssassinate');
  assert.equal(player(game, emperor).leaders.find(l => l.id === target.id)!.dead, false);
  assert.equal(player(game, f.moritani).leaders.find(l => l.id === loser.id)!.dead, false);
  custody(game);
});

void test('all four minimal native policies perform original Terror choices and loss reveal/decline without a Terror fee or premature card transfer', () => {
  const f = createMoritaniStrongholdsFixture();
  for (const difficulty of DIFFICULTIES) {
    const placement = moritaniStrongholdsPolicy(f.beforePlacement, f.moritani, difficulty).find(a => a.type === 'decision'); assert.ok(placement);
    const placed = applyAction(structuredClone(f.beforePlacement), f.moritani, placement);
    assert.deepEqual(placed.players.map(p => ({ id: p.id, spice: p.spice })), f.beforePlacement.players.map(p => ({ id: p.id, spice: p.spice })), 'Printed Terror placement has no fee');
    assert.deepEqual(placed.strongholdCards, f.beforePlacement.strongholdCards);
    const action = moritaniStrongholdsPolicy(f.pending, f.moritani, difficulty)[0]; assert.ok(action);
    const revealed = applyAction(structuredClone(f.pending), f.moritani, action);
    assert.equal(revealed.moritaniAssassinate!.opportunities.at(-1)!.stage, 'revealed');
    assert.equal(revealed.moritaniAssassinate!.opportunities.at(-1)!.card, f.target);
    // Private eligibility is varied by a conserved swap before actual plan
    // submission, never by modifying an original assassination receipt.
    let empty = structuredClone(f.game);
    holdMoritaniStrongholdsTraitor(empty, f.moritani, player(empty, f.moritani).leaders[0].id);
    for (const plan of f.planActions) empty = applyAction(empty, plan.actor, plan.action);
    empty = resolveMoritaniStrongholdsBattle(empty, f.moritani);
    const decline = moritaniStrongholdsPolicy(empty, f.moritani, difficulty)[0]; assert.ok(decline);
    const declined = applyAction(empty, f.moritani, decline);
    assert.equal(declined.moritaniAssassinate!.opportunities.at(-1)!.stage, 'declined');
    custody(placed); custody(revealed); custody(declined);
  }
});
