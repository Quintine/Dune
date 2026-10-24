export type AmbassadorRevivalSource = {
  event: string;
  owner: string;
  entrant: string;
  token: string;
  territory: string;
  sector: number;
  turn: number;
  phase: number;
  beneficiary: string;
  incomeOwner: string;
};
export type AmbassadorRevivalReturn =
  | { kind: 'forces'; amount: number; elite: number }
  | { kind: 'leader'; leader: string; deaths: number }
  | { kind: 'kwisatz'; cycle: number };
export type AmbassadorRevivalReceipt = {
  version: 1;
  source: AmbassadorRevivalSource;
  returned: AmbassadorRevivalReturn;
  amount: 1;
  signature: string;
};
export class AmbassadorRevivalIncomeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AmbassadorRevivalIncomeError';
  }
}
function requireIncome(value: unknown, message: string): asserts value {
  if (!value) throw new AmbassadorRevivalIncomeError(message);
}
const text = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;
const count = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const exact = (value: unknown, keys: string): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value) &&
  [Object.prototype, null].includes(Object.getPrototypeOf(value)) &&
  Object.keys(value).sort().join(',') === keys;
function validSource(source: unknown): source is AmbassadorRevivalSource {
  return exact(source, 'beneficiary,entrant,event,incomeOwner,owner,phase,sector,territory,token,turn') &&
    text(source.event) && text(source.owner) && text(source.entrant) && text(source.token) &&
    text(source.territory) && text(source.beneficiary) && text(source.incomeOwner) &&
    count(source.sector) && source.sector >= 1 && source.sector <= 18 &&
    count(source.turn) && source.turn >= 1 && count(source.phase);
}
function validReturn(returned: unknown): returned is AmbassadorRevivalReturn {
  if (exact(returned, 'amount,elite,kind') && returned.kind === 'forces')
    return count(returned.amount) && returned.amount >= 1 && returned.amount <= 4 &&
      count(returned.elite) && returned.elite <= returned.amount;
  if (exact(returned, 'deaths,kind,leader') && returned.kind === 'leader')
    return text(returned.leader) && count(returned.deaths) && returned.deaths >= 1;
  return exact(returned, 'cycle,kind') && returned.kind === 'kwisatz' &&
    count(returned.cycle) && returned.cycle >= 1;
}
const sourceValues = (source: AmbassadorRevivalSource) => [
  source.event, source.owner, source.entrant, source.token, source.territory,
  source.sector, source.turn, source.phase, source.beneficiary, source.incomeOwner,
];
function signature(receipt: AmbassadorRevivalReceipt): string {
  const returned = receipt.returned;
  return JSON.stringify([
    'ambassadorRevivalReceipt', receipt.version, sourceValues(receipt.source),
    returned.kind === 'forces' ? ['forces', returned.amount, returned.elite] :
      returned.kind === 'leader' ? ['leader', returned.leader, returned.deaths] : ['kwisatz', returned.cycle],
    receipt.amount,
  ]);
}

/** Bind an already-committed positive return, not permission to revive or pay.
 * The native parent validates actual pieces/custody and owns the existing free
 * income ledger. Canceling the queued income cannot undo this return. */
export function createAmbassadorRevivalReceipt(
  source: AmbassadorRevivalSource,
  returned: AmbassadorRevivalReturn,
): AmbassadorRevivalReceipt {
  requireIncome(validSource(source), 'Ambassador revival income needs its exact original source.');
  requireIncome(validReturn(returned), 'Ambassador revival income needs one positive physical return.');
  const receipt: AmbassadorRevivalReceipt = {
    version: 1, source: { ...source }, returned: { ...returned }, amount: 1, signature: '',
  };
  receipt.signature = signature(receipt);
  return receipt;
}
export function validateAmbassadorRevivalReceipt(
  source: AmbassadorRevivalSource,
  receipt: AmbassadorRevivalReceipt,
): void {
  requireIncome(validSource(source), 'Ambassador revival income needs its exact original source.');
  requireIncome(
    exact(receipt, 'amount,returned,signature,source,version') && receipt.version === 1 && receipt.amount === 1,
    'The Ambassador revival income receipt has changed its fixed reward or shape.',
  );
  requireIncome(
    validSource(receipt.source) && JSON.stringify(sourceValues(source)) === JSON.stringify(sourceValues(receipt.source)),
    'The Ambassador revival income receipt no longer matches its original source.',
  );
  requireIncome(validReturn(receipt.returned), 'Ambassador revival income needs one positive physical return.');
  requireIncome(receipt.signature === signature(receipt), 'The Ambassador revival income receipt has changed its committed return.');
}
