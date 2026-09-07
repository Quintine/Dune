'use client';

import type { Action, GameView } from '@/game/engine';
import { Button } from '@/components/ui/button';
import { CardInspector, CardRules } from './card-inspector';

export function AuditorDecision({
  game,
  act,
  busy,
}: {
  game: GameView;
  act: (action: Action) => void;
  busy: boolean;
}) {
  const audit = game.auditor;
  if (!audit) return null;
  const payment = game.decision?.kind === 'choamAuditPayment';
  const opponent = game.players.find((p) => p.id === audit.opponent);
  return (
    <section className="min-w-0 space-y-3" aria-label="Auditor decision">
      <h3 className="font-serif text-xl">
        {payment ? 'Keep your hand private' : 'Use the Auditor'}
      </h3>
      <p className="text-base leading-7">
        {payment
          ? `Pay ${audit.count} spice to CHOAM to cancel the entire inspection, or allow it without payment.`
          : `Your Auditor ${audit.survived ? 'survived' : 'died'}. You may inspect ${audit.count} random card${audit.count === 1 ? '' : 's'} from ${opponent?.name ?? 'your opponent'}’s hand. Cards used in this battle are excluded.`}
      </p>
      {!payment && (
        <p className="text-base leading-7">
          Karama can prevent the audit. Your opponent can also cancel by paying
          one spice per card you would inspect.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={busy}
          onClick={() =>
            act(
              payment
                ? {
                    type: 'decision',
                    event: audit.event,
                    pay: true,
                    count: audit.count,
                  }
                : { type: 'decision', event: audit.event, audit: true },
            )
          }
        >
          {payment
            ? `Pay ${audit.count} spice · cancel audit`
            : 'Audit opposing hand'}
        </Button>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() =>
            act(
              payment
                ? { type: 'decision', event: audit.event, pay: false }
                : { type: 'decision', event: audit.event, audit: false },
            )
          }
        >
          {payment ? 'Allow inspection' : 'Decline audit'}
        </Button>
      </div>
    </section>
  );
}

export function AuditorInsight({ game }: { game: GameView }) {
  const insight = game.auditorInsight;
  if (!insight) return null;
  const opponent = game.players.find((p) => p.id === insight.target);
  return (
    <section
      className="notice min-w-0 space-y-3"
      aria-label="Your private Auditor inspection"
    >
      <h3 className="font-serif text-xl">
        Your Auditor inspection · {opponent?.name}
      </h3>
      <p className="text-base leading-7">
        Only you receive this inspection. These cards were in the opposing hand
        when the audit resolved; they may move afterward. The inspection stays
        here until the next battle or turn.
      </p>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        {insight.cards.map((card) => (
          <article
            key={card.id}
            className="min-w-0 space-y-3 rounded-lg border border-[#485542] p-4"
          >
            <h4 className="font-serif text-xl">{card.name}</h4>
            <CardRules card={card} />
            <CardInspector card={card} />
          </article>
        ))}
      </div>
    </section>
  );
}
