import assert from 'node:assert/strict';
import { applyAction, viewGame, type Game } from '../game/engine';
import type { Card } from '../game/cards';
import { createIndependentCardModulesFixture, type IndependentCardModulesStep } from './fixture-independent-card-modules';
import { nextRicheseStrongholdsNativeStep } from './fixture-richese-strongholds';

export const NATIVE_MODULE_STONE = 'richese-stone-burner';
export const NATIVE_MODULE_MIRROR = 'richese-mirror-weapon';
export const NATIVE_MODULE_TOOTH = 'ix-poison-tooth';
export const NATIVE_MODULE_REINFORCEMENTS = 'ecaz-reinforcements';
export type NativeStoneModulesStep = IndependentCardModulesStep;
export type NativeStoneModulesOptions = {
  advanced?: boolean;
  tech?: boolean;
  strongholds?: boolean;
  kind?: 'original' | 'mirror';
  independent?: boolean;
};
export const nativeStoneModulesClean = (game: Game) =>
  !game.phaseOpening && !game.response && !game.decision && !game.pendingTreacheryDiscard;
export function nativeStoneModulesPlayer(game: Game, actor: string) {
  const player = game.players.find(p => p.id === actor); assert.ok(player); return player;
}
export function advanceNativeStoneModules(game: Game, until: (state: Game) => boolean,
  steps: NativeStoneModulesStep[] = []): Game {
  for (let count = 0; count < 1800; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'Original native programme ended before its requested boundary');
    const step = nextRicheseStrongholdsNativeStep(game);
    assert.ok(step, 'Supply the real unsealed battle plans');
    // Real opening dials put Storm at7; every later native distance leaves
    // Ix before Richese in battle order. Habbanya can then decide their tie.
    if (game.turn === 1 && step.action.type === 'stormDial') step.action.amount = 3;
    steps.push(structuredClone(step)); game = applyAction(game, step.actor, step.action);
  }
  throw Error('Original native Stone module programme did not reach its requested boundary');
}
function positionPhysicalCard(game: Game, actor: string, id: string, staging: string[]) {
  const player = nativeStoneModulesPlayer(game, actor);
  if (player.hand.some(card => card.id === id)) return;
  const zones: { label: string; cards: Card[] }[] = [
    { label: 'remaining original deck', cards: game.deck },
    { label: 'original discard', cards: game.discard },
    { label: 'separate original Richese cache', cards: game.richeseCache ?? [] },
    ...game.players.filter(p => p.id !== actor).map(p => ({ label: `${p.id}'s hand`, cards: p.hand })),
  ];
  const source = zones.find(zone => zone.cards.some(card => card.id === id));
  assert.ok(source, `Missing original physical ${id}`);
  assert.ok(player.hand.length < 4, 'The native physical hand must retain its printed limit');
  player.hand.push(source.cards.splice(source.cards.findIndex(card => card.id === id), 1)[0]);
  staging.push(`Conserved physical ${id}: ${source.label} → ${actor}'s hand; not a new purchase or face.`);
}

/** Original selected setup/cache acquisition → paid concealed shipment → earned
 * END-Mentat custody → next-turn paid typed attack → actual native battle.
 * Only explicitly recorded physical cards move outside the real action trail. */
export function createNativeStoneModulesFixture(options: NativeStoneModulesOptions = {}) {
  const advanced = options.advanced ?? true;
  const strongholds = options.strongholds ?? advanced;
  const kind = options.kind ?? 'original';
  const source = createIndependentCardModulesFixture({ advanced, tech: options.tech ?? true,
    strongholds, independent: options.independent, factions: ['ixians', 'richese', 'atreides'], expansions: ['ix', 'choam'] });
  let game = source.game;
  const initial = source.initial, afterSetup = structuredClone(game);
  const steps = source.steps, staging: string[] = [];
  const owner = 'richese', opponent = 'ixians';
  const territory = 'habbanya_ridge_sietch', sector = 17;
  const act = (step: NativeStoneModulesStep): Game => {
    steps.push(structuredClone(step)); game = applyAction(game, step.actor, step.action); return game;
  };
  const advance = (until: (state: Game) => boolean) => {
    game = advanceNativeStoneModules(game, until, steps);
  };
  advance(g => g.decision?.kind === 'richeseCache');
  const acquisitionBefore = structuredClone(game);
  const acquisitionStart = steps.length;
  advance(g => nativeStoneModulesPlayer(g, owner).hand.some(c => c.id === NATIVE_MODULE_STONE));
  const acquisition = { before: acquisitionBefore, after: structuredClone(game), steps: steps.slice(acquisitionStart) };
  advance(g => g.turn === 1 && g.phase === 5 && g.active === owner && nativeStoneModulesClean(g));
  const token = nativeStoneModulesPlayer(game, owner).noField!.tokens.find(t => t.value === 5)!;
  const beforeShipment = structuredClone(game);
  const shipmentStep: NativeStoneModulesStep = { actor: owner, action: { type: 'ship', territory, sector,
    noField: token.id, event: nativeStoneModulesPlayer(game, owner).noFieldEvent } };
  act(shipmentStep);
  advance(g => g.turn === 1 && g.phase === 8 && nativeStoneModulesClean(g));
  let beforeMentat: Game | undefined, mentatStep: NativeStoneModulesStep | undefined;
  for (let count = 0; game.turn === 1 && count < 100; count++) {
    const next = nextRicheseStrongholdsNativeStep(game); assert.ok(next);
    const before = structuredClone(game), after = act(next);
    if (after.turn === 2) { beforeMentat = before; mentatStep = next; }
  }
  assert.ok(beforeMentat && mentatStep);
  if (strongholds) assert.equal(game.strongholdCards!.owners[territory], owner);
  const afterMentat = structuredClone(game);
  advance(g => g.turn === 2 && g.phase === 5 && g.active === opponent && nativeStoneModulesClean(g));
  const beforeAttack = structuredClone(game);
  const attackStep: NativeStoneModulesStep = { actor: opponent,
    action: { type: 'ship', territory, sector, amount: 3, elite: 1 } };
  act(attackStep);
  advance(g => g.phase === 6 && nativeStoneModulesClean(g));
  const beforeBattle = structuredClone(game);
  const choice = viewGame(game, game.active!).battleChoices.find(b => b.territory === territory);
  assert.ok(choice);
  const battleStep: NativeStoneModulesStep = { actor: choice.chooser, action: { type: 'chooseBattle', territory,
    target: choice.attacker === choice.chooser ? choice.defender : choice.attacker } };
  act(battleStep);
  advance(g => !!g.battle && !g.battle.preparation && (!g.battle.preLeader || g.battle.preLeader.closed) && nativeStoneModulesClean(g));
  if (game.ecazTreachery) positionPhysicalCard(game, owner, NATIVE_MODULE_REINFORCEMENTS, staging);
  if (kind === 'mirror') {
    positionPhysicalCard(game, opponent, NATIVE_MODULE_STONE, staging);
    positionPhysicalCard(game, owner, NATIVE_MODULE_MIRROR, staging);
  } else positionPhysicalCard(game, opponent, NATIVE_MODULE_TOOTH, staging);
  const strongest = nativeStoneModulesPlayer(game, owner).leaders.filter(l => !l.dead)
    .sort((a, b) => b.strength - a.strength || a.id.localeCompare(b.id))[0];
  const weakest = nativeStoneModulesPlayer(game, opponent).leaders.filter(l => !l.dead)
    .sort((a, b) => a.strength - b.strength || a.id.localeCompare(b.id))[0];
  assert.ok(strongest && weakest);
  const dial = advanced ? 2 : 1;
  const plans: NativeStoneModulesStep[] = [
    { actor: owner, action: { type: 'battlePlan', dial, support: advanced ? dial : 0,
      leader: strongest.id, weapon: kind === 'mirror' ? NATIVE_MODULE_MIRROR : NATIVE_MODULE_STONE,
      defense: game.ecazTreachery ? NATIVE_MODULE_REINFORCEMENTS : null } },
    { actor: opponent, action: { type: 'battlePlan', dial: 0, support: 0, leader: weakest.id,
      weapon: kind === 'mirror' ? NATIVE_MODULE_STONE : NATIVE_MODULE_TOOTH } },
  ];
  return { initial, afterSetup, acquisition, beforeShipment, shipmentStep, beforeMentat, mentatStep,
    afterMentat, beforeAttack, attackStep, beforeBattle, battleStep, game, owner, opponent,
    territory, location: `${territory}:${sector}`, kind, advanced, plans, steps, staging };
}
