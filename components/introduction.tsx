'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { BattleWheel } from './battle-wheel';
import { CardInspector, CardRules } from './card-inspector';
import { PHASES } from '@/game/catalog';
import {
  INTRODUCTION_CARDS, INTRODUCTION_LEADERS, INTRODUCTION_STEPS, INTRODUCTION_STORAGE_KEY,
  introductionBattle, introductionCollection, introductionShipment, newIntroduction, restoreIntroduction,
  type IntroductionState,
} from '@/game/introduction';
import styles from './introduction.module.css';

const subscribeHydration = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

export function Introduction() {
  const hydrated = useSyncExternalStore(subscribeHydration, clientSnapshot, serverSnapshot);
  return <main className={styles.page}>
    <header className={styles.header}>
      <Link href="/">← Return to Arrakis</Link>
      <p className="eyebrow">LEARN TO PLAY · BASIC GAME</p>
      <h1>A first turn on Arrakis</h1>
      <p>Try three small examples, then take a seat at a real table. These are separate practice positions; they do not change any saved game.</p>
    </header>
    {hydrated ? <IntroductionLessons /> : <output>Restoring your lesson…</output>}
  </main>;
}

function IntroductionLessons() {
  const [{ state, storageFailed }, setProgress] = useState(() => {
    try { return { state: restoreIntroduction(localStorage.getItem(INTRODUCTION_STORAGE_KEY)) ?? newIntroduction(), storageFailed: false }; }
    catch { return { state: newIntroduction(), storageFailed: true }; }
  });
  const heading = useRef<HTMLHeadingElement>(null);
  const focusNext = useRef(false);
  useEffect(() => {
    if (focusNext.current) { heading.current?.focus(); focusNext.current = false; }
  }, [state.step]);
  const update = (patch: Partial<IntroductionState>) => {
    const next = { ...state, ...patch };
    let failed = false;
    try { localStorage.setItem(INTRODUCTION_STORAGE_KEY, JSON.stringify(next)); }
    catch { failed = true; }
    setProgress({ state: next, storageFailed: failed });
  };
  const go = (step: number) => { focusNext.current = true; update({ step }); };
  const shipment = introductionShipment(state);
  const battle = state.revealed ? introductionBattle(state) : null;
  const collection = introductionCollection(state);
  const lesson = INTRODUCTION_STEPS[state.step];
  const won = battle?.winner === 'you';
  const survivingForces = battle ? (won ? 6 - state.dial : 0) : 0;
  return <>
      <nav className={styles.steps} aria-label="Introduction lessons">
        {INTRODUCTION_STEPS.map((step, index) => <button key={step.title}
          aria-current={state.step === index ? 'step' : undefined} onClick={() => go(index)}>
          <span>{index + 1}</span>{step.title}
        </button>)}
      </nav>
      <section className={styles.lesson} aria-labelledby="lesson-title">
        <p className="eyebrow">{state.step + 1} / {INTRODUCTION_STEPS.length}</p>
        <h2 id="lesson-title" ref={heading} tabIndex={-1}>{lesson.title}</h2>
        {state.step === 0 && <>
          <p>Each faction has its own powers. You will practice as Atreides with ordinary forces in the Basic game. Advanced combat and expansion powers come later.</p>
          <div className={styles.columns}>
            <div><h3>On the table</h3><p>Everyone can see the board, forces, storm and revealed cards. Your spice, Treachery hand and Traitors stay private unless a rule reveals them.</p></div>
            <div><h3>Your objective</h3><p>Normally, hold three strongholds alone or four together with your ally at the Mentat Pause. Player-count and faction victory rules can change that target; the live table shows your current victory progress.</p></div>
          </div>
          <h3>A turn follows these phases</h3>
          <ol className={styles.phases}>{PHASES.map(phase => <li key={phase}>{phase}</li>)}</ol>
          <p>The table tells you who must act. Your decisions can wait while another player seals a plan or answers a power. Automatic effects show in the chronicle.</p>
        </>}
        {state.step === 1 && <>
          <p>You have <strong>8 spice</strong> and six available reserve forces. Ship from reserves before moving on the board. This example has no discount, storm, occupancy restriction or reacting faction power.</p>
          <div className={styles.columns}>
            <div className={styles.controls}>
              <label htmlFor="learn-destination">Destination</label>
              <select id="learn-destination" value={state.destination} onChange={e => update({ destination: e.target.value as IntroductionState['destination'], shipped: false })}>
                <option value="sand">Wind Pass · 2 spice per force</option>
                <option value="stronghold">Arrakeen · 1 spice per force</option>
              </select>
              <label htmlFor="learn-shipment">Forces to ship: {state.shipment}</label>
              <input id="learn-shipment" type="range" min="1" max="6" step="1" value={state.shipment}
                onChange={e => update({ shipment: Number(e.target.value), shipped: false })} />
              <button disabled={!shipment.affordable || state.shipped} onClick={() => update({ shipped: true })}>Ship practice forces</button>
            </div>
            <div className={styles.result} aria-live="polite">
              <h3>{state.shipped ? 'Shipment complete' : 'Review the cost'}</h3>
              <p>{state.shipment} forces cost <strong>{shipment.cost} spice</strong>.</p>
              {shipment.affordable ? <p>{state.shipped ? 'You have' : 'You would have'} {shipment.remaining} spice left.</p>
                : <p>You need {shipment.cost - 8} more spice. Reduce the force count or choose the stronghold.</p>}
              {state.shipped && <p>{state.shipment} forces arrived; {6 - state.shipment} of your six available reserves remain. You could now move one group already on the board, including these newly shipped forces.</p>}
            </div>
          </div>
          <p className="fine">Ordinary movement reaches an adjacent territory. Ornithopters and faction powers can extend its range. Inspect the live destination guide before committing.</p>
        </>}
        {state.step === 2 && <>
          <p>A separate battle: you are the aggressor in Wind Pass with six ordinary forces and {INTRODUCTION_LEADERS.you.name}, strength {INTRODUCTION_LEADERS.you.strength}. Your opponent also has six forces. Neither side calls a Traitor or uses a faction power in this example.</p>
          <div className={styles.columns}>
            <div className={styles.controls}>
              <label htmlFor="learn-dial">Forces dialed</label>
              <div className={styles.wheel}><BattleWheel id="learn-dial" value={state.dial} max={6} step={1} disabled={state.revealed} onChange={dial => update({ dial })} /></div>
              <label htmlFor="learn-defense">Your defense · no weapon</label>
              <select id="learn-defense" value={state.defense} disabled={state.revealed} onChange={e => update({ defense: e.target.value as IntroductionState['defense'] })}>
                <option value="shield">Shield</option><option value="snooper">Snooper</option>
              </select>
              <CardRules card={INTRODUCTION_CARDS[state.defense]} />
              <CardInspector card={INTRODUCTION_CARDS[state.defense]} />
              <button disabled={state.revealed} onClick={() => update({ revealed: true })}>Seal plan and reveal both</button>
            </div>
            <div className={styles.result} aria-live="polite">
              {!battle ? <><h3>Opponent’s plan is sealed</h3><p>Choose how much to risk. In a normal victory you lose the forces you dial; in defeat you lose all your forces in this battle. In Basic play, ordinary forces need no spice support.</p><p>Your selected leader contributes strength only if they survive the weapon exchange. Plans reveal together.</p></>
                : <><h3>{won ? 'You won the battle' : 'Your opponent won'}</h3>
                  <p>The opponent dialed 3 with {INTRODUCTION_LEADERS.opponent.name} (strength {INTRODUCTION_LEADERS.opponent.strength}), a {INTRODUCTION_CARDS.weapon.name} and no defense.</p>
                  <CardInspector card={INTRODUCTION_CARDS.weapon} />
                  <p>{battle.leaderDeaths.attacker ? 'Your Snooper stops poison, so it cannot stop this projectile weapon. Your leader dies and adds no strength.' : 'Your Shield stops the projectile weapon. Your leader survives and adds five strength.'}</p>
                  <p><strong>Your total: {battle.scores!.attacker}. Opponent: {battle.scores!.defender}.</strong> {battle.scores!.attacker === battle.scores!.defender && 'The aggressor wins this ordinary tie.'}</p>
                  <p>{6 - survivingForces} of your forces go to the Tanks; {survivingForces} remain in Wind Pass. {won ? 'The opponent loses all six forces.' : 'The opponent loses the three dialed forces and keeps three.'}</p>
                  <p>{won ? 'A normal winner may keep or discard the cards they used.' : 'The defeated player discards the cards used in the plan.'} {battle.bounty?.amount ? `The winner also collects ${battle.bounty.amount} spice for the killed leader.` : 'Neither leader died, so there is no leader bounty.'}</p>
                  <button onClick={() => update({ revealed: false })}>Try another plan</button>
                </>}
            </div>
          </div>
        </>}
        {state.step === 3 && <>
          <p>A fresh position has 8 spice in Wind Pass, sector 14. You have surviving forces in that same sector, outside the storm. Collection uses the forces still on the board after battles.</p>
          <div className={styles.columns}>
            <div className={styles.controls}>
              <label htmlFor="learn-collectors">Forces at the spice: {state.collectors}</label>
              <input id="learn-collectors" type="range" min="0" max="6" step="1" value={state.collectors} onChange={e => update({ collectors: Number(e.target.value), collected: false })} />
              <label className={styles.checkbox}><input type="checkbox" checked={state.city} onChange={e => update({ city: e.target.checked, collected: false })} />Also occupy Arrakeen with a separate force</label>
              <button disabled={state.collected} onClick={() => update({ collected: true })}>Collect practice spice</button>
            </div>
            <div className={styles.result} aria-live="polite"><h3>{state.collected ? 'Collection complete' : 'Collection capacity'}</h3>
              <p>Each ordinary force can collect {state.city ? 3 : 2} spice{state.city ? ' because you occupy Arrakeen' : ''}.</p>
              <p>{state.collected ? 'You collected' : 'You can collect'} <strong>{collection.amount} spice</strong>. {collection.remaining} {state.collected ? 'remains' : 'would remain'} on the board.</p>
              <p>Spice beyond your capacity stays for a later turn. In a real table this calculation is automatic.</p>
            </div>
          </div>
        </>}
        {state.step === 4 && <>
          <p>You can revisit any example. This introduction covers the core resource and battle choices; it does not teach every faction, card, alliance, storm exception or expansion.</p>
          <ul>
            <li>Create a private room, choose a faction, and add friends or AI players. Share the room invitation.</li>
            <li>Mark yourself ready after reviewing the selected rules. The host begins once all seats are ready.</li>
            <li>Inspect your private Treachery hand and Traitors. Use the phase guide when a decision is unfamiliar.</li>
            <li>Use <strong>Protect your saved seat</strong> and keep its recovery kit private. An invitation identifies the room; the kit restores your seat after cookie loss.</li>
          </ul>
          <p>Refresh restores a live game through its saved seat. If a request has an uncertain result, use the offered retry rather than repeating the game action.</p>
          <div className={styles.links}><Link href="/">Create or join a game →</Link><Link href="/rules">Explore the full reference →</Link></div>
        </>}
        <footer className={styles.footer}>
          <button disabled={state.step === 0} onClick={() => go(state.step - 1)}>Previous lesson</button>
          <Link href={`/rules?topic=${lesson.topic}#${lesson.topic}`}>Read the related rules</Link>
          {state.step < INTRODUCTION_STEPS.length - 1 && <button onClick={() => go(state.step + 1)}>Next lesson</button>}
        </footer>
      </section>
      <output className={styles.saved}>{storageFailed ? 'Browser storage is unavailable. You can still practice, but a refresh may reset this lesson.' : 'Your lesson position and practice choices are saved in this browser.'}</output>
  </>;
}
