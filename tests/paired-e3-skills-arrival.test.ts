import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { createEcazIndependentSkillsFixture } from './fixture-ecaz-independent-skills';
import { homeworldEcazClean, nextHomeworldEcazStep } from './fixture-homeworld-ecaz-occupy';

/** Branch from the genuine original setup snapshot, not its later battle.
 * Only unopened land-card order is controlled. Native token declarations,
 * both response windows, phase readiness and the paid shipment are actual actions. */
function pairedArrival(advanced: boolean, skills: boolean, independent: boolean) {
  const fixture = createEcazIndependentSkillsFixture({ paired: true, advanced, skills,
    independent, cards: independent ? ['reinforcements', 'harass'] : [] });
  let game = structuredClone(fixture.afterSetup);
  const act = (actor: string, action: Action) => { game = applyAction(game, actor, action); };
  const step = () => {
    if (homeworldEcazClean(game) && game.phase === 5)
      act(game.active!, { type: 'endMovement' });
    else {
      const next = nextHomeworldEcazStep(game);
      assert.ok(next, `Native paired continuation at ${game.turn}/${game.phase}/${game.decision?.kind}`);
      act(next.actor, next.action);
    }
  };
  const reach = (until: (state: Game) => boolean) => {
    for (let n = 0; n < 450 && !until(game); n++) step();
    assert.ok(until(game));
  };
  for (let index = 0; index < (advanced ? 4 : 2); index++) {
    const at = game.spiceDeck.findIndex((card, position) => position >= index &&
      'territory' in card && !card.discovery);
    assert.ok(at >= index);
    game.spiceDeck.splice(index, 0, game.spiceDeck.splice(at, 1)[0]);
  }
  reach(state => state.turn === 1 && !state.response && state.decision?.kind === 'ecazPlacement');
  const ambassador = game.ecazAmbassadors!.tokens.find(token => token.effect === 'ecaz' && token.zone === 'supply')!.id;
  act(fixture.ecaz, { type: 'decision', token: ambassador, territory: 'arrakeen' });
  reach(state => !state.response && state.ecazAmbassadors!.tokens.find(token => token.id === ambassador)!.zone === 'placed');
  reach(state => state.turn === 1 && !state.response && state.decision?.kind === 'moritaniPlacement');
  const terror = game.moritaniTerror!.tokens.find(token => token.kind === 'robbery' && token.status === 'available')!.id;
  act(fixture.ally, { type: 'decision', token: terror, territory: 'arrakeen' });
  reach(state => state.turn === 2 && state.phase === 5 && state.active === fixture.opponent && homeworldEcazClean(state));
  const before = structuredClone(game);
  const shipment: Action = { type: 'ship', territory: 'arrakeen', sector: 10, amount: 1, elite: 0, allyPayment: 0 };
  act(fixture.opponent, shipment);
  reach(state => !!state.pendingArrivalOverlap);
  return { fixture, game, before, shipment, ambassador, terror };
}

for (const { advanced, skills, independent } of [
  { advanced: false, skills: true, independent: false },
  { advanced: true, skills: true, independent: true },
  { advanced: false, skills: false, independent: true },
])
  void test(`${advanced ? 'Advanced' : 'Basic'} paired ${skills ? 'Skills' : 'native factions'} ${independent ? 'with independent cards' : 'without extra cards'} settles both earned reactions without re-paying shipment`, () => {
    const f = pairedArrival(advanced, skills, independent), { ecaz, ally: moritani, opponent: guild } = f.fixture;
    let game = f.game;
    const player = (state: Game, id: string) => state.players.find(seat => seat.id === id)!;
    const before = player(f.before, guild), moritaniBefore = player(f.before, moritani).spice;
    const first = game.pendingArrivalOverlap!.first;
    const seen: string[] = [];
    for (let n = 0; n < 40 && (game.pendingArrivalOverlap || game.pendingAmbassador ||
        game.pendingTerrorEntry || !homeworldEcazClean(game)); n++) {
      let actor: string, action: Action;
      if (game.response) {
        const next = nextHomeworldEcazStep(game)!;
        actor = next.actor; action = next.action;
      } else if (game.decision?.kind === 'ecazAmbassador') {
        seen.push('ambassador'); actor = ecaz;
        action = { type: 'decision', event: game.pendingAmbassador!.event,
          trigger: true, choice: 'duke', beneficiary: ecaz };
      } else if (game.decision?.kind === 'moritaniTerror') {
        const entry = viewGame(game, moritani).terrorEntry!;
        assert.ok('stage' in entry);
        seen.push(`terror:${entry.stage}`); actor = moritani;
        action = entry.stage === 'offer' ? { type: 'decision', reveal: true }
          : { type: 'decision', choice: 'spice' };
      } else throw Error(`Unexpected arrival continuation ${game.decision?.kind}`);
      game = applyAction(game, actor, action);
    }
    assert.deepEqual(seen, first === 'ambassador'
      ? ['ambassador', 'terror:offer', 'terror:robbery']
      : ['terror:offer', 'terror:robbery', 'ambassador']);
    const robbery = Math.ceil((before.spice - 1) / 2);
    assert.equal(player(game, guild).spice, before.spice - 1 - robbery);
    assert.equal(player(game, moritani).spice, moritaniBefore + robbery);
    assert.equal(player(game, guild).reserves, before.reserves - 1);
    assert.equal(player(game, guild).forces['arrakeen:10'], 1);
    assert.equal(game.dukeVidal!.controller, ecaz);
    assert.equal(game.dukeVidal!.leader.strength, 6);
    assert.ok(!game.leaderSkills?.assignments.some(assignment => assignment.leader === 'duke-vidal'));
    assert.equal(game.moritaniTerror!.tokens.find(token => token.id === f.terror)!.status, 'removed');
    assert.equal(game.ecazAmbassadors!.tokens.find(token => token.id === f.ambassador)!.zone, 'supply');
    assert.equal(viewGame(game, guild).arrivalOverlap, null);
    assert.equal(game.active, guild);
    const settled = structuredClone(game);
    assert.throws(() => applyAction(game, guild, f.shipment));
    assert.deepEqual(game, settled);
    game = applyAction(game, guild, { type: 'endMovement' });
    assert.equal(player(game, guild).reserves, before.reserves - 1);
    assert.equal(player(game, guild).forces['arrakeen:10'], 1);
  });
