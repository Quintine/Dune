import {
  validateRicheseNoField,
  type NoFieldValue,
  type RicheseNoField,
} from './richese-no-field';

export type NoFieldValueFact = {
  kind: 'noFieldValue';
  value: NoFieldValue;
};

export function parseNoFieldValueFact(value: unknown): NoFieldValueFact {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new Error('Choose a current concealed No-Field printed-value fact.');
  const input = value as Record<string, unknown>;
  const keys = Object.keys(input);
  if (
    keys.length !== 2 ||
    !keys.includes('kind') ||
    !keys.includes('value') ||
    input.kind !== 'noFieldValue'
  )
    throw new Error('Choose only a current concealed No-Field printed-value fact.');
  if (input.value !== 0 && input.value !== 3 && input.value !== 5)
    throw new Error('Choose the printed No-Field value zero, three, or five.');
  return { kind: 'noFieldValue', value: input.value };
}

/** Observe current concealed custody, never shipment history or materialized forces. */
export function noFieldValueFactMatches(
  state: RicheseNoField | undefined,
  fact: NoFieldValueFact,
): boolean {
  if (state === undefined) return false;
  validateRicheseNoField(state);
  if (state.deployed === null) return false;
  const token = state.tokens.find(
    (candidate) => candidate.id === state.deployed!.tokenId,
  )!;
  return token.value === fact.value;
}

export function noFieldValueFactText(fact: NoFieldValueFact): string {
  return `you currently have a concealed No-Field with printed value ${fact.value}`;
}
