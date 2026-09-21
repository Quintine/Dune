'use client';
import { Fragment, useId, useState, type ReactNode } from 'react';
import type { Card } from '@/game/cards';
import { browseHand, type HandCategory, type HandSort } from '@/game/hand-browsing';
import { Button } from './ui/button';

export function HandBrowser({ cards, empty, children }: {
  cards: readonly Card[];
  empty: ReactNode;
  children: (card: Card) => ReactNode;
}) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<HandCategory>('all');
  const [sort, setSort] = useState<HandSort>('hand');
  const gridId = useId();
  const shown = browseHand(cards, query, category, sort);
  const filtered = query !== '' || category !== 'all';
  return (
    <>
      {cards.length > 0 && (
        <search aria-label="Browse your private hand">
        <form className="hand-browse" onSubmit={event => event.preventDefault()}>
          <label>
            Search your hand
            <input type="search" placeholder="Card name" value={query} maxLength={128} autoComplete="off" spellCheck={false}
              aria-controls={gridId} onChange={event => setQuery(event.target.value)} />
          </label>
          <label>
            Printed category
            <select value={category} aria-controls={gridId} onChange={event => setCategory(event.target.value as HandCategory)}>
              <option value="all">All categories</option>
              <option value="weapon">Weapons</option>
              <option value="defense">Defenses</option>
              <option value="worthless">Worthless</option>
              <option value="hero">Cheap Hero / Heroine</option>
              <option value="special">Special</option>
            </select>
          </label>
          <label>
            Display order
            <select value={sort} aria-controls={gridId} onChange={event => setSort(event.target.value as HandSort)}>
              <option value="hand">Hand order</option>
              <option value="name">Name A–Z</option>
              <option value="category">Printed category</option>
            </select>
          </label>
          <div className="hand-browse-results">
            <output aria-live="polite">{shown.length} of {cards.length} {cards.length === 1 ? 'card' : 'cards'} shown</output>
            {filtered && <Button type="button" variant="outline" onClick={() => { setQuery(''); setCategory('all'); }}>Show all cards</Button>}
            <a href="/rules?topic=hand-browsing#hand-browsing">Hand browsing help</a>
          </div>
        </form>
        </search>
      )}
      {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- Keyboard users need access to this independently scrolling card row. */}
      <section className="hand-grid" id={gridId} aria-label="Your hand cards" tabIndex={0}>
        {cards.length === 0 ? empty : shown.length === 0
          ? <p className="hand-browse-empty">No cards match. Change the name or category, or choose Show all cards.</p>
          : shown.map(card => <Fragment key={card.id}>{children(card)}</Fragment>)}
      </section>
    </>
  );
}
