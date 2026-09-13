import test from 'node:test';
import assert from 'node:assert/strict';
import {
  quoteJacurutuBattleIncome,
  JACURUTU_BATTLE_INCOME_RULE,
} from '../game/discovery-battle';
import { applyAction, normalizeAutomaticGame, type Game } from '../game/engine';
import { JACURUTU_SIETCH } from '../game/discoveries';
import { discoveryBattleBeforeFinalVote } from './fixture-discovery-battle';

const reload = (game: Game): Game => JSON.parse(JSON.stringify(game));

void test('the source-bound contract quotes only opposing undialed counters actually sent to the Tanks', () => {
  assert.match(JACURUTU_BATTLE_INCOME_RULE, /opposing undialed force/);
  const ordinary = {
    normal: 5,
    elite: 0,
    eliteStrength: 1 as const,
    freeSupport: true,
  };
  assert.deepEqual(
    quoteJacurutuBattleIncome({
      territory: JACURUTU_SIETCH,
      jacurutuRevealed: true,
      winner: 'winner',
      opponent: 'loser',
      opponentForces: ordinary,
      opponentDial: 2,
      opponentSupport: 0,
      sentToTanks: { normal: 5, elite: 0 },
    }),
    {
      kind: 'income',
      winner: 'winner',
      opponent: 'loser',
      amount: 3,
      sentToTanks: { normal: 5, elite: 0 },
      dialed: [{ normal: 2, elite: 0, paidNormal: 0, paidElite: 0 }],
    },
  );
  const withdrawn = quoteJacurutuBattleIncome({
    territory: JACURUTU_SIETCH,
    jacurutuRevealed: true,
    winner: 'winner',
    opponent: 'loser',
    opponentForces: ordinary,
    opponentDial: 2,
    opponentSupport: 0,
    sentToTanks: { normal: 2, elite: 0 },
  });
  assert.equal(withdrawn?.kind, 'income');
  assert.equal(withdrawn?.kind === 'income' ? withdrawn.amount : -1, 0);
});

void test('mixed Advanced allocations remain explicit when they imply different physical payouts', () => {
  const quote = quoteJacurutuBattleIncome({
    territory: JACURUTU_SIETCH,
    jacurutuRevealed: true,
    winner: 'winner',
    opponent: 'emperor',
    opponentForces: {
      normal: 5,
      elite: 1,
      eliteStrength: 2,
      freeSupport: false,
    },
    opponentDial: 3,
    opponentSupport: 1,
    sentToTanks: { normal: 5, elite: 1 },
  });
  assert.equal(quote?.kind, 'allocationRequired');
  if (quote?.kind !== 'allocationRequired') return;
  assert.deepEqual(
    [...new Set(quote.choices.map((choice) => choice.amount))].sort(
      (left, right) => left - right,
    ),
    [1, 2, 3],
  );
});

void test('no winner, another territory, or a hidden Jacurutu never creates income', () => {
  const partial = {
    opponent: null,
    opponentForces: null,
    opponentDial: null,
    opponentSupport: null,
    sentToTanks: null,
  };
  assert.equal(
    quoteJacurutuBattleIncome({
      ...partial,
      territory: JACURUTU_SIETCH,
      jacurutuRevealed: true,
      winner: null,
    }),
    null,
  );
  assert.equal(
    quoteJacurutuBattleIncome({
      ...partial,
      territory: 'arrakeen',
      jacurutuRevealed: true,
      winner: 'winner',
    }),
    null,
  );
  assert.equal(
    quoteJacurutuBattleIncome({
      ...partial,
      territory: JACURUTU_SIETCH,
      jacurutuRevealed: false,
      winner: 'winner',
    }),
    null,
  );
});

void test('real Basic and Advanced battles pay once from the losing plan and add a typed chronicle event', () => {
  for (const advanced of [false, true]) {
    const {
      game: pending,
      attacker,
      defender,
    } = discoveryBattleBeforeFinalVote(advanced);
    const winnerBefore = pending.players.find(
      (player) => player.id === attacker,
    )!.spice;
    const loser = pending.players.find((player) => player.id === defender)!;
    loser.tanks = 4;
    loser.reserves = 11;
    const before = structuredClone(pending);
    const done = applyAction(reload(pending), defender, {
      type: 'traitorCall',
      call: false,
    });
    assert.deepEqual(pending, before);
    assert.equal(
      done.players.find((player) => player.id === attacker)!.spice,
      winnerBefore - (advanced ? 1 : 0) + 3,
    );
    assert.equal(
      done.players.find((player) => player.id === defender)!.tanks,
      9,
    );
    assert.equal(
      done.log.filter(
        (entry) => entry.automatic?.name === 'Jacurutu Sietch income',
      ).length,
      1,
    );
    assert.match(done.log.at(-1)!.text, /Jacurutu|battle|Ready|won/i);
    const stable = reload(done);
    assert.deepEqual(normalizeAutomaticGame(reload(stable)), stable);
  }
});

void test('winner casualties and pre-existing Tanks do not increase Jacurutu income', () => {
  const {
    game: pending,
    attacker,
    defender,
  } = discoveryBattleBeforeFinalVote(false);
  const winner = pending.players.find((player) => player.id === attacker)!;
  winner.tanks = 3;
  winner.reserves = 12;
  const beforeSpice = winner.spice;
  const done = applyAction(pending, defender, {
    type: 'traitorCall',
    call: false,
  });
  const settled = done.players.find((player) => player.id === attacker)!;
  assert.equal(settled.tanks, 4);
  assert.equal(settled.spice, beforeSpice + 3);
});

void test('a real traitor winner still receives only the opposing undialed Tanks income', () => {
  const {
    game: pending,
    attacker,
    defender,
  } = discoveryBattleBeforeFinalVote(false, ['a', 'g', 'f'], true);
  const beforeSpice = pending.players.find(
    (player) => player.id === attacker,
  )!.spice;
  const done = applyAction(pending, defender, {
    type: 'traitorCall',
    call: false,
  });
  assert.equal(done.lastBattleContext?.result, 'traitor');
  assert.equal(
    done.players.find((player) => player.id === attacker)!.spice,
    beforeSpice + 1 + 3,
  );
  assert.equal(
    done.log.filter(
      (entry) => entry.automatic?.name === 'Jacurutu Sietch income',
    ).length,
    1,
  );
});
