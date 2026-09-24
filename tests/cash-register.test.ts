import { describe, expect, it } from 'vitest';

import { cashAmountForPayment, isValidCashAmount, summarizeCashMovements, validateCashNote } from '../shared/cash-register';

describe('caixa da Teiko', () => {
  it('calcula o dinheiro esperado sem somar duas vezes o fundo de abertura', () => {
    const summary = summarizeCashMovements(10000, [
      { id: 'open', brandId: 'teiko', registerId: 'r', type: 'OPENING', direction: 'IN', amountCents: 10000, cashAmountCents: 10000, operatorUid: 'a' },
      { id: 'cash', brandId: 'teiko', registerId: 'r', type: 'SALE', direction: 'IN', amountCents: 2590, cashAmountCents: 2590, paymentMethod: 'CASH', operatorUid: 'a' },
      { id: 'pix', brandId: 'teiko', registerId: 'r', type: 'SALE', direction: 'IN', amountCents: 4000, cashAmountCents: 0, paymentMethod: 'PIX', operatorUid: 'a' },
      { id: 'supply', brandId: 'teiko', registerId: 'r', type: 'SUPPLY', direction: 'IN', amountCents: 2000, cashAmountCents: 2000, operatorUid: 'a' },
      { id: 'withdrawal', brandId: 'teiko', registerId: 'r', type: 'WITHDRAWAL', direction: 'OUT', amountCents: 1500, cashAmountCents: 1500, operatorUid: 'a' },
      { id: 'close', brandId: 'teiko', registerId: 'r', type: 'CLOSING', direction: 'OUT', amountCents: 13090, cashAmountCents: 0, operatorUid: 'a' },
    ]);
    expect(summary.expectedCashCents).toBe(13090);
    expect(summary.cashSalesCents).toBe(2590);
    expect(summary.pixSalesCents).toBe(4000);
    expect(summary.totalSalesCents).toBe(6590);
  });

  it('mantém Pix e cartão fora do dinheiro físico', () => {
    expect(cashAmountForPayment(3590, 'PIX')).toBe(0);
    expect(cashAmountForPayment(3590, 'CARD')).toBe(0);
    expect(cashAmountForPayment(3590, 'CASH')).toBe(3590);
  });

  it('rejeita saldo fracionário, negativo, gigante e observações com controles', () => {
    expect(isValidCashAmount(0, true)).toBe(true);
    expect(isValidCashAmount(-1, true)).toBe(false);
    expect(isValidCashAmount(10000001, true)).toBe(false);
    expect(isValidCashAmount(10.5)).toBe(false);
    expect(validateCashNote('  ', true)).toBe(false);
    expect(validateCashNote('ok\u0000não')).toBe(false);
    expect(validateCashNote('conferido')).toBe(true);
  });
});
