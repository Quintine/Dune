import {applyAction,type Game} from '../game/engine';
import type {MixedShipmentExpression} from '../game/mixed-shipment-question';
import {compoundShipmentGame,openCompoundShipmentQuestion} from './fixture-compound-shipment';

/** Genuine base setup, then the existing labelled conserved shipment position. */
export function mixedShipmentGame(): Game {
  return compoundShipmentGame();
}
export function askMixedShipment(game: Game, mixed: MixedShipmentExpression): Game {
  return applyAction(openCompoundShipmentQuestion(game),game.players[1].id,{
    type:'truthAsk',question:{kind:'mixedShipment',target:game.players[0].id,mixed},
  });
}
export function mixedSpiceShipment(kind:'and'|'or',compare:'gte'|'lte',value:number): MixedShipmentExpression {
  return {kind,terms:[{kind:'fact',fact:{kind:'spice',compare,value}},
    {kind:'shipment',territory:'arrakeen',minimum:4}]};
}
