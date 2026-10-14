import type { Action, GameView } from './engine';


export function nexusTleilaxuRevivalAction(
  game:GameView,event:string,leader:string,amount:number,elite:number,
):Action|null {
  const offer=game.nexusTleilaxu?.secretAlly;
  const owner=game.players.find(p=>p.id===game.me);
  if(!offer||offer.blocked||!owner||game.status!=='playing'||game.phase!==4||
    owner.ally||game.nexusCards?.card!=='tleilaxu'||offer.event!==event||
    !offer.leaders.some(candidate=>candidate.id===leader)||
    !Number.isSafeInteger(amount)||amount<0||amount>offer.maxForces||amount>(owner.spice??0)||
    !Number.isSafeInteger(elite)||elite<0||elite>amount||elite>offer.maxElite||
    amount-elite>owner.tanks-(owner.elites?.tanks??0))return null;
  return {type:'nexusTleilaxuRevival',event,leader,amount,elite};
}
/** The server's private offer binds the complete revealed replacement group.
 * Do not reconstruct eligibility from private Face Dancer hands. */
export function nexusFaceDancersAction(
  game: GameView,
  event: string,
): Action | null {
  const offer = game.nexusTleilaxu?.cunning;
  const owner = game.players.find((player) => player.id === game.me);
  if (
    game.status !== 'playing' ||
    !owner ||
    owner.faction !== 'tleilaxu' ||
    owner.ally ||
    game.nexusCards?.card !== 'tleilaxu' ||
    game.truthtrance ||
    game.nexusCards.waiting.length ||
    game.nexusTraitors?.pending ||
    !offer ||
    !event ||
    offer.event !== event ||
    offer.blocked ||
    !Number.isSafeInteger(offer.count) ||
    offer.count < 1
  )
    return null;
  return { type: 'nexusFaceDancers', event };
}

/** All profiles share the legal replacement policy. There is no post-draw
 * choice and no access to another player's hand or the reserve order. */
export function nexusTleilaxuBotActions(game: GameView): Action[] {
  const revival=game.nexusTleilaxu?.secretAlly;
  if(revival&&!revival.blocked&&revival.leaders.length) {
    const owner=game.players.find(p=>p.id===game.me)!;
    const amount=Math.min(revival.maxForces,owner.spice??0);
    const elite=Math.max(0,amount-(owner.tanks-(owner.elites?.tanks??0)));
    const action=nexusTleilaxuRevivalAction(game,revival.event,revival.leaders[0].id,amount,elite);
    if(action)return [action];
  }
  const offer = game.nexusTleilaxu?.cunning;
  const action = offer ? nexusFaceDancersAction(game, offer.event) : null;
  return action ? [action] : [];
}
