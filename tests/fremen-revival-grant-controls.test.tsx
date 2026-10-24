import assert from 'node:assert/strict';
import test from 'node:test';
import { Children, createElement, isValidElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FremenRevivalGrant } from '../components/fremen-revival-grant';
import {
  createGame,
  newPlayer,
  viewGame,
  type Action,
  type GameView,
} from '../game/engine';

// These client fixtures exercise public grant projections. Engine source tests
// own the actual alliance, Karama response and physical revival transitions.
function projected(): GameView {
  const game = createGame('FREMENGRANTCONTROLS', newPlayer('f', 'Fremen', 'fremen'));
  game.players.push(newPlayer('a', 'Ally', 'emperor'));
  Object.assign(game, {
    status: 'playing', phase: 4, turn: 3, order: ['f', 'a'],
  });
  game.players[0].ally = 'a';
  game.players[1].ally = 'f';
  const view = viewGame(game, 'f');
  view.fremenRevivalGrant = { recipient: 'a', granted: false, blocked: null };
  return view;
}

function markup(game: GameView, busy = false) {
  return renderToStaticMarkup(createElement(FremenRevivalGrant, {
    game, busy, act() {},
  }));
}

function click(node: ReactNode): boolean {
  for (const child of Children.toArray(node)) {
    if (!isValidElement<{
      children?: ReactNode;
      onClick?: () => void;
      'data-testid'?: string;
    }>(child)) continue;
    if (child.props['data-testid'] === 'fremen-revival-grant-submit' && child.props.onClick) {
      child.props.onClick();
      return true;
    }
    if (click(child.props.children)) return true;
  }
  return false;
}

function grant(game: GameView, busy = false): Action[] {
  const actions: Action[] = [];
  click(FremenRevivalGrant({ game, busy, act(action) { actions.push(action); } }));
  return actions;
}

void test('native Fremen grant renders its ally and submits the original grant action once', () => {
  const game = projected();
  const html = markup(game);
  assert.match(html, /aria-label="Fremen ally free revival"/);
  assert.match(html, /Grant Ally an ordinary free force revival rate of three this phase/);
  assert.match(html, /Grant ally free revival/);
  assert.doesNotMatch(html, /disabled=""/);
  assert.deepEqual(grant(game), [{ type: 'grantRevival' }]);
});

void test('the persistent grant guide names native three, provisional Recruits current rates, prior free use and no refunds', () => {
  const html = markup(projected());
  assert.match(html, /replaces their native ordinary rate rather than adding three/);
  assert.match(html, /Ordinary total revival and special-force limits still apply/);
  assert.match(html, /Provisional current-rate policy/);
  assert.match(html, /Recruits doubles the current granted rate, including applicable bonuses,\s*before caps/);
  assert.match(html, /Later grants use the same current-rate calculation/);
  assert.match(html, /your ally’s revival controls show the actual remaining allowance/);
  assert.match(html, /Previously recorded free returns use the allowance/);
  assert.match(html, /Earlier paid returns keep their payments and count toward the total revival limit/);
  assert.match(html, /no refund or retroactive reclassification/);
  assert.match(html, /Another player may use Karama before the original alliance grant takes effect/);
  assert.match(html, /Canceling blocks this Fremen grant to the current ally for this Revival/);
  assert.match(html, /the ally retains its intrinsic rate and Recruits/);
  assert.match(html, /Completed revivals and payments stay unchanged/);
  assert.match(html, /response timing and prevention scope are provisional/);
});

void test('busy, Truthtrance and pending Nexus block the actual callback', () => {
  const game = projected();
  assert.deepEqual(grant(game, true), []);
  assert.match(markup(game, true), /<button\b[^>]*\sdisabled=""/);
  const truthtrance = structuredClone(game);
  truthtrance.truthtrance = {} as NonNullable<GameView['truthtrance']>;
  assert.deepEqual(grant(truthtrance), []);
  assert.match(markup(truthtrance), /<button\b[^>]*\sdisabled=""/);
  const nexus = structuredClone(game);
  nexus.nexusTraitors = {
    offer: null,
    pending: {} as NonNullable<NonNullable<GameView['nexusTraitors']>['pending']>,
  };
  assert.deepEqual(grant(nexus), []);
  assert.match(markup(nexus), /<button\b[^>]*\sdisabled=""/);
});

void test('blocked and granted projections retain readable status and guidance without permitting replay', () => {
  for (const status of ['blocked', 'granted'] as const) {
    const game = projected();
    if (status === 'blocked') game.fremenRevivalGrant!.blocked = 'Karama prevents this ally grant for the rest of this phase.';
    if (status === 'granted') game.fremenRevivalGrant!.granted = true;
    for (let render = 0; render < 3; render++) {
      const html = markup(game);
      assert.match(html, /Grant ally free revival/);
      assert.match(html, /<button\b[^>]*\sdisabled=""/);
      assert.match(html, /Provisional current-rate policy/);
      if (status === 'blocked') {
        assert.match(html, /Karama prevents this ally grant for the rest of this phase/);
        assert.match(html, /aria-describedby="fremen-revival-grant-unavailable"/);
      } else {
        assert.match(html, /Free revival has been granted to Ally for this phase/);
      }
      assert.deepEqual(grant(game), []);
    }
  }
});

void test('the grant control uses only its native owner, actual ally and current Revival projection', () => {
  for (const field of ['phase', 'status', 'viewer', 'faction', 'ally', 'recipient', 'offer'] as const) {
    const game = projected();
    if (field === 'phase') game.phase = 5;
    if (field === 'status') game.status = 'lobby';
    if (field === 'viewer') game.me = 'a';
    if (field === 'faction') game.players[0].faction = 'emperor';
    if (field === 'ally') game.players[0].ally = null;
    if (field === 'recipient') game.fremenRevivalGrant!.recipient = 'someone-else';
    if (field === 'offer') game.fremenRevivalGrant = null;
    assert.equal(markup(game), '', field);
    assert.deepEqual(grant(game), [], field);
  }
});

void test('grant guidance never reads the ally wallet, Tanks or private revival use', () => {
  const game = projected();
  const ally = game.players.find((player) => player.id === 'a')!;
  for (const field of ['spice', 'tanks', 'deadForces', 'revived', 'freeForcesRevived']) {
    Object.defineProperty(ally, field, {
      get() { throw new Error(`Grant control read private ally ${field}`); },
    });
  }
  assert.match(markup(game), /Grant Ally an ordinary free force revival rate of three/);
  assert.deepEqual(grant(game), [{ type: 'grantRevival' }]);
});
