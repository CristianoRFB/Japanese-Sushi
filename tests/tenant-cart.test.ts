import { describe, expect, it } from 'vitest';
import { changeTenantCart, quoteTenantCart, sanitizeTenantCart } from '../shared/tenant-cart';

const product = { id: 'sushi', tenantId: 'tenant-a', name: 'Sushi de teste', active: true,
  productType: 'SIMPLE', modifierGroupIds: [], sizes: [{ id: 'unico', active: true, basePriceCents: 1990 }] };

describe('carrinho público isolado por tenant', () => {
  it('filtra armazenamento adulterado sem transportar PII', () => {
    expect(sanitizeTenantCart([{ productId: 'sushi', quantity: 2 }, { productId: 'sushi', quantity: 3 },
      { productId: '../teiko', quantity: 1 }, { productId: 'tea', quantity: 999 },
      { productId: 'rice', quantity: 1, customerName: 'não persistir' }]))
      .toEqual([{ productId: 'sushi', quantity: 2 }, { productId: 'rice', quantity: 1 }]);
  });
  it('faz atualização determinística sem exceder quantidade', () => {
    const one = changeTenantCart([], 'sushi', 1);
    expect(changeTenantCart(one, 'sushi', 1)[0].quantity).toBe(2);
    expect(changeTenantCart(one, 'sushi', -1)).toEqual([]);
    expect(changeTenantCart([{ productId: 'sushi', quantity: 20 }], 'sushi', 1)[0].quantity).toBe(20);
  });
  it('bloqueia mistura de tenants e divergência de catálogo', () => {
    expect(quoteTenantCart('tenant-a', [{ productId: 'sushi', quantity: 2 }], [product]).totalCents).toBe(3980);
    expect(quoteTenantCart('tenant-b', [{ productId: 'sushi', quantity: 1 }], [product]).invalid).toBe(true);
    expect(quoteTenantCart('tenant-a', [{ productId: 'sushi', quantity: 1 }], [{ ...product, active: false }]).invalid).toBe(true);
    expect(quoteTenantCart('tenant-a', [{ productId: 'sushi', quantity: 1 }], [{ ...product, modifierGroupIds: ['extra'] }]).invalid).toBe(true);
  });
});
