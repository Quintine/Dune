import type { GameView } from '@/game/engine';

/** The engine quote carries public locations only, never concealed force values. */
export function AdvancedAllySeparation({ quote, basic = false }: {
  quote: GameView['advancedAllySeparation'];
  basic?: boolean;
}) {
  if (!quote?.territories.length) return null;
  return <output id={basic ? 'basic-ally-separation' : 'advanced-ally-separation'} className="notice block">
    {basic ? <>
      Your ally’s Shipment and Movement turn is finished. Ending your turn now sends your forces in{' '}
      {quote.territories.join(', ')} to Tanks under the Basic alliance rule.
    </> : <>
      Finishing now sends your forces in{' '}
      {quote.territories.join(', ')} to Tanks under the Advanced alliance rule.
    </>}
    {quote.noField && <span className="mt-2 block">
      Provisional No-Field consequence: at this ending deadline, reveal your marker and place its forces
      using only available reserves, then send the actual revealed forces to Tanks. A zero marker creates
      no counter. Your ally’s forces stay unchanged.
    </span>}
  </output>;
}
