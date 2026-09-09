import type { GameView } from '@/game/engine';
import { PHASES } from '@/game/catalog';

export function EcazPoisonIncome({ game: g }: { game: GameView }) {
  if (
    g.players.find((player) => player.id === g.me)?.faction !== 'ecaz' ||
    !g.ecazPoisonIncome?.length
  )
    return null;
  return (
    <section
      aria-label="Your Ecaz poison income"
      className="rounded-lg border border-[#a88b60]/50 p-3"
    >
      <h4>Your Ecaz poison income</h4>
      <p className="fine">
        Private record of spice you received when poison weapons were discarded.
      </p>
      <ul className="fine">
        {g.ecazPoisonIncome
          .slice(-6)
          .reverse()
          .map((income, index) => (
            <li key={`${income.turn}-${income.phase}-${index}`}>
              Turn {income.turn} · {PHASES[income.phase]}: +{income.amount}{' '}
              spice from {income.count} discarded poison{' '}
              {income.count === 1 ? 'weapon' : 'weapons'}.
            </li>
          ))}
      </ul>
    </section>
  );
}
