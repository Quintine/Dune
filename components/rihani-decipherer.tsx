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
function Card({ game, id, faceDancer = false }: { game: GameView; id: string; faceDancer?: boolean }) {
  const card = identity(game, id);
  return card ? <div><span>{card.name}</span> <LeaderInspector identity={card} kind={faceDancer ? "faceDancer" : "traitor"} /></div> : <p>Card identity unavailable.</p>;
}

export function RihaniHistory({ game }: { game: GameView }) {
  const history = game.rihani?.history;
  const faceDancer = game.players.find(p => p.id === game.me)?.faction === 'tleilaxu';
  if (!history?.length) return null;
  return <details className="notice" aria-label="Your private Rihani history">
    <summary>Your private Rihani inspections</summary>
    <p className="fine">A peek records the deck at that moment. Later draws can change who holds those cards.</p>
    {[...history].reverse().map((r) => <div key={r.event} className="space-y-2 border-t py-2">
      <p>Turn {r.turn}</p>
      {r.peeked.length > 0 && <><p>Normal inspection — returned to the shuffled deck</p>{r.peeked.map((id) => <Card key={id} game={game} id={id} />)}</>}
      {r.drawn.length > 0 && <><p>Separate skilled draw</p>{r.drawn.map((id) => <Card key={id} game={game} id={id} faceDancer={faceDancer} />)}</>}
      {r.kept && <p>Kept {identity(game, r.kept)?.name}; revealed and returned {identity(game, r.given!)?.name}.</p>}
    </div>)}
  </details>;
}

export function RihaniChoice({ game, act, busy }: { game: GameView; act: (action: Action) => void; busy: boolean }) {
  const [kept, setKept] = useState(''), [given, setGiven] = useState('');
  const pending = game.rihani?.pending;
  if (!pending || pending.owner !== game.me) return null;
  const blocked = busy || !!game.truthtrance;
  const faceDancer = game.players.find(p => p.id === game.me)?.faction === 'tleilaxu';
  const cardName = faceDancer ? 'Face Dancer' : 'Traitor';
  const oldCard = faceDancer ? 'unrevealed' : 'unused';
  if (pending.stage === 'offer') return <section className="space-y-3" aria-label="Rihani draw offer">
    <p>You may draw two {cardName} Cards. Once drawn, you must keep one new card by publicly revealing and returning one {oldCard} card you already hold.</p>
    <p className="fine">The other drawn card returns secretly. Your normal inspection, when available, has already returned its cards to the shuffled deck.</p>
    <Button disabled={blocked} onClick={() => !blocked && act({ type: 'decision', event: pending.event, draw: true })}>Draw two {cardName}s</Button>
    <Button variant="outline" disabled={blocked} onClick={() => !blocked && act({ type: 'decision', event: pending.event, draw: false })}>Decline exchange</Button>
  </section>;
  return <section className="space-y-3" aria-label={`Rihani ${cardName} exchange`}>
    <p>Keep one newly drawn card and reveal one {oldCard} card from your old hand. The revealed card and the other new card return to the shuffled deck.</p>
    <fieldset><legend>Keep one new {cardName} — private</legend>
      {pending.drawn?.map((id) => <div key={id} className="space-y-2 py-2">
        <label className="flex min-h-11 items-center gap-2"><input type="radio" name="rihani-keep" value={id} checked={kept === id} disabled={blocked} onChange={() => setKept(id)} />Keep {identity(game, id)?.name}</label>
        <Card game={game} id={id} faceDancer={faceDancer} />
      </div>)}
    </fieldset>
    <fieldset><legend>Reveal and return one {oldCard} old {cardName} — public</legend>
      {pending.eligible?.map((id) => <div key={id} className="space-y-2 py-2">
        <label className="flex min-h-11 items-center gap-2"><input type="radio" name="rihani-give" value={id} checked={given === id} disabled={blocked} onChange={() => setGiven(id)} />Reveal {identity(game, id)?.name}</label>
        <Card game={game} id={id} faceDancer={faceDancer} />
      </div>)}
    </fieldset>
    <Button disabled={blocked || !pending.drawn?.includes(kept) || !pending.eligible?.includes(given)} onClick={() => {
      if (!blocked && pending.drawn?.includes(kept) && pending.eligible?.includes(given)) act({ type: 'decision', event: pending.event, cards: [kept, given] });
    }}>Keep and reveal selected cards</Button>
  </section>;
}
