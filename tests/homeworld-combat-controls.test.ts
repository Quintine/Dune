import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { GameView } from '../game/engine';
import { IxSubstitution } from '../components/ix-substitution';
import { FaceDanceDecision } from '../components/face-dance-decision';

// Narrow presentation fixtures, not initialized games or engine legality proof.
// The actual dispatcher/AI tests separately verify state and action contracts.
function render(
  component: typeof IxSubstitution | typeof FaceDanceDecision,
  view: unknown,
) {
  return renderToStaticMarkup(
    createElement(component, {
      game: view as GameView,
      act: () => {},
      busy: false,
    }),
  );
}

void test('Homeworld Ix substitution renders native counters and the world name without invented sectors', () => {
  const game = {
    me: 'i',
    players: [{ id: 'i', forces: {}, elites: { forces: {} } }],
    combatLocations: [
      {
        id: 'homeworld:ixians',
        kind: 'homeworld',
        name: 'Ix',
        forces: { i: { normal: 3, elite: 0 } },
      },
    ],
    decision: {
      kind: 'ixSubstitution',
      player: 'i',
      territory: 'homeworld:ixians',
      losses: { 'homeworld:ixians': 2 },
    },
  };
  const before = structuredClone(game);
  const html = render(IxSubstitution, game);
  assert.match(html, /Retained cyborgs return to Ix/);
  assert.match(html, /Ix · 3 suboids available/);
  assert.match(html, /Ix · 2 cyborgs lost/);
  assert.doesNotMatch(html, /Sector|casualty sectors|undefined|NaN/);
  assert.deepEqual(game, before);
});

function faceDance(blocked?: string) {
  return {
    me: 't',
    players: [
      {
        id: 't',
        reserves: 5,
        forces: { 'arrakeen:10': 2 },
        faceDancers: [{ leader: 'atreides-0', revealed: false }],
      },
      { id: 'a', name: 'Atreides', forces: {} },
    ],
    combatLocations: [
      {
        id: 'homeworld:tleilaxu',
        kind: 'homeworld',
        name: 'Tleilax',
        forces: { t: { normal: 5, elite: 0 }, a: { normal: 3, elite: 0 } },
      },
    ],
    decision: {
      kind: 'faceDance',
      player: 't',
      winner: 'a',
      leader: 'atreides-0',
      identity: 'atreides-0',
      territory: 'homeworld:tleilaxu',
      ...(blocked ? { blocked } : {}),
    },
  };
}

void test('native Face Dance displays foreign survivors, preserves native pool and offers zero external replacement without a destination sector', () => {
  const game = faceDance();
  const before = structuredClone(game);
  const html = render(FaceDanceDecision, game);
  assert.match(html, /Atreides won in Tleilax/);
  assert.match(html, /winner’s 3 remaining forces/);
  assert.match(html, /native forces already at Tleilax remain there/);
  assert.match(html, /zero additional forces/);
  assert.match(html, /Arrakeen · sector 10/);
  assert.match(html, /0 \/ 3 replacement forces selected/);
  assert.doesNotMatch(
    html,
    /face-source-reserves|face-sector|Replacement sector|undefined|NaN/,
  );
  const revealButton = html.match(
    /<button\b[^>]*>Reveal Face Dancer<\/button>/,
  )?.[0];
  assert.ok(revealButton);
  assert.doesNotMatch(revealButton, /\sdisabled(?:=|[ >])/);
  assert.deepEqual(game, before);
});

void test('a projected Face Dance return restriction disables reveal and retains decline', () => {
  const reason = 'The winner’s native return requires a destination ruling.';
  const html = render(FaceDanceDecision, faceDance(reason));
  assert.match(html, /<output\b/);
  assert.ok(html.includes(reason));
  assert.match(
    html,
    /<button\b[^>]*\sdisabled(?:=|[ >])[^>]*>Reveal Face Dancer<\/button>/,
  );
  const decline = html.match(
    /<button\b[^>]*>Decline Face Dancer<\/button>/,
  )?.[0];
  assert.ok(decline);
  assert.doesNotMatch(decline, /\sdisabled(?:=|[ >])/);
});
