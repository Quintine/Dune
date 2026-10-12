import assert from 'node:assert/strict';
import { applyAction, createGame, joinGame, newPlayer, type Action, type Game } from '../game/engine';
import { initializeClassicNexusSkillsPaymentsSetup, nextClassicNexusSkillsPaymentsNativeStep } from './fixture-classic-nexus-skills-payments';

export type BureaucratQualifyingSplitStep = { actor: string; action: Action };
const clean = (game: Game) => !game.phaseOpening && !game.response && !game.decision;

/** Keep every original army and wallet. A real three-spice bribe collects into
 * Fremen's shield at the first Mentat; the actual second-turn worm forms H/F. */
export function createBureaucratQualifyingSplitSetup(advanced = false) {
  const lobby = createGame('BUREAUCRATQUALIFY', newPlayer('b', 'Bureaucrat', 'atreides'), advanced);
  for (const [id, faction] of [['p', 'harkonnen'], ['f', 'fremen'], ['e', 'emperor'], ['g', 'guild']] as const)
    joinGame(lobby, newPlayer(id, faction, faction));
  let game = initializeClassicNexusSkillsPaymentsSetup({ initial: lobby, skill: 'bureaucrat' });
  const actions: BureaucratQualifyingSplitStep[] = [];
  const staging: string[] = [];
  const act = (actor: string, action: Action) => {
    actions.push({ actor, action });
    game = applyAction(game, actor, action);
  };
  const advance = (until: (state: Game) => boolean) => {
    for (let n = 0; !until(game) && n < 2400; n++) {
      assert.notEqual(game.status, 'finished');
      const next = nextClassicNexusSkillsPaymentsNativeStep(game);
      assert.ok(next, 'Original skill and phase controls must reach the payment boundary');
      act(next.actor, next.action);
    }
    assert.ok(until(game));
  };
  const orderSpice = (kinds: ('land' | 'worm')[]) => {
    for (const [position, kind] of kinds.entries()) {
      const index = game.spiceDeck.findIndex((card, i) => i >= position &&
        (kind === 'land' ? 'territory' in card : 'worm' in card));
      assert.ok(index >= position);
      game.spiceDeck.splice(position, 0, game.spiceDeck.splice(index, 1)[0]);
    }
    staging.push('Reorder only original still-unplayed Spice Cards.');
  };
  advance(state => state.status === 'playing');
  const setup = structuredClone(game);
  assert.ok(game.leaderSkills!.assignments.some(a => a.owner === 'b' && a.skill === 'bureaucrat'));
  orderSpice(['land', 'land']);
  advance(state => state.phase === 5 && state.active === 'p' && clean(state));
  const beforeBribe = structuredClone(game);
  act('p', { type: 'bribe', target: 'f', amount: 3 });
  const bribe = structuredClone(game);
  assert.equal(game.players.find(p => p.id === 'f')!.bribes, 3);
  advance(state => state.turn === 2 && state.phase === 1 && clean(state));
  const afterFirstMentat = structuredClone(game);
  assert.equal(game.players.find(p => p.id === 'f')!.spice, 6);
  orderSpice(['worm', 'land', 'land']);
  advance(state => state.nexus && !state.spiceWindow && !state.spiceResolution && clean(state));
  const worm = structuredClone(game);
  act('p', { type: 'alliance', target: 'f' });
  act('f', { type: 'alliance', target: 'p' });
  const alliance = structuredClone(game);
  advance(state => state.phase === 3 && !!state.auction && clean(state));
  return { game, setup, beforeBribe, bribe, afterFirstMentat, worm, alliance,
    payer: 'p', donor: 'f', trainer: 'b', guild: 'g', emperor: 'e', actions, staging };
}

export function advanceBureaucratQualifyingSplit(state: Game, until: (game: Game) => boolean,
  actions?: BureaucratQualifyingSplitStep[]): Game {
  let game = state;
  for (let n = 0; !until(game) && n < 1600; n++) {
    assert.notEqual(game.status, 'finished');
    const next = nextClassicNexusSkillsPaymentsNativeStep(game);
    assert.ok(next);
    actions?.push(next);
    game = applyAction(game, next.actor, next.action);
  }
  assert.ok(until(game));
  return game;
}
