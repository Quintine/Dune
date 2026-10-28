import assert from 'node:assert/strict';
import test from 'node:test';
import { TRUTH_CARD_NAMES } from '../game/truthtrance-card-names';
import { knowledgeFactAnswer, knowledgeFactText, parseKnowledgeFact, truthKnowledgeOf } from '../game/truthtrance-knowledge';
import {
  advanceTruthtranceRichesePromises as advance,
  createTruthtranceRichesePromisesFixture as fixture,
  truthtranceRichesePromisesClean as clean,
} from './fixture-truthtrance-richese-promises';

/** The original fixture orders only unopened cards and advances the actual auction. */
function liveCache() {
  const f = fixture();
  const game = advance(f.earlySource, state => clean(state) && state.phase === 3 &&
    state.richeseAuction?.source === 'cache' && !state.richeseAuction.outcome);
  const card = game.richeseCache!.find(item => item.id === game.richeseAuction!.cardId);
  assert.ok(card);
  return { game, card };
}

void test('public cache question validates printed faces and answers from the active lot', () => {
  const { game, card } = liveCache();
  const yes = { kind: 'cacheLot', name: card.name } as const;
  const absent = TRUTH_CARD_NAMES.find(name => name !== card.name); assert.ok(absent);
  assert.deepEqual(parseKnowledgeFact({ ...yes, extra: true }), yes);
  assert.throws(() => parseKnowledgeFact({ kind: 'cacheLot', name: 'Not a real card' }));
  assert.match(knowledgeFactText(yes), /public Richese cache auction card/);
  for (const player of game.players) {
    const knowledge = truthKnowledgeOf(game, player);
    assert.equal(knowledge.cacheLot, card.name);
    assert.equal(knowledgeFactAnswer(yes, knowledge), 'yes');
    assert.equal(knowledgeFactAnswer({ kind: 'cacheLot', name: absent }, knowledge), 'no');
  }
});

void test('cache lot question becomes unknown outside the supported active Basic public lot', () => {
  const { game, card } = liveCache();
  const fact = { kind: 'cacheLot', name: card.name } as const;
  const outside = [
    (copy: typeof game) => { copy.phase = 4; },
    (copy: typeof game) => { copy.advanced = true; },
    (copy: typeof game) => { copy.richeseAuction = null; },
    (copy: typeof game) => { copy.richeseAuction!.source = 'blackMarket'; },
    (copy: typeof game) => { copy.richeseAuction!.outcome = { kind: 'unbid' }; },
    (copy: typeof game) => { copy.richeseCache = copy.richeseCache!.filter(item => item.id !== card.id); },
  ];
  for (const change of outside) {
    const staged = structuredClone(game); change(staged);
    for (const player of staged.players)
      assert.equal(knowledgeFactAnswer(fact, truthKnowledgeOf(staged, player)), 'unknown');
  }
  assert.equal(knowledgeFactAnswer(fact), 'unknown');
});
