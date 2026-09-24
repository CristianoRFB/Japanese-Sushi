export type FinanceEntryKind = 'INCOME' | 'EXPENSE';
export type FinanceEntryStatus = 'PAID' | 'PENDING';

export interface FinanceEntry {
  id: string;
  brandId: string;
  kind: FinanceEntryKind;
  category: string;
  description: string;
  amountCents: number;
  date: string;
  status: FinanceEntryStatus;
  orderNumber?: string;
  notes?: string;
  sourceOrderId?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export const FINANCE_CATEGORIES = [
  'Vendas de sushi',
  'Delivery',
  'Insumos frescos',
  'Embalagens',
  'Taxas',
  'Pró-labore',
  'Outros',
] as const;

export function parseOptionalBRLToCents(value: string, maxCents = Number.MAX_SAFE_INTEGER): number | null {
  const normalized = value.trim().replace(/^R\$\s*/i, '').replace(/\s/g, '');
  if (!normalized || normalized.length > 18 || /[-+eE]/u.test(normalized)) return null;
  const brazilian = /^(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{1,2})?$/u.test(normalized);
  const decimal = /^\d+(?:\.\d{1,2})?$/u.test(normalized);
  if (!brazilian && !decimal) return null;
  const amount = Number(normalized.includes(',')
    ? normalized.replace(/\./g, '').replace(',', '.')
    : normalized.replace(/\./g, ''));
  if (!Number.isFinite(amount) || amount < 0 || amount > maxCents / 100) return null;
  const cents = Math.round(amount * 100);
  return Number.isSafeInteger(cents) ? cents : null;
}

export function parseBRLToCents(value: string): number {
  const cents = parseOptionalBRLToCents(value);
  return cents && cents > 0 ? cents : 0;
}

export function formatDateKey(value: string): string {
  const [year, month, day] = value.split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
}
