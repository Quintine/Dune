import assert from 'node:assert/strict';
import test from 'node:test';
import { handLimit, viewGame, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { act, inventory, player, createSaphoTruthOrderFixture as fixture,
  truthOrderFrame as frame, passTruthOrder as pass, playSaphoTruthOrder as play,
  finishTruthOrder as finish, finishOriginalTruthQuestions as answer, passFreshDiscard,
  rejectSaphoTruthOrder as reject, ownOrderChoices as choices } from './fixture-sapho-truth-order';

for (const advanced of [false,true]) for (const mode of ['first','last'] as const) {
  const label = `${advanced ? 'Advanced' : 'Basic'} ${mode}`;
  void test(`${label} Sapho reorders the original pending Truth groups and resumes their parent`, () => {
    const f = fixture({advanced,mode}), state = f.game, before = structuredClone(state);
    const current = frame(state), ownerChoices = choices(state,f.owner);
    assert.ok(ownerChoices.some(option => option.card === f.card && option.mode === mode));
    assert.deepEqual(choices(state,f.other), [], 'A different holder is not told which card Emperor holds');
    const unchanged = mode === 'first' ? 'last' : 'first';
    reject(state,f.owner,{type:'saphoTruthOrder',event:current.event,revision:current.revision,card:f.card,mode:unchanged});
    reject(state,f.owner,{type:'saphoTruthOrder',event:'stale',revision:current.revision,card:f.card,mode});
    reject(state,f.owner,{type:'saphoTruthOrder',event:current.event,revision:current.revision + 1,card:f.card,mode});
    reject(state,'atreides',{type:'truthOrderPass',event:current.event,revision:current.revision});
    assert.deepEqual(state,before);
    let game = play(state,f.owner,f.card,mode);
    // The neutral Semuta offer may suspend Truth even when nobody holds the
    // card; each player explicitly passes before the original frame resumes.
    game = passFreshDiscard(game);
    assert.equal(player(game,f.owner).hand.some(card => card.id === f.card),false);
    assert.equal(game.discard.filter(card => card.id === f.card).length,1);
    assert.deepEqual(game.order,f.order,'The physical storm order never changes');
    assert.ok(frame(game).passed.includes(f.owner));
    reject(game,f.owner,{type:'saphoTruthOrder',event:current.event,revision:current.revision,card:f.card,mode});
    game = finish(game);
    const queue = game.truthtrance!.queue.map(row => row.player);
    assert.equal(mode === 'first' ? queue[0] : queue.at(-1),f.owner);
    assert.deepEqual([...queue].sort(),[f.owner,f.other].sort());
    game = answer(game);
    assert.equal(game.truthtrance,null);
    assert.equal(game.discard.filter(card => [f.card,f.truth,f.otherTruth].includes(card.id)).length,3);
    assert.equal(game.turn,f.parent.turn); assert.equal(game.phase,f.parent.phase);
    assert.equal(game.active,f.parent.active); assert.deepEqual(game.movementRemaining,f.parent.movementRemaining);
    assert.deepEqual(game.players.map(row => ({id:row.id,spice:row.spice,reserves:row.reserves,tanks:row.tanks,
      shipped:row.shipped,moved:row.moved,forces:row.forces})),f.parent.players);
    assert.deepEqual(inventory(game),f.originalCards);
  });
}

for (const advanced of [false,true]) {
  const label = advanced ? 'Advanced' : 'Basic';
  void test(`${label} all Truth holders can pass ordering without any Sapho being held`, () => {
    // The optional cache exchange occurs before either actual declaration,
    // so window creation cannot depend on whether anybody holds Sapho.
    const f = fixture({advanced,mode:'first',withoutSapho:true}), state = structuredClone(f.game);
    assert.ok(state.players.every(row => !row.hand.some(card => card.id === f.card)));
    assert.deepEqual(inventory(state),f.originalCards);
    const initialQueue = state.truthtrance!.queue.map(row => ({...row}));
    const initialFrame = frame(state);
    for (const holder of initialFrame.holders) assert.deepEqual(choices(state,holder),[]);
    let game = pass(state,initialFrame.holders[0]);
    const updated = frame(game);
    reject(game,initialFrame.holders[0],{type:'truthOrderPass',event:updated.event,revision:updated.revision});
    game = finish(game);
    assert.deepEqual(game.truthtrance!.queue,initialQueue);
    game = answer(game);
    assert.deepEqual(inventory(game),f.originalCards);
  });

  void test(`${label} each minimal bot profile can advance the public ordering window legally`, () => {
    const f = fixture({advanced,mode:'first'});
    for (const difficulty of DIFFICULTIES) for (const actor of [f.owner,f.other]) {
      const view = viewGame(f.game,actor);
      view.players.find(row => row.id === actor)!.bot = difficulty;
      const action = botActions(view)[0]; assert.ok(action,`${difficulty} ${actor}`);
      assert.ok(action.type === 'truthOrderPass' || action.type === 'saphoTruthOrder',
        `The ${difficulty} bot must use a legal ordering action`);
      const progressed = act(structuredClone(f.game),actor,action);
      assert.ok(!progressed.truthtrance || progressed.truthtrance.stage === 'order' || progressed.truthtrance.stage === 'ask');
      assert.deepEqual(inventory(progressed),f.originalCards);
    }
  });
}

for (const claim of [false,true]) void test(
  `Basic labeled conserved Semuta ${claim ? 'claim' : 'pass'} restores the same Truth ordering window`, () => {
    const f = fixture({advanced:false,mode:'first'}), state = structuredClone(f.game);
    // Controlled physical supplement: the original cached Semuta is swapped
    // with Atreides' original held card. The underlying public setup and
    // actually purchased Sapho are untouched; no card/resource is created.
    const claimant = player(state,'atreides'), cache = state.richeseCache;
    assert.ok(cache); const semutaAt = cache.findIndex(card => card.effect === 'semutaDrug'); assert.ok(semutaAt >= 0);
    assert.ok(claimant.hand.length > 0);
    const [semuta] = cache.splice(semutaAt,1), [exchange] = claimant.hand.splice(0,1);
    claimant.hand.push(semuta); cache.push(exchange);
    assert.deepEqual(inventory(state),f.originalCards);
    const prior = structuredClone(frame(state));
    let game = play(state,f.owner,f.card,'first');
    assert.ok(game.pendingTreacheryDiscard?.reaction,'The actual fresh Sapho discard offers Semuta');
    assert.equal(game.pendingTreacheryDiscard.batch.entries[0].card.id,f.card);
    const event = game.pendingTreacheryDiscard.batch.event;
    assert.equal(viewGame(game,'atreides').semutaReaction?.canCommit,true);
    if (claim) game = act(game,'atreides',{type:'semutaCommit',event});
    else while (game.pendingTreacheryDiscard?.reaction?.stage === 'offer') {
      const pending: NonNullable<Game['pendingTreacheryDiscard']> = game.pendingTreacheryDiscard;
      const reaction: NonNullable<NonNullable<Game['pendingTreacheryDiscard']>['reaction']> = pending.reaction!;
      assert.equal(reaction.stage,'offer');
      if (reaction.stage !== 'offer') throw new Error('The Semuta response must remain an offer.');
      const actor = game.players.find(row => !reaction.passed.includes(row.id)); assert.ok(actor);
      game = act(game,actor.id,{type:'semutaPass',event:pending.batch.event});
    }
    assert.equal(game.pendingTreacheryDiscard,null);
    const resumed = frame(game);
    assert.equal(resumed.event,prior.event);
    assert.deepEqual([...resumed.holders].sort(),[...prior.holders].sort());
    assert.ok(resumed.passed.includes(f.owner));
    assert.equal(player(game,'atreides').hand.some(card => card.id === f.card),claim);
    assert.equal(game.discard.some(card => card.id === semuta.id),claim);
    assert.deepEqual(inventory(game),f.originalCards);
    game = answer(finish(game));
    assert.equal(game.truthtrance,null);
    assert.equal(game.active,f.parent.active); assert.equal(game.phase,f.parent.phase);
    assert.deepEqual(inventory(game),f.originalCards);
  },
);

for (const claim of [false,true]) void test(
  `Basic Semuta ${claim ? 'claim' : 'pass'} after the final Sapho response resumes directly to Truth questions`, () => {
    const f = fixture({advanced:false,mode:'first'}), state = structuredClone(f.game);
    // Controlled conserved custody, as above: swap the original cached Semuta
    // into Atreides' hand before either participant responds to the order frame.
    const claimant = player(state,'atreides'), cache = state.richeseCache;
    assert.ok(cache); const semutaAt = cache.findIndex(card => card.effect === 'semutaDrug'); assert.ok(semutaAt >= 0);
    assert.ok(claimant.hand.length > 0);
    const [semuta] = cache.splice(semutaAt,1), [exchange] = claimant.hand.splice(0,1);
    claimant.hand.push(semuta); cache.push(exchange);
    assert.deepEqual(inventory(state),f.originalCards);
    let game = pass(state,f.other);
    assert.deepEqual(frame(game).passed,[f.other]);
    // The only remaining holder plays Sapho, so the ordering is complete but
    // its fresh-discard reaction must settle before the first question opens.
    game = play(game,f.owner,f.card,'first');
    assert.ok(game.pendingTreacheryDiscard?.reaction,'The actual fresh Sapho discard offers Semuta');
    assert.equal(game.pendingTreacheryDiscard.batch.entries[0].card.id,f.card);
    const event = game.pendingTreacheryDiscard.batch.event;
    if (claim) game = act(game,'atreides',{type:'semutaCommit',event});
    else game = passFreshDiscard(game);
    assert.equal(game.pendingTreacheryDiscard,null);
    assert.equal(game.truthtrance?.stage,'ask');
    assert.equal(game.truthtrance?.queue[0].player,f.owner);
    assert.equal(player(game,'atreides').hand.some(card => card.id === f.card),claim);
    assert.equal(game.discard.some(card => card.id === semuta.id),claim);
    assert.deepEqual(inventory(game),f.originalCards);
    game = answer(game);
    assert.equal(game.truthtrance,null);
    assert.equal(game.phase,f.parent.phase); assert.equal(game.active,f.parent.active);
    assert.deepEqual(inventory(game),f.originalCards);
  },
);

for (const mode of ['first','last'] as const) void test(
  `Basic a second Truth holder cannot displace an established Sapho ${mode} after reclaiming it with Semuta`, () => {
    const f = fixture({advanced:false,mode}), state = structuredClone(f.game);
    // Controlled conserved custody: move the original cached Semuta into the
    // other already-queued Truth holder's real hand, without modifying funds,
    // the queue or any physical card identity. The hand has a genuine vacancy.
    const other = player(state,f.other), cache = state.richeseCache;
    assert.ok(cache); const semutaAt = cache.findIndex(card => card.effect === 'semutaDrug'); assert.ok(semutaAt >= 0);
    assert.ok(other.hand.length < handLimit(other));
    const [semuta] = cache.splice(semutaAt,1); other.hand.push(semuta);
    assert.ok(other.hand.some(card => card.id === f.otherTruth));
    assert.deepEqual(inventory(state),f.originalCards);
    const before = frame(state);
    let game = play(state,f.owner,f.card,mode);
    assert.ok(game.pendingTreacheryDiscard?.reaction,'The physical Sapho discard offers the held Semuta');
    const event = game.pendingTreacheryDiscard.batch.event;
    assert.equal(viewGame(game,f.other).semutaReaction?.canCommit,true);
    game = act(game,f.other,{type:'semutaCommit',event});
    assert.equal(game.pendingTreacheryDiscard,null);
    assert.ok(player(game,f.other).hand.some(card => card.id === f.card));
    assert.ok(game.discard.some(card => card.id === semuta.id));
    const after = frame(game);
    assert.equal(after.event,before.event);
    assert.ok(after.passed.includes(f.owner)); assert.ok(!after.passed.includes(f.other));
    assert.equal(mode === 'first' ? game.truthtrance!.queue[0].player : game.truthtrance!.queue.at(-1)!.player,f.owner);
    assert.ok(!choices(game,f.other).some(choice => choice.card === f.card && choice.mode === mode),
      'The later holder cannot override the earlier protected position');
    reject(game,f.other,{type:'saphoTruthOrder',event:after.event,revision:after.revision,card:f.card,mode});
    assert.equal(mode === 'first' ? game.truthtrance!.queue[0].player : game.truthtrance!.queue.at(-1)!.player,f.owner);
    game = pass(game,f.other);
    assert.equal(game.truthtrance?.stage,'ask');
    assert.equal(mode === 'first' ? game.truthtrance!.queue[0].player : game.truthtrance!.queue.at(-1)!.player,f.owner);
    game = answer(game);
    assert.equal(game.truthtrance,null);
    assert.equal(game.phase,f.parent.phase); assert.equal(game.active,f.parent.active);
    assert.deepEqual(inventory(game),f.originalCards);
  },
);
