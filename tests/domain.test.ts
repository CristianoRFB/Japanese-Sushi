import { describe, expect, it } from 'vitest';

import { developmentCatalog, developmentStoreConfig } from '../lib/development-seed';
import { applyCashMovement, cashDifference, emptyCashSummary, summarizeCashMovements } from '../shared/cash';
import { calculateCartPreview, calculateDeliveryFee, calculateItemPrice, formatBRL, formatNextOpening, getDeliveryEstimate, getNextOpening, getStoreAvailability, isStoreOpen, normalizeSelections, type StorePublicConfig } from '../shared/domain';

describe('domínio Teiko e valores em centavos', () => {
  it('calcula um item simples e mantém precisão monetária', () => {
    const item = calculateItemPrice({ cartItemId: '1', productId: 'teiko-combinado-12', sizeId: '12pcs', quantity: 2, selections: [] }, developmentCatalog);
    expect(item.unitPriceCents).toBe(4290);
    expect(item.totalPriceCents).toBe(8580);
    expect(formatBRL(2350)).toContain('23,50');
  });
  it('soma carrinho e multiplica quantidades', () => expect(calculateCartPreview([{ cartItemId: 'simple', productId: 'agua-sem-gas', sizeId: 'unico', selections: [], quantity: 3 }], developmentCatalog).subtotalCents).toBe(1350));
  it('rejeita produto, tamanho e grupo inexistentes', () => {
    expect(() => calculateItemPrice({ cartItemId: 'x', productId: 'fake', sizeId: 'x', selections: [], quantity: 1 }, developmentCatalog)).toThrow(/Produto/);
    expect(() => calculateItemPrice({ cartItemId: 'x', productId: 'agua-sem-gas', sizeId: 'fake', selections: [], quantity: 1 }, developmentCatalog)).toThrow(/Tamanho/);
    expect(() => calculateItemPrice({ cartItemId: 'x', productId: 'agua-sem-gas', sizeId: 'unico', selections: [{ groupId: 'fake', items: [] }], quantity: 1 }, developmentCatalog)).toThrow(/Grupo/);
  });
  it('normaliza seleções repetidas de forma determinística', () => expect(normalizeSelections([{ groupId: 'b', items: [{ modifierId: 'x', quantity: 1 }] }, { groupId: 'b', items: [{ modifierId: 'x', quantity: 2 }] }])).toEqual([{ groupId: 'b', items: [{ modifierId: 'x', quantity: 3 }] }]));
});

describe('caixa e financeiro', () => {
  it('calcula vendas, sangria, suprimento, estorno e saldo esperado', () => {
    const summary = summarizeCashMovements(10000, [
      { type: 'SALE', amountCents: 4290, paymentMethod: 'CASH' },
      { type: 'SALE', amountCents: 3000, paymentMethod: 'PIX' },
      { type: 'WITHDRAWAL', amountCents: 500 },
      { type: 'DEPOSIT', amountCents: 1000 },
      { type: 'REFUND', amountCents: 1000, paymentMethod: 'CASH' },
    ]);
    expect(summary.salesCents).toBe(7290); expect(summary.refundsCents).toBe(1000); expect(summary.expectedCashCents).toBe(13790); expect(summary.orderCount).toBe(2);
    expect(cashDifference(summary.expectedCashCents, 13000)).toBe(-790);
  });
  it('mantém apenas operações monetárias inteiras', () => expect(() => applyCashMovement(emptyCashSummary(), { type: 'SALE', amountCents: 1.2, paymentMethod: 'PIX' })).toThrow());
});

describe('horário e delivery', () => {
  const config: Pick<StorePublicConfig, 'hours' | 'timezone'> = { timezone: 'America/Sao_Paulo', hours: [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, closed: day !== 1, windows: day === 1 ? [{ open: '12:00', close: '14:00' }] : [] })) };
  it('respeita abertura, fechamento, borda e timezone da loja', () => { expect(isStoreOpen(new Date('2026-08-31T15:00:00Z'), config)).toBe(true); expect(isStoreOpen(new Date('2026-08-31T17:00:00Z'), config)).toBe(false); expect(isStoreOpen(new Date('2026-08-30T16:00:00Z'), config)).toBe(false); });
  it('retorna disponibilidade e próxima abertura configuradas', () => { const holidayConfig = { ...developmentStoreConfig, holidayDates: ['2026-09-07'] }; expect(getNextOpening(new Date('2026-09-07T17:30:00Z'), holidayConfig)).toBeTruthy(); expect(formatNextOpening(getNextOpening(new Date('2026-09-07T17:30:00Z'), holidayConfig))).toContain('Hoje'); expect(getStoreAvailability(new Date('2026-08-31T17:00:00Z'), developmentStoreConfig).acceptingOrders).toBe(false); });
  it('calcula taxas none, confirm, fixed e zones', () => { expect(() => calculateDeliveryFee({ mode: 'NONE' }, 'DELIVERY')).toThrow(); expect(calculateDeliveryFee({ mode: 'CONFIRM' }, 'DELIVERY')).toBe(0); expect(calculateDeliveryFee({ mode: 'FIXED', fixedFeeCents: 600 }, 'DELIVERY')).toBe(600); expect(calculateDeliveryFee({ mode: 'ZONES', zones: [{ id: 'centro', name: 'Centro', feeCents: 400, active: true }] }, 'DELIVERY', 'centro')).toBe(400); });
  it('retorna estimativa contextual', () => expect(getDeliveryEstimate(new Date('2026-08-31T18:00:00Z'), developmentStoreConfig).label).toContain('30'));
});
