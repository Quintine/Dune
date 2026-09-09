'use client';
import Link from 'next/link';
import { StrongholdCardGallery } from './stronghold-cards';
import { HomeworldCardGallery } from './homeworld-cards';
import { NexusCardGallery } from './nexus-cards';
import { createStrongholdCards } from '@/game/stronghold-cards';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState, useEffect, useRef } from 'react';
import { Search, ArrowUpRight, BookOpen } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { RULE_TOPICS } from '@/game/reference';
import { BattleWheel } from './battle-wheel';
import { RICHESE_CARD_DEFINITIONS } from '@/game/richese-cards';
import { CardInspector, CardRules } from './card-inspector';

export function RulesReference() {
  return (
    <Suspense
      fallback={<p className="reference-page">Loading the rules reference…</p>}
    >
      <RulesReferenceContent />
    </Suspense>
  );
}

function RulesReferenceContent() {
  const searchParams = useSearchParams();
  const topicQuery = searchParams.get('topic');
  const [query, setQuery] = useState('');
  const [practiceDial, setPracticeDial] = useState(3);
  const [category, setCategory] = useState('All topics');
  const [opened, setOpened] = useState<Record<string, boolean>>({});
  const pendingScroll = useRef<string | null>(null);
  useEffect(() => {
    const reveal = () => {
      const id = topicQuery || window.location.hash.slice(1);
      if (!RULE_TOPICS.some((t) => t.id === id)) return;
      pendingScroll.current = id;
      setQuery('');
      setCategory('All topics');
      setOpened((previous) => ({ ...previous, [id]: true }));
    };
    reveal();
    window.addEventListener('hashchange', reveal);
    return () => window.removeEventListener('hashchange', reveal);
  }, [topicQuery]);
  // Scroll only after React has rendered the destination with cleared filters.
  useEffect(() => {
    const id = pendingScroll.current;
    if (!id) return;
    const article = document.getElementById(id);
    if (!article) return;
    pendingScroll.current = null;
    article.scrollIntoView({ block: 'start' });
  });
  const openTopic = (id: string) => {
    pendingScroll.current = id;
    setQuery('');
    setCategory('All topics');
    setOpened((previous) => ({ ...previous, [id]: true }));
  };
  const categories = [
    'All topics',
    ...new Set(RULE_TOPICS.map((t) => t.category)),
  ];
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const topics = RULE_TOPICS.filter(
    (t) =>
      (category === 'All topics' || t.category === category) &&
      terms.every((term) =>
        [
          t.title,
          t.summary,
          t.searchText ?? '',
          ...t.steps,
          t.example ?? '',
          ...(t.checklist ?? []).flatMap((item) => [
            item.area,
            item.status,
            item.detail,
            ...(item.evidence ?? []),
          ]),
        ]
          .join(' ')
          .toLowerCase()
          .includes(term),
      ),
  );
  return (
    <main className="reference-page">
      <header className="reference-header">
        <Link href="/">← Return to Arrakis</Link>
        <span className="eyebrow">
          <BookOpen size={14} /> THE MENTAT’S REFERENCE
        </span>
        <h1>
          Know the rules.
          <br />
          <em>Choose your moment.</em>
        </h1>
        <p>
          Find a phase, card or faction. Follow the action guides, inspect
          examples and move directly between related rules.
        </p>
        <p className="reference-status">
          This reference is growing with the game. Advanced play and expansion
          rules are unfinished.{' '}
          <Link href="/rules/coverage">
            View the implementation ledger <ArrowUpRight size={13} />
          </Link>
          {' · '}
          <Link href="/rules?topic=implementation-checklist#implementation-checklist">
            Open feature checklists <ArrowUpRight size={13} />
          </Link>
        </p>
      </header>
      <div className="reference-layout">
        <aside className="reference-nav">
          <label htmlFor="rules-search">
            <Search size={16} /> Search the reference
          </label>
          <Input
            id="rules-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Storm, Karama, allies…"
          />
          <nav aria-label="Rule categories">
            {categories.map((c) => (
              <button
                key={c}
                aria-pressed={category === c}
                onClick={() => setCategory(c)}
              >
                {c}
                <span>
                  {c === 'All topics'
                    ? RULE_TOPICS.length
                    : RULE_TOPICS.filter((t) => t.category === c).length}
                </span>
              </button>
            ))}
          </nav>
        </aside>
        <section className="reference-results" aria-label="Rule topics">
          <output className="fine">
            {topics.length} {topics.length === 1 ? 'topic' : 'topics'}
            {query ? ` matching “${query}”` : ''}
          </output>
          {topics.length === 0 && (
            <p>No matching topics. Try a card name or choose All topics.</p>
          )}
          {topics.map((topic) => (
            <article id={topic.id} key={topic.id} className="rule-topic">
              <details
                open={terms.length > 0 || !!opened[topic.id]}
                onToggle={(event) => {
                  if (terms.length) return;
                  const isOpen = event.currentTarget.open;
                  setOpened((previous) =>
                    previous[topic.id] === isOpen
                      ? previous
                      : { ...previous, [topic.id]: isOpen },
                  );
                }}
              >
                <summary>
                  <span className="eyebrow">{topic.category}</span>
                  <h2>{topic.title}</h2>
                  <span
                    className={`coverage-label coverage-${topic.coverage.toLowerCase()}`}
                  >
                    {topic.coverage}
                  </span>
                  <p>{topic.summary}</p>
                </summary>
                <div className="rule-topic-content">
                  <ol>
                    {topic.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                  {topic.id === 'stronghold-cards' && (
                    <StrongholdCardGallery
                      state={createStrongholdCards()}
                      players={[]}
                    />
                  )}
                  {topic.id === 'homeworlds' && <HomeworldCardGallery />}
                  {topic.id === 'nexus-cards' && <NexusCardGallery />}
                  {topic.id === 'richese-cards' && (
                    <section
                      aria-label="Richese card collection"
                      className="grid gap-4 sm:grid-cols-2"
                    >
                      {RICHESE_CARD_DEFINITIONS.map(({ card, printedType }) => (
                        <article
                          key={card.id}
                          className="flex min-w-0 flex-col gap-3 rounded-lg border border-[#454b3c] bg-[#1d221b] p-4"
                        >
                          <h3 className="m-0 break-words font-serif text-xl text-[#efd9a8]">
                            {card.name}
                          </h3>
                          <p className="m-0 text-xs text-[#c1c5b8]">
                            {printedType} · 1 card
                          </p>
                          <CardRules card={card} />
                          <CardInspector card={card} />
                        </article>
                      ))}
                    </section>
                  )}
                  {topic.checklist && (
                    <section
                      aria-label={`${topic.title} implementation checklist`}
                    >
                      <h3>Feature checklist</h3>
                      <div className="max-w-full overflow-x-auto">
                        <table className="w-full text-left text-sm leading-6">
                          <caption className="sr-only">
                            {topic.title}: implementation, controls, AI,
                            documentation and verification
                          </caption>
                          <thead>
                            <tr>
                              <th scope="col" className="p-2">
                                Area
                              </th>
                              <th scope="col" className="p-2">
                                Status
                              </th>
                              <th scope="col" className="p-2">
                                Scope and evidence
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {topic.checklist.map((item) => (
                              <tr key={item.area}>
                                <th scope="row" className="p-2 align-top">
                                  {item.area}
                                </th>
                                <td className="p-2 align-top">{item.status}</td>
                                <td className="p-2 align-top">
                                  <p className="m-0">{item.detail}</p>
                                  {item.evidence && (
                                    <ul className="mt-2 list-disc pl-4">
                                      {item.evidence.map((file) => (
                                        <li key={file}>
                                          <code className="break-all text-xs">
                                            {file}
                                          </code>
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  )}
                  {topic.id === 'battle' && (
                    <aside className="rule-example">
                      <strong>Try a basic battle wheel</strong>
                      <p>
                        Practice with ten ordinary forces and a strength-five
                        leader. Use the slider, arrow keys or number field. In a
                        game, your choice stays private until the plans are
                        revealed.
                      </p>
                      <div style={{ maxWidth: 280 }}>
                        <label htmlFor="practice-battle-dial">
                          Practice dial
                        </label>
                        <BattleWheel
                          id="practice-battle-dial"
                          value={practiceDial}
                          onChange={(value) =>
                            setPracticeDial(
                              Math.min(10, Math.max(0, Math.round(value))),
                            )
                          }
                          max={10}
                          step={1}
                        />
                      </div>
                      <p aria-live="polite">
                        If the leader survives, your total is {practiceDial} + 5
                        = {practiceDial + 5}. In a normal victory you lose the{' '}
                        {practiceDial} dialed forces; in a defeat you lose all
                        ten. Weapon, traitor and faction effects can change the
                        result.
                      </p>
                      <p className="fine">
                        This practice wheel does not change a live game.
                      </p>
                    </aside>
                  )}
                  {topic.example && (
                    <aside className="rule-example">
                      <strong>Example</strong>
                      <p>{topic.example}</p>
                    </aside>
                  )}
                  {topic.related && (
                    <nav
                      aria-label={`Related to ${topic.title}`}
                      className="related-rules"
                    >
                      {topic.related.map((id) => (
                        <a
                          href={`/rules?topic=${id}#${id}`}
                          key={id}
                          onClick={() => {
                            openTopic(id);
                          }}
                        >
                          {RULE_TOPICS.find((t) => t.id === id)?.title ?? id}{' '}
                          <ArrowUpRight size={13} />
                        </a>
                      ))}
                    </nav>
                  )}
                  <a
                    className="rule-permalink"
                    href={`/rules?topic=${topic.id}#${topic.id}`}
                    onClick={() => openTopic(topic.id)}
                  >
                    Link to this topic
                  </a>
                </div>
              </details>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
