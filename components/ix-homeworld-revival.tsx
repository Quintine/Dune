import { quoteIxSuboidBonus } from '@/game/ix-homeworld-revival';

/** The ordinary revival controls own selection and payment. This persistent
 * quote explains the automatic physical grant without adding another choice. */
export function IxHomeworldRevivalBonus(props: {
  enabled: boolean;
  blocked?: boolean;
  amount: number;
  elite: number;
  free: number;
  freeElite: number;
  normalTanks: number;
}) {
  if (!props.enabled) return null;
  if (props.blocked) return <p className="notice" aria-live="polite">
    La La La prevents the free Ix HIGH Suboid bonus on new requests this phase.
    {' '}Paid Cyborg revival remains available.
  </p>;
  let bonus: number;
  try { bonus = quoteIxSuboidBonus(props); }
  catch {
    return <p className="fine" aria-live="polite">
      Ix HIGH adds up to two physical Suboids from Tanks per paid Cyborg.
      Select an available revival group to see its bonus.
    </p>;
  }
  return <p className="notice" aria-live="polite">
    Ix HIGH: this selection also returns {bonus} Suboid{bonus === 1 ? '' : 's'} for free.
    {' '}These additional physical forces do not use normal revival allowance
    or its free quota. Available Suboids in Tanks limit the bonus.
  </p>;
}
