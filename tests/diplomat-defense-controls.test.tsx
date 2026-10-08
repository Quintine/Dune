import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DiplomatDefense } from '../components/diplomat-defense';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { applyAction, viewGame, type Game, type GameView } from '../game/engine';
import { baseDeck, ixBattleCards, type Card } from '../game/cards';
import { richeseCards } from '../game/richese-cards';
import type { DiplomatDefenseQuote } from '../game/diplomat-defense';
import {
  diplomatDefenseGame,
  revealDiplomatPlans,
  takeBattleCard,
} from './diplomat-defense-fixture';


function markup(game: Game, viewer = 'a', busy = false) {
  return renderToStaticMarkup(
    createElement(DiplomatDefense, {
      game: viewGame(game, viewer),
      act() {},
      busy,
    }),
  );
}

/** Project the public revealed receipt with a chosen copied role. Native
 * integration is proven separately once the server passes the widened kind. */
function markupCopy(source: Card, kind: DiplomatDefenseQuote['kind']): string {
  const base = viewGame(revealDiplomatPlans(diplomatDefenseGame()), 'a');
  const battle = base.battle!;
  const view: GameView = {
    ...base,
    battle: {
      ...battle,
      cards: [source],
      diplomatDefense: { ...battle.diplomatDefense!, source: source.id, kind },
    },
    decision: {
      kind: 'diplomatDefense',
      player: 'a',
      event: 'projected',
      cards: ['worthless-projected'],
      source: source.id,
    },
  };
  return renderToStaticMarkup(
    createElement(DiplomatDefense, { game: view, act() {}, busy: false }),
  );
}

function describedProtection(html: string) {
  const match = /provides <strong>(.*?)<\/strong> protection/.exec(html);
  assert.ok(match, html);
  return match[1];
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

void test('only the deciding owner can access eligible committed cards, with busy controls disabled', () => {
  const game = diplomatDefenseGame();
  const uncommitted = takeBattleCard(game, 'd', 'worthless');
  const revealed = revealDiplomatPlans(game);
  const html = markup(revealed);
  assert.equal(html.includes(uncommitted.name), false);
  assert.equal(markup(revealed, 'd'), '');
  assert.ok(
    (markup(revealed, 'a', true).match(/disabled=""/g) ?? []).length >= 2,
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
      let sealed = applyAction(game, 'a', candidates[0]);
      const opponent = sealed.players.find(player => player.id === 'd')!;
      sealed = applyAction(sealed, 'd', {
        type: 'battlePlan', dial: 0, leader: 'guild-1',
        weapon: opponent.hand.find(card => card.kind === 'poison')!.id,
        defense: opponent.hand.find(card => card.kind === 'snooper')!.id,
      });
      assert.ok(sealed.decision?.kind === 'diplomatDefense');
      const selected = sealed.decision!;
      sealed = applyAction(sealed, 'a', { type: 'decision', event: selected.event, card: selected.cards[0] });
      sealed = applyAction(sealed, 'a', { type: 'traitorCall', call: false });
      sealed = applyAction(sealed, 'd', { type: 'traitorCall', call: false });
      assert.equal(sealed.players[0].leaders.find(disc => disc.id === leader)!.dead, false);
      assert.equal(sealed.discard.filter(card => card.id === selected.cards[0]).length, 1);
    }
  }
});

void test('the choice describes the actual copied role instead of a binary Shield or Snooper', () => {
  const ix = ixBattleCards(),
    deck = baseDeck();
  const snooper = deck.find((c) => c.kind === 'snooper')!;
  const cases = [
    { source: snooper, kind: 'snooper' as const },
    { source: deck.find((c) => c.kind === 'shield')!, kind: 'shield' as const },
    {
      source: ix.find((c) => c.kind === 'shieldSnooper')!,
      kind: 'shieldSnooper' as const,
    },
    {
      source: ix.find((c) => c.kind === 'weirdingWay')!,
      kind: 'weirdingWay' as const,
    },
    {
      source: ix.find((c) => c.kind === 'chemistry')!,
      kind: 'chemistry' as const,
    },
    {
      source: richeseCards().find((c) => c.effect === 'portableSnooper')!,
      kind: 'snooper' as const,
    },
  ];
  const described = cases.map(({ source, kind }) => {
    const html = markupCopy(source, kind);
    assert.ok(html.includes(source.name), source.name);
    assert.ok(
      html.includes(`Copy ${source.name} with worthless-projected`),
      source.name,
    );
    return describedProtection(html);
  });
  assert.equal(new Set(described.slice(0, 2)).size, 2);
  assert.equal(described[0], described[5]);
  for (const index of [2, 3, 4])
    assert.ok(
      !described.slice(0, 2).includes(described[index]),
      cases[index].source.name,
    );
  for (const [index, { source, kind }] of cases.entries()) {
    const html = markupCopy(source, kind);
    assert.equal(
      html.includes('data-copied-role-interpretation="true"'),
      index >= 2,
      source.name,
    );
  }
});
