import { INTRODUCTION_LEADERS, introductionTraitor, type IntroductionState } from '@/game/introduction';
import { INTRODUCTION_MOVE_DESTINATIONS, introductionMovement } from '@/game/introduction-movement';
import { splitLocation, territory } from '@/game/board';
import { LeaderInspector } from './leader-inspector';
import styles from './introduction.module.css';

type Props = { state: IntroductionState; update: (patch: Partial<IntroductionState>) => void };

export function MovementLesson({ state, update }: Props) {
  const move = introductionMovement(state);
  return <>
    <p>You have five ordinary Atreides forces in Red Chasm, sector 7. Move some or all as one group. This separate practice position has no allies or reacting powers.</p>
    <div className={styles.columns}>
      <div className={styles.controls}>
        <label htmlFor="learn-move-destination">Move destination</label>
        <select id="learn-move-destination" value={state.moveDestination}
          onChange={e => update({ moveDestination: e.target.value as IntroductionState['moveDestination'], moved: false })}>
          {INTRODUCTION_MOVE_DESTINATIONS.map(key => {
            const at = splitLocation(key);
            return <option key={key} value={key}>{territory(at.territory).name} · sector {at.sector}</option>;
          })}
        </select>
        <label htmlFor="learn-move-forces">Forces to move: {state.moveForces}</label>
        <input id="learn-move-forces" type="range" min="1" max="5" step="1" value={state.moveForces}
          onChange={e => update({ moveForces: Number(e.target.value), moved: false })} />
        <label className={styles.checkbox}><input type="checkbox" checked={state.moveCity}
          onChange={e => update({ moveCity: e.target.checked, moved: false })} />Start with a separate force in Arrakeen for ornithopters</label>
        <label className={styles.checkbox}><input type="checkbox" checked={state.moveStorm}
          onChange={e => update({ moveStorm: e.target.checked, moved: false })} />Put the destination sector under the storm</label>
        <button disabled={!move.allowed || state.moved} onClick={() => update({ moved: true })}>Move practice forces</button>
      </div>
      <div className={styles.result} aria-live="polite">
        <h3>{state.moved ? 'Movement complete' : 'Check the route'}</h3>
        <p>Your range is <strong>{move.range} {move.range === 1 ? 'territory' : 'territories'}</strong>{state.moveCity ? ' because you already occupy Arrakeen.' : '.'}</p>
        <p>Guild and Emperor each occupy Tuek’s Sietch in this position. A third faction cannot enter or pass through that stronghold.</p>
        {move.blocked ? <p>{move.blocked}</p> : <>
          <p>The shortest open route to {move.name}, sector {move.sector}, crosses {move.steps} {move.steps === 1 ? 'territory' : 'territories'}.</p>
          {state.moved ? <p><strong>{move.arrived} forces arrived.</strong> {move.sourceRemaining} remain in Red Chasm. {state.moveCity && 'The separate Arrakeen force stays there. '}Movement costs no spice and uses your one ordinary move.</p>
            : <p>You can move this group. Forces left behind stay in Red Chasm.</p>}
        </>}
        {state.moved && <button onClick={() => update({ moved: false })}>Reset practice movement</button>}
      </div>
    </div>
    <p>Crossing a territory boundary uses range; crossing a sector line within one territory does not add range. Storm sectors and stronghold capacity still constrain the path. Ornithopters let any one group move up to three territories, even when it starts away from the city.</p>
    <p className="fine">Change a control to start a fresh example. Live movement has further faction, alliance and card rules; this exercise uses ordinary Basic movement.</p>
  </>;
}

export function TraitorLesson({ state, update }: Props) {
  const resolved = state.traitorStage === 'resolved';
  const revealed = state.traitorStage !== 'plans';
  const outcome = resolved ? introductionTraitor(state) : null;
  const remaining = (player: string) => !outcome ? 6 : outcome.destroyedArmies.includes(player)
    ? 0 : 6 - (outcome.winner === player ? outcome.basicWinnerLosses ?? 0 : 0);
  return <>
    <p>A fresh battle has six forces on each side. You privately hold the Traitor for {INTRODUCTION_LEADERS.opponent.name}. A matching Traitor can overturn a losing plan, but you choose whether to reveal it after both plans appear.</p>
    <LeaderInspector kind="traitor" identity={{ ...INTRODUCTION_LEADERS.opponent, factionName: 'Spacing Guild' }} />
    <div className={styles.columns}>
      <div className={styles.controls}>
        <label className={styles.checkbox}><input type="checkbox" checked={state.opponentTraitor} disabled={revealed}
          onChange={e => update({ opponentTraitor: e.target.checked })} />Practice an opponent who also calls your leader as a Traitor</label>
        <p className="fine">This chooses the teaching scenario. At a real table, you cannot see the opponent’s private Traitors.</p>
        {!revealed ? <>
          <p>Your example plan uses {INTRODUCTION_LEADERS.you.name}, dial 2, no weapon and a Snooper. The opposing plan stays face down until you reveal both.</p>
          <button onClick={() => update({ traitorStage: 'revealed', traitorCall: false })}>Reveal practice plans</button>
        </> : <>
          <h3>Both plans are revealed</h3>
          <p>You: {INTRODUCTION_LEADERS.you.name}, dial 2, Snooper, no weapon.</p>
          <p>Opponent: {INTRODUCTION_LEADERS.opponent.name}, dial 3, projectile weapon, no defense.</p>
          {!resolved && <>
            <button onClick={() => update({ traitorStage: 'resolved', traitorCall: true })}>Call your matching Traitor</button>
            <button onClick={() => update({ traitorStage: 'resolved', traitorCall: false })}>Decline the Traitor call</button>
          </>}
        </>}
      </div>
      <div className={styles.result} aria-live="polite">
        {!outcome ? <><h3>{revealed ? 'Your Traitor matches' : 'Wait for the reveal'}</h3><p>{revealed
          ? 'The opposing leader matches the card you hold. You may call it now or keep it secret. Ordinary weapon and score resolution waits for the Traitor decisions.'
          : 'Having a Traitor is not enough: the opposing plan must use that leader. Your card remains private until you call it.'}</p></>
          : <>
            <h3>{outcome.result === 'mutualTraitors' ? 'Both leaders betrayed their factions'
              : outcome.winner === 'you' ? 'Your Traitor wins the battle' : 'Your opponent wins'}</h3>
            <p>{outcome.result === 'mutualTraitors' ? 'Both leaders die and both armies are destroyed. Neither side wins or receives a leader bounty.'
              : outcome.result === 'traitor' ? `${outcome.winner === 'you' ? 'Your' : 'The opponent’s'} successful call wins before weapons or battle scores resolve. The winner keeps every force and its leader; the betrayed leader dies and its army is destroyed.`
              : 'You declined and the opponent made no call. The projectile kills your leader because a Snooper only stops poison. Ordinary scores decide the battle.'}</p>
            {outcome.scores && <p>Your strength: {outcome.scores.attacker}. Opponent: {outcome.scores.defender}.</p>}
            <p><strong>Your forces remaining: {remaining('you')}. Opponent: {remaining('opponent')}.</strong></p>
            <p>{outcome.bounty?.amount ? `${outcome.bounty.player === 'you' ? 'You collect' : 'The opponent collects'} ${outcome.bounty.amount} spice for the killed leader.` : 'No leader bounty is paid.'}</p>
            <p>{outcome.winner ? 'The defeated player discards the cards used in the plan. The winner may keep or discard its used card.' : 'Both sides discard the cards used in their plans.'} A called Traitor card stays face up with its owner.</p>
            <button onClick={() => update({ traitorStage: 'plans', traitorCall: false })}>Try another Traitor decision</button>
          </>}
      </div>
    </div>
  </>;
}
