import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { assertAdvancedNativeCustody } from './fixture-advanced-native-skills';
import {
  createSemutaSkillsMentatFixture, semutaSkillsDiscardStep, reactSemutaSkillsDiscard,
  openSemutaSkillsMentat, reloadSemutaSkills as reload, semutaSkillsPlayer,
  semutaSkillsInventory, semutaSkillsPhysical, type SemutaSkillsMentatFixture,
} from './fixture-semuta-skills';

const profiles = [
  { advanced: false, tech: false, strongholds: false },
  { advanced: false, tech: true, strongholds: false },
  { advanced: true, tech: false, strongholds: false },
  { advanced: true, tech: true, strongholds: false },
  { advanced: true, tech: false, strongholds: true },
  { advanced: true, tech: true, strongholds: true },
];
function reject(game: Game, actor: string, action: Action): void {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before);
}
function questionResources(game: Game) {
  return structuredClone({ players: game.players, deck: game.deck, discard: game.discard,
    cache: game.richeseCache, removed: game.richeseRemoved, skills: game.leaderSkills,
    tech: game.techTokens, strongholds: game.strongholdCards });
}
function pause(f: SemutaSkillsMentatFixture): Game {
  const step = semutaSkillsDiscardStep(f), game = applyAction(reload(f.game), step.actor, step.action);
  const pending = game.pendingTreacheryDiscard!;
  assert.equal(pending.reaction?.stage, 'offer');
  assert.equal(pending.batch.cause, 'ordinary:hajr');
  assert.deepEqual(pending.batch.entries.map(e => ({ id: e.card.id, actor: e.discardedBy, publicFace: e.publicFace })),
    [{ id: f.hajr, actor: f.spender, publicFace: true }]);
  assert.equal(pending.continuation.kind, 'ordinaryCardDiscard');
  if (pending.continuation.kind !== 'ordinaryCardDiscard') throw Error('Expected the original Hajr continuation');
  assert.equal(pending.continuation.player, f.spender);
  assert.equal(pending.continuation.effect, 'hajr');
  assert.equal(game.active, f.spender);
  assert.equal(game.phase, 5);
  assert.equal(game.hajr.filter(id => id === f.spender).length, 1);
  assert.deepEqual(semutaSkillsPhysical(game), semutaSkillsPhysical(f.game));
  assert.deepEqual(semutaSkillsInventory(game), semutaSkillsInventory(f.game));
  reject(game, f.spender, { type: 'endMovement' });
  return game;
}
function resumedQuestion(pending: Game, f: SemutaSkillsMentatFixture, claim: boolean): Game {
  const event = pending.pendingTreacheryDiscard!.batch.event;
  const movement = reactSemutaSkillsDiscard(reload(pending), claim);
  assert.equal(movement.pendingTreacheryDiscard, null);
  assert.equal(movement.phase, 5);
  assert.equal(movement.active, f.spender, 'The original Atreides closing owner resumes before Battle');
  assert.deepEqual(movement.movementRemaining, f.game.movementRemaining);
  assert.equal(movement.hajr.filter(id => id === f.spender).length, 1);
  assert.equal(semutaSkillsPlayer(movement, f.owner).hand.some(c => c.id === f.hajr), claim);
  assert.equal(semutaSkillsPlayer(movement, f.owner).hand.some(c => c.id === f.semuta), !claim);
  assert.equal(movement.discard.filter(c => c.id === f.hajr).length, Number(!claim));
  assert.equal(movement.discard.filter(c => c.id === f.semuta).length, Number(claim));
  assert.deepEqual(semutaSkillsPhysical(movement), semutaSkillsPhysical(f.game));
  assert.deepEqual(semutaSkillsInventory(movement), semutaSkillsInventory(f.game));
  reject(movement, f.owner, { type: 'semutaCommit', event });
  const game = openSemutaSkillsMentat(reload(movement), f);
  assert.equal(game.decision?.kind, 'mentatQuestion', 'Semuta must retain the original native skill consumer');
  assert.equal(game.decision?.player, f.owner);
  assert.equal(game.battle?.mentatQuestion?.leader, f.trainer);
  assert.equal(game.battle?.mentatQuestion?.stage, 'name');
  assert.equal(game.battle?.mentatQuestion?.owner, f.owner);
  assert.equal(game.battle?.mentatQuestion?.target, f.target);
  assertAdvancedNativeCustody(game);
  assert.deepEqual(semutaSkillsInventory(game), semutaSkillsInventory(f.game));
  return game;
}

for (const profile of profiles) {
  const label = `${profile.advanced ? 'Advanced' : 'Basic'}${profile.tech ? ' Tech' : ''}${profile.strongholds ? ' Strongholds' : ''}`;
  void test(`${label} Semuta claim/pass resumes the native owner before a genuine private Mentat question and reply`, () => {
    const f = createSemutaSkillsMentatFixture(profile.advanced, profile.tech, profile.strongholds);
    const pending = pause(f);
    for (const claim of [false, true]) for (const matched of [false, true]) {
      const game = resumedQuestion(pending, f, claim), before = questionResources(game);
      const event = game.battle!.mentatQuestionEvent!;
      const weapon = matched ? 'Crysknife' : 'Lasgun';
      const expected = matched ? f.weapon : f.fallback;
      assert.ok(viewGame(game, f.owner).mentat.pending!.weapons.includes(weapon));
      for (const id of [f.target, f.spender]) {
        assert.deepEqual(viewGame(game, id).mentat.pending!.weapons, []);
        assert.deepEqual(viewGame(game, id).mentat.pending!.cards, []);
        reject(game, id, { type: 'decision', event, weapon });
      }
      const named = applyAction(reload(game), f.owner, { type: 'decision', event, weapon });
      assert.equal(named.decision?.kind, 'mentatQuestion');
      assert.equal(named.decision?.player, f.target, 'Both exact and fallback questions use the same target-owned reply');
      assert.equal(named.battle!.mentatQuestion!.stage, 'reveal');
      assert.equal(named.battle!.mentatQuestionEvent, event);
      const choices = viewGame(named, f.target).mentat.pending!.cards;
      assert.deepEqual(choices.map(c => c.id), matched ? [f.weapon] : [f.weapon, f.fallback]);
      for (const id of [f.owner, f.spender]) {
        assert.deepEqual(viewGame(named, id).mentat.pending!.cards, []);
        assert.deepEqual(viewGame(named, id).mentat.history, []);
        reject(named, id, { type: 'decision', event, card: expected });
      }
      if (matched) reject(named, f.target, { type: 'decision', event, card: f.fallback });
      reject(named, f.target, { type: 'decision', event: 'stale', card: expected });
      const shown = applyAction(reload(named), f.target, { type: 'decision', event, card: expected });
      assert.equal(shown.battle!.mentatQuestion!.stage, 'answered');
      assert.equal(shown.decision?.kind, 'leaderSkillVisibility');
      assert.deepEqual(questionResources(shown), before, 'A normal question never transfers, reserves, spends or edits components');
      assert.deepEqual(semutaSkillsPlayer(shown, f.target).hand.map(c => c.id), [f.weapon, f.fallback]);
      for (const id of [f.owner, f.target]) {
        const history = viewGame(shown, id).mentat.history;
        assert.equal(history.length, 1);
        assert.equal(history[0].event, event);
        assert.equal(history[0].card.id, expected);
        assert.equal(history[0].weapon, weapon);
      }
      assert.deepEqual(viewGame(shown, f.spender).mentat.history, []);
      assert.ok(!JSON.stringify(viewGame(shown, f.spender)).includes(expected));
      assert.ok(!JSON.stringify(shown.log).includes(expected));
      reject(shown, f.owner, { type: 'decision', event, weapon });
      reject(shown, f.target, { type: 'decision', event, card: expected });
      let posture = reload(shown);
      while (posture.decision?.kind === 'leaderSkillVisibility') {
        const decision = posture.decision;
        posture = applyAction(posture, decision.player,
          { type: 'leaderSkillVisibility', event: decision.event, hide: false });
      }
      assert.equal(posture.battle!.leaderSkillHidden!.r, false, 'The normal Mentat may stay face-up after the private question');
      assert.ok(posture.battle?.preparation || posture.decision?.kind === 'fullPlanOffer' || posture.battle?.preLeader);
      assertAdvancedNativeCustody(posture);
      assert.deepEqual(semutaSkillsInventory(posture), semutaSkillsInventory(f.game));
    }
  });
}

void test('all four AI profiles participate legally in the original private Mentat contract after Semuta claim/pass', () => {
  for (const profile of profiles) {
    const f = createSemutaSkillsMentatFixture(profile.advanced, profile.tech, profile.strongholds);
    const pending = pause(f);
    for (const claim of [false, true]) {
      const question = resumedQuestion(pending, f, claim);
      for (const difficulty of DIFFICULTIES) {
        const own = viewGame(question, f.owner);
        own.players.find(p => p.id === f.owner)!.bot = difficulty;
        const name = botActions(own)[0];
        assert.ok(name && own.mentat.pending!.weapons.includes(name.weapon as string));
        assert.equal(name.event, question.battle!.mentatQuestionEvent);
        for (const id of [f.target, f.spender]) {
          const other = viewGame(question, id);
          other.players.find(p => p.id === id)!.bot = difficulty;
          assert.deepEqual(botActions(other), []);
        }
        const named = applyAction(reload(question), f.owner, name), before = questionResources(named);
        const target = viewGame(named, f.target);
        target.players.find(p => p.id === f.target)!.bot = difficulty;
        const answer = botActions(target)[0];
        assert.ok(answer && target.mentat.pending!.cards.some(c => c.id === answer.card));
        assert.equal(answer.event, name.event);
        for (const id of [f.owner, f.spender]) {
          const other = viewGame(named, id);
          other.players.find(p => p.id === id)!.bot = difficulty;
          assert.deepEqual(botActions(other), []);
        }
        const shown = applyAction(reload(named), f.target, answer);
        assert.equal(shown.decision?.kind, 'leaderSkillVisibility');
        assert.deepEqual(questionResources(shown), before);
        assert.equal(viewGame(shown, f.owner).mentat.history[0].card.id, answer.card);
        assert.deepEqual(viewGame(shown, f.spender).mentat.history, []);
        assertAdvancedNativeCustody(shown);
      }
    }
  }
});
