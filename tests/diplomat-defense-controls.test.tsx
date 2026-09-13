import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DiplomatDefense } from '../components/diplomat-defense';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { applyAction, viewGame, type Game } from '../game/engine';
import {
  diplomatDefenseGame,
  revealDiplomatPlans,
  takeBattleCard,
} from './diplomat-defense-fixture';

const aliases = registerHooks({
  resolve(specifier, context, next) {
    return next(
      specifier === 'next/image' ? 'vinext/shims/image' : specifier,
      context,
    );
  },
});
const { RevealedBattle } = await import('../components/revealed-battle');
aliases.deregister();

function markup(game: Game, viewer = 'a', busy = false) {
  return renderToStaticMarkup(
    createElement(DiplomatDefense, {
      game: viewGame(game, viewer),
      act() {},
      busy,
    }),
  );
}

function revealAgainstProjectile(game: Game) {
  const own = game.players.find((player) => player.id === 'a')!;
  const other = game.players.find((player) => player.id === 'd')!;
  const weapon = takeBattleCard(game, 'd', 'projectile');
  let next = applyAction(game, 'a', {
    type: 'battlePlan',
    dial: 0,
    leader: 'emperor-1',
    defense: own.hand.find((card) => card.kind === 'worthless')!.id,
  });
  next = applyAction(next, 'd', {
    type: 'battlePlan',
    dial: 0,
    leader: 'guild-1',
    weapon: weapon.id,
    defense: other.hand.find((card) => card.kind === 'snooper')!.id,
  });
  return next;
}

void test('the deciding owner sees the copied protection, named Worthless choice, mandatory discard and decline', () => {
  const game = diplomatDefenseGame();
  const uncommitted = takeBattleCard(game, 'd', 'worthless');
  const revealed = revealDiplomatPlans(game);
  const html = markup(revealed);
  assert.match(html, /aria-label="Diplomat defense choice"/);
  assert.match(html, /opposing committed defense, <strong>Snooper/);
  assert.match(html, /<strong>Poison defense<\/strong> protection/);
  assert.match(html, /Copy Snooper with Baliset · mandatory discard/);
  assert.match(html, /must be discarded after this battle/);
  assert.match(html, /Decline Diplomat defense/);
  assert.equal(html.includes(uncommitted.name), false);
  assert.equal(markup(revealed, 'd'), '');
  assert.ok(
    (markup(revealed, 'a', true).match(/disabled=""/g) ?? []).length >= 2,
  );
  assert.match(
    markup(revealDiplomatPlans(diplomatDefenseGame(false, true))),
    /Diplomat defense choice/,
  );
});

void test('all profiles copy useful revealed protection and decline a mismatched defense', () => {
  for (const difficulty of DIFFICULTIES) {
    let useful = revealDiplomatPlans(diplomatDefenseGame());
    let view = viewGame(useful, 'a');
    view.players.find((player) => player.id === 'a')!.bot = difficulty;
    const copy = botActions(view)[0];
    assert.deepEqual(copy, {
      type: 'decision',
      event:
        useful.decision?.kind === 'diplomatDefense'
          ? useful.decision.event
          : '',
      card:
        useful.decision?.kind === 'diplomatDefense'
          ? useful.decision.cards[0]
          : null,
    });
    useful = applyAction(useful, 'a', copy);
    assert.equal(useful.battle!.diplomatDefense!.stage, 'copied');

    let mismatch = revealAgainstProjectile(diplomatDefenseGame());
    view = viewGame(mismatch, 'a');
    view.players.find((player) => player.id === 'a')!.bot = difficulty;
    const decline = botActions(view)[0];
    assert.deepEqual(decline, {
      type: 'decision',
      event:
        mismatch.decision?.kind === 'diplomatDefense'
          ? mismatch.decision.event
          : '',
      card: null,
    });
    mismatch = applyAction(mismatch, 'a', decline);
    assert.equal(mismatch.battle!.diplomatDefense!.stage, 'declined');
  }
});

void test('the revealed plan preserves the public copied or declined Diplomat status across views', () => {
  const unsealed = diplomatDefenseGame();
  assert.equal(
    renderToStaticMarkup(
      createElement(RevealedBattle, { game: viewGame(unsealed, 'a') }),
    ),
    '',
  );

  let copied = revealDiplomatPlans(unsealed);
  assert.equal(copied.decision?.kind, 'diplomatDefense');
  copied = applyAction(copied, 'a', {
    type: 'decision',
    event: copied.decision.event,
    card: copied.decision.cards[0],
  });
  for (const viewer of ['a', 'd']) {
    const html = renderToStaticMarkup(
      createElement(RevealedBattle, { game: viewGame(copied, viewer) }),
    );
    assert.match(
      html,
      /Diplomat: Baliset copies Snooper · discard after battle/,
    );
  }

  let declined = revealDiplomatPlans(diplomatDefenseGame());
  assert.equal(declined.decision?.kind, 'diplomatDefense');
  declined = applyAction(declined, 'a', {
    type: 'decision',
    event: declined.decision.event,
    card: null,
  });
  const declinedHtml = renderToStaticMarkup(
    createElement(RevealedBattle, { game: viewGame(declined, 'd') }),
  );
  assert.match(declinedHtml, /Diplomat: defense copy declined/);
  assert.doesNotMatch(declinedHtml, /discard after battle/);
});

void test('all profiles retain legal Worthless plans for the native trainer and the selected hidden trained disc', () => {
  for (const difficulty of DIFFICULTIES) {
    for (const hidden of [false, true]) {
      const game = diplomatDefenseGame(hidden);
      const view = viewGame(game, 'a');
      view.players.find((player) => player.id === 'a')!.bot = difficulty;
      const worthless = new Set(
        view.players
          .find((player) => player.id === 'a')!
          .hand?.filter((card) => card.kind === 'worthless')
          .map((card) => card.id),
      );
      const leader = hidden ? 'emperor-0' : 'emperor-1';
      const candidates = botActions(view).filter(
        (action) =>
          action.type === 'battlePlan' &&
          action.leader === leader &&
          (worthless.has(String(action.weapon)) ||
            worthless.has(String(action.defense))),
      );
      assert.ok(
        candidates.length,
        `${difficulty} omitted ${hidden ? 'trained-disc' : 'native'} Diplomat planning`,
      );
      assert.doesNotThrow(() => applyAction(game, 'a', candidates[0]));
    }
  }
});
