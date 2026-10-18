import assert from 'node:assert/strict';
import { applyAction, createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import type { FactionId } from '../game/catalog';

export type SelectedIndependentEntryOptions = {
  expansions: Game['expansions'];
  factions: readonly FactionId[];
  advanced?: boolean;
  skills?: boolean;
  homeworlds?: boolean;
  tech?: boolean;
  strongholds?: boolean;
  discoveries?: boolean;
  nexus?: boolean;
};

/** Ordinary host controls and original private choices; no dealt inventory edits. */
export function createSelectedIndependentEntry(options: SelectedIndependentEntryOptions) {
  const [host, ...others] = options.factions;
  let game = createGame('SELECTEDINDEPENDENTNEXUS', newPlayer(host, host, host), options.advanced ?? false, options.expansions);
  for (const faction of others) joinGame(game, newPlayer(faction, faction, faction));
  const actions: {actor: string; action: Action}[] = [];
  const act = (actor: string, action: Action) => {
    actions.push(structuredClone({actor, action}));
    game = applyAction(game, actor, action);
  };
  act(host, {type:'moduleOption', module:'ecazTreachery', enabled:true});
  if (options.nexus !== false) act(host, {type:'moduleOption', module:'nexusCards', enabled:true});
  if (options.discoveries) act(host, {type:'moduleOption', module:'discoveries', enabled:true});
  if (options.skills) act(host, {type:'moduleOption', module:'leaderSkills', enabled:true});
  if (options.homeworlds) act(host, {type:'homeworlds', enabled:true});
  if (options.tech) act(host, {type:'techTokens', enabled:true});
  if (options.strongholds) act(host, {type:'strongholdCards', enabled:true});
  for (const player of game.players) act(player.id, {type:'ready'});
  const lobby = structuredClone(game);
  act(host, options.advanced ? {type:'start', advancedPreview:true} : {type:'start'});
  const setup = structuredClone(game);
  for (let count = 0; game.status === 'setup' && count < 100; count++) {
    let next: {actor:string; action:Action} | undefined;
    for (const player of game.players) {
      const view = viewGame(game, player.id);
      view.players.find(seat => seat.id === player.id)!.bot = 'Easy';
      const action = botActions(view)[0];
      if (action) { next = {actor:player.id, action}; break; }
    }
    assert.ok(next, `Original ${game.setupStage} setup must have an owned legal choice`);
    act(next.actor, next.action);
  }
  assert.equal(game.status, 'playing');
  return {lobby, setup, game, actions};
}
