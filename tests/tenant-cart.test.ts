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

describe('tamanhos do carrinho isolados por variante', () => {
  const variants = { id: 'combo', tenantId: 'tenant-a', name: 'Combo de teste',
    active: true, productType: 'VARIANT', modifierGroupIds: [],
    sizes: [{ id: 'pequeno', label: 'Pequeno', active: true, basePriceCents: 1200 },
      { id: 'grande', label: 'Grande', active: true, basePriceCents: 2400 }] };
  it('precifica cada variante, sem mesclar linhas do mesmo produto', () => {
    const first = changeTenantCart([], 'combo', 1, 'pequeno');
    const second = changeTenantCart(first, 'combo', 1, 'grande');
    expect(second).toHaveLength(2);
    expect(quoteTenantCart('tenant-a', second, [variants]).totalCents).toBe(3600);
    expect(changeTenantCart(second, 'combo', -1, 'pequeno')).toHaveLength(1);
  });
  it('nega tamanho omitido, inativo ou de outro tenant', () => {
    expect(quoteTenantCart('tenant-a', [{ productId: 'combo', quantity: 1 }], [variants]).invalid).toBe(true);
    expect(quoteTenantCart('tenant-a', [{ productId: 'combo', sizeId: 'outro', quantity: 1 }], [variants]).invalid).toBe(true);
    expect(quoteTenantCart('tenant-b', [{ productId: 'combo', sizeId: 'grande', quantity: 1 }], [variants]).invalid).toBe(true);
    expect(quoteTenantCart('tenant-a', [{ productId: 'combo', sizeId: 'grande', quantity: 1 }],
      [{ ...variants, sizes: variants.sizes.map(s => ({ ...s, active: false })) }]).invalid).toBe(true);
    expect(sanitizeTenantCart([{ productId: 'combo', sizeId: '../other', quantity: 1 }])).toEqual([]);
  });
});
