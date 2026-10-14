import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { forceRevivalQuote } from '../game/revival';
import {
  NEXUS_TLEILAXU_FORCE_GROUP_CAP, tleilaxuSecretAllyEvent,
} from '../game/nexus-tleilaxu-revival';
import {
  advanceNexusTleilaxuSecretAlly, createNexusTleilaxuSecretAllyFixture,
  nexusTleilaxuSecretAllyClean, nexusTleilaxuSecretAllyInventory,
  nexusTleilaxuSecretAllyPlayer as player,
  type NexusTleilaxuSecretAllyFixture,
} from './fixture-nexus-tleilaxu-secret-ally';

function secretAllyOffer(game:Game,id:string) {
  return viewGame(game,id).nexusTleilaxu?.secretAlly??null;
}
/** The exact committed action shape of this card, not a fixture-level stand-in. */
const cardAction = (event: string, leader: string, amount: number, elite = 0): Action => ({
  type: 'nexusTleilaxuRevival', event, leader, amount, elite,
});
function rejected(game: Game, actor: string, action: Action): void {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before, 'A refused action cannot move counters, spice, cards or the leader');
}
function quietRevival(game: Game, fixture: NexusTleilaxuSecretAllyFixture): Game {
  return advanceNexusTleilaxuSecretAlly(game, state =>
    state.turn === fixture.game.turn && state.phase === 4 && nexusTleilaxuSecretAllyClean(state));
}

for (const advanced of [false, true]) {
  const band = advanced ? 'Advanced' : 'Basic';

  void test(`${band} absent-Tleilaxu Nexus: one own dead leader returns with paid counters exactly once`, () => {
    const f = createNexusTleilaxuSecretAllyFixture({ advanced });
    assert.equal(secretAllyOffer(f.game,f.opponent),null);
    assert.equal(secretAllyOffer(f.game,f.partner),null);
    const offer = secretAllyOffer(f.game, f.owner)!;
    const before = player(f.game, f.owner);
    const returned = applyAction(f.game, f.owner, cardAction(offer.event, f.deadLeader.id, 2));
    const holder = player(returned, f.owner);
    const leader = holder.leaders.find(l => l.id === f.deadLeader.id)!;
    assert.equal(leader.dead, false, 'The card returns the offered own disc');
    assert.equal(leader.deaths, 1, 'The original death history is preserved');
    assert.equal(holder.tanks, before.tanks - 2);
    assert.equal(holder.reserves, before.reserves + 2, 'Returned counters enter the ordinary reserves');
    assert.equal(holder.spice, before.spice - 2, 'One bank spice per exact returned counter, leader included for nothing');
    assert.equal(returned.nexusCards!.cards!.hands[f.owner], null);
    assert.equal(returned.nexusCards!.cards!.discard.filter(card => card === 'tleilaxu').length, 1);
    assert.equal(secretAllyOffer(returned, f.owner), null, 'The spent physical card cannot offer again');
    rejected(returned, f.owner, cardAction(offer.event, f.deadLeader.id, 2));
    nexusTleilaxuSecretAllyInventory(returned);
  });

  void test(`${band} absent-Tleilaxu Nexus: the shared five ceiling counts earlier ordinary returns instead of adding five more`, () => {
    const f = createNexusTleilaxuSecretAllyFixture({ advanced });
    const before = player(f.game, f.owner);
    let game = applyAction(f.game, f.owner, { type: 'revive', amount: 3 });
    game = quietRevival(game, f);
    const ordinary = player(game, f.owner);
    assert.equal(ordinary.revived, 3);
    assert.equal(ordinary.tanks, before.tanks - 3);
    assert.equal(ordinary.spice, before.spice - forceRevivalQuote(f.game, before, 3).cost);
    const offer = secretAllyOffer(game, f.owner)!;
    assert.equal(offer.blocked, null);
    assert.equal(offer.maxForces, NEXUS_TLEILAXU_FORCE_GROUP_CAP - ordinary.revived,
      'Three ordinary counters leave only two card counters of the shared five');
    rejected(game, f.owner, cardAction(offer.event, f.deadLeader.id, 5));
    rejected(game, f.owner, cardAction(offer.event, f.deadLeader.id, 3));
    const paid = applyAction(game, f.owner, cardAction(offer.event, f.deadLeader.id, 2));
    const holder = player(paid, f.owner);
    assert.equal(holder.tanks, before.tanks - 5, 'Five physical counters return, never three plus five');
    assert.equal(holder.reserves, before.reserves + 5);
    assert.equal(holder.spice, ordinary.spice - 2);
    nexusTleilaxuSecretAllyInventory(paid);
  });

  void test(`${band} absent-Tleilaxu Nexus: card-first and ordinary-first share the same five-return ceiling`,()=>{
    const f=createNexusTleilaxuSecretAllyFixture({advanced});
    const offer=secretAllyOffer(f.game,f.owner)!;
    const card=applyAction(f.game,f.owner,cardAction(offer.event,f.deadLeader.id,1));
    const price=forceRevivalQuote(card,player(card,f.owner),4).cost;
    const done=quietRevival(applyAction(card,f.owner,{type:'revive',amount:4}),f);
    assert.equal(player(done,f.owner).revived,5);
    assert.equal(player(done,f.owner).tanks,3);
    assert.equal(player(done,f.owner).spice,player(card,f.owner).spice-price);
    assert.equal(player(done,f.owner).leaderRevived,true);
    rejected(done,f.owner,{type:'revive',amount:1});
  });

  void test(`${band} absent-Tleilaxu Nexus: zero counters still returns exactly one own leader free`, () => {
    const f = createNexusTleilaxuSecretAllyFixture({ advanced });
    const offer = secretAllyOffer(f.game, f.owner)!;
    const before = player(f.game, f.owner);
    const returned = applyAction(f.game, f.owner, cardAction(offer.event, f.deadLeader.id, 0));
    const holder = player(returned, f.owner);
    assert.equal(holder.leaders.find(l => l.id === f.deadLeader.id)!.dead, false);
    assert.equal(holder.tanks, before.tanks);
    assert.equal(holder.reserves, before.reserves);
    assert.equal(holder.spice, before.spice, 'The leader is free; only exact counters are priced');
    assert.equal(returned.nexusCards!.cards!.discard.filter(card => card === 'tleilaxu').length, 1);
    rejected(returned, f.owner, cardAction(offer.event, f.deadLeader.id, 0));
    nexusTleilaxuSecretAllyInventory(returned);
  });

  void test(`${band} absent-Tleilaxu Nexus: foreign actor, stale event, living leader, overage and wrong phase leave everything untouched`, () => {
    const f = createNexusTleilaxuSecretAllyFixture({ advanced });
    const offer = secretAllyOffer(f.game, f.owner)!;
    const living = player(f.game, f.owner).leaders.find(l => !l.dead)!.id;
    for (const actor of [f.opponent, f.partner])
      rejected(f.game, actor, cardAction(offer.event, f.deadLeader.id, 1));
    rejected(f.game, f.owner, cardAction(tleilaxuSecretAllyEvent({ turn: f.game.turn + 1, phase: 4 }, player(f.game, f.owner)), f.deadLeader.id, 1));
    rejected(f.game, f.owner, cardAction('stale', f.deadLeader.id, 1));
    rejected(f.game, f.owner, cardAction(offer.event, living, 0));
    rejected(f.game, f.owner, cardAction(offer.event, f.deadLeader.id, NEXUS_TLEILAXU_FORCE_GROUP_CAP + 1));
    rejected(f.game, f.owner, cardAction(offer.event, f.deadLeader.id, -1));
    rejected(f.game, f.owner, cardAction(offer.event, f.deadLeader.id, 1, 2));
    rejected(f.game, f.owner, cardAction(offer.event, f.deadLeader.id, NEXUS_TLEILAXU_FORCE_GROUP_CAP + 0.5));
    // An unused physical card stays held, so the next quiet Revival opens a new opportunity.
    const laterTurn = advanceNexusTleilaxuSecretAlly(f.game, state =>
      state.turn === 3 && state.phase === 4 && nexusTleilaxuSecretAllyClean(state));
    assert.equal(laterTurn.nexusCards!.cards!.hands[f.owner], 'tleilaxu');
    assert.equal(player(laterTurn, f.owner).tanks, 8);
    const later = secretAllyOffer(laterTurn, f.owner);
    assert.ok(later);
    assert.equal(later.blocked, null);
    assert.equal(later.event, tleilaxuSecretAllyEvent(laterTurn, player(laterTurn, f.owner)));
    assert.notEqual(later.event, offer.event, 'A later quiet Revival is its own opportunity');
    rejected(laterTurn, f.owner, cardAction(offer.event, f.deadLeader.id, 1));
    const settled = applyAction(laterTurn, f.owner, cardAction(later.event, f.deadLeader.id, 1));
    assert.equal(player(settled, f.owner).leaders.find(l => l.id === f.deadLeader.id)!.dead, false);
    assert.equal(player(settled, f.owner).tanks, 7);
    assert.equal(settled.nexusCards!.cards!.discard.filter(card => card === 'tleilaxu').length, 1);
    nexusTleilaxuSecretAllyInventory(settled);
  });
}

void test('absent-Tleilaxu Nexus: the spent card continues the real turn and the next Revival unchanged', () => {
  const f = createNexusTleilaxuSecretAllyFixture({ advanced: false });
  const offer = secretAllyOffer(f.game, f.owner)!;
  const applied = applyAction(f.game, f.owner, cardAction(offer.event, f.deadLeader.id, 1));
  assert.equal(player(applied, f.owner).leaders.find(l => l.id === f.deadLeader.id)!.dead, false);
  assert.equal(player(applied, f.owner).tanks, 7);
  const quiet = nexusTleilaxuSecretAllyClean(applied) ? applied : advanceNexusTleilaxuSecretAlly(applied,
    state => state.turn === 2 && state.phase === 4 && nexusTleilaxuSecretAllyClean(state));
  assert.equal(quiet.turn, 2);
  assert.equal(quiet.phase, 4,
    'The spent card never rewrites the current Revival phase');
  const next = advanceNexusTleilaxuSecretAlly(quiet, state =>
    state.turn === 3 && state.phase === 4 && nexusTleilaxuSecretAllyClean(state));
  assert.equal(next.phase, 4);
  const holder = player(next, f.owner);
  assert.equal(holder.leaders.find(l => l.id === f.deadLeader.id)!.dead, false, 'Revival survives Movement, Battle, Collection and the next turn');
  assert.equal(holder.revived, 0, 'The real turn boundary resets the ordinary ledger');
  assert.equal(holder.tanks, 7);
  assert.equal(next.nexusCards!.cards!.hands[f.owner], null);
  assert.equal(next.nexusCards!.cards!.discard.filter(card => card === 'tleilaxu').length, 1,
    'Exactly one physical Tleilaxu card was spent');
  assert.equal(secretAllyOffer(next, f.owner), null);
  assert.ok(Number.isSafeInteger(holder.spice) && holder.spice >= 0, 'The wallet remains a valid bank balance');
  nexusTleilaxuSecretAllyInventory(next);
});
