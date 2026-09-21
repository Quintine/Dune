// A blank edit is not a zero. Keep input text separate from submitted numbers.
export function integerInputValue(text: string): number {
  if (text.trim() === '') return Number.NaN;
  const value = Number(text);
  return Number.isSafeInteger(value) ? value : Number.NaN;
}
