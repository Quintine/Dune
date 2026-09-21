import Link from 'next/link';

/** Counts only: this component never receives deck contents or private cards. */
export function DrawPiles({ piles }: {
  piles: { treachery: number; spice: number } | null;
}) {
  if (!piles) return null;
  return (
    <section className="draw-piles" aria-label="Draw piles">
      <dl>
        <div>
          <dt>Treachery draw pile</dt>
          <dd><strong>{piles.treachery}</strong> {piles.treachery === 1 ? 'card' : 'cards'}</dd>
        </div>
        <div>
          <dt>Spice draw pile</dt>
          <dd><strong>{piles.spice}</strong> {piles.spice === 1 ? 'card' : 'cards'}</dd>
        </div>
      </dl>
      <p>Draw piles exclude hands, auction cards and discards.
        {(piles.treachery === 0 || piles.spice === 0) && ' An empty pile may be replenished from eligible discards.'}
        {' '}<Link href="/rules?topic=draw-piles#draw-piles">About these piles</Link>
      </p>
    </section>
  );
}
