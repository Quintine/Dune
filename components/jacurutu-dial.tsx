'use client';

import {
  JACURUTU_BATTLE_INCOME_RULE,
  type JacurutuDialChoice,
  type JacurutuDialOffer,
} from '@/game/discovery-battle';
import { Button } from './ui/button';

/** Concrete physical reading of one legal allocation of the revealed dial. */
export function jacurutuDialChoiceLabel(choice: JacurutuDialChoice): string {
  const { normal, elite, paidNormal, paidElite } = choice.dialed;
  const counters = [
    `${normal} ordinary counter${normal === 1 ? '' : 's'} (${paidNormal} paid)`,
    `${elite} elite counter${elite === 1 ? '' : 's'} (${paidElite} paid)`,
  ].join(' · ');
  return `${counters} — ${
    choice.amount === 0
      ? 'no spice from the bank'
      : `${choice.amount} spice from the bank`
  }`;
}

/**
 * The defeated player's own allocation of their revealed dial. Only the legal
 * physical readings reported for this battle are offered; the numeric wheel
 * value alone never decides the counters.
 */
export function JacurutuDial({
  offer,
  onChoose,
  busy,
}: {
  offer: JacurutuDialOffer;
  onChoose: (allocation: number) => void;
  busy: boolean;
}) {
  if (!offer.choices.length) return null;
  return (
    <section
      className="flex flex-col gap-3"
      aria-label="Jacurutu Sietch dial allocation"
    >
      <p>
        You lost this battle in Jacurutu Sietch. Choose which counters your
        revealed dial actually committed; the winner collects one bank spice
        for each opposing undialed force sent to the Tanks.
      </p>
      <p className="fine">{JACURUTU_BATTLE_INCOME_RULE}</p>
      <p className="fine">Prototype interpretation: the defeated player identifies the physical dial allocation before battle settlement.</p>
      <div className="flex flex-wrap gap-2">
        {offer.choices.map((choice, allocation) => (
          <Button
            key={`${choice.dialed.normal}:${choice.dialed.elite}:${choice.dialed.paidNormal}:${choice.dialed.paidElite}`}
            className="game-action min-h-11 whitespace-normal"
            variant={choice.amount === 0 ? 'outline' : 'default'}
            disabled={busy}
            onClick={() => !busy && onChoose(allocation)}
          >
            {jacurutuDialChoiceLabel(choice)}
          </Button>
        ))}
      </div>
    </section>
  );
}
