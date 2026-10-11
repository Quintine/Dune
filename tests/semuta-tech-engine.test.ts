import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, type Game } from '../game/engine';
import { initializeSemutaTechGame, semutaTechBattleFixture } from './fixture-semuta-tech';

const reload = (game: Game): Game => JSON.parse(JSON.stringify(game));
const player = (game: Game, id: string) => game.players.find(p => p.id === id)!;
const inventory = (game: Game) => [...game.deck, ...game.discard, ...game.richeseCache!, ...game.players.flatMap(p => p.hand)].map(card => card.id).sort();
const pass = (game: Game) => {
  const event = game.pendingTreacheryDiscard!.batch.event;
  for (const id of ['a', 'e', 'r']) game = applyAction(game, id, { type: 'semutaPass', event });
  return game;
};

for (const advanced of [false, true]) {
  void test(`Semuta ${advanced ? 'Advanced' : 'Basic'} keeps original setup and first-Storm Tech ownership`, () => {
    const game = initializeSemutaTechGame(advanced);
    assert.equal(game.techTokens!.axlotl.owner, 'e');
    assert.equal(new Set(Object.values(game.techTokens!).map(token => token.owner)).size, 3);
  });
  void test(`Semuta ${advanced ? 'Advanced' : 'Basic'} resumes one original token choice after mandatory and winner discards`, () => {
    const f = semutaTechBattleFixture(advanced);
    let state = applyAction(f.game, 'a', { type: 'chooseBattle', territory: 'arrakeen', target: 'e' });
    for (let step = 0; step < 40; step++) {
      if (state.response) {
        const actor = state.players.find(p => !state.response!.passed.includes(p.id))!;
        state = applyAction(state, actor.id, { type: 'passResponse' });
      } else if (state.battle?.preparation)
        state = applyAction(state, state.battle.preparation.owner, { type: 'declineBattlePower' });
      else if (state.decision?.kind === 'fullPlanOffer')
        state = applyAction(state, state.decision.player, { type: 'decision', decline: true });
      else break;
    }
    for (const id of ['a', 'e']) state = applyAction(state, id, { type: 'battlePreparationReady', event: state.battle!.preLeader!.event });
    state = applyAction(state, 'a', { type: 'battlePlan', dial: 2, support: advanced ? 2 : 0,
      leader: player(state, 'a').leaders[0].id, weapon: f.weapon });
    state = applyAction(state, 'e', { type: 'battlePlan', dial: 0, support: 0,
      leader: player(state, 'e').leaders[0].id, defense: f.defense });
    for (const id of ['a', 'e']) state = applyAction(state, id, { type: 'traitorCall', call: false });
    assert.equal(state.pendingTreacheryDiscard?.reaction?.stage, 'offer');
    const winner = applyAction(pass(reload(state)), 'a', { type: 'decision', discard: [f.weapon] });
    assert.equal(winner.pendingTreacheryDiscard?.reaction?.stage, 'offer');
    for (const pending of [state, winner]) {
      const event = pending.pendingTreacheryDiscard!.batch.event;
      const fresh = pending.pendingTreacheryDiscard!.batch.entries[0].card.id;
      for (const claim of [false, true]) {
        let resumed = claim ? applyAction(reload(pending), 'r', { type: 'semutaCommit', event }) : pass(reload(pending));
        if (resumed.decision?.kind === 'battleCards') resumed = applyAction(resumed, 'a', { type: 'decision', discard: [] });
        assert.equal(resumed.decision?.kind, 'techToken');
        assert.equal(resumed.decision?.player, 'a');
        assert.equal(resumed.techTokens!.axlotl.owner, 'e');
        assert.equal(resumed.techTokens!.heighliners.owner, 'e');
        for (const token of ['axlotl', 'heighliners'] as const) {
          let awarded = applyAction(reload(resumed), 'a', { type: 'decision', token });
          assert.equal(awarded.techTokens![token].owner, 'a');
          assert.equal(awarded.techTokens![token === 'axlotl' ? 'heighliners' : 'axlotl'].owner, 'e');
          assert.equal(awarded.techTokens!.production.owner, 'r');
          assert.equal(awarded.decision?.kind, 'faceDance');
          assert.throws(() => applyAction(awarded, 'a', { type: 'decision', token }));
          awarded = applyAction(awarded, 'e', { type: 'decision', reveal: false });
          assert.equal(awarded.techTokens![token].owner, 'a');
          assert.equal(player(awarded, 'r').hand.some(card => card.id === fresh), claim);
          assert.equal(awarded.discard.some(card => card.id === f.semuta), claim);
          assert.deepEqual(inventory(awarded), f.cards);
          assert.throws(() => applyAction(awarded, 'r', { type: 'semutaCommit', event }));
        }
      }
    }
  });
}
