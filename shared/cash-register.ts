export type CashRegisterStatus = 'OPEN' | 'CLOSED';
export type CashMovementType = 'OPENING' | 'SALE' | 'WITHDRAWAL' | 'SUPPLY' | 'CLOSING';
export type CashPaymentMethod = 'PIX' | 'CARD' | 'CASH' | 'OTHER';

export interface CashRegister {
  id: string;
  brandId: string;
  status: CashRegisterStatus;
  operatorUid: string;
  operatorEmail?: string;
  openingDate: string;
  initialBalanceCents: number;
  expectedCashCents: number;
  countedCashCents?: number;
  differenceCents?: number;
  note?: string;
  closingNote?: string;
  closingRequestId?: string;
  openedAt?: unknown;
  closedAt?: unknown;
  updatedAt?: unknown;
};

export interface CashMovement {
  id: string;
  brandId: string;
  registerId: string;
  type: CashMovementType;
  direction: 'IN' | 'OUT';
  amountCents: number;
  cashAmountCents: number;
  paymentMethod?: CashPaymentMethod;
  description?: string;
  orderNumber?: string;
  operatorUid: string;
  operatorEmail?: string;
  note?: string;
  createdAt?: unknown;
};

export interface CashSummary {
  totalSalesCents: number;
  cashSalesCents: number;
  pixSalesCents: number;
  cardSalesCents: number;
  otherSalesCents: number;
  withdrawalsCents: number;
  suppliesCents: number;
  expectedCashCents: number;
};

export const MAX_CASH_AMOUNT_CENTS = 10_000_000;

export function isValidCashAmount(value: unknown, allowZero = false): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && (allowZero ? value >= 0 : value > 0) && value <= MAX_CASH_AMOUNT_CENTS;
}

export function cashAmountForPayment(amountCents: number, paymentMethod: CashPaymentMethod): number {
  return paymentMethod === 'CASH' ? amountCents : 0;
}

const sum = (values: number[]) => values.reduce((total, value) => total + (Number.isSafeInteger(value) ? value : 0), 0);

export function summarizeCashMovements(initialBalanceCents: number, movements: CashMovement[]): CashSummary {
  const sales = movements.filter((movement) => movement.type === 'SALE');
  const byMethod = (method: CashPaymentMethod) => sum(sales.filter((movement) => movement.paymentMethod === method).map((movement) => movement.amountCents));
  const cashImpact = movements.reduce((total, movement) => {
    if (movement.type === 'OPENING' || movement.type === 'CLOSING') return total;
    return total + (movement.direction === 'OUT' ? -movement.cashAmountCents : movement.cashAmountCents);
  }, initialBalanceCents);
  return {
    totalSalesCents: sum(sales.map((movement) => movement.amountCents)),
    cashSalesCents: byMethod('CASH'),
    pixSalesCents: byMethod('PIX'),
    cardSalesCents: byMethod('CARD'),
    otherSalesCents: byMethod('OTHER'),
    withdrawalsCents: sum(movements.filter((movement) => movement.type === 'WITHDRAWAL').map((movement) => movement.amountCents)),
    suppliesCents: sum(movements.filter((movement) => movement.type === 'SUPPLY').map((movement) => movement.amountCents)),
    expectedCashCents: cashImpact,
  };
}

export function cashMovementLabel(type: CashMovementType): string {
  return { OPENING: 'Abertura', SALE: 'Venda', WITHDRAWAL: 'Sangria', SUPPLY: 'Suprimento', CLOSING: 'Fechamento' }[type];
}

export function cashPaymentLabel(method?: CashPaymentMethod): string {
  return { PIX: 'Pix', CARD: 'Cartão', CASH: 'Dinheiro', OTHER: 'Outra forma' }[method ?? 'OTHER'];
}

export function validateCashNote(value: string, required = false): boolean {
  const trimmed = value.trim();
  return trimmed.length <= 200 && (!required || trimmed.length >= 3) && !/\p{Cc}/u.test(trimmed);
}

export function parseCashAmountToCents(value: string): number | null {
  const normalized = value.trim().replace(/^R\$\s*/i, '').replace(/\s/g, '');
  if (!normalized || normalized.length > 18 || /[-+eE]/u.test(normalized)) return null;
  const brazilian = /^(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{1,2})?$/u.test(normalized);
  const decimal = /^\d+(?:\.\d{1,2})?$/u.test(normalized);
  if (!brazilian && !decimal) return null;
  const amount = Number(normalized.includes(',')
    ? normalized.replace(/\./g, '').replace(',', '.')
    : normalized.replace(/\./g, ''));
  if (!Number.isFinite(amount) || amount > 100_000) return null;
  const cents = Math.round(amount * 100);
  return Number.isSafeInteger(cents) ? cents : null;
}
