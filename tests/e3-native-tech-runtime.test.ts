import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction, createGame, initializeFactionExpansionsGameForAudit,
  initializeStrongholdFactionsGameForAudit, joinGame, newPlayer, viewGame, type Game,
} from '../game/engine';
import type { FactionId } from '../game/catalog';
import { treacheryDeck } from '../game/cards';
import { createTechTokens, ownedTech } from '../game/tech-tokens';
import { quoteBattleResolution, type ResolutionCombatant } from '../game/battle-resolution-quote';
import { quoteSpiceCollection } from '../game/board-resolution-quote';
import { strongholdControllers } from '../game/stronghold-cards';
import { finishEcazOccupySetup } from './fixture-ecaz-occupy';
import { advanceEcazStronghold, ecazStrongholdSeat as player, finishEcazStronghold } from './fixture-ecaz-strongholds';
import {
  advanceMoritaniStrongholds, holdMoritaniStrongholdsTraitor, nextMoritaniStrongholdsStep,
  resolveMoritaniStrongholdsBattle, stageMoritaniStrongholdsBattle,
} from './fixture-moritani-strongholds';
import { quoteStrongholdFactionsBattle } from './fixture-stronghold-factions';
import {
  createEcazNativeTechFixture, createMoritaniNativeTechFixture,
  initializeE3NativeTechSetup, revealEcazNativeTechBattle,
} from './fixture-e3-native-tech';

function lobby(roster: FactionId[], advanced = true, expansions: Game['expansions'] = ['ecaz']): Game {
  let game = createGame('E3TECHGUARD', newPlayer(`auth-${roster[0]}`, roster[0], roster[0]), advanced, expansions);
  for (const faction of roster.slice(1)) joinGame(game, newPlayer(`auth-${faction}`, faction, faction));
  game.techTokens = createTechTokens();
  for (const p of game.players) game = applyAction(game, p.id, { type: 'ready' });
  return game;
}
function physical(game: Game): void {
  const cards = [...game.deck, ...game.discard, ...(game.auction?.cards.slice(game.auction.index) ?? []),
    ...game.players.flatMap(p => p.hand)].map(c => c.id).sort();
  assert.deepEqual(cards, treacheryDeck(['ecaz']).map(c => c.id).sort(), 'Every original selected physical card retains one custodian.');
  assert.equal(new Set(cards).size, cards.length);
  for (const p of game.players) {
    assert.equal(p.reserves + p.tanks + Object.values(p.forces).reduce((sum, n) => sum + n, 0), 20);
    if (p.elites) assert.equal(p.elites.reserves + p.elites.tanks + Object.values(p.elites.forces).reduce((sum, n) => sum + n, 0),
      p.faction === 'emperor' ? 5 : 3);
  }
  assert.equal(Object.keys(game.techTokens!).length, 3);
  for (const token of Object.values(game.techTokens!))
    assert.ok(token.owner === null || game.players.some(p => p.id === token.owner));
  const moritani = game.players.find(p => p.faction === 'moritani');
  if (moritani) {
    assert.equal(moritani.leaders.length, 5, 'The five original Moritani leader discs remain physically present.');
    assert.equal(new Set(moritani.leaders.map(l => l.id)).size, 5);
    assert.equal(game.moritaniTerror!.tokens.length, 6);
    assert.equal(new Set(game.moritaniTerror!.tokens.map(t => t.id)).size, 6);
    const traitors = [...game.players.flatMap(p => p.traitors), ...(game.traitorReserve ?? []),
      ...(game.ecazLoyalty?.card ? [game.ecazLoyalty.card] : []),
      ...(game.moritaniAssassinate?.opportunities.flatMap(o => o.stage === 'replaced' && o.card ? [o.card] : []) ?? [])];
    assert.equal(new Set(traitors).size, traitors.length, 'Held, replacement-reserve and revealed spent Traitors have distinct physical custody.');
  }
}

for (const native of ['ecaz', 'moritani'] as const) for (const advanced of [false, true])
  for (const seats of [3, 6]) void test(`${advanced ? 'Advanced' : 'Basic'} standalone ${native} plain Tech: ${seats} original seats complete real setup and receive three first-Storm tokens`, () => {
    const roster: FactionId[] = [native, 'guild', 'emperor', 'atreides', 'fremen', 'beneGesserit'].slice(0, seats) as FactionId[];
    const admitted = lobby(roster, advanced);
    const setup = initializeE3NativeTechSetup({ initial: admitted, native, advanced });
    let game = finishEcazOccupySetup(setup);
    const actor = game.players.find(p => p.faction === native)!;
    assert.equal(actor.id, `auth-${native}`);
    physical(game);
    game = advanceMoritaniStrongholds(game, g => g.phase === 2 && !g.phaseOpening && !g.response && !g.decision);
    const owners = Object.values(game.techTokens!).map(token => token.owner);
    assert.ok(owners.every(owner => typeof owner === 'string' && game.players.some(p => p.id === owner)));
    assert.equal(new Set(owners).size, 3, 'Actual first-Storm order supplies unassigned tokens to three distinct seats.');
    physical(game);
  });


for (const strongholds of [false, true]) for (const lead of ['ecaz', 'ally'] as const)
  void test(`Advanced standalone Ecaz ${strongholds ? 'Stronghold+Tech' : 'plain Tech'}: selected ${lead} earns only the enemy token after original holder reward and typed owner casualties`, () => {
    const f = createEcazNativeTechFixture({ strongholds });
    const result = revealEcazNativeTechBattle(f, lead, true);
    const { before, revealed, pending, actor } = result;
    const battle = revealed.battle!, publicBattle = viewGame(revealed, actor).battle!;
    const side = (id: string): ResolutionCombatant => {
      const p = player(revealed, id), view = viewGame(revealed, id).battle!;
      assert.ok(view.ownForces);
      return { id, faction: p.faction, ally: p.ally, spice: p.spice, hand: p.hand,
        plan: battle.plans[id], leader: p.leaders.find(l => l.id === battle.plans[id].leader),
        forces: view.ownForces, stronghold: view.strongholdEffects[id] };
    };
    const quote = quoteBattleResolution({ advanced: true, turn: revealed.turn, territory: f.territory,
      ecazOccupy: publicBattle.ecazOccupy!.profile!, aggressor: publicBattle.aggressor,
      attacker: side(battle.attacker), defender: side(battle.defender),
      voters: publicBattle.traitorVoters.map(id => ({ id, called: false, traitors: player(revealed, id).traitors,
        beneficiary: [battle.attacker, battle.defender].includes(id) ? id : actor })),
      participants: revealed.players, physicalCards: [...revealed.deck, ...revealed.discard, ...revealed.players.flatMap(p => p.hand)],
      pendingAuditorPresent: false, pendingRetentionPresent: false });
    assert.deepEqual(quote.fixedLosses, [{ owner: f.ecaz, normal: 3, elite: 0 }]);
    assert.equal(quote.casualties!.owner, f.ally, 'The Guild variable army owns its losses even when Ecaz seals the winning plan.');
    assert.deepEqual(quote.casualties!.options, [{ normal: 3, elite: 0,
      paidNormal: battle.plans[actor].support, paidElite: 0 }]);
    const income = strongholds && lead === 'ecaz' ? 2 : 0;
    assert.deepEqual(quote.strongholdIncome, income ? [{ player: actor, amount: income }] : []);
    const payment = quote.payments.find(p => p.player === actor)!;
    assert.equal(player(pending, actor).spice, player(before, actor).spice - payment.ownPayment + income);
    assert.equal(pending.decision?.player, actor);
    const enemyToken = ownedTech(before.techTokens, f.opponent);
    assert.equal(enemyToken.length, 1);
    assert.equal(pending.techTokens![enemyToken[0]].owner, f.opponent,
      'Stronghold reward is already paid while actual winner-card cleanup still precedes Tech custody.');
    const game = finishEcazStronghold(pending), nonLead = lead === 'ecaz' ? f.ally : f.ecaz;
    assert.equal(game.lastBattleContext!.winner, actor);
    assert.equal(game.techTokens![enemyToken[0]].owner, actor);
    assert.equal(ownedTech(game.techTokens, actor).length, 2);
    assert.equal(ownedTech(game.techTokens, nonLead).length, 1);
    assert.equal(ownedTech(game.techTokens, f.opponent).length, 0);
    assert.equal(player(game, f.ecaz).tanks - player(before, f.ecaz).tanks, 3);
    assert.equal(player(game, f.ally).tanks - player(before, f.ally).tanks, 3);
    assert.equal(player(game, f.opponent).tanks - player(before, f.opponent).tanks, 8);
    assert.equal(player(game, f.ecaz).forces[f.location], 2);
    assert.equal(player(game, f.ally).forces[f.location], 1);
    const progress = viewGame(game, actor).victoryProgress.find(p => p.player === actor)!;
    assert.equal(progress.strongholds.length, 3);
    assert.equal(progress.jointlyOccupied.length, 1);
    assert.equal(progress.techStronghold, false, 'Two plus one allied tokens do not produce a joint third-token stronghold.');
    assert.equal(progress.qualifies, false);
    physical(game);
    const collection = quoteSpiceCollection(game).receipts.find(p => p.player === actor)!;
    const nextTurn = advanceEcazStronghold(game, g => g.turn === 4 && g.phase === 0);
    assert.equal(nextTurn.status, 'playing', 'Original end-Mentat does not infer an allied three-token victory.');
    assert.deepEqual(nextTurn.winner, []);
    assert.equal(player(nextTurn, actor).spice, player(pending, actor).spice + collection.strongholds + collection.collected,
      'Only actual native Collection follows the completed reward; the earlier Stronghold battle income does not replay.');
  });

for (const lead of ['ecaz', 'ally'] as const)
  void test(`Basic plain Tech Ecaz ${lead}: even original coalition pays no support and attributes the token to its actual selected lead`, () => {
    const f = createEcazNativeTechFixture({ advanced: false });
    const result = revealEcazNativeTechBattle(f, lead);
    const token = ownedTech(result.before.techTokens, f.opponent)[0];
    assert.equal(player(result.pending, result.actor).spice, player(result.before, result.actor).spice);
    const game = finishEcazStronghold(result.pending);
    assert.equal(game.techTokens![token].owner, result.actor);
    assert.equal(player(game, f.ecaz).forces[f.location], 2);
    assert.equal(player(game, f.ally).forces[f.location], 1);
    assert.equal(player(game, f.ecaz).tanks - player(result.before, f.ecaz).tanks, 2);
    assert.equal(player(game, f.ally).tanks - player(result.before, f.ally).tanks, 3);
    physical(game);
  });

void test('Basic native Tech Ecaz admits odd forces with provisional ceiling losses and floor survivors', () => {
  const f = createEcazNativeTechFixture({ advanced: false, ecazForces: 3, chooseBattle: false });
  const admitted = applyAction(f.game, f.battleAction.actor, f.battleAction.action);
  assert.ok(admitted.battle);
  assert.equal(admitted.decision?.kind, 'ecazBattleLead');
  physical(admitted);
  for (const lead of ['ecaz', 'ally'] as const) {
    const result = revealEcazNativeTechBattle({ ...f, game: admitted }, lead);
    const { before, revealed, pending, actor } = result;
    const battle = revealed.battle!, publicBattle = viewGame(revealed, actor).battle!;
    const profile = publicBattle.ecazOccupy!.profile!;
    assert.equal(profile.ecazForces.normal, 3);
    assert.equal(profile.fixedEcazDial, Math.ceil(3 / 2));
    assert.equal(profile.planOwner, actor);
    assert.equal(profile.payer, actor);
    assert.equal(profile.forceOwner, f.ally);
    const side = (id: string): ResolutionCombatant => {
      const p = player(revealed, id), view = viewGame(revealed, id).battle!;
      assert.ok(view.ownForces);
      return { id, faction: p.faction, ally: p.ally, spice: p.spice, hand: p.hand,
        plan: battle.plans[id], leader: p.leaders.find(l => l.id === battle.plans[id].leader),
        forces: view.ownForces, stronghold: view.strongholdEffects[id] };
    };
    const quote = quoteBattleResolution({ advanced: false, turn: revealed.turn, territory: f.territory,
      ecazOccupy: profile, aggressor: publicBattle.aggressor,
      attacker: side(battle.attacker), defender: side(battle.defender),
      voters: publicBattle.traitorVoters.map(id => ({ id, called: false, traitors: player(revealed, id).traitors,
        beneficiary: [battle.attacker, battle.defender].includes(id) ? id : actor })),
      participants: revealed.players, physicalCards: [...revealed.deck, ...revealed.discard, ...revealed.players.flatMap(p => p.hand)],
      pendingAuditorPresent: false, pendingRetentionPresent: false });
    assert.equal(quote.winner, actor);
    assert.deepEqual(quote.fixedLosses, [{ owner: f.ecaz, normal: Math.ceil(3 / 2), elite: 0 }]);
    assert.equal(quote.casualties!.owner, f.ally);
    assert.deepEqual(quote.casualties!.options, [{ normal: 3, elite: 0, paidNormal: 0, paidElite: 0 }]);
    assert.ok(quote.payments.every(payment => payment.ownPayment === 0));
    assert.deepEqual(quote.strongholdIncome, []);
    assert.equal(player(pending, actor).spice, player(before, actor).spice);
    const token = ownedTech(before.techTokens, f.opponent)[0]; assert.ok(token);
    assert.equal(pending.techTokens![token].owner, f.opponent, 'Winner-card cleanup still precedes Tech transfer.');
    const game = finishEcazStronghold(pending), nonLead = actor === f.ecaz ? f.ally : f.ecaz;
    assert.equal(game.lastBattleContext!.winner, actor);
    assert.equal(game.techTokens![token].owner, actor);
    assert.equal(ownedTech(game.techTokens, actor).length, 2);
    assert.equal(ownedTech(game.techTokens, nonLead).length, 1);
    assert.equal(ownedTech(game.techTokens, f.opponent).length, 0);
    assert.equal(player(game, f.ecaz).tanks - player(before, f.ecaz).tanks, Math.ceil(3 / 2));
    assert.equal(player(game, f.ecaz).forces[f.location], Math.floor(3 / 2));
    assert.equal(player(game, f.ally).tanks - player(before, f.ally).tanks, 3);
    assert.equal(player(game, f.ally).forces[f.location], 1);
    assert.equal(player(game, f.opponent).tanks - player(before, f.opponent).tanks, 8);
    physical(game);
  }
});

for (const strongholds of [false, true])
  void test(`Advanced Moritani ${strongholds ? 'Stronghold+Tech' : 'plain Tech'}: loss retains original effects, assassination pays one bounty, actual winner earns Tech, and Mentat replaces one held Traitor`, () => {
    const f = createMoritaniNativeTechFixture({ strongholds });
    assert.equal(f.afterSetup.players.find(p => p.id === f.moritani)!.leaders.length, 5);
    assert.equal(f.afterPlacement.moritaniTerror!.tokens.filter(t => t.status === 'available').length, 5);
    assert.equal(f.afterPlacement.moritaniTerror!.tokens.filter(t => t.status === 'placed').length, 1);
    const discs = f.afterPlacement.moritaniTerror!.tokens.map(t => ({ ...t }));
    const pending = f.pending, quote = quoteStrongholdFactionsBattle(f.revealed);
    assert.equal(pending.decision?.kind, 'moritaniAssassinate');
    assert.equal(pending.lastBattleContext!.winner, f.opponent);
    const income = strongholds ? 4 : 0;
    assert.deepEqual(quote.strongholdIncome, income ? [{ player: f.moritani, amount: income }] : []);
    assert.equal(player(pending, f.moritani).spice, player(f.revealed, f.moritani).spice - 1 + income);
    assert.equal(player(pending, f.opponent).spice, player(f.revealed, f.opponent).spice - 3);
    if (strongholds) {
      assert.equal(pending.strongholdCards!.owners.tueks_sietch, f.moritani);
      assert.equal(strongholdControllers(pending.players, false).tueks_sietch, f.opponent);
    }
    const token = ownedTech(pending.techTokens, f.moritani)[0];
    assert.ok(token);
    const target = player(pending, f.opponent).leaders.find(l => l.id === f.target)!;
    const held = [...player(pending, f.moritani).traitors], reserve = [...pending.traitorReserve!];
    const decision = pending.decision;
    assert.ok(decision?.kind === 'moritaniAssassinate');
    let game = applyAction(pending, f.moritani, { type: 'decision', event: decision.event, card: f.target });
    const paid = player(game, f.moritani).spice;
    assert.equal(paid, player(pending, f.moritani).spice + target.strength);
    assert.equal(player(game, f.opponent).leaders.find(l => l.id === f.target)!.deaths, target.deaths + 1);
    assert.deepEqual(player(game, f.moritani).traitors, held, 'Revealed original physical Traitor remains held until Mentat.');
    assert.equal(game.techTokens![token].owner, f.moritani);
    assert.equal(game.decision?.kind, 'battleCards');
    game = applyAction(game, f.opponent, { type: 'decision', discard: f.opponentCards });
    game = advanceMoritaniStrongholds(game, g => !g.battle && !g.response && !g.decision && !g.pendingTreacheryDiscard);
    assert.equal(game.techTokens![token].owner, f.opponent);
    assert.equal(ownedTech(game.techTokens, f.opponent).length, 2);
    assert.equal(ownedTech(game.techTokens, f.moritani).length, 0);
    assert.equal(player(game, f.moritani).tanks - player(f.revealed, f.moritani).tanks, 6);
    assert.equal(player(game, f.opponent).tanks - player(f.revealed, f.opponent).tanks, 3);
    assert.equal(player(game, f.moritani).spice, paid);
    assert.deepEqual(game.moritaniTerror!.tokens, discs, 'Original assassination does not consume a Terror disc.');
    for (const card of [...f.moritaniCards, ...f.opponentCards]) assert.equal(game.discard.filter(c => c.id === card).length, 1);
    physical(game);
    game = advanceMoritaniStrongholds(game, g => g.phase === 8);
    const receipt = game.moritaniAssassinate!.opportunities.at(-1)!;
    assert.equal(receipt.stage, 'replaced'); assert.equal(receipt.bounty, target.strength);
    assert.equal(receipt.replacement, reserve[0]);
    assert.deepEqual(game.traitorReserve, reserve.slice(1));
    assert.deepEqual(player(game, f.moritani).traitors, [...held.filter(id => id !== f.target), reserve[0]]);
    assert.equal(player(game, f.moritani).spice, paid, 'Neither Stronghold income nor bounty replays at Mentat.');
    const rival = viewGame(game, f.opponent).moritaniAssassinate!.history.at(-1)!;
    assert.equal(rival.card, f.target); assert.equal('replacement' in rival, false);
    game = advanceMoritaniStrongholds(game, g => g.turn === 3 && g.phase === 0);
    assert.equal(game.traitorReserve!.length, reserve.length - 1);
    assert.equal(player(game, f.moritani).spice, paid);
    assert.equal(game.techTokens![token].owner, f.opponent);
    if (strongholds) assert.equal(game.strongholdCards!.owners.tueks_sietch, f.opponent);
    physical(game);
  });

for (const strongholds of [false, true])
  void test(`Advanced Moritani ${strongholds ? 'Stronghold+Tech' : 'plain Tech'}: genuine normal Traitor call forfeits the later original loss assassination across turns`, () => {
    const f = createMoritaniNativeTechFixture({ strongholds, normalCall: true });
    assert.equal(f.pending.lastBattleContext!.winner, f.moritani);
    assert.equal(f.pending.moritaniAssassinate!.normalTraitorCall, true);
    assert.equal(f.pending.moritaniAssassinate!.opportunities.length, 0);
    assert.equal(player(f.pending, f.opponent).leaders.find(l => l.id === f.opponentLeader)!.dead, true);
    assert.equal(ownedTech(f.pending.techTokens, f.moritani).length, 2);
    let game = advanceMoritaniStrongholds(f.pending, g => g.turn === 3 && g.phase === 5 && !g.response && !g.phaseOpening && !g.decision);
    const emperor = game.players.find(p => p.faction === 'emperor')!.id;
    stageMoritaniStrongholdsBattle(game, f.moritani, emperor, 'tueks_sietch');
    const loser = player(game, f.moritani).leaders.filter(l => !l.dead).sort((a, b) => a.strength - b.strength)[0];
    const winner = player(game, emperor).leaders.filter(l => !l.dead).sort((a, b) => b.strength - a.strength)[0];
    const target = player(game, emperor).leaders.find(l => !l.dead && l.id !== winner.id)!;
    holdMoritaniStrongholdsTraitor(game, f.moritani, target.id);
    const tokens = ownedTech(game.techTokens, f.moritani), reserve = [...game.traitorReserve!];
    game = advanceMoritaniStrongholds(game, g => g.phase === 6 && !g.response && !g.phaseOpening && !g.decision);
    const actor = game.active!;
    assert.ok([f.moritani, emperor].includes(actor));
    game = applyAction(game, actor, { type: 'chooseBattle', territory: 'tueks_sietch', target: actor === f.moritani ? emperor : f.moritani });
    game = advanceMoritaniStrongholds(game, g => !!g.battle && !g.battle.revealed && !nextMoritaniStrongholdsStep(g));
    game = applyAction(game, f.moritani, { type: 'battlePlan', leader: loser.id, dial: 0, support: 0 });
    game = applyAction(game, emperor, { type: 'battlePlan', leader: winner.id, dial: 2, support: 2 });
    game = resolveMoritaniStrongholdsBattle(game, f.moritani);
    assert.equal(game.lastBattleContext!.winner, emperor);
    assert.equal(game.moritaniAssassinate!.normalTraitorCall, true);
    assert.equal(game.moritaniAssassinate!.opportunities.length, 0);
    assert.equal(player(game, emperor).leaders.find(l => l.id === target.id)!.dead, false);
    assert.deepEqual(game.traitorReserve, reserve, 'No assassination means no hidden replacement draw.');
    assert.equal(tokens.filter(token => game.techTokens![token].owner === emperor).length, 1,
      'A real victory selects one loser token, not both allied or held tokens.');
    assert.equal(ownedTech(game.techTokens, emperor).length, 2);
    physical(game);
  });

for (const strongholds of [false, true]) {
  const initialize = strongholds ? initializeStrongholdFactionsGameForAudit : initializeFactionExpansionsGameForAudit;
  void test(`${strongholds ? 'Stronghold+Tech' : 'plain Tech'} initializer rejects paired E3 and mixed selected families without admitting unrelated overlays`, () => {
    assert.throws(() => initialize(lobby(['ecaz', 'moritani', 'guild'])));
    assert.throws(() => initialize(lobby(['ecaz', 'ixians', 'guild'], true, ['ecaz', 'ix'])));
    assert.throws(() => initialize(lobby(['moritani', 'choam', 'guild'], true, ['ecaz', 'choam'])));
    assert.throws(() => initialize(lobby(['moritani', 'harkonnen', 'guild'])));
    assert.throws(() => initialize(lobby(['ecaz', 'guild'])));
    if (strongholds) assert.throws(() => initialize(lobby(['ecaz', 'guild', 'emperor'], false)));
    for (const overlay of ['leaderSkills', 'homeworlds', 'nexusCards', 'discoveryEnabled', 'ecazTreachery',
      'semutaPreview', 'advancedPreview', 'kullPreview', 'nexusKullPreview', 'guildBetrayalPreview',
      'richeseBetrayalPreview', 'nexusIxianReplacementPreview', 'nexusIxianBetrayalPreview', 'nexusHarkonnenBetrayalPreview']) {
      const game = lobby(['ecaz', 'guild', 'emperor']); Object.assign(game, { [overlay]: true });
      assert.throws(() => initialize(game), `${overlay} remains excluded from the bounded native Tech family.`);
    }
    for (const stale of ['owner', 'spice', 'triggeredTurn'] as const) {
      const game = lobby(['ecaz', 'guild', 'emperor']);
      Object.assign(game.techTokens!.axlotl, { [stale]: stale === 'owner' ? game.host : 1 });
      assert.throws(() => initialize(game));
    }
  });
}

void test('Basic standalone Moritani Tech retains its original Harkonnen-compatible setup boundary', () => {
  const game = finishEcazOccupySetup(initializeE3NativeTechSetup({
    initial: lobby(['moritani', 'harkonnen', 'guild'], false), native: 'moritani', advanced: false,
  }));
  assert.equal(player(game, 'auth-moritani').reserves, 14);
  assert.equal(player(game, 'auth-harkonnen').traitors.length, 4);
  physical(game);
});
