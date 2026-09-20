import type { IntroductionState } from '@/game/introduction';
import { introductionCharity, introductionRevival } from '@/game/introduction-resources';
import { LeaderInspector } from './leader-inspector';
import { LeaderPortrait } from './leader-portrait';
import styles from './introduction.module.css';

type Props = { state: IntroductionState; update: (patch: Partial<IntroductionState>) => void };

export function CharityLesson({ state, update }: Props) {
  const charity = introductionCharity(state);
  return <>
    <p>CHOAM Charity comes before Bidding. In this Basic example you are Atreides,
      with no expansion powers or special charity rules. Choose how much spice you already hold.</p>
    <div className={styles.columns}>
      <div className={styles.controls}>
        <label htmlFor="learn-charity-spice">Starting spice: {state.charitySpice}</label>
        <input id="learn-charity-spice" type="range" min="0" max="3" step="1" value={state.charitySpice}
          onChange={e => update({ charitySpice: Number(e.target.value), charityClaimed: false })} />
        <button disabled={!charity.canClaim} onClick={() => update({ charityClaimed: true })}>Claim practice charity</button>
        <button onClick={() => update({ charityClaimed: false })}>Restart charity example</button>
        <p className="fine">Changing the starting spice starts a fresh example. It does not change another lesson or any live game.</p>
      </div>
      <div className={styles.result} aria-live="polite">
        <h3>{state.charityClaimed ? 'Charity received' : charity.canClaim ? 'You can claim charity' : 'No charity needed'}</h3>
        <p>You have <strong>{charity.spice} spice</strong>.</p>
        <p>{state.charityClaimed ? 'The Spice Bank paid' : 'The Spice Bank would pay'} {charity.amount} spice.</p>
        {charity.reason && <p>{charity.reason}</p>}
        <p>With no spice you receive two; with one you receive one. At two or more, ordinary charity gives nothing.
          It brings an eligible player up to two spice; it does not add two to every player’s balance.</p>
      </div>
    </div>
    <p>Charity is a once-per-turn claim during its phase. That budget may matter in the following auction.
      Advanced Bene Gesserit and the CHOAM expansion change the ordinary case; their powers are separate.</p>
  </>;
}

export function RevivalLesson({ state, update }: Props) {
  const revival = introductionRevival(state);
  const selected = revival.leaders[state.revivalLeader];
  const reset = (patch: Partial<IntroductionState> = {}) => update({ revivalActions: [], ...patch });
  return <>
    <p>At the Revival phase, this separate Basic position has <strong>five ordinary forces in the Tanks</strong> and
      fifteen in reserves. Revived forces return to reserves, ready for later shipment.
      No Tleilaxu, ally funding, elites, cards or other expansion effects apply.</p>
    <div className={styles.columns}>
      <div className={styles.controls}>
        <label htmlFor="learn-revival-faction">Practice faction</label>
        <select id="learn-revival-faction" value={state.revivalFaction}
          onChange={e => reset({ revivalFaction: e.target.value as IntroductionState['revivalFaction'] })}>
          <option value="atreides">Atreides</option><option value="emperor">Emperor</option><option value="fremen">Fremen</option>
        </select>
        <label htmlFor="learn-revival-spice">Starting spice: {state.revivalSpice}</label>
        <input id="learn-revival-spice" type="range" min="0" max="10" step="1" value={state.revivalSpice}
          onChange={e => reset({ revivalSpice: Number(e.target.value) })} />
        <label htmlFor="learn-revival-roster">Starting leader position</label>
        <select id="learn-revival-roster" value={state.revivalRoster}
          onChange={e => reset({ revivalRoster: e.target.value as IntroductionState['revivalRoster'] })}>
          <option value="all-dead">All five leaders have died once</option>
          <option value="survivor">Four leaders dead; one has never died</option>
          <option value="repeat">First leader died twice; others died once</option>
        </select>
        <p className="fine">Faction, starting spice and leader position reset this example. Force and leader choices below share the same remaining spice.</p>
        <h3>Bring forces back</h3>
        <label htmlFor="learn-revival-amount">Forces to revive: {state.revivalAmount}</label>
        <input id="learn-revival-amount" type="range" min="1" max="4" step="1" value={state.revivalAmount}
          onChange={e => update({ revivalAmount: Number(e.target.value) })} />
        <button disabled={!revival.canReviveForces} onClick={() => update({ revivalActions: [...state.revivalActions, { kind: 'forces', amount: state.revivalAmount }] })}>Revive practice forces</button>
        <h3>Bring one leader back</h3>
        <label htmlFor="learn-revival-leader">Leader to revive</label>
        <select id="learn-revival-leader" value={state.revivalLeader}
          onChange={e => update({ revivalLeader: Number(e.target.value) })}>
          {revival.leaders.map((leader, index) => <option key={leader.id} value={index}>{leader.name} · strength {leader.strength} · {leader.dead ? `dead (${leader.deaths} ${leader.deaths === 1 ? 'death' : 'deaths'})` : 'alive'}</option>)}
        </select>
        <LeaderInspector identity={{ id: selected.id, name: selected.name, strength: selected.strength, factionName: revival.factionName }} />
        <button disabled={!revival.canReviveLeader} onClick={() => update({ revivalActions: [...state.revivalActions, { kind: 'leader', leader: state.revivalLeader }] })}>Revive practice leader</button>
        <button onClick={() => reset()}>Restart revival example</button>
      </div>
      <div className={styles.result} aria-live="polite">
        <h3>Your remaining resources</h3>
        <p><strong>{revival.spice} spice</strong> · {revival.tanks} forces in the Tanks · {revival.reserves} in reserves.</p>
        <p>{revival.revived} of three ordinary force revivals used this turn. You may still return up to {revival.remaining} {revival.remaining === 1 ? 'force' : 'forces'}.</p>
        <p>{revival.factionName} has {revival.freeRate} free force revivals per turn; {revival.freeRemaining} of that allowance remain.</p>
        <h3>Selected force return</h3>
        {revival.canReviveForces ? <p>{state.revivalAmount} forces: {revival.forceFree} free, total cost <strong>{revival.forceCost} spice</strong> to the Spice Bank.</p>
          : <p>{revival.forceReason}</p>}
        <h3>{selected.name}</h3>
        <LeaderPortrait identityId={selected.id} name={selected.name} fallback={<span>Strength {selected.strength}</span>} badge={selected.strength} />
        {revival.canReviveLeader ? <p>This leader can return for <strong>{revival.leaderCost} spice</strong> to the Spice Bank.</p>
          : <p>{revival.leaderReason}</p>}
        <p>{revival.leaderRevived ? 'Your ordinary leader revival is used for this turn.' : 'One ordinary leader may be revived this turn, if eligible and affordable.'}</p>
        <h3>Revival history</h3>
        {revival.transcript.length ? <ol>{revival.transcript.map((entry, i) => <li key={i}>{entry}</li>)}</ol>
          : <p>No revivals yet. Try returning forces in separate batches: the free allowance is shared across them.</p>}
      </div>
    </div>
    <p>The ordinary force limit is three total, including free returns. Extra paid returns cost two spice each.
      Force and leader allowances are separate, so a leader return does not consume a force revival.</p>
    <p>Normally all five leaders must die before the first revival cycle opens. You may then revive one eligible leader per turn
      for its fighting strength in spice. A returned leader that dies again must wait for the other revivable leaders to return and die again.
      Reviving a leader does not remove a matching Traitor Card from another player’s hand.</p>
  </>;
}
