import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, viewGame, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { biddingPhysicalIds } from './fixture-homeworld-occupied-bidding';
import { semutaEmperorPlayer } from './fixture-semuta-emperor-share';
import { advanceSemutaHomeworldChoam, reactSemutaHomeworldChoam } from './fixture-semuta-homeworld-choam';
import {
  createSemutaHomeworldChoamReturnsFixture, playSemutaHomeworldChoamReturns,
  semutaHomeworldChoamReturnsForces, type SemutaHomeworldChoamReturnsFixture,
} from './fixture-semuta-homeworld-choam-returns';

const wallets = (game: Game) => game.players.map(player => ({ id: player.id, spice: player.spice }));
const counters = (game: Game, id: string) => {
  const p = semutaEmperorPlayer(game, id);
  return { forces: p.forces, reserves: p.reserves, tanks: p.tanks,
    elites: p.elites, revived: p.revived, freeForcesRevived: p.freeForcesRevived, battleLosses: p.battleLosses };
};
const homeForces = (game: Game) => viewGame(game, game.host).homeworlds!.worlds!
  .map(home => ({ id: home.id, native: home.native, forces: home.forces }));

/** Shared observable contract: exactly one printed effect follows the recovery,
 * and recovery changes card ownership only, not the source's native economics. */
function assertSettled(f: SemutaHomeworldChoamReturnsFixture, done: Game, claim: boolean) {
  assert.equal(done.pendingTreacheryDiscard, null);
  const holder = semutaEmperorPlayer(done, f.holder);
  assert.equal(holder.hand.some(card => card.id === f.card), claim);
  assert.equal(holder.hand.some(card => card.id === SEMUTA_DRUG_ID), !claim);
  assert.equal(done.discard.filter(card => card.id === f.card).length, Number(!claim));
  assert.equal(done.discard.filter(card => card.id === SEMUTA_DRUG_ID).length, Number(claim));
  assert.equal(semutaEmperorPlayer(done, f.owner).hand.some(card => card.id === f.card), false);
  assert.deepEqual(biddingPhysicalIds(done), f.originalCards);
  assert.deepEqual(semutaHomeworldChoamReturnsForces(done), semutaHomeworldChoamReturnsForces(f.setup));
  assert.deepEqual(wallets(done), wallets(f.game));
  assert.equal(done.turn, f.game.turn);
  assert.equal(done.phase, f.game.phase);
  for (const player of done.players.filter(player => player.id !== f.target))
    assert.deepEqual(counters(done, player.id), counters(f.game, player.id));

  if (f.power === 'laLaLa') {
    const before = viewGame(f.game, f.target).revival;
    const after = viewGame(done, f.target).revival;
    assert.ok(before.freeRemaining > 0, 'Original Atreides has a genuine free allowance');
    assert.equal(before.freeBlocked, false);
    assert.equal(after.freeRemaining, 0, 'The printed power removes the actual free-revival allowance');
    assert.equal(after.freeBlocked, true);
    assert.equal(after.limit, before.limit, 'Paid revival allowance is not canceled');
    assert.equal(viewGame(done, f.owner).choamWorthless!.targets.includes(f.target), false);
    for (const player of done.players.filter(player => player.id !== f.target))
      assert.equal(viewGame(done, player.id).revival.freeRemaining, viewGame(f.game, player.id).revival.freeRemaining);
    assert.deepEqual(counters(done, f.target), counters(f.game, f.target),
      'The original Revival has no Tanks: proactive denial must not invent or revive a casualty');
    assert.deepEqual(homeForces(done), homeForces(f.game));
  } else {
    const before = semutaEmperorPlayer(f.game, f.target), after = semutaEmperorPlayer(done, f.target);
    assert.equal(after.forces[f.from], before.forces[f.from] - 1);
    assert.equal(after.reserves, before.reserves + 1, 'One ORIGINAL board token returns to native reserves');
    assert.equal(after.tanks, before.tanks, 'Trip is not a resurrection from Tanks');
    assert.equal(after.revived, before.revived);
    assert.equal(after.freeForcesRevived, before.freeForcesRevived);
    assert.equal(after.battleLosses, before.battleLosses);
    assert.deepEqual(after.elites, before.elites);
    assert.deepEqual(Object.entries(after.forces).filter(([key]) => key !== f.from),
      Object.entries(before.forces).filter(([key]) => key !== f.from));
    const expectedHomes = structuredClone(homeForces(f.game));
    const nativeHome = expectedHomes.find(home => home.native === f.target)!;
    nativeHome.forces[f.target].normal++;
    assert.deepEqual(homeForces(done), expectedHomes, 'Public Caladan custody gains exactly that one ordinary token');
    assert.equal(done.decision?.kind, 'choamMentat');
    assert.equal(done.decision!.player, f.owner, 'The original closing owner resumes before victory');
    assert.equal(viewGame(done, f.target).mentatVictoryPending, true);
    assert.equal(done.status, 'playing');
    assert.throws(() => applyAction(done, f.target, { type: 'decision', done: true }));
  }
  assert.throws(() => applyAction(done, f.owner, f.action), 'The original printed power cannot replay');
  if (claim) assert.throws(() => applyAction(done, f.holder, f.action),
    'Recovering a Worthless card does not grant the non-CHOAM holder its faction power');
}

function consumeOriginalSuffix(f: SemutaHomeworldChoamReturnsFixture, state: Game) {
  const before = structuredClone(counters(state, f.target));
  const homes = homeForces(state);
  const next = f.power === 'gamont'
    ? applyAction(state, f.owner, { type: 'decision', done: true })
    : advanceSemutaHomeworldChoam(state, game => game.phase === 5 && !game.phaseOpening && !game.response && !game.decision);
  assert.equal(next.turn, f.game.turn + Number(f.power === 'gamont'));
  assert.equal(next.phase, f.power === 'gamont' ? 0 : 5);
  assert.equal(next.status, 'playing');
  assert.deepEqual(counters(next, f.target), before, 'The real next stage must not run the power a second time');
  assert.deepEqual(homeForces(next), homes);
  assert.deepEqual(biddingPhysicalIds(next), f.originalCards);
  if (f.power === 'gamont') {
    assert.equal(next.choamMentatPending, false);
    assert.throws(() => applyAction(next, f.owner, { type: 'decision', done: true }),
      'The original closing decision is consumed once');
  }
}

for (const advanced of [false, true]) {
  for (const power of ['laLaLa', 'gamont'] as const) {
    for (const claim of [false, true]) void test(
      `Homeworld ${advanced ? 'Advanced' : 'Basic'} native ${power}: Semuta ${claim ? 'claims' : 'passes'} before the original effect`, () => {
        const f = createSemutaHomeworldChoamReturnsFixture(power, advanced);
        const pending = playSemutaHomeworldChoamReturns(f);
        const cost = pending.pendingTreacheryDiscard;
        assert.ok(cost, 'The actual printed disposal pauses before its native effect');
        assert.equal(viewGame(pending, f.holder).semutaReaction!.canCommit, true);
        assert.equal(pending.discard.filter(card => card.id === f.card).length, 1);
        assert.deepEqual(counters(pending, f.target), counters(f.game, f.target));
        assert.deepEqual(homeForces(pending), homeForces(f.game));
        assert.deepEqual(wallets(pending), wallets(f.game));
        assert.equal(viewGame(pending, f.target).revival.freeRemaining, viewGame(f.game, f.target).revival.freeRemaining);
        assert.throws(() => applyAction(pending, f.owner, f.action));
        assert.throws(() => applyAction(pending, f.owner, { type: 'decision', done: true }),
          'Closing/Revival cannot skip the actual recovery window');
        assert.throws(() => applyAction(pending, f.target, { type: 'ready' }));
        assert.throws(() => applyAction(pending, f.target, { type: 'semutaCommit', event: cost.batch.event }));
        const done = reactSemutaHomeworldChoam(pending, f.holder, claim);
        assertSettled(f, done, claim);
        assert.throws(() => applyAction(done, f.holder, { type: 'semutaCommit', event: cost.batch.event }));
        assert.throws(() => applyAction(done, f.target, { type: 'semutaPass', event: cost.batch.event }));
        consumeOriginalSuffix(f, done);
      },
    );

    for (const difficulty of DIFFICULTIES) void test(
      `${difficulty} legally completes Homeworld ${advanced ? 'Advanced' : 'Basic'} native ${power} recovery and original controls`, () => {
        const f = createSemutaHomeworldChoamReturnsFixture(power, advanced);
        let game = playSemutaHomeworldChoamReturns(f);
        const event = game.pendingTreacheryDiscard!.batch.event;
        const view = viewGame(game, f.holder);
        view.players.find(player => player.id === f.holder)!.bot = difficulty;
        const action = botActions(view)[0];
        assert.ok(action);
        assert.ok(action.type === 'semutaCommit' || action.type === 'semutaPass');
        game = applyAction(game, f.holder, action);
        for (const player of game.players) {
          if (game.pendingTreacheryDiscard?.reaction?.stage === 'offer'
            && !game.pendingTreacheryDiscard.reaction.passed.includes(player.id))
            game = applyAction(game, player.id, { type: 'semutaPass', event });
        }
        const claimed = semutaEmperorPlayer(game, f.holder).hand.some(card => card.id === f.card);
        assertSettled(f, game, claimed);
        if (power === 'gamont') {
          const closingView = viewGame(game, f.owner);
          closingView.players.find(player => player.id === f.owner)!.bot = difficulty;
          const close = botActions(closingView)[0];
          assert.ok(close);
          const after = applyAction(game, f.owner, close);
          assert.equal(after.turn, game.turn + 1);
          assert.equal(after.phase, 0);
          assert.equal(after.choamMentatPending, false);
          assert.deepEqual(counters(after, f.target), counters(game, f.target));
          assert.deepEqual(homeForces(after), homeForces(game));
          assert.deepEqual(biddingPhysicalIds(after), f.originalCards);
        } else consumeOriginalSuffix(f, game);
      },
    );
  }
}
