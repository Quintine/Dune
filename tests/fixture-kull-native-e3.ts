import assert from 'node:assert/strict';
import { createGame, joinGame, newPlayer, type Action, type Game } from '../game/engine';
import { territory } from '../game/board';
import { actKullPurpose, kullPurposeClean, kullPurposePlayer, nextKullPurposeStep,
  type KullPurposeStep } from './fixture-kull-purpose';
import { publicKullInventory } from './fixture-public-choam-kull';

export const act = actKullPurpose;
export const clean = kullPurposeClean;
export const player = kullPurposePlayer;
export const inventory = publicKullInventory;
export type E3NativeRoster = 'ecaz' | 'moritani' | 'both';
export type E3NativeTarget = 'ecaz' | 'moritani';

/** Make only ordinary native decisions, declining optional placements and
 * effects unless the caller has stopped at the requested original control. */
function step(game: Game): KullPurposeStep | null {
  if (!game.phaseOpening && !game.response && game.decision) {
    const d = game.decision;
    if (d.kind === 'moritaniSetup') return { actor: d.player,
      action: { type: 'decision', territory: 'carthag', sector: territory('carthag').sectors[0] } };
    if (d.kind === 'ecazPlacement' || d.kind === 'moritaniPlacement')
      return { actor: d.player, action: { type: 'decision', decline: true } };
    if (d.kind === 'ecazAmbassador') return { actor: d.player,
      action: { type: 'decision', event: game.pendingAmbassador!.event, decline: true } };
  }
  return nextKullPurposeStep(game);
}
export function advance(game: Game, until: (state: Game) => boolean, actions: KullPurposeStep[] = []): Game {
  for (let n = 0; n < 1800; n++) {
    if (until(game)) return game;
    assert.notEqual(game.status,'finished','The native E3 Kull programme ended before the requested window');
    const next = step(game); assert.ok(next,`A native continuation is required at ${game.status}/${game.turn}/${game.phase}/${game.decision?.kind}`);
    game = act(game,next.actor,next.action,actions);
  }
  throw Error('The native E3 Kull programme did not reach its finite boundary');
}

/** Real public Basic start; only original unopened Treachery and Spice
 * positions are chosen before native deal. No force, wallet, token or phase is
 * staged. Every subsequent placement and cancellation uses native actions. */
export function createKullNativeE3Fixture(roster: E3NativeRoster, target: E3NativeTarget = roster === 'moritani' ? 'moritani' : 'ecaz') {
  assert.ok(roster === 'both' || roster === target);
  let game = createGame('KULLE3',newPlayer('choam','CHOAM','choam'),false,['choam','ix','ecaz']);
  const natives = roster === 'both' ? ['ecaz','moritani'] as const : [roster] as const;
  for (const faction of natives) joinGame(game,newPlayer(faction,faction,faction));
  for (const faction of ['emperor','guild'] as const) joinGame(game,newPlayer(faction,faction,faction));
  const actions: KullPurposeStep[] = [];
  const send = (actor: string, action: Action) => { game = act(game,actor,action,actions); };
  const reach = (predicate: (state: Game) => boolean) => { game = advance(game,predicate,actions); };
  send('choam',{type:'moduleOption',module:'kullPreview',enabled:true});
  for (const seat of game.players) send(seat.id,{type:'ready'});
  const lobby = structuredClone(game);
  send('choam',{type:'start'});
  assert.equal(game.status,'setup'); assert.equal(game.kullPreview,true);
  const setup = structuredClone(game), originalCards = game.deck.map(card => card.id).sort();
  const kinds = roster === 'both' ? ['kull','truth','filler','karama','karama'] : ['kull','truth','karama','karama'];
  const chosen: Game['deck'] = [];
  for (const kind of kinds) {
    const index = game.deck.findIndex(card => kind === 'kull' ? card.id === 'ix-kull-wahad' :
      kind === 'truth' ? card.effect === 'truthtrance' : kind === 'karama' ? card.effect === 'karama' :
        card.kind === 'worthless' && card.id !== 'ix-kull-wahad');
    assert.ok(index >= 0); chosen.push(game.deck.splice(index,1)[0]);
  }
  game.deck.unshift(...chosen);
  const beforeDeal = structuredClone(game);
  reach(state => state.status === 'playing');
  const afterSetup = structuredClone(game), kull = 'ix-kull-wahad';
  const karama = player(game,'emperor').hand.find(card => card.effect === 'karama')?.id;
  const counter = player(game,'guild').hand.find(card => card.effect === 'karama')?.id;
  const asker = roster === 'moritani' ? 'moritani' : 'ecaz';
  const truth = player(game,asker).hand.find(card => card.effect === 'truthtrance')?.id;
  assert.ok(karama && counter && truth && karama !== counter);
  assert.ok(player(game,'choam').hand.some(card => card.id === kull));
  assert.deepEqual(inventory(game),originalCards);
  if (roster !== 'moritani') assert.ok(game.ecazAmbassadors && game.ecazOccupyPreview);
  if (roster !== 'ecaz') assert.ok(game.moritaniTerror);
  const spice = game.spiceDeck.findIndex(card => 'territory' in card && !card.discovery);
  assert.ok(spice >= 0); game.spiceDeck.unshift(game.spiceDeck.splice(spice,1)[0]);
  reach(state => state.phase <= 1 && clean(state));
  const early = structuredClone(game);
  const phase = target === 'ecaz' ? 4 : 8;
  const decision = target === 'ecaz' ? 'ecazPlacement' : 'moritaniPlacement';
  reach(state => state.phase === phase && state.decision?.kind === decision && !state.response && !state.phaseOpening);
  const beforePlacement = structuredClone(game);
  const token = target === 'ecaz' ? game.ecazAmbassadors!.tokens.find(row => row.effect === 'ecaz' && row.zone === 'supply')
    : game.moritaniTerror!.tokens.find(row => row.status === 'available');
  assert.ok(token);
  send(target,{type:'decision',token:token.id,territory:'carthag'});
  assert.equal(game.response?.kind,decision);
  assert.deepEqual(inventory(game),originalCards);
  return { game, early, beforePlacement, lobby, setup, beforeDeal, afterSetup, actions, originalCards,
    actor:'emperor', reactor:'choam', counterOwner:'guild', asker, target, token:token.id,
    kull, karama, counter, truth };
}
export type KullNativeE3Fixture = ReturnType<typeof createKullNativeE3Fixture>;
