'use client';

import type { Action, GameView } from '@/game/engine';
import { liveRevivalExpressionPromises } from '@/game/revival-expression-promises';
import { truthQuestionText } from '@/game/truthtrance';
import { CHEAP_HERO_TRAITOR } from '@/game/traitors';
import { RevivalExpressionPromiseGuideButton } from './revival-expression-promises';

/** Only the original question, aggregate answer and ordinary return progress
 * are projected. Never evaluate facts or inspect a compiled future branch. */
export function MixedRevivalPromises(props: { game: GameView; busy: boolean; send: (action: Action) => void }) {
  const game = props.game, own = game.mixedRevivalPromises.filter(promise => promise.player === game.me);
  if (!own.length) return null;
  const leaderName = (id: string) => id === 'kwisatz' ? 'Kwisatz Haderach'
    : id === CHEAP_HERO_TRAITOR ? 'Cheap Hero / Heroine' : game.allLeaders.find(leader => leader.id === id)?.name ?? id;
  const live = own.some(promise => promise.turn === game.turn && !promise.fulfilled && !promise.released);
  const other = game.revivalOrder?.remaining[0];
  const waiting = live && (game.phase < 4 || game.phase === 4 && other && other !== game.me);
  const sharedGuideElsewhere = liveRevivalExpressionPromises(game.revivalExpressionPromises, game.me, game.turn).length > 0;
  return <section className="notice space-y-3" aria-label="Your Truthtrance mixed Revival promises" id="mixed-revival-promise-guidance">
    <h3>Your mixed Revival promises</h3>
    <ul>{own.map(promise => <li key={promise.event}>
      Turn {promise.turn}: You answered {promise.answer ? 'Yes' : 'No'} to {truthQuestionText({ kind: 'mixedRevival', target: promise.player,
        turn: promise.turn, mixed: promise.mixed }, leaderName,
      id => game.combatLocations.find(location => location.id === id)?.name ?? id,
      id => game.players.find(player => player.id === id)?.name ?? id)}
      {' '}Future ordinary progress: {promise.progress.total} physical forces ({promise.progress.normal} normal, {promise.progress.elite} elite);
      {' '}returned leaders: {promise.progress.leaders.length ? promise.progress.leaders.map(leaderName).join(', ') : 'none'}.
      {promise.released ? ' Released: this whole commitment is no longer possible.'
        : promise.fulfilled ? ' Fulfilled: this whole commitment is complete.' : ' This whole answer is binding for this turn.'}
    </li>)}</ul>
    <p>Current facts are evaluated at the answer. They create no promise to keep cards, spice or forces afterward.
      Only the aggregate answer is shared. Individual fact answers and any reduced future branch remain private.
      AND requires every condition; OR requires at least one. No negates the whole expression, not each condition separately.
      Legal alternatives remain available; no fixed branch is selected for you.</p>
    <p className="fine">Physical force progress is cumulative across smaller future ordinary returns; each normal or elite counter counts once.
      Only actual ordinary native force and named-leader returns after the answer count.
      Prior returns, requests alone, Ghola, foreign leaders and special card returns do not count.
      Original costs, revival cycles, limits and turn order still apply. The claim grants no extra Revival opportunity.
      A guide may accept an existing current Tleilaxu quote; it does not arrange new consent.
      {' '}<a href="/rules#truthtrance-mixed-revival">Mixed Revival rules</a>.</p>
    {waiting && <p>Your Revival opportunity is still ahead; {game.phase < 4
      ? 'continue the current phase and preserve the resources for your whole answer.'
      : 'this promise remains visible while the current actor finishes.'}</p>}
    {live && !sharedGuideElsewhere && <RevivalExpressionPromiseGuideButton {...props} />}
  </section>;
}
