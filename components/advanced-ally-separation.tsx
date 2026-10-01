import type { GameView } from '@/game/engine';

/** The engine quote carries public locations only, never concealed force values. */
export function AdvancedAllySeparation({ quote }: {
  quote: GameView['advancedAllySeparation'];
}) {
  if (!quote?.territories.length) return null;
  return <output id="advanced-ally-separation" className="notice block">
    Finishing now sends your forces in{' '}
    {quote.territories.join(', ')} to Tanks under the Advanced alliance rule.
  </output>;
}
