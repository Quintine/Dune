import type { IntroductionState } from '@/game/introduction';
import { introductionStorm, introductionSpiceBlow, PRACTICE_PREVIOUS_BLOW } from '@/game/introduction-opening';
import { splitLocation, territory } from '@/game/board';
import { BattleWheel } from './battle-wheel';
import { SpiceCardInspector, spiceCardTitle } from './spice-card-inspector';
import styles from './introduction.module.css';

type Props = { state: IntroductionState; update: (patch: Partial<IntroductionState>) => void };
const spicePlaces = (spice: Record<string, number>) => Object.entries(spice).map(([key, amount]) =>
  `${territory(splitLocation(key).territory).name}, sector ${splitLocation(key).sector}: ${amount} spice`).join('; ') || 'No spice on the board';

export function StormLesson({ state, update }: Props) {
  const result = introductionStorm(state);
  const first = state.stormExample === 'first';
  return <>
    <p>Two players secretly dial the storm’s distance on their Battle Wheels. On the first turn, the players nearest
      the Storm Start dial 0–20. On later Basic turns, the last two players to use the wheels in battle dial 1–3;
      if no battle occurred, the previous pair stays. This example has no Weather Control or other reacting powers.</p>
    <div className={styles.columns}>
      <div className={styles.controls}>
        <label htmlFor="learn-storm-example">Storm example</label>
        <select id="learn-storm-example" value={state.stormExample} onChange={e => update({ stormExample: e.target.value as IntroductionState['stormExample'], stormDial: 2, stormStage: 'draft' })}>
          <option value="later">Later Basic turn · exposed and sheltered forces</option>
          <option value="first">First turn · starting Atreides forces</option>
        </select>
        <label htmlFor="learn-storm-dial">Your storm dial</label>
        <div className={styles.wheel}><BattleWheel id="learn-storm-dial" sliderLabel="Storm distance slider" value={state.stormDial} min={first ? 0 : 1} max={first ? 20 : 3} step={1}
          disabled={state.stormStage !== 'draft'} onChange={stormDial => { if (Number.isInteger(stormDial) && stormDial >= (first ? 0 : 1) && stormDial <= (first ? 20 : 3)) update({ stormDial }); }} /></div>
        <button disabled={state.stormStage !== 'draft'} onClick={() => update({ stormStage: 'sealed' })}>Seal practice storm dial</button>
        <button disabled={state.stormStage !== 'sealed'} onClick={() => update({ stormStage: 'revealed' })}>Reveal both practice dials</button>
        <button disabled={state.stormStage !== 'revealed'} onClick={() => update({ stormStage: 'resolved' })}>Move practice storm</button>
        <button onClick={() => update({ stormStage: 'draft' })}>Reset storm example</button>
      </div>
      <div className={styles.result} aria-live="polite">
        <h3>{state.stormStage === 'resolved' ? 'Storm movement complete' : state.stormStage === 'revealed' ? 'Both dials revealed' : state.stormStage === 'sealed' ? 'Your dial is sealed' : 'Prepare a secret dial'}</h3>
        <p>The storm is at sector <strong>{result.sector}</strong>.</p>
        {result.distance === null ? <p>The other dial stays hidden. Sealing does not move the storm.</p> : <p>Your {state.stormDial} plus the other player’s {result.otherDial} makes {result.distance} sectors counterclockwise.</p>}
        {state.stormStage === 'revealed' && <p>At a live table, players may use eligible storm cards before movement. This example has none.</p>}
        {state.stormStage === 'resolved' && <p>{result.crossed.length ? `Crossed sectors: ${result.crossed.join(' → ')}.` : 'Zero movement crosses no sector.'}</p>}
        <ul>{result.locations.map(place => <li key={place.key}>{place.name}, sector {place.sector}: {place.after} forces{state.stormStage === 'resolved' ? ` (${place.before - place.after} lost)` : ''} · {place.sheltered ? 'sheltered' : 'exposed sand'}</li>)}</ul>
        <p>Your reserves: {result.reserves}. Your Tanks: {result.tanks}.</p>
        <p>{spicePlaces(result.spice)}.</p>
      </div>
    </div>
    <p>Storm crosses every intervening sector and wraps from 18 to 1. Exposed forces go to the Tanks and crossed spice disappears.
      Rock, strongholds and Polar Sink shelter forces; the intact Shield Wall also shelters Imperial Basin.
      The first example starts with sheltered Atreides forces. Later examples are separate prepared positions.</p>
  </>;
}

export function SpiceBlowLesson({ state, update }: Props) {
  const result = introductionSpiceBlow(state);
  return <>
    <p>A territory card places its printed spice in one sector. When the preceding eligible discard is a territory card,
      Shai-Hulud affects that whole territory, then drawing continues to a new territory card. In these separate examples, no Fremen forces,
      allies, Harvester or other reacting powers are present.</p>
    <div className={styles.columns}>
      <div className={styles.controls}>
        <label htmlFor="learn-blow-example">Spice Blow example</label>
        <select id="learn-blow-example" value={state.blowExample} onChange={e => update({ blowExample: e.target.value as IntroductionState['blowExample'], blowStage: 'draft' })}>
          <option value="clear">Add spice to an existing pile</option><option value="storm">The card’s sector is in storm</option>
          <option value="worm">Shai-Hulud in a later turn</option><option value="first-worm">Ignore Shai-Hulud on turn one</option>
        </select>
        <p>Turn {result.turn} · storm sector {result.storm}.</p>
        {result.turn > 1 && <><p>Previous territory card: {spiceCardTitle(PRACTICE_PREVIOUS_BLOW)}. Three Emperor forces occupy that territory.</p><SpiceCardInspector card={PRACTICE_PREVIOUS_BLOW} context="Practice previous discard" /></>}
        <button disabled={state.blowStage !== 'draft'} onClick={() => update({ blowStage: 'revealed' })}>Reveal practice spice sequence</button>
        <button disabled={state.blowStage !== 'revealed'} onClick={() => update({ blowStage: 'settled' })}>{state.blowExample === 'worm' ? 'Finish blow and open Nexus' : 'Finish practice Spice Blow'}</button>
        <button onClick={() => update({ blowStage: 'draft' })}>Reset Spice Blow example</button>
      </div>
      <div className={styles.result} aria-live="polite">
        <h3>{state.blowStage === 'draft' ? 'The next draw is face down' : result.nexus ? 'Nexus: negotiate alliances' : state.blowStage === 'settled' ? 'Continue to CHOAM Charity' : 'Spice sequence revealed'}</h3>
        {result.revealed.map((card, index) => <div key={index}><p>{index + 1}. {spiceCardTitle(card)}</p><SpiceCardInspector card={card} context="Practice revealed card" /></div>)}
        <p>{spicePlaces(result.spice)}.</p>
        <p>Emperor forces in The Great Flat: {result.forces}. Tanks: {result.tanks}. Reserves: {result.reserves}.</p>
        {result.added !== null && <p>{result.added ? `${result.added} spice was added to Broken Land.` : 'Broken Land is in storm: its card adds no spice.'}</p>}
        {state.blowExample === 'worm' && state.blowStage !== 'draft' && <p>Shai-Hulud consumed all six spice and three Emperor forces in The Great Flat. It did not attack the new Broken Land blow. {state.blowStage === 'settled' ? 'The replacement blow is finished and the Nexus is open.' : 'Finish the new blow before starting alliance negotiations.'}</p>}
        {result.skippedWorm && <p>{state.blowStage === 'settled' ? 'The ignored worm is shuffled back after this first-turn blow.' : 'On turn one, set the worm aside and draw a replacement. It causes no destruction or Nexus.'}</p>}
        {result.nexus && <p>The next lesson lets you practice an alliance offer, acceptance or withdrawal. Once negotiations finish, eligible Fremen may ride before Charity; this example has no Fremen to move.</p>}
      </div>
    </div>
    <p>Ordinary worms consume forces and spice throughout the previous territory, across its sectors. Fremen normally
      survive and may protect allies or ride, subject to their response windows. Advanced double blows and expansion cards have separate rules.</p>
  </>;
}
