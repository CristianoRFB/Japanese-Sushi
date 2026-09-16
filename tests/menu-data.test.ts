import { describe, expect, it } from 'vitest';

import { developmentCatalog, developmentStoreConfig } from '../lib/development-seed';
import { validateProductConfiguration } from '../shared/domain';

describe('cardápio transcrito', () => {
  it('mantém IDs, slugs, preços e relacionamentos válidos', () => {
    expect(developmentCatalog.categories).toHaveLength(6);
    expect(developmentCatalog.products).toHaveLength(14);
    expect(new Set(developmentCatalog.products.map((product) => product.id)).size).toBe(developmentCatalog.products.length);
    expect(new Set(developmentCatalog.products.map((product) => product.slug)).size).toBe(developmentCatalog.products.length);
    expect(new Set(developmentCatalog.groups.map((group) => group.id)).size).toBe(developmentCatalog.groups.length);
    expect(new Set(developmentCatalog.modifiers.map((modifier) => modifier.id)).size).toBe(developmentCatalog.modifiers.length);
    for (const product of developmentCatalog.products) {
      expect(validateProductConfiguration(product, developmentCatalog.groups, developmentCatalog.modifiers)).toEqual([]);
      expect(product.sizes.every((size) => Number.isSafeInteger(size.basePriceCents) && size.basePriceCents >= 0)).toBe(true);
    }
  });

  it('confere combinados, sushis, pratos quentes e bebidas', () => {
    const prices = (id: string) => developmentCatalog.products.find((product) => product.id === id)?.sizes.map((size) => size.basePriceCents);
    expect(prices('teiko-combinado-12')).toEqual([4290, 6590]);
    expect(prices('uramaki-philadelphia')).toEqual([2490]);
    expect(prices('temaki-salmao')).toEqual([2990]);
    expect(prices('yakisoba-frango')).toEqual([2790]);
    expect(prices('agua-sem-gas')).toEqual([450]);
  });

  it('confere taxa, horários e textos operacionais', () => {
    expect(developmentStoreConfig.deliveryConfig).toEqual({ mode: 'FIXED', fixedFeeCents: 500 });
    expect(developmentStoreConfig.hours.find((day) => day.day === 0)?.windows).toEqual([{ open: '18:00', close: '22:30' }]);
    for (const day of [5, 6]) expect(developmentStoreConfig.hours.find((entry) => entry.day === day)?.windows).toEqual([{ open: '18:00', close: '22:30' }]);
    expect(developmentStoreConfig.orderInstructions).toMatch(/pagamento/);
    expect(developmentStoreConfig.storeName).toBe('Teiko Sushi');
  });
});
