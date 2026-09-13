import assert from 'node:assert/strict';
import { mock } from 'node:test';
import {
  applyAction,
  createGame,
  initializeLeaderSkillsGameForAudit,
  joinGame,
  newPlayer,
  viewGame,
  type Game,
} from '../game/engine';
import { LEADER_SKILL_CARDS } from '../game/leader-skill-cards';
import { botActions } from '../game/bots';

export const bureaucratReload = (g: Game): Game =>
  JSON.parse(JSON.stringify(g)) as Game;
export const bureaucratPlayer = (g: Game, id: string) =>
  g.players.find((p) => p.id === id)!;
export function takeBureaucratCard(g: Game, id: string, name = 'Karama') {
  const index = g.deck.findIndex((card) => card.name === name);
  assert.ok(index >= 0);
  const [card] = g.deck.splice(index, 1);
  bureaucratPlayer(g, id).hand.push(card);
  return card;
}
/** Genuine Leader Skills setup; conserved focused position with four or five human seats. */
export function bureaucratPaymentGame({
  advanced = false,
  choam = false,
  phase = 5,
  advisor = false,
}: {
  advanced?: boolean;
  choam?: boolean;
  phase?: number;
  advisor?: boolean;
} = {}): Game {
  let g = createGame(
    'BUROTEST',
    newPlayer('b', 'Bureaucrat', 'atreides'),
    advanced,
    choam ? ['choam'] : [],
  );
  for (const [id, name, faction] of [
    ['p', 'Payer', 'harkonnen'],
    ['e', 'Emperor', 'emperor'],
    ['g', 'Guild', 'guild'],
    ...(choam ? [['r', 'Richese', 'richese']] : []),
    ...(advisor ? [['bg', 'Bene Gesserit', 'beneGesserit']] : []),
  ] as [string, string, Parameters<typeof newPlayer>[2]][])
    joinGame(g, newPlayer(id, name, faction));
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  const index = LEADER_SKILL_CARDS.findIndex(
    (card) => card.id === 'bureaucrat',
  );
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
  for (let step = 0; g.status === 'setup' && step < 80; step++) {
    let next: Game | undefined;
    for (const p of g.players) {
      const offer = g.leaderSkills!.offers[p.id];
      if (g.setupStage === 'leaderSkills' && p.id === 'b' && offer)
        assert.ok(offer.cards.includes('bureaucrat'));
      const view = viewGame(g, p.id);
      view.players.find((player) => player.id === p.id)!.bot = 'Medium';
      const actions =
        g.setupStage === 'leaderSkills' && offer
          ? [
              {
                type: 'leaderSkill',
                event: offer.event,
                skill: p.id === 'b' ? 'bureaucrat' : offer.cards[0],
                leader: `${p.faction}-0`,
              },
            ]
          : g.setupStage === 'traitors' && p.traitorChoices.length
            ? [{ type: 'traitor', leader: p.traitorChoices[0] }]
            : botActions(view);
      for (const action of actions)
        try {
          next = applyAction(g, p.id, action);
          break;
        } catch {}
      if (next) break;
    }
    assert.ok(next, `Setup stalled at ${g.setupStage}`);
    g = next;
  }
  assert.equal(g.status, 'playing');
  for (const p of g.players) {
    g.deck.push(...p.hand);
    Object.assign(p, {
      hand: [],
      spice: 30,
      bribes: 0,
      forces: {},
      reserves: 20,
      tanks: 0,
      shipped: false,
      moved: 0,
      advisors: {},
    });
    if (p.elites) p.elites = { forces: {}, reserves: 5, tanks: 0, revived: 0 };
  }
  Object.assign(g, {
    turn: 2,
    phase,
    storm: 18,
    active: 'p',
    ready: [],
    phaseOpening: null,
    response: null,
    decision: null,
    order: g.players.map((p) => p.id),
    movementRemaining: g.players.map((p) => p.id),
  });
  return g;
}
export function beginBureaucratAuction(g: Game): Game {
  Object.assign(g, {
    phase: 2,
    ready: [],
    active: null,
    phaseOpening: null,
    response: null,
    decision: null,
  });
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  assert.equal(g.phase, 3);
  if (g.phaseOpening)
    for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  return g;
}
export function allowBureaucratIncome(g: Game): Game {
  for (let n = 0; g.response && n < 12; n++) {
    const responder = g.players.find((p) => {
      const controls = viewGame(g, p.id).responseControls;
      return controls && !controls.hasPassed && controls.cancelCards.length;
    });
    assert.ok(responder);
    g = applyAction(g, responder.id, { type: 'passResponse' });
  }
  return g;
}
