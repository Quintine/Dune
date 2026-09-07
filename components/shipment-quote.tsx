export type ShipmentQuoteProps = {
  id?: string;
  label?: string;
  physicalForces?: number;
  quote: {
    cost: number;
    normalCost: number;
    ownPayment: number;
    pledgedPayment: number;
  } | null;
  funding: {
    ownSpice: number;
    pledgedSpice: number;
  };
  unavailableReasons?: readonly string[];
};

/** Displays only caller-supplied prices and private funding already authorized for
 * this viewer. The caller validates the selection and controls action availability.
 */
export function ShipmentQuote({
  id,
  label = 'Reserve shipment',
  physicalForces,
  quote,
  funding,
  unavailableReasons = [],
}: ShipmentQuoteProps) {
  return (
    <section
      id={id}
      className="notice shipment-quote flex min-w-0 flex-col gap-3 text-sm leading-6"
      aria-label={`${label} cost and funding`}
    >
      <div>
        {label !== 'Reserve shipment' && (
          <p className="m-0 font-semibold">{label}</p>
        )}
        <p className="m-0 text-base font-semibold text-[#efd9a8]">
          {quote ? `Shipment cost: ${quote.cost} spice` : 'Shipment cost'}
        </p>
        {quote ? (
          quote.normalCost !== quote.cost && (
            <p className="m-0 text-sm leading-6">
              Normal cost: {quote.normalCost} spice. The applicable rate is
              included in your shipment cost.
            </p>
          )
        ) : (
          <p className="m-0 text-sm leading-6">
            Choose valid forces and funding to see the payment breakdown.
          </p>
        )}
      </div>
      <dl className="m-0 grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1">
        {physicalForces !== undefined && (
          <>
            <dt>Physical forces selected</dt>
            <dd className="m-0 text-right tabular-nums">{physicalForces}</dd>
          </>
        )}
        <dt>Your available spice</dt>
        <dd className="m-0 text-right tabular-nums">{funding.ownSpice}</dd>
        <dt>Available ally pledge</dt>
        <dd className="m-0 text-right tabular-nums">{funding.pledgedSpice}</dd>
        {quote && (
          <>
            <dt>Your payment</dt>
            <dd className="m-0 text-right tabular-nums">{quote.ownPayment}</dd>
            <dt>Ally pledge used</dt>
            <dd className="m-0 text-right tabular-nums">
              {quote.pledgedPayment}
            </dd>
          </>
        )}
      </dl>
      {unavailableReasons.length > 0 && (
        <div>
          <p className="m-0 font-semibold">Shipment unavailable</p>
          <ul className="m-0 list-disc space-y-1 pl-5">
            {unavailableReasons.map((reason, index) => (
              <li key={index}>{reason}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
