import test from 'node:test';
import assert from 'node:assert/strict';
import { viewGame, type GameView } from '../game/engine';
import {
  nexusAdvisorAction,
} from '../game/nexus-advisor-options';
import { nexusAdvisorFixture } from './fixture-nexus-advisors';


void test('advisor selection rejects other actors, Basic, wrong phase and all interrupted windows', () => {
  const original = viewGame(nexusAdvisorFixture(), 'p');
  for (const mutate of [
    (v: GameView) => {
      v.me = 'q';
    },
    (v: GameView) => {
      v.advanced = false;
    },
    (v: GameView) => {
      v.phase = 4;
    },
    (v: GameView) => {
      v.active = 'q';
    },
    (v: GameView) => {
      v.players[0].ally = 'q';
    },
    (v: GameView) => {
      v.nexusCards!.card = null;
    },
    (v: GameView) => {
      v.automaticContinuationPending = true;
    },
    (v: GameView) => {
      v.decision = { kind: 'nullentropy', player: 'p' };
    },
    (v: GameView) => {
      v.truthtrance = {
        stage: 'priority',
        queue: [],
        passed: [],
        question: null,
      };
    },
    (v: GameView) => {
      v.nexusCards!.waiting = ['q'];
    },
    (v: GameView) => {
      v.nexusTraitors = {
        offer: null,
        pending: {
          event: 'other',
          owner: 'q',
          mode: 'cunning',
          count: 1,
          choices: [],
        },
      };
    },
  ]) {
    const v = structuredClone(original);
    mutate(v);
    assert.equal(
      nexusAdvisorAction(v, v.nexusAdvisors!.offer!.event, ['arrakeen']),
      null,
    );
  }
});

