import assert from 'node:assert/strict';
import test from 'node:test';
import {applyAction,viewGame} from '../game/engine';
import {botActions} from '../game/bots';
import {DIFFICULTIES} from '../game/bot-profiles';
import {NATIVE_MENTAT_FAMILIES,nativeMentatBattle} from './fixture-native-mentat';

for (const family of NATIVE_MENTAT_FAMILIES) {
  void test(`${family} Mentat requires an explicit preview and resumes native posture after a matching or fallback answer`,()=>{
    const ordinary = nativeMentatBattle(family,true,false);
    assert.equal(ordinary.battle!.mentatQuestion,undefined);
    assert.equal(ordinary.decision!.kind,'leaderSkillVisibility');
    for (const matching of [true,false]) {
      let game = nativeMentatBattle(family,matching);
      assert.equal(game.decision!.kind,'mentatQuestion');
      const receipt = game.battle!.mentatQuestion!;
      const weapon = game.expansions.includes('ix') ? 'Weirding Way' : 'Crysknife';
      const shown = game.players.find(p => p.id === receipt.target)!.hand[0];
      const owner = viewGame(game,receipt.owner);
      assert.ok(owner.mentat.pending!.weapons.includes(weapon));
      assert.ok(!owner.mentat.pending!.weapons.includes('Chemistry'));
      game = applyAction(game,receipt.owner,{type:'decision',event:receipt.event,weapon});
      const choice = viewGame(game,receipt.target).mentat.pending!;
      assert.deepEqual(choice.cards,[shown]);
      game = applyAction(game,receipt.target,{type:'decision',event:receipt.event,card:shown.id});
      assert.equal(game.decision!.kind,'leaderSkillVisibility');
      assert.equal(viewGame(game,receipt.owner).mentat.history[0].card.id,shown.id);
      assert.ok(game.players.find(p => p.id === receipt.target)!.hand.some(c => c.id === shown.id));
      assert.equal(game.battle!.preparation,undefined);
      game = applyAction(game,receipt.owner,{type:'leaderSkillVisibility',event:game.battle!.event,hide:true});
      assert.equal(game.battle!.leaderSkillHidden![receipt.owner],true);
    }
  });
}

void test('all four policies complete native Ixian Mentat naming and compulsory disclosure before posture',()=>{
  for (const difficulty of DIFFICULTIES) {
    let game = nativeMentatBattle('ixians');
    const receipt = game.battle!.mentatQuestion!;
    for (const id of [receipt.owner,receipt.target]) {
      const view = viewGame(game,id);
      view.players.find(p => p.id === id)!.bot = difficulty;
      const action = botActions(view)[0];
      assert.equal(action.event,receipt.event);
      game = applyAction(game,id,action);
    }
    assert.equal(game.battle!.mentatQuestion!.stage,'answered');
    assert.equal(game.decision!.kind,'leaderSkillVisibility');
    assert.equal(viewGame(game,receipt.owner).mentat.history[0].card.id,game.players.find(p => p.id === receipt.target)!.hand[0].id);
  }
});
