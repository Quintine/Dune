import assert from 'node:assert/strict';
import {
  applyAction, createGame, initializeFactionExpansionsGameForAudit,
  initializeStrongholdFactionsGameForAudit, joinGame, newPlayer, viewGame, type Game,
} from '../game/engine';
import { territory } from '../game/board';
import { createTechTokens } from '../game/tech-tokens';
import { finishEcazOccupySetup, stageEcazOccupyCard } from './fixture-ecaz-occupy';
import {
  advanceEcazStronghold, ecazStrongholdFixture, ecazStrongholdSeat as player,
  openEcazStronghold, type EcazStrongholdFixture,
} from './fixture-ecaz-strongholds';
import {
  advanceMoritaniStrongholds, createMoritaniStrongholdsFixture,
  holdMoritaniStrongholdsTraitor, nextMoritaniStrongholdsStep,
  resolveMoritaniStrongholdsBattle, stageMoritaniStrongholdsBattle,
  type MoritaniStrongholdsFixture,
} from './fixture-moritani-strongholds';
import { nextStrongholdFactionsNativeStep, type StrongholdFactionsNativeStep } from './fixture-stronghold-factions';

export type E3NativeTechOptions = {
  /** Original authenticated lobby or its undealt native setup; identities are retained. */
  initial?: Game;
  native?: 'ecaz' | 'moritani';
  advanced?: boolean;
  strongholds?: boolean;
};
const clean = (game: Game) => !game.response && !game.phaseOpening && !game.decision;

/** Scope deterministic entropy to the genuine first initializer, never a later deal. */
export function initializeE3NativeTechSetup(options: E3NativeTechOptions = {}): Game {
  const native = options.native ?? 'ecaz';
  const advanced = options.advanced ?? options.initial?.advanced ?? true;
  const strongholds = options.strongholds ?? false;
  let game: Game;
  if (options.initial) game = structuredClone(options.initial);
  else {
    game = createGame('E3NATIVETECH', newPlayer(native, native, native), advanced, ['ecaz']);
    joinGame(game, newPlayer('guild', 'Guild', 'guild'));
    joinGame(game, newPlayer('emperor', 'Emperor', 'emperor'));
    if (native === 'ecaz') {
      for (const [actor, position] of [['ecaz', 6], ['guild', 4], ['emperor', 5]] as const)
        if (viewGame(game, actor).playerPositions[actor] !== position)
          game = applyAction(game, actor, { type: 'seatPosition', position });
    }
  }
  assert.equal(game.advanced, advanced);
  assert.deepEqual(game.expansions, ['ecaz']);
  assert.ok(game.players.some(p => p.faction === native));
  if (game.status === 'setup') {
    assert.equal(game.turn, 1); assert.equal(game.phase, 0);
    assert.ok(game.players.every(p => p.hand.length === 0));
    assert.ok(game.techTokens);
    assert.equal(!!game.strongholdCards, strongholds);
    return game;
  }
  assert.equal(game.status, 'lobby', 'Started games cannot be retrofitted with Tech.');
  if (!game.techTokens) game.techTokens = createTechTokens();
  for (const p of game.players) if (!p.ready) game = applyAction(game, p.id, { type: 'ready' });
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  crypto.getRandomValues = <T extends ArrayBufferView | null>(array: T): T => {
    assert.ok(array);
    new Uint8Array(array.buffer, array.byteOffset, array.byteLength).fill(255);
    return array;
  };
  try {
    return strongholds ? initializeStrongholdFactionsGameForAudit(game)
      : initializeFactionExpansionsGameForAudit(game);
  } finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}
function reserveBoard(game: Game): void {
  for (const p of game.players) {
    p.reserves += Object.values(p.forces).reduce((sum, n) => sum + n, 0); p.forces = {};
    if (p.elites) {
      p.elites.reserves += Object.values(p.elites.forces).reduce((sum, n) => sum + n, 0);
      p.elites.forces = {};
    }
    if (p.advisors) p.advisors = {};
  }
}
function place(game: Game, actor: string, location: string, count: number): void {
  const p = player(game, actor);
  assert.ok(Number.isSafeInteger(count) && count >= 0 && p.reserves >= count);
  p.reserves -= count; p.forces[location] = count;
}
function orderBlow(game: Game, worm: boolean, position: number): void {
  const index = game.spiceDeck.findIndex((card, i) => i >= position && (worm
    ? 'worm' in card && !card.greatMaker && !card.suppressed : 'territory' in card));
  assert.ok(index >= position, 'Only unplayed original Spice Cards are ordered.');
  game.spiceDeck.splice(position, 0, game.spiceDeck.splice(index, 1)[0]);
}
export type EcazNativeTechOptions = Omit<E3NativeTechOptions, 'native'> & {
  ecazForces?: number;
  /** Expose original chooseBattle for the preserved Basic odd-force rejection. */
  chooseBattle?: boolean;
};
export type EcazNativeTechFixture = EcazStrongholdFixture & { battleAction: StrongholdFactionsNativeStep };
function battleChoice(game: Game, kind: string): StrongholdFactionsNativeStep {
  const choice = viewGame(game, game.active!).battleChoices.find(b => b.territory === kind);
  assert.ok(choice, 'The actual conserved armies must quote an original battle.');
  return { actor: choice.chooser, action: { type: 'chooseBattle', territory: kind,
    target: choice.attacker === choice.chooser ? choice.defender : choice.attacker } };
}
/** Original setup, worm Nexus, reciprocal alliance and (when selected) real
 * Stronghold claim. Controlled board/card custody follows setup; wallets, phases,
 * Tech owners and aftermath receipts are never assigned. */
export function createEcazNativeTechFixture(options: EcazNativeTechOptions = {}): EcazNativeTechFixture {
  const setup = initializeE3NativeTechSetup({ ...options, native: 'ecaz' });
  if (options.strongholds) {
    const f = ecazStrongholdFixture({ initial: setup, kind: 'sietch_tabr', ecazForces: options.ecazForces });
    return { ...f, battleAction: battleChoice(f.beforeBattle, f.territory) };
  }
  const initial = structuredClone(setup), staging: string[] = [];
  let game = finishEcazOccupySetup(setup);
  const afterSetup = structuredClone(game);
  const ecaz = game.players.find(p => p.faction === 'ecaz')!.id;
  const ally = game.players.find(p => p.faction === 'guild')!.id;
  const opponent = game.players.find(p => p.faction === 'emperor')!.id;
  assert.equal(game.players.length, 3); assert.ok(ecaz && ally && opponent);
  const kind = 'sietch_tabr', location = `${kind}:${territory(kind).sectors[0]}`;
  reserveBoard(game); orderBlow(game, false, 0); orderBlow(game, false, 1);
  staging.push('After genuine setup: return physical counters to their own reserves; retain native wallets, cards, leaders and identities.');
  game = advanceEcazStronghold(game, g => g.turn === 2 && g.phase === 0 && clean(g));
  orderBlow(game, true, 0); orderBlow(game, false, 1); orderBlow(game, false, 2);
  game = advanceEcazStronghold(game, g => g.phase === 1 && !!g.nexus && clean(g) && !g.spiceWindow && !g.spiceResolution);
  game = applyAction(game, ecaz, { type: 'alliance', target: ally });
  game = applyAction(game, ally, { type: 'alliance', target: ecaz });
  game = advanceEcazStronghold(game, g => g.phase === 8 && clean(g));
  reserveBoard(game); place(game, ecaz, location, 1); place(game, ally, location, 1);
  let beforeMentat: Game | undefined, mentatStep: StrongholdFactionsNativeStep | undefined;
  for (let count = 0; game.turn === 2 && count < 200; count++) {
    const next = nextStrongholdFactionsNativeStep(game); assert.ok(next);
    const before = structuredClone(game);
    game = applyAction(game, next.actor, next.action);
    if (game.turn === 3) { beforeMentat = before; mentatStep = next; }
  }
  assert.ok(beforeMentat && mentatStep);
  const afterMentat = structuredClone(game);
  orderBlow(game, false, 0); orderBlow(game, false, 1);
  game = advanceEcazStronghold(game, g => g.phase === 5 && clean(g));
  const ecazForces = options.ecazForces ?? (game.advanced ? 5 : 4), allyForces = 4;
  reserveBoard(game); place(game, ecaz, location, ecazForces);
  place(game, ally, location, allyForces); place(game, opponent, location, 8);
  stageEcazOccupyCard(game, opponent, card => card.effect === 'karama');
  staging.push(`Before original movement completion: conserve ${ecazForces} Ecaz, four Guild and eight Emperor counters in Tabr; conserved Karama custody exposes original Occupy response.`);
  game = advanceEcazStronghold(game, g => g.phase === 6 && clean(g));
  const beforeBattle = structuredClone(game), battleAction = battleChoice(game, kind);
  if (options.chooseBattle !== false) game = applyAction(game, battleAction.actor, battleAction.action);
  return { initial, afterSetup, beforeMentat, mentatStep, afterMentat, beforeBattle, game,
    ecaz, ally, opponent, territory: kind, location, ecazForces, allyForces, staging, battleAction };
}
export function revealEcazNativeTechBattle(f: EcazNativeTechFixture, lead: 'ecaz' | 'ally', victoryPosition = false) {
  const actor = lead === 'ecaz' ? f.ecaz : f.ally;
  const staged = { ...f, game: structuredClone(f.game) };
  if (victoryPosition) {
    const holds = ['arrakeen', 'carthag', 'habbanya_ridge_sietch', 'tueks_sietch']
      .filter(id => territory(id).sectors[0] !== staged.game.storm);
    for (const [index, owner] of [f.ecaz, f.ally].entries()) {
      const hold = holds[index];
      assert.ok(hold);
      place(staged.game, owner, `${hold}:${territory(hold).sectors[0]}`, 1);
      f.staging.push(`Before selected-lead choice: conserve one reserve ${owner} counter alone in ${hold}; three alliance holds but only one jointly occupied hold.`);
    }
  }
  const shield = stageEcazOccupyCard(staged.game, actor, c => c.kind === 'shield');
  let game = openEcazStronghold(staged, lead);
  const before = structuredClone(game), profile = viewGame(game, actor).battle!.ecazOccupy!.profile!;
  const own = player(game, actor).leaders.filter(l => !l.dead && !l.usedAt).sort((a, b) => b.strength - a.strength)[0];
  const enemy = player(game, f.opponent).leaders.filter(l => !l.dead && !l.usedAt).sort((a, b) => a.strength - b.strength)[0];
  const support = game.advanced ? Math.min(3, player(game, actor).spice) : 0;
  const variableDial = game.advanced ? (3 + support) / 2 : 3;
  assert.ok(own && enemy);
  game = applyAction(game, actor, { type: 'battlePlan', leader: own.id,
    dial: profile.fixedEcazDial + variableDial, support, defense: shield });
  game = applyAction(game, f.opponent, { type: 'battlePlan', leader: enemy.id, dial: game.advanced ? 2 : 0, support: 0 });
  assert.ok(game.battle?.revealed);
  const revealed = structuredClone(game);
  for (const voter of viewGame(game, actor).battle!.traitorVoters)
    game = applyAction(game, voter, { type: 'traitorCall', call: false });
  assert.equal(game.decision?.kind, 'battleCards', 'The original winner-card window precedes Tech transfer.');
  return { before, revealed, pending: game, actor, shield };
}

export type MoritaniNativeTechOptions = Omit<E3NativeTechOptions, 'native'> & { normalCall?: boolean };
/** Genuine six-disc Terror supply: the first printed Mentat placement leaves
 * five supply discs and one placed disc. Advanced losses use original assassination. */
export function createMoritaniNativeTechFixture(options: MoritaniNativeTechOptions = {}): MoritaniStrongholdsFixture {
  const setup = initializeE3NativeTechSetup({ ...options, native: 'moritani' });
  if (options.strongholds) return createMoritaniStrongholdsFixture({ initial: setup, normalCall: options.normalCall });
  let game = setup;
  const initial = structuredClone(game), sourceActions: StrongholdFactionsNativeStep[] = [], staging: string[] = [];
  const run = (step: StrongholdFactionsNativeStep) => {
    sourceActions.push(structuredClone(step)); game = applyAction(game, step.actor, step.action);
  };
  for (let count = 0; game.status === 'setup' && count < 200; count++) {
    const next = nextMoritaniStrongholdsStep(game); assert.ok(next); run(next);
  }
  assert.equal(game.status, 'playing', 'Genuine native Moritani setup must complete.');
  const afterSetup = structuredClone(game);
  const moritani = game.players.find(p => p.faction === 'moritani')!.id;
  const opponent = game.players.find(p => p.faction === 'guild')!.id;
  assert.equal(game.players.length, 3); assert.ok(moritani && opponent);
  orderBlow(game, false, 0); orderBlow(game, false, 1);
  for (let count = 0; !(game.phase === 8 && game.decision?.kind === 'moritaniPlacement') && count < 1800; count++) {
    const next = nextMoritaniStrongholdsStep(game); assert.ok(next);
    if (next.action.type === 'stormDial' && game.turn === 1) next.action.amount = 4;
    run(next);
  }
  assert.equal(game.decision?.kind, 'moritaniPlacement');
  const beforePlacement = structuredClone(game), token = game.moritaniTerror!.tokens.find(t => t.status === 'available');
  assert.ok(token);
  run({ actor: moritani, action: { type: 'decision', token: token.id, territory: 'arrakeen' } });
  game = advanceMoritaniStrongholds(game, g => g.phase === 8 && clean(g), sourceActions);
  const afterPlacement = structuredClone(game), kind = 'tueks_sietch';
  reserveBoard(game); place(game, moritani, `${kind}:${territory(kind).sectors[0]}`, 1);
  place(game, opponent, 'carthag:11', 1);
  let beforeFirstMentat: Game | undefined, firstMentatStep: StrongholdFactionsNativeStep | undefined;
  for (let count = 0; game.turn === 1 && count < 200; count++) {
    const next = nextMoritaniStrongholdsStep(game); assert.ok(next);
    const before = structuredClone(game);
    sourceActions.push(structuredClone(next)); game = applyAction(game, next.actor, next.action);
    if (game.turn === 2) { beforeFirstMentat = before; firstMentatStep = next; }
  }
  assert.ok(beforeFirstMentat && firstMentatStep);
  const afterFirstMentat = structuredClone(game);
  orderBlow(game, false, 0); orderBlow(game, false, 1);
  game = advanceMoritaniStrongholds(game, g => g.phase === 5 && clean(g), sourceActions);
  stageMoritaniStrongholdsBattle(game, moritani, opponent, kind, staging);
  const own = player(game, moritani).leaders.filter(l => !l.dead).sort((a, b) => a.strength - b.strength)[0];
  const enemy = player(game, opponent).leaders.filter(l => !l.dead).sort((a, b) => b.strength - a.strength)[0];
  const target = player(game, opponent).leaders.find(l => !l.dead && l.id !== enemy.id)!;
  assert.ok(own && enemy && target);
  holdMoritaniStrongholdsTraitor(game, moritani, options.normalCall ? enemy.id : target.id, staging);
  const moritaniCards = [stageEcazOccupyCard(game, moritani, c => c.kind === 'worthless')];
  const opponentCards = [stageEcazOccupyCard(game, opponent, c => c.kind === 'worthless')];
  game = advanceMoritaniStrongholds(game, g => g.phase === 6 && clean(g), sourceActions);
  const beforeBattle = structuredClone(game), battleAction = battleChoice(game, kind); run(battleAction);
  game = advanceMoritaniStrongholds(game, g => !!g.battle && !g.battle.revealed && !nextMoritaniStrongholdsStep(g), sourceActions);
  const planActions: StrongholdFactionsNativeStep[] = [
    { actor: moritani, action: { type: 'battlePlan', leader: own.id, dial: 1,
      support: game.advanced ? 1 : 0, weapon: moritaniCards[0] } },
    { actor: opponent, action: { type: 'battlePlan', leader: enemy.id, dial: 3,
      support: game.advanced ? 3 : 0, weapon: opponentCards[0] } },
  ];
  const prepared = structuredClone(game);
  for (const plan of planActions) run(plan);
  assert.ok(game.battle?.revealed);
  const revealed = structuredClone(game);
  const pending = resolveMoritaniStrongholdsBattle(game, moritani, options.normalCall, sourceActions);
  return { initial, afterSetup, beforePlacement, afterPlacement, beforeFirstMentat, firstMentatStep,
    afterFirstMentat, beforeBattle, game: prepared, revealed, pending, moritani, opponent,
    holder: moritani, kind, target: target.id, moritaniLeader: own.id, opponentLeader: enemy.id,
    moritaniCards, opponentCards, battleAction, planActions, sourceActions, staging };
}
