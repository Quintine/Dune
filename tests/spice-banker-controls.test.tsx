import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SpiceBankerControl } from '../components/spice-banker';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import {
  applyAction,
  viewGame,
  type GameView,
  type Plan,
} from '../game/engine';
import { spiceBankerGame } from './spice-banker-fixture';

const aliases = registerHooks({
  resolve(specifier, context, next) {
    return next(
      specifier === 'next/image' ? 'vinext/shims/image' : specifier,
      context,
    );
  },
});
const { PrivateBattlePlan } = await import('../components/private-battle-plan');
const { RevealedBattle } = await import('../components/revealed-battle');
aliases.deregister();

function renderControl(
  game: GameView,
  selectedLeader: string,
  ownSupport: number,
  value: number,
) {
  return renderToStaticMarkup(
    createElement(SpiceBankerControl, {
      game,
      selectedLeader,
      ownSupport,
      value,
      onChange() {},
    }),
  );
}

void test('Spice Banker renders a bounded separate own-spice commitment only for the controlled living skilled disc', () => {
  const native = spiceBankerGame();
  native.players[0].spice = 4;
  const view = viewGame(native, 'a');
  const html = renderControl(view, 'emperor-0', 2, 2);
  assert.match(html, /aria-label="Spice Banker battle commitment"/);
  assert.match(html, /id="battle-banker-spice"[^>]*max="2"[^>]*value="2"/);
  assert.match(
    html,
    /Plan funding: 2 own spice for force support \+ 2 committed to Spice Banker = 4 own spice total/,
  );
  assert.match(
    html,
    /Each committed spice adds 1 strength if this skilled leader survives/,
  );
  assert.match(html, /commitment goes to the Bank after a win or loss/);
  assert.match(
    html,
    /sole winner through a traitor call spends no Battle Plan spice/,
  );
  assert.equal(renderControl(view, 'emperor-1', 0, 3), '');

  const faceUp = structuredClone(view);
  faceUp.leaderSkills!.assignments.find(
    (assignment) => assignment.skill === 'spice-banker',
  )!.faceUp = true;
  assert.equal(renderControl(faceUp, 'emperor-0', 0, 3), '');

  const dead = structuredClone(view);
  dead.players
    .find((player) => player.id === 'a')!
    .leaders.find((leader) => leader.id === 'emperor-0')!.dead = true;
  assert.equal(renderControl(dead, 'emperor-0', 0, 3), '');

  const foreign = structuredClone(view);
  foreign.leaderSkills!.assignments.find(
    (assignment) => assignment.skill === 'spice-banker',
  )!.controller = 'd';
  assert.equal(renderControl(foreign, 'emperor-0', 0, 3), '');

  const combinedModule = structuredClone(view);
  combinedModule.expansions = ['ix'];
  assert.equal(renderControl(combinedModule, 'emperor-0', 0, 3), '');

  const capturedGame = spiceBankerGame(false, true);
  capturedGame.players[0].spice = 3;
  const captive = viewGame(capturedGame, 'a');
  assert.match(
    renderControl(captive, 'guild-0', 0, 3),
    /Spice Banker commitment/,
  );
});

void test('full-plan inspection and public reveal show the exact commitment without leaking it to another private viewer', () => {
  const plan: Plan = {
    dial: 1,
    support: 0,
    bankerSpice: 3,
    leader: 'emperor-0',
    weapon: null,
    defense: null,
  };
  const inspected = {
    me: 'atreides',
    players: [
      { id: 'atreides', name: 'Atreides' },
      { id: 'emperor', name: 'Emperor' },
      { id: 'observer', name: 'Observer' },
    ],
    allLeaders: [],
    battle: {
      revealed: false,
      fullPlan: { owner: 'atreides', target: 'emperor' },
      fullPlanInsight: { target: 'emperor', plan, cards: [] },
    },
  } as unknown as GameView;
  const privateHtml = renderToStaticMarkup(
    createElement(PrivateBattlePlan, { game: inspected }),
  );
  assert.match(privateHtml, /Spice Banker commitment<\/dt><dd>3<\/dd>/);
  assert.equal(
    renderToStaticMarkup(
      createElement(PrivateBattlePlan, {
        game: {
          ...inspected,
          me: 'observer',
        },
      }),
    ),
    '',
  );

  const revealed = {
    ...inspected,
    advanced: false,
    me: 'observer',
    battle: {
      attacker: 'emperor',
      defender: 'atreides',
      revealed: true,
      plans: {
        emperor: plan,
        atreides: {
          dial: 0,
          support: 0,
          leader: null,
          weapon: null,
          defense: null,
        },
      },
      cards: [],
      ownForces: null,
      stoneBurner: {},
      poisonTooth: {},
      lateDefense: {},
      native: null,
      nativeBattleStrength: 0,
    },
  } as unknown as GameView;
  const publicHtml = renderToStaticMarkup(
    createElement(RevealedBattle, { game: revealed }),
  );
  assert.match(publicHtml, /Spice Banker: 3 spice committed/);
  assert.equal(
    (publicHtml.match(/Spice Banker:/g) ?? []).length,
    1,
    'zero commitments stay absent from public reveal',
  );
});

void test('all four bot profiles reserve only remaining own spice and emit legal skilled plans', () => {
  for (const [profile, expectedCap] of DIFFICULTIES.map(
    (difficulty, index) => [difficulty, Math.min(index + 1, 3)] as const,
  )) {
    const game = spiceBankerGame(true);
    game.players[0].spice = 4;
    const view = viewGame(game, 'a');
    view.players.find((player) => player.id === 'a')!.bot = profile;
    const plans = botActions(view).filter(
      (action) => action.type === 'battlePlan' && action.leader === 'emperor-0',
    );
    assert.ok(plans.length, `${profile} omitted the skilled disc`);
    for (const action of plans) {
      const support = Number(action.support ?? 0);
      assert.equal(
        Number(action.bankerSpice ?? 0),
        Math.min(expectedCap, Math.max(0, 4 - support)),
        `${profile} did not reserve Banker spice after force support`,
      );
    }
    assert.doesNotThrow(
      () => applyAction(game, 'a', plans[0]),
      `${profile} emitted an illegal Spice Banker plan`,
    );
  }
});

void test('bots do not emit a currently gated Banker commitment in a combined-module view', () => {
  const game = spiceBankerGame();
  const view = viewGame(game, 'a');
  view.expansions = ['ix'];
  for (const difficulty of DIFFICULTIES) {
    view.players.find((player) => player.id === 'a')!.bot = difficulty;
    const skilled = botActions(view).filter(
      (action) => action.type === 'battlePlan' && action.leader === 'emperor-0',
    );
    assert.ok(skilled.length);
    assert.ok(
      skilled.every((action) => !action.bankerSpice),
      `${difficulty} emitted a gated Banker commitment`,
    );
  }
});
