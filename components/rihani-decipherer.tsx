'use client';

import { useState } from 'react';
import type { Action, GameView } from '@/game/engine';
import { faction } from '@/game/catalog';
import { leaderStrengthLabel } from '@/game/cards';
import { CHEAP_HERO_TRAITOR } from '@/game/traitors';
import { LeaderInspector, type LeaderDisplayIdentity } from './leader-inspector';
import { Button } from './ui/button';

function identity(game: GameView, id: string): LeaderDisplayIdentity | null {
  if (id === CHEAP_HERO_TRAITOR) return { name: 'Cheap Hero / Heroine', factionName: 'Any faction', strength: 0, cheapHero: true };
  const leader = game.allLeaders.find((l) => l.id === id);
  return leader ? { id: leader.id, name: leader.name, factionName: faction(leader.faction).name, strength: leaderStrengthLabel(leader) } : null;
}
function Card({ game, id }: { game: GameView; id: string }) {
  const card = identity(game, id);
  return card ? <div><span>{card.name}</span> <LeaderInspector identity={card} kind="traitor" /></div> : <p>Card identity unavailable.</p>;
}

export function RihaniHistory({ game }: { game: GameView }) {
  const history = game.rihani?.history;
  if (!history?.length) return null;
  return <details className="notice" aria-label="Your private Rihani history">
    <summary>Your private Rihani inspections</summary>
    <p className="fine">A peek records the deck at that moment. Later draws can change who holds those cards.</p>
    {[...history].reverse().map((r) => <div key={r.event} className="space-y-2 border-t py-2">
      <p>Turn {r.turn}</p>
      {r.peeked.length > 0 && <><p>Normal inspection — returned to the shuffled deck</p>{r.peeked.map((id) => <Card key={id} game={game} id={id} />)}</>}
      {r.drawn.length > 0 && <><p>Separate skilled draw</p>{r.drawn.map((id) => <Card key={id} game={game} id={id} />)}</>}
      {r.kept && <p>Kept {identity(game, r.kept)?.name}; revealed and returned {identity(game, r.given!)?.name}.</p>}
    </div>)}
  </details>;
}

export function RihaniChoice({ game, act, busy }: { game: GameView; act: (action: Action) => void; busy: boolean }) {
  const [kept, setKept] = useState(''), [given, setGiven] = useState('');
  const pending = game.rihani?.pending;
  if (!pending || pending.owner !== game.me) return null;
  const blocked = busy || !!game.truthtrance;
  if (pending.stage === 'offer') return <section className="space-y-3" aria-label="Rihani draw offer">
    <p>You may draw two Traitor Cards. Once drawn, you must keep one new card by publicly revealing and returning one unused card you already hold.</p>
    <p className="fine">The other drawn card returns secretly. Your normal inspection, when available, has already returned its cards to the shuffled deck.</p>
    <Button disabled={blocked} onClick={() => !blocked && act({ type: 'decision', event: pending.event, draw: true })}>Draw two Traitors</Button>
    <Button variant="outline" disabled={blocked} onClick={() => !blocked && act({ type: 'decision', event: pending.event, draw: false })}>Decline exchange</Button>
  </section>;
  return <section className="space-y-3" aria-label="Rihani Traitor exchange">
    <p>Keep one newly drawn card and reveal one unused card from your old hand. The revealed card and the other new card return to the shuffled deck.</p>
    <fieldset><legend>Keep one new Traitor — private</legend>
      {pending.drawn?.map((id) => <div key={id} className="space-y-2 py-2">
        <label className="flex min-h-11 items-center gap-2"><input type="radio" name="rihani-keep" value={id} checked={kept === id} disabled={blocked} onChange={() => setKept(id)} />Keep {identity(game, id)?.name}</label>
        <Card game={game} id={id} />
      </div>)}
    </fieldset>
    <fieldset><legend>Reveal and return one unused old Traitor — public</legend>
      {pending.eligible?.map((id) => <div key={id} className="space-y-2 py-2">
        <label className="flex min-h-11 items-center gap-2"><input type="radio" name="rihani-give" value={id} checked={given === id} disabled={blocked} onChange={() => setGiven(id)} />Reveal {identity(game, id)?.name}</label>
        <Card game={game} id={id} />
      </div>)}
    </fieldset>
    <Button disabled={blocked || !pending.drawn?.includes(kept) || !pending.eligible?.includes(given)} onClick={() => {
      if (!blocked && pending.drawn?.includes(kept) && pending.eligible?.includes(given)) act({ type: 'decision', event: pending.event, cards: [kept, given] });
    }}>Keep and reveal selected cards</Button>
  </section>;
}
