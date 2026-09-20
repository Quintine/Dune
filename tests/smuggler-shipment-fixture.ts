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
} from '../game/engine';
import { LEADER_SKILL_CARDS } from '../game/leader-skill-cards';
import type { FactionId } from '../game/catalog';
import { botActions } from '../game/bots';

/** Genuine module setup followed by a conserved, explicitly staged shipment turn. */
export function smugglerShipmentGame(
  faction: FactionId = 'emperor',
  advanced = false,
  skill: 'smuggler' | 'sandmaster' = 'smuggler',
  opponentFaction?: FactionId,
): Game {
  let g = createGame('SMUGSHIP', newPlayer('p', 'Smuggler', faction), advanced);
  joinGame(
    g,
    newPlayer('h', 'Opponent', opponentFaction ?? (faction === 'guild' ? 'emperor' : 'guild')),
  );
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  const index = LEADER_SKILL_CARDS.findIndex((c) => c.id === skill);
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
  for (let i = 0; g.status === 'setup' && i < 60; i++) {
    let accepted = false;
    for (const p of g.players) {
      const view = viewGame(g, p.id);
      const skills = view.leaderSkills!;
      const options =
        g.setupStage === 'leaderSkills' && skills.offer
          ? [
              {
                type: 'leaderSkill',
                event: skills.offer.event,
                skill: p.id === 'p' ? skill : skills.offer.cards[0],
                leader: skills.eligibleLeaders[0].id,
              },
            ]
          : g.setupStage === 'traitors' && p.traitorChoices.length
            ? [{ type: 'traitor', leader: p.traitorChoices[0] }]
            : g.setupStage === 'prediction' && p.faction === 'beneGesserit'
              ? [{ type: 'predict', faction: g.players.find(other => other.id !== p.id)!.faction, turn: 3 }]
              : g.setupStage === 'forces' &&
                  p.faction === 'fremen' &&
                  p.reserves === 20
                ? [
                    {
                      type: 'fremenSetup',
                      placements: {
                        sietch_tabr: 10,
                        false_wall_south: 0,
                        false_wall_west: 0,
                      },
                    },
                  ]
                : g.setupStage === 'forces' &&
                    p.faction === 'beneGesserit' &&
                    !p.advisorSetup
                  ? [
                      {
                        type: 'advisorSetup',
                        territory: 'arrakeen',
                        sector: 10,
                      },
                    ]
                  : botActions(view);
      for (const a of options) {
        try {
          g = applyAction(g, p.id, a);
          accepted = true;
          break;
        } catch {
          /* Other seats can be waiting. */
        }
      }
      if (accepted) break;
    }
    assert.ok(accepted, `setup ${g.setupStage}`);
  }
  assert.equal(g.status, 'playing');
  Object.assign(g, {
    phase: 5,
    turn: 2,
    storm: 18,
    active: 'p',
    order: ['p', 'h'],
    movementRemaining: ['p', 'h'],
    ready: [],
    response: null,
    decision: null,
    phaseOpening: null,
  });
  for (const p of g.players) {
    g.deck.push(...p.hand);
    p.hand = [];
    p.forces = {};
    p.reserves = 20;
    p.tanks = 0;
    p.shipped = false;
    p.moved = 0;
    p.advisors = {};
    if (p.elites) p.elites = { ...p.elites, forces: {},
      reserves: p.elites.reserves + p.elites.tanks + Object.values(p.elites.forces).reduce((sum, n) => sum + n, 0), tanks: 0 };
  }
  return g;
}
