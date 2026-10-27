import assert from 'node:assert/strict';
import { createGame, joinGame, newPlayer, type Action, type Game } from '../game/engine';
import { actKullPurpose, advanceKullPurpose, kullPurposeClean, kullPurposePlayer,
  type KullPurposeStep } from './fixture-kull-purpose';
import { publicKullInventory } from './fixture-public-choam-kull';

export const act = actKullPurpose;
export const advance = advanceKullPurpose;
export const clean = kullPurposeClean;
export const player = kullPurposePlayer;
export const inventory = publicKullInventory;
export type IxNativeRoster = 'ixians' | 'tleilaxu' | 'both';

/** Host-created Basic Kull lobby with genuine native Ix setup. Only original
 * unopened Treachery and Spice positions are selected; every later payment,
 * decision, force, Face Dancer and movement transition comes from native play.
 * The scalar shuffle preserves the selected Ixian starting-pool deal order. */
export function createKullNativeIxFixture(roster: IxNativeRoster) {
  const actor = roster === 'ixians' ? 'ixians' : 'tleilaxu';
  let game = createGame('NATIVEKULL', newPlayer('choam','CHOAM','choam'), false, ['choam','ix']);
  const natives = roster === 'both' ? ['ixians','tleilaxu'] as const : [roster] as const;
  for (const faction of natives) joinGame(game, newPlayer(faction,faction,faction));
  for (const faction of ['emperor','guild'] as const) joinGame(game, newPlayer(faction,faction,faction));
  const actions: KullPurposeStep[] = [];
  const send = (seat: string, action: Action) => { game = act(game,seat,action,actions); };
  const reach = (until: (state: Game) => boolean) => { game = advance(game,until,actions); };
  send('choam',{type:'moduleOption',module:'kullPreview',enabled:true});
  for (const seat of game.players) send(seat.id,{type:'ready'});
  const lobby = structuredClone(game);
  send('choam',{type:'start'});
  const setup = structuredClone(game);
  assert.equal(game.status,'setup');
  assert.equal(game.kullPreview,true);
  assert.ok(game.players.every(seat => seat.hand.length === 0));
  const originalCards = game.deck.map(card=>card.id).sort();
  const selected: Game['deck'] = [];
  // In the Ixian starting pool, the first offered original card is selected,
  // then the remaining pool is dealt in non-Ixian seat order. The 'both'
  // roster therefore gives Ixians a harmless original card before the other
  // native faction receives its own Karama.
  const kinds = roster === 'ixians' ? ['karama','kull','karama','truth'] :
    roster === 'tleilaxu' ? ['kull','karama','karama','truth'] :
      ['filler','kull','karama','karama','truth'];
  for (const kind of kinds) {
    const index = game.deck.findIndex(card => kind === 'kull' ? card.id === 'ix-kull-wahad' :
      kind === 'truth' ? card.effect === 'truthtrance' : kind === 'karama' ? card.effect === 'karama' :
        card.kind === 'worthless' && card.id !== 'ix-kull-wahad');
    assert.ok(index >= 0,`Original ${kind} is available before deal`);
    selected.push(game.deck.splice(index,1)[0]);
  }
  game.deck.unshift(...selected);
  const beforeDeal = structuredClone(game);
  reach(state=>state.status === 'playing');
  const afterSetup = structuredClone(game);
  const kull = 'ix-kull-wahad';
  const karama = player(game,actor).hand.find(card=>card.effect === 'karama')?.id;
  const counter = player(game,'emperor').hand.find(card=>card.effect === 'karama')?.id;
  const truth = player(game,'guild').hand.find(card=>card.effect === 'truthtrance')?.id;
  assert.ok(karama && counter && truth);
  assert.notEqual(karama,counter);
  assert.ok(player(game,'choam').hand.some(card=>card.id === kull));
  assert.deepEqual(inventory(game),originalCards);
  if (roster !== 'tleilaxu') assert.ok(game.mobileStronghold);
  if (roster !== 'ixians') assert.equal(player(game,'tleilaxu').faceDancers?.length,3);
  const spice = game.spiceDeck.findIndex(card=>'territory' in card && !card.discovery);
  assert.ok(spice >= 0);
  game.spiceDeck.unshift(game.spiceDeck.splice(spice,1)[0]);
  reach(state=>state.phase <= 1 && clean(state));
  const early = structuredClone(game);
  reach(state=>state.phase === 5 && state.active === actor && clean(state));
  assert.deepEqual(inventory(game),originalCards);
  return { game, early, lobby, setup, beforeDeal, afterSetup, actions, originalCards,
    actor, reactor:'choam', counterOwner:'emperor', asker:'guild', recipient:'emperor',
    kull, karama, counter, truth };
}
export type KullNativeIxFixture = ReturnType<typeof createKullNativeIxFixture>;
export const attempt = (f: KullNativeIxFixture): Action =>
  ({type:'card',mode:'shipment',card:f.karama,target:f.actor});
