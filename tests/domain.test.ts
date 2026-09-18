import { describe, expect, it } from 'vitest';

import { developmentCatalog, developmentStoreConfig } from '../lib/development-seed';
<<<<<<< HEAD
import { calculateCartPreview, calculateDeliveryFee, calculateItemPrice, getStoreAvailability, isStoreOpen, isPromotionActive, isReservationTimeWithinHours, isValidReservationDate, normalizeSelections, validateGroupSelection, validateReservationDraft, type CatalogSnapshot, type Promotion } from '../shared/domain';

describe('motor de preço em centavos', () => {
  it('calcula item simples e quantidade sem aceitar total do cliente', () => {
    const item = calculateItemPrice({ cartItemId: 'one', productId: 'sushi-salmao', sizeId: 'unico', quantity: 2, selections: [], clientTotalCents: 1 } as never, developmentCatalog);
    expect(item.totalPriceCents).toBe(0);
    expect(calculateCartPreview([{ cartItemId: 'one', productId: 'sushi-salmao', sizeId: 'unico', quantity: 2, selections: [] }], developmentCatalog).subtotalCents).toBe(0);
  });

  it('rejeita produto, tamanho e quantidade inválidos', () => {
    expect(() => calculateItemPrice({ cartItemId: 'x', productId: 'fake', sizeId: 'unico', quantity: 1, selections: [] }, developmentCatalog)).toThrow(/Produto/);
    expect(() => calculateItemPrice({ cartItemId: 'x', productId: 'sushi-salmao', sizeId: 'fake', quantity: 1, selections: [] }, developmentCatalog)).toThrow(/Tamanho/);
    expect(() => calculateItemPrice({ cartItemId: 'x', productId: 'sushi-salmao', sizeId: 'unico', quantity: 21, selections: [] }, developmentCatalog)).toThrow(/Quantidade/);
  });

  it('mantém validação de grupos e normalização determinística', () => {
    const group = developmentCatalog.groups[0];
    const modifiers = new Map(developmentCatalog.modifiers.map((modifier) => [modifier.id, modifier]));
    expect(validateGroupSelection(group, { groupId: group.id, items: [{ modifierId: 'invalido', quantity: 1 }] }, modifiers).valid).toBe(false);
    expect(normalizeSelections([{ groupId: 'b', items: [{ modifierId: 'x', quantity: 1 }] }, { groupId: 'b', items: [{ modifierId: 'x', quantity: 2 }] }])).toEqual([{ groupId: 'b', items: [{ modifierId: 'x', quantity: 3 }] }]);
  });

  it('aplica promoção ativa somente aos produtos elegíveis', () => {
    const pricedCatalog: CatalogSnapshot = {
      ...developmentCatalog,
      products: developmentCatalog.products.map((product, index) => index === 0
        ? { ...product, sizes: product.sizes.map((size) => ({ ...size, basePriceCents: 2000 })) }
        : product),
    };
    const promotion: Promotion = {
      id: 'promocao-teste', brandId: 'teiko', name: 'Noite Teiko', active: true,
      discountType: 'PERCENTAGE', discountValue: 15, startsAt: '2026-09-01', endsAt: '2026-09-30', productIds: ['sushi-salmao'],
    };
    const preview = calculateCartPreview([{ cartItemId: 'promo', productId: 'sushi-salmao', sizeId: 'unico', quantity: 1, selections: [] }], pricedCatalog, [promotion], new Date('2026-09-15T15:00:00Z'));
    expect(isPromotionActive(promotion, new Date('2026-09-15T15:00:00Z'))).toBe(true);
    expect(preview.discountCents).toBe(300);
    expect(preview.subtotalCents).toBe(1700);
    expect(preview.items[0].promotionId).toBe('promocao-teste');
  });
});

describe('horário, unidade e delivery', () => {
  const config = { timezone: 'America/Sao_Paulo', hours: [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, closed: day !== 1, windows: day === 1 ? [{ open: '12:00', close: '14:00' }] : [] })) };
  it('respeita abertura, fechamento e timezone', () => {
    expect(isStoreOpen(new Date('2026-08-31T15:00:00Z'), config)).toBe(true);
    expect(isStoreOpen(new Date('2026-08-31T17:00:00Z'), config)).toBe(false);
  });
  it('retorna loja fechada enquanto o seed aguarda configuração oficial', () => {
    expect(getStoreAvailability(new Date('2026-08-31T17:00:00Z'), { ...developmentStoreConfig, enforceHours: true }).acceptingOrders).toBe(false);
  });
  it('calcula modalidades de delivery sem floats', () => {
    expect(() => calculateDeliveryFee({ mode: 'NONE' }, 'DELIVERY')).toThrow();
    expect(calculateDeliveryFee({ mode: 'CONFIRM' }, 'DELIVERY')).toBe(0);
    expect(calculateDeliveryFee({ mode: 'FIXED', fixedFeeCents: 600 }, 'DELIVERY')).toBe(600);
    expect(calculateDeliveryFee({ mode: 'ZONES', zones: [{ id: 'centro', name: 'Centro', feeCents: 400, active: true }] }, 'DELIVERY', 'centro')).toBe(400);
  });
});

describe('catálogo adulterado', () => {
  it('não encontra produto de outra marca quando o catálogo filtrado é usado', () => {
    const otherBrand: CatalogSnapshot = { ...developmentCatalog, products: developmentCatalog.products.map((product) => ({ ...product, brandId: 'other' })) };
    expect(() => calculateItemPrice({ cartItemId: 'x', productId: 'sushi-salmao', sizeId: 'unico', quantity: 1, selections: [] }, otherBrand)).toThrow(/Produto/);
  });
});

describe('validação de reservas 2026', () => {
  const validReservation = {
    name: 'Aline Teiko',
    whatsapp: '17999999999',
    date: '2026-12-20',
    time: '19:30',
    people: 2,
    notes: 'Mesa tranquila',
  };

  it('aceita data real de 2026 e mantém observação segura', () => {
    expect(isValidReservationDate(validReservation.date)).toBe(true);
    expect(validateReservationDraft(validReservation)).toEqual({});
  });

  it('rejeita ano fora do limite, dia impossível, nome inválido e telefone ruim', () => {
    expect(isValidReservationDate('2027-02-11')).toBe(false);
    expect(isValidReservationDate('2026-02-31')).toBe(false);
    expect(validateReservationDraft({ ...validReservation, date: '2027-02-11', name: '!!!', whatsapp: 'abc' })).toMatchObject({
      name: expect.any(String),
      whatsapp: expect.any(String),
      date: expect.any(String),
    });
  });

  it('normaliza espaços e rejeita horário, lotação e observação fora dos limites', () => {
    const errors = validateReservationDraft({
      ...validReservation,
      name: '  Aline   Teiko  ',
      time: '25:90',
      people: 31,
      notes: 'x'.repeat(501),
    });
    expect(errors.name).toBeUndefined();
    expect(errors.time).toMatch(/horário/i);
    expect(errors.people).toMatch(/1 e 30/i);
    expect(errors.notes).toMatch(/500/);
  });

  it('aceita somente horário dentro da agenda da unidade', () => {
    expect(isReservationTimeWithinHours('2026-12-21', '19:30', developmentStoreConfig)).toBe(true);
    expect(isReservationTimeWithinHours('2026-12-21', '23:00', developmentStoreConfig)).toBe(false);
    expect(isReservationTimeWithinHours('2026-12-20', '19:30', developmentStoreConfig)).toBe(false);
  });
=======
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
>>>>>>> origin/main
});
