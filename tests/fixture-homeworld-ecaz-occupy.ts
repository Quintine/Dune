import assert from 'node:assert/strict';
import { applyAction, createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { territory } from '../game/board';
import { finishEcazOccupySetup, type EcazOccupyFixture } from './fixture-ecaz-occupy';
import { nativeShipmentSources } from '../game/homeworld-options';

export type HomeworldEcazStep = { actor: string; action: Action };
export type HomeworldEcazOccupyFixture = EcazOccupyFixture & {
  actions: HomeworldEcazStep[]; afterFirstMentat?: Game; strongholdTerritory?: string;
};
export const homeworldEcazClean = (game: Game) =>
  !game.phaseOpening && !game.response && !game.decision && !game.pendingTreacheryDiscard;

/** Original choices only: leave optional Ambassadors unplaced and pass auctions. */
export function nextHomeworldEcazStep(game: Game): HomeworldEcazStep | null {
  if (game.response) return { actor: game.players.find(p => !game.response!.passed.includes(p.id))!.id,
    action: { type: 'passResponse' } };
  if (game.decision?.kind === 'ecazPlacement')
    return { actor: game.decision.player, action: { type: 'decision', decline: true } };
  if (game.decision?.kind === 'moritaniPlacement')
    return { actor: game.decision.player, action: { type: 'decision', decline: true } };
  if (!game.phaseOpening && !game.decision && game.phase === 0 && game.stormPending === null) {
    const actor = game.stormDialers.find(id => game.stormDials[id] === undefined);
    if (actor) return { actor, action: { type: 'stormDial', amount: game.turn === 1 ? 0 : 1 } };
  }
  if (!game.phaseOpening && !game.decision && game.phase === 3 && game.auction)
    return { actor: game.auction.active, action: { type: 'passBid' } };
  for (const player of game.players) {
    const view = viewGame(game, player.id);
    view.players.find(p => p.id === player.id)!.bot = 'Easy';
    const actions = botActions(view);
    const action = actions.find(a => a.type === 'ready') ?? actions[0];
    if (action) return { actor: player.id, action };
  }
  return null;
}

/** Fresh native setup (Worlds enabled by default), a real worm alliance and paid
 * Arrakis shipments. Only unopened Spice order is staged; armies, wallets,
 * phases, alliances, World custody and offered skills follow the real actions. */
export function createHomeworldEcazOccupyFixture(options: {
  advanced?: boolean; skills?: boolean; independent?: boolean;
  allyFaction?: 'emperor' | 'moritani';
  tech?: boolean; strongholds?: boolean;
  /** No-World control uses the same genuine alliance/Arrakis route. */
  homeworlds?: boolean;
  /** Select only actual offered setup choices; the captured initial stays untouched. */
  finishSetup?: (initial: Game) => Game;
} = {}): HomeworldEcazOccupyFixture {
  const advanced = options.advanced ?? true;
  const homeworlds = options.homeworlds ?? true;
  const ally = options.allyFaction ?? 'emperor';
  let game = createGame('WORLDECAZOCCUPY', newPlayer('ecaz', 'Ecaz', 'ecaz'), advanced, ['ecaz']);
  joinGame(game, newPlayer(ally, ally === 'emperor' ? 'Emperor' : 'Moritani', ally));
  joinGame(game, newPlayer('guild', 'Guild', 'guild'));
  const actions: HomeworldEcazStep[] = [];
  const act = (actor: string, action: Action) => {
    actions.push({ actor, action: structuredClone(action) });
    game = applyAction(game, actor, action);
  };
  const ship = (actor: string, action: Action) => {
    if (homeworlds) {
      const sources = nativeShipmentSources(viewGame(game, actor), Number(action.amount), Number(action.elite ?? 0));
      assert.ok(sources, 'The original native World pools must fund the typed shipment');
      action.homeworldSources = sources;
    }
    act(actor, action);
  };
  if (homeworlds) act('ecaz', { type: 'homeworlds', enabled: true });
  if (options.tech) act('ecaz', { type: 'techTokens', enabled: true });
  if (options.strongholds) act('ecaz', { type: 'strongholdCards', enabled: true });
  if (options.independent) act('ecaz', { type: 'moduleOption', module: 'ecazTreachery', enabled: true });
  if (options.skills) act('ecaz', { type: 'moduleOption', module: 'leaderSkills', enabled: true });
  for (const player of game.players) act(player.id, { type: 'ready' });
  act('ecaz', advanced ? { type: 'start', advancedPreview: true } : { type: 'start' });
  const initial = structuredClone(game);
  game = (options.finishSetup ?? finishEcazOccupySetup)(game);
  const afterSetup = structuredClone(game);
  const step = () => {
    const next = nextHomeworldEcazStep(game);
    assert.ok(next, `A native World action must exist at ${game.turn}/${game.phase}/${game.decision?.kind}`);
    act(next.actor, next.action);
  };
  const reach = (until: (state: Game) => boolean) => {
    for (let n = 0; n < 800 && !until(game); n++) step();
    assert.ok(until(game), 'The original World programme must reach its next native boundary.');
  };
  const orderBlow = (worm: boolean, position: number) => {
    const at = game.spiceDeck.findIndex((card, i) => i >= position &&
      (worm ? 'worm' in card && !card.greatMaker && !card.suppressed :
        'territory' in card && !['arrakeen', 'sietch_tabr', 'habbanya_ridge_sietch'].includes(card.territory)));
    assert.ok(at >= position);
    game.spiceDeck.splice(position, 0, game.spiceDeck.splice(at, 1)[0]);
  };
  orderBlow(false, 0);
  if (advanced) orderBlow(false, 1);
  reach(g => g.phase === 5 && homeworldEcazClean(g));
  const strongholdTerritory = options.strongholds ? 'arrakeen' : undefined;
  while (game.phase === 5) {
    if (!homeworldEcazClean(game)) { step(); continue; }
    const actor = game.active!;
    if (strongholdTerritory && actor === 'ecaz' && !game.players.find(player => player.id === actor)!.shipped) {
      ship(actor, { type: 'ship', territory: strongholdTerritory,
        sector: territory(strongholdTerritory).sectors[0], amount: 4, elite: 0, allyPayment: 0, smuggler: false });
      reach(homeworldEcazClean);
    }
    act(actor, { type: 'endMovement' });
  }
  reach(g => g.turn === 2 && g.phase === 0 && !g.phaseOpening);
  const afterFirstMentat = options.tech || options.strongholds ? structuredClone(game) : undefined;
  orderBlow(true, 0);
  orderBlow(false, 1);
  if (advanced) orderBlow(false, 2);
  reach(g => g.phase === 1 && g.nexus && !g.spiceWindow && !g.spiceResolution && homeworldEcazClean(g));
  act('ecaz', { type: 'alliance', target: ally });
  act(ally, { type: 'alliance', target: 'ecaz' });
  reach(g => g.phase === 5 && homeworldEcazClean(g));
  const battleTerritory = strongholdTerritory ?? ['arrakeen', 'sietch_tabr', 'habbanya_ridge_sietch']
    .find(id => territory(id).sectors[0] !== game.storm &&
      !game.players.some(player => Object.entries(player.forces).some(([key, amount]) =>
        amount > 0 && key.startsWith(`${id}:`))))!;
  const sector = territory(battleTerritory).sectors[0];
  const location = `${battleTerritory}:${sector}`;
  const shipped = new Set<string>();
  while (game.phase === 5) {
    if (!homeworldEcazClean(game)) { step(); continue; }
    const actor = game.active!;
    if (!shipped.has(actor) && !(strongholdTerritory && actor === 'ecaz')) {
      ship(actor, { type: 'ship', territory: battleTerritory, sector,
        amount: actor === 'guild' ? 2 : 4,
        elite: actor === ally && ally === 'emperor' && (advanced || homeworlds) ? 2 : 0, allyPayment: 0 });
      shipped.add(actor);
      reach(homeworldEcazClean);
    }
    act(actor, { type: 'endMovement' });
  }
  reach(homeworldEcazClean);
  const choice = viewGame(game, game.active!).battleChoices.find(c => c.territory === battleTerritory);
  assert.ok(choice, 'The actually shipped coalition must have a mandatory Arrakis battle.');
  act(choice.chooser, { type: 'chooseBattle', territory: battleTerritory,
    target: choice.attacker === choice.chooser ? choice.defender : choice.attacker });
  if (!options.skills) assert.equal(game.decision?.kind, 'ecazBattleLead');
  return { game, initial, afterSetup, actions, afterFirstMentat, strongholdTerritory,
    ecaz: 'ecaz', ally, opponent: 'guild',
    territory: battleTerritory, location, ecazForces: 4 };
}
