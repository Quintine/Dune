import type { IntroductionState } from '@/game/introduction';
import { introductionAlliance } from '@/game/introduction-alliance';
import { TERRITORIES } from '@/game/board';
import styles from './introduction.module.css';

export function AllianceLesson({ state, update }: {
  state: IntroductionState; update: (patch: Partial<IntroductionState>) => void;
}) {
  const practice = introductionAlliance(state);
  const reset = (patch: Partial<IntroductionState> = {}) => update({
    allianceActions: [], allianceClosed: false, allianceChecked: false, ...patch,
  });
  return <>
    <p>Shai-Hulud has brought a Nexus during the Spice Blow phase of turn 2.
      This separate four-player Basic example starts after the worm and spice effects.
      You are Atreides; the Emperor is a possible partner. Harkonnen and the Guild stay unallied.</p>
    <div className={styles.columns}>
      <div className={styles.controls}>
        <label htmlFor="learn-alliance-scenario">Emperor’s practice response</label>
        <select id="learn-alliance-scenario" value={state.allianceScenario}
          onChange={e => reset({ allianceScenario: e.target.value as IntroductionState['allianceScenario'] })}>
          <option value="invited">Offers you an alliance first</option>
          <option value="accepts">Accepts your offer</option>
          <option value="waits">Stays unallied</option>
        </select>
        <label htmlFor="learn-alliance-holdings">Emperor’s strongholds</label>
        <select id="learn-alliance-holdings" value={state.allianceHoldings}
          onChange={e => reset({ allianceHoldings: Number(e.target.value) as 1 | 2 })}>
          <option value="2">Sietch Tabr and Habbanya Sietch · 2</option>
          <option value="1">Sietch Tabr only · 1</option>
        </select>
        <p className="fine">These fixed responses demonstrate consent, not an AI’s strategy. Changing an option starts a new example.</p>
        <button disabled={!practice.canOffer} onClick={() => update({ allianceActions: ['offer'] })}>
          {practice.incoming ? 'Accept Emperor’s offer' : 'Offer alliance to Emperor'}
        </button>
        <button disabled={!practice.canLeave} onClick={() => update({ allianceActions: [...state.allianceActions, 'leave'] })}>
          {practice.allied ? 'Break practice alliance' : practice.outgoing ? 'Withdraw your offer' : 'Remain unallied'}
        </button>
        <button disabled={state.allianceClosed} onClick={() => update({ allianceClosed: true })}>Finish practice Nexus</button>
        <button disabled={!state.allianceClosed || state.allianceChecked} onClick={() => update({ allianceChecked: true })}>Check the same board at Mentat Pause</button>
        <button onClick={() => reset()}>Restart alliance example</button>
      </div>
      <div className={styles.result} aria-live="polite">
        <h3>{state.allianceChecked ? practice.winner.length ? 'You win together' : 'No stronghold victory yet'
          : state.allianceClosed ? 'Nexus finished' : practice.allied ? 'Your alliance is public'
          : state.allianceActions.includes('leave') ? 'You remain unallied' : 'Choose whether to ally'}</h3>
        <p>{practice.allied ? 'You and the Emperor are allied. The ordinary alliance limit is two players.'
          : practice.outgoing ? `${state.allianceClosed ? 'Your offer was not accepted.' : 'Your offer is pending.'} You and the Emperor still count separately.`
          : practice.incoming && !state.allianceActions.length && !state.allianceClosed ? 'The Emperor has offered. You decide whether to accept.' : 'You are unallied.'}</p>
        {state.allianceActions.includes('leave') && !state.allianceClosed && <p>In a live Nexus you may continue negotiating. Restart this example to try another choice.</p>}
        <h3>Your stronghold progress</h3>
        <p><strong>{practice.progress.strongholds.length} / {practice.progress.target} strongholds</strong>
          {practice.allied ? ' held by your alliance' : ' held by you'}.</p>
        <ul>{practice.progress.strongholds.map(id => <li key={id}>{TERRITORIES.find(t => t.id === id)!.name}</li>)}</ul>
        <p>You occupy Arrakeen and Carthag. The Emperor occupies {state.allianceHoldings === 2 ? 'Sietch Tabr and Habbanya Sietch' : 'Sietch Tabr'}.
          Harkonnen holds Tuek’s Sietch; the Guild has a force in the Polar Sink.</p>
        {!state.allianceChecked && <p>This is prospective progress. Forming an alliance does not end the game during the Nexus.</p>}
        {state.allianceClosed && <p>Ordinary alliances cannot now change until another Nexus. For this exercise, the later phases leave every force in place; check this unchanged position at the Mentat Pause.</p>}
        {state.allianceChecked && <p>{practice.winner.length
          ? 'Atreides and the Emperor jointly hold four strongholds at the Mentat Pause and share the victory.'
          : `You need ${practice.progress.target - practice.progress.strongholds.length} more stronghold${practice.progress.target - practice.progress.strongholds.length === 1 ? '' : 's'} for an ordinary ${practice.allied ? 'alliance' : 'solo'} victory. The game continues.`}</p>}
        <h3>Nexus history</h3>
        {practice.transcript.length ? <ol>{practice.transcript.map((entry, i) => <li key={i}>{entry}</li>)}</ol>
          : <p>No offers yet. You may offer an alliance or stay unallied.</p>}
      </div>
    </div>
    <p>Both players must agree to form an alliance. Either partner may break it during a Nexus.
      In this ordinary four-player game, a solo player needs three strongholds and an alliance needs four at the Mentat Pause.</p>
    <p>An alliance shares the victory and grants the faction’s listed alliance power, not every faction advantage.
      Forces and cards remain owned by their players. Funding, movement restrictions, special victories and expansion exceptions are separate rules in the reference.</p>
  </>;
}
