import assert from 'node:assert/strict';
import { mock } from 'node:test';
import {
  applyAction,
  createGame,
  newPlayer,
  joinGame,
  initializeLeaderSkillsGameForAudit,
  viewGame,
  type Game,
  type Action,
} from '../game/engine';
import { LEADER_SKILL_CARDS } from '../game/leader-skill-cards';
import { botActions } from '../game/bots';

/** Genuine Richese + Leader Skills setup, then an explicitly conserved shipment scenario. */
export function smugglerNoFieldGame(advanced = false): Game {
  let g = createGame(
    'SMUGNOFL',
    newPlayer('r', 'Richese', 'richese'),
    advanced,
    ['choam'],
  );
  joinGame(g, newPlayer('h', 'Harkonnen', 'harkonnen'));
  joinGame(g, newPlayer('g', 'Guild', 'guild'));
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  const index = LEADER_SKILL_CARDS.findIndex((c) => c.id === 'smuggler');
  let cursor = LEADER_SKILL_CARDS.length - 1;
  mock.method(globalThis.crypto, 'getRandomValues', (array: Uint32Array) => {
    array[0] = cursor-- === index ? 0 : 0xffffffff;
    return array;
  });
  try {
    g = initializeLeaderSkillsGameForAudit(g);
  } finally {
    mock.restoreAll();
  }
  for (let i = 0; g.status === 'setup' && i < 80; i++) {
    let accepted = false;
    for (const p of g.players) {
      const view = viewGame(g, p.id);
      const skills = view.leaderSkills!;
      const options: Action[] =
        g.setupStage === 'leaderSkills' && skills.offer
          ? [
              {
                type: 'leaderSkill',
                event: skills.offer.event,
                skill: p.id === 'r' ? 'smuggler' : skills.offer.cards[0],
                leader: skills.eligibleLeaders[0].id,
              },
            ]
          : g.setupStage === 'traitors' && p.traitorChoices.length
            ? [{ type: 'traitor', leader: p.traitorChoices[0] }]
            : botActions(view);
      for (const a of options) {
        try {
          g = applyAction(g, p.id, a);
          accepted = true;
          break;
        } catch {
          /* Other seats may be waiting. */
        }
      }
      if (accepted) break;
    }
    assert.ok(accepted, `setup ${g.setupStage}`);
  }
  assert.equal(g.status, 'playing');
  assert.ok(g.players[0].noField);
  Object.assign(g, {
    phase: 5,
    turn: 2,
    storm: 18,
    active: 'r',
    order: ['r', 'h', 'g'],
    movementRemaining: ['r', 'h', 'g'],
    ready: [],
    response: null,
    decision: null,
    phaseOpening: null,
  });
  for (const p of g.players) {
    g.deck.push(...p.hand);
    Object.assign(p, {
      hand: [],
      forces: {},
      reserves: 20,
      tanks: 0,
      spice: 10,
      shipped: false,
      moved: 0,
      advisors: {},
    });
  }
  return g;
}

export function smugglerNoFieldAction(
  g: Game,
  value: 0 | 3 | 5 = 5,
  smuggler = true,
): Action {
  const p = g.players.find((p) => p.id === 'r')!;
  return {
    type: 'ship',
    noField: p.noField!.tokens.find((t) => t.value === value)!.id,
    event: p.noFieldEvent,
    territory: 'arrakeen',
    sector: 10,
    smuggler,
  };
}

export function conserveNoFieldForces(g: Game) {
  for (const p of g.players)
    assert.equal(
      p.reserves + p.tanks + Object.values(p.forces).reduce((a, b) => a + b, 0),
      20,
      p.id,
    );
}
