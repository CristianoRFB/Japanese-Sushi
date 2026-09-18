export type CashMovementType = 'OPENING' | 'SALE' | 'WITHDRAWAL' | 'DEPOSIT' | 'REFUND' | 'CLOSING';
export type CashPaymentMethod = 'PIX' | 'CARD' | 'CASH' | 'OTHER';

export interface CashMovementInput {
  type: CashMovementType;
  amountCents: number;
  paymentMethod?: CashPaymentMethod;
}

export interface CashSummary {
  openingBalanceCents: number;
  salesCents: number;
  refundsCents: number;
  withdrawalsCents: number;
  depositsCents: number;
  cashSalesCents: number;
  pixSalesCents: number;
  cardSalesCents: number;
  otherSalesCents: number;
  orderCount: number;
  expectedCashCents: number;
}

export const emptyCashSummary = (openingBalanceCents = 0): CashSummary => ({
  openingBalanceCents,
  salesCents: 0,
  refundsCents: 0,
  withdrawalsCents: 0,
  depositsCents: 0,
  cashSalesCents: 0,
  pixSalesCents: 0,
  cardSalesCents: 0,
  otherSalesCents: 0,
  orderCount: 0,
  expectedCashCents: openingBalanceCents,
});

export function applyCashMovement(summary: CashSummary, movement: CashMovementInput): CashSummary {
  if (!Number.isSafeInteger(movement.amountCents) || movement.amountCents < 0) throw new Error('Valor monetário inválido.');
  const next = { ...summary };
  if (movement.type === 'SALE') {
    next.salesCents += movement.amountCents;
    next.orderCount += 1;
    if (movement.paymentMethod === 'CASH') { next.cashSalesCents += movement.amountCents; next.expectedCashCents += movement.amountCents; }
    else if (movement.paymentMethod === 'PIX') next.pixSalesCents += movement.amountCents;
    else if (movement.paymentMethod === 'CARD') next.cardSalesCents += movement.amountCents;
    else next.otherSalesCents += movement.amountCents;
  } else if (movement.type === 'REFUND') {
    next.refundsCents += movement.amountCents;
    if (movement.paymentMethod === 'CASH') next.expectedCashCents -= movement.amountCents;
  } else if (movement.type === 'WITHDRAWAL') {
    next.withdrawalsCents += movement.amountCents;
    next.expectedCashCents -= movement.amountCents;
  } else if (movement.type === 'DEPOSIT') {
    next.depositsCents += movement.amountCents;
    next.expectedCashCents += movement.amountCents;
  }
  return next;
}

export function summarizeCashMovements(openingBalanceCents: number, movements: CashMovementInput[]): CashSummary {
  if (!Number.isSafeInteger(openingBalanceCents) || openingBalanceCents < 0) throw new Error('Saldo inicial inválido.');
  return movements.reduce(applyCashMovement, emptyCashSummary(openingBalanceCents));
}

export function cashDifference(expectedCashCents: number, countedCashCents: number): number {
  if (!Number.isSafeInteger(countedCashCents) || countedCashCents < 0) throw new Error('Valor contado inválido.');
  return countedCashCents - expectedCashCents;
}
