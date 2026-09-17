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

export function parseBRLToCents(value: string): number {
  const normalized = value.trim().replace(/R\$\s?/gi, '');
  const numeric = normalized.includes(',')
    ? normalized.replace(/\./g, '').replace(',', '.')
    : normalized.replace(/[^0-9.-]/g, '');
  const amount = Number(numeric);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  const cents = Math.round(amount * 100);
  return Number.isSafeInteger(cents) ? cents : 0;
}

export function formatDateKey(value: string): string {
  const [year, month, day] = value.split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
}
