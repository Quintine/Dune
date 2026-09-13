import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  HarassWithdrawChoice,
  harassWithdrawChoiceState,
} from '../components/harass-withdraw-choice';
import {
  HarassWithdrawGuide,
  harassWithdrawControlState,
} from '../components/harass-withdraw';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { applyAction, viewGame, type Game } from '../game/engine';
import {
  defaultHarassWithdrawAllocation,
  harassWithdrawCommitments,
} from '../game/harass-withdraw';
import { harassWithdrawGame } from './fixture-harass-withdraw';

function submitPlans(game: Game) {
  const owner = game.players[0];
  const opponent = game.players[1];
  let next = applyAction(game, owner.id, {
    type: 'battlePlan',
    dial: game.advanced ? 2 : 2,
    support: game.advanced ? 1 : 0,
    leader: owner.leaders.find((leader) => !leader.dead)!.id,
    weapon: 'ecaz-harass-withdraw',
  });
  next = applyAction(next, opponent.id, {
    type: 'battlePlan',
    dial: 0,
    support: 0,
    leader: opponent.leaders.find((leader) => !leader.dead)!.id,
  });
  assert.equal(next.decision?.kind, 'harassWithdraw');
  return next;
}

function multiSectorGame() {
  const game = harassWithdrawGame({
    territory: 'imperial_basin',
    sector: 9,
  });
  game.players[0].forces = {
    'imperial_basin:9': 2,
    'imperial_basin:10': 3,
  };
  return game;
}

void test('pre-seal guidance permits a supported ambiguous plan and defers its private allocation', () => {
  const game = harassWithdrawGame({ advanced: true, normal: 3, elite: 1 });
  const preview = viewGame(game, 'a').battle!.harassWithdraw!;
  const state = harassWithdrawControlState(preview, true, 2, 1);
  assert.deepEqual(state, { blocked: null, returned: null });
  const html = renderToStaticMarkup(
    createElement(HarassWithdrawGuide, { preview, state }),
  );
  assert.match(html, /After plans are revealed/);
  assert.match(html, /choose exactly which undialed ordinary and elite forces/);
  assert.doesNotMatch(html, /ambiguous regular\/elite/);
  for (const difficulty of DIFFICULTIES) {
    const botView = viewGame(game, 'a');
    botView.players.find((player) => player.id === 'a')!.bot = difficulty;
    const candidates = botActions(botView).filter(
      (action) =>
        action.type === 'battlePlan' &&
        (action.weapon === 'ecaz-harass-withdraw' ||
          action.defense === 'ecaz-harass-withdraw'),
    );
    assert.ok(candidates.length, `${difficulty} omitted legal Harass plans`);
    assert.ok(
      candidates.every((action) => !Object.hasOwn(action, 'returns')),
      `${difficulty} exposed an early return selection`,
    );
  }
});

void test('the revealed owner gets exact commitment and per-sector controls while rivals get no allocation', () => {
  const revealed = submitPlans(multiSectorGame());
  const ownerView = viewGame(revealed, 'a');
  const observerView = viewGame(revealed, 't');
  assert.equal(observerView.battle!.harassAllocation, null);
  const offer = ownerView.battle!.harassAllocation!;
  assert.equal(offer.selection, null);
  const commitments = harassWithdrawCommitments(
    offer.context,
    offer.dial,
    offer.support,
  );
  assert.deepEqual(commitments, [{ normal: 2, elite: 0 }]);

  const first = defaultHarassWithdrawAllocation(
    offer.context,
    offer.dial,
    offer.support,
    commitments[0],
  );
  assert.deepEqual(first, {
    'imperial_basin:10': { normal: 3, elite: 0 },
  });
  assert.equal(
    harassWithdrawChoiceState(offer.context, offer.dial, offer.support, first)
      .blocked,
    null,
  );
  assert.match(
    harassWithdrawChoiceState(offer.context, offer.dial, offer.support, {
      'imperial_basin:9': { normal: 2, elite: 0 },
    }).blocked!,
    /exact undialed complement/,
  );

  const html = renderToStaticMarkup(
    createElement(HarassWithdrawChoice, {
      game: ownerView,
      act() {},
      busy: false,
    }),
  );
  assert.match(html, /aria-label="Harass and Withdraw force allocation"/);
  assert.match(html, /Dialed physical commitment/);
  assert.match(html, /2 ordinary · 0 elite/);
  assert.match(html, /Imperial Basin · sector 9/);
  assert.match(html, /Imperial Basin · sector 10/);
  assert.match(html, /Confirm returned forces/);
  assert.equal(
    renderToStaticMarkup(
      createElement(HarassWithdrawChoice, {
        game: observerView,
        act() {},
        busy: false,
      }),
    ),
    '',
  );
  assert.match(
    renderToStaticMarkup(
      createElement(HarassWithdrawChoice, {
        game: ownerView,
        act() {},
        busy: true,
      }),
    ),
    /disabled=""/,
  );
});

void test('every bot profile submits the shared deterministic allocation only at its revealed decision', () => {
  for (const difficulty of DIFFICULTIES) {
    const revealed = submitPlans(
      harassWithdrawGame({ advanced: true, normal: 3, elite: 1 }),
    );
    const view = viewGame(revealed, 'a');
    view.players.find((player) => player.id === 'a')!.bot = difficulty;
    const offer = view.battle!.harassAllocation!;
    const expected = defaultHarassWithdrawAllocation(
      offer.context,
      offer.dial,
      offer.support,
    );
    const action = botActions(view)[0];
    assert.deepEqual(action, {
      type: 'decision',
      event:
        revealed.decision?.kind === 'harassWithdraw'
          ? revealed.decision.event
          : '',
      returns: expected,
    });
    const selected = applyAction(revealed, 'a', action);
    assert.deepEqual(selected.battle!.harassAllocation!.selection, expected);
    assert.notEqual(selected.decision?.kind, 'harassWithdraw');
    assert.deepEqual(
      viewGame(selected, 't').battle!.harassAllocation!.selection,
      expected,
    );
  }
});
