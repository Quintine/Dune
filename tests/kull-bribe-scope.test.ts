import assert from 'node:assert/strict';
import test from 'node:test';
import { bribePromiseModeSupported } from '../game/bribe-promises';
import { bribeExpressionPromiseModeSupported } from '../game/bribe-expression-promises';
import { bribeTimingBlock } from '../game/bribe-options';
import { viewGame } from '../game/engine';
import { act, createPublicChoamKullFixture, publicKullAttempt } from './fixture-public-choam-kull';

const basic = {
  advanced: false,
  expansions: ['choam', 'ix'],
  players: [{faction:'choam'}, {faction:'emperor'}, {faction:'guild'}],
};

void test('Basic printed Kull supports the shared bribe family in its declared native envelope', () => {
  for (const quote of [bribePromiseModeSupported, bribeExpressionPromiseModeSupported]) {
    assert.equal(quote({...basic,kullPreview:true}),true);
    assert.equal(quote({...basic,expansions:['ix','choam'],kullPreview:true}),true);
    assert.equal(quote({...basic,kullPreview:false}),true);
    assert.equal(quote({...basic,advanced:true,kullPreview:true}),false);
    assert.equal(quote({...basic,expansions:['choam'],kullPreview:true}),false);
    assert.equal(quote({...basic,expansions:['choam','ix','ecaz'],kullPreview:true}),true);
    assert.equal(quote({...basic,players:[{faction:'emperor'},{faction:'guild'}],kullPreview:true}),false);
    assert.equal(quote({...basic,players:[{faction:'choam'},{faction:'ixians'}],kullPreview:true,mobileStronghold:{}}),true);
    assert.equal(quote({...basic,players:[{faction:'choam'},{faction:'tleilaxu'}],kullPreview:true}),true);
    assert.equal(quote({...basic,players:[{faction:'choam'},{faction:'ecaz'}],expansions:['choam','ix','ecaz'],kullPreview:true}),true);
    assert.equal(quote({...basic,players:[{faction:'choam'},{faction:'moritani'}],expansions:['choam','ix','ecaz'],kullPreview:true}),true);
    assert.equal(quote({...basic,players:[{faction:'choam'},{faction:'ecaz'}],kullPreview:true}),false);
    assert.equal(quote({...basic,players:[{faction:'choam'},{faction:'richese'}],kullPreview:true}),false);
    assert.equal(quote({...basic,players:[{faction:'choam'},{faction:'emperor'},{faction:'emperor'}],kullPreview:true}),false);
    for (const option of ['semutaPreview','nexusKullPreview','richeseBetrayalPreview','guildBetrayalPreview',
      'nexusIxianReplacementPreview','nexusIxianBetrayalPreview','nexusHarkonnenBetrayalPreview',
      'moritaniAssassinatePreview','mobileStronghold','nexusCards','homeworlds','techTokens',
      'leaderSkills','discoveryEnabled','ecazTreachery'] as const)
      assert.equal(quote({...basic,kullPreview:true,[option]:true}),false,option);
    // Existing unmarked admission is unchanged even for legacy fields not
    // previously considered by the bribe predicate.
    assert.equal(quote({...basic,guildBetrayalPreview:true}),true);
  }
});

void test('a real neutral Kull offer temporarily blocks bribes and the original timing resumes on decline', () => {
  const fixture = createPublicChoamKullFixture();
  assert.equal(bribeTimingBlock(fixture.game),null);
  const offered = act(fixture.game,fixture.actor,publicKullAttempt(fixture));
  const reaction = viewGame(offered,fixture.reactor).kullReaction; assert.ok(reaction);
  assert.equal(offered.pendingKull?.stage,'offer');
  assert.match(bribeTimingBlock(offered) ?? '',/Finish the current decision or response/);
  assert.match(viewGame(offered,fixture.actor).bribeOptions.blocked ?? '',/Finish the current decision or response/);
  const resumed = act(offered,fixture.reactor,{type:'kullDecision',event:reaction.event,decline:true});
  assert.equal(resumed.pendingKull,null);
  assert.equal(bribeTimingBlock(resumed),null);
});
