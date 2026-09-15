import { describe, expect, it } from 'vitest';

import { developmentCatalog, developmentStoreConfig } from '../lib/development-seed';
import { calculateCartPreview, calculateDeliveryFee, calculateItemPrice, getStoreAvailability, isStoreOpen, isPromotionActive, isValidReservationDate, normalizeSelections, validateGroupSelection, validateReservationDraft, type CatalogSnapshot, type Promotion } from '../shared/domain';

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
});
