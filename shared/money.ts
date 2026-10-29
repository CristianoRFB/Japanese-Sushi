// Strict decimal parsing: never use floating-point multiplication for prices.
export function brlToCents(input: string): number | null {
  const value = input.trim().replace(',', '.');
  if (!/^\d{1,6}(?:\.\d{1,2})?$/.test(value)) return null;
  const [whole, decimal = ''] = value.split('.');
  const cents = Number(whole) * 100 + Number(decimal.padEnd(2, '0'));
  return Number.isSafeInteger(cents) && cents >= 1 && cents <= 10_000_000 ? cents : null;
}
