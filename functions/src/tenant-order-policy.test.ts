import { describe, expect, it } from 'vitest';
import { priceTenantPickup, tenantPickupSchema } from './tenant-order-policy.js';

const product = (tenantId = 'tenant-a', price = 1800) => ({
  tenantId, active: true, productType: 'SIMPLE', name: 'Produto de teste',
  modifierGroupIds: [], sizes: [{ id: 'unico', active: true, basePriceCents: price }],
});

describe('tenant pickup policy', () => {
  it('recalcula preço exclusivamente pelo catálogo do tenant', () => {
    const result = priceTenantPickup('tenant-a', [{ productId: 'sushi', quantity: 2 }],
      new Map([['sushi', product()]]));
    expect(result.totalCents).toBe(3600);
    expect(result.items[0].unitPriceCents).toBe(1800);
  });
  it('rejeita produto entre tenants, preço inválido, grupo de modificadores e valor excessivo', () => {
    for (const data of [
      product('tenant-b'),
      product('tenant-a', -100),
      product('tenant-a', 0),
      { ...product(), modifierGroupIds: ['adicionais'] },
      { ...product(), active: false },
      { ...product(), sizes: [{ id: 'unico', active: false, basePriceCents: 1800 }] },
    ]) {
      expect(() => priceTenantPickup('tenant-a', [{ productId: 'sushi', quantity: 1 }],
        new Map([['sushi', data]]))).toThrow();
    }
    expect(() => priceTenantPickup('tenant-a', [{ productId: 'sushi', quantity: 20 }],
      new Map([['sushi', product('tenant-a', 9000000)]]))).toThrow();
  });
  it('recusa campos ocultos, itens vazios e identificadores perigosos', () => {
    const draft = { tenantId: 'tenant-a', clientRequestId: crypto.randomUUID(),
      customerName: 'Cliente de teste', clientPreviewTotalCents: 1800,
      items: [{ productId: 'sushi', quantity: 1 }] };
    expect(tenantPickupSchema.safeParse(draft).success).toBe(true);
    expect(tenantPickupSchema.safeParse({ ...draft, totalCents: 1 }).success).toBe(false);
    expect(tenantPickupSchema.safeParse({ ...draft, tenantId: '../teiko' }).success).toBe(false);
    expect(tenantPickupSchema.safeParse({ ...draft, items: [] }).success).toBe(false);
    expect(tenantPickupSchema.safeParse({ ...draft, items: [{ productId: 'sushi', quantity: 0 }] }).success).toBe(false);
  });
});
