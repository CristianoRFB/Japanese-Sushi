import { describe, expect, it } from 'vitest';

import { developmentCatalog, developmentStoreConfig } from '../lib/development-seed';
import { validateProductConfiguration } from '../shared/domain';

<<<<<<< HEAD
describe('catálogo Teiko de desenvolvimento', () => {
  it('é explicitamente Teiko e mantém relacionamentos válidos', () => {
    expect(developmentStoreConfig.brandId).toBe('teiko');
    expect(developmentCatalog.categories.length).toBeGreaterThan(0);
    expect(developmentCatalog.products.length).toBeGreaterThan(0);
=======
describe('cardápio transcrito', () => {
  it('mantém IDs, slugs, preços e relacionamentos válidos', () => {
    expect(developmentCatalog.categories).toHaveLength(6);
    expect(developmentCatalog.products).toHaveLength(14);
>>>>>>> origin/main
    expect(new Set(developmentCatalog.products.map((product) => product.id)).size).toBe(developmentCatalog.products.length);
    expect(new Set(developmentCatalog.products.map((product) => product.slug)).size).toBe(developmentCatalog.products.length);
    for (const product of developmentCatalog.products) {
      expect(product.brandId).toBe('teiko');
      expect(validateProductConfiguration(product, developmentCatalog.groups, developmentCatalog.modifiers)).toEqual([]);
      expect(product.sizes.every((size) => Number.isSafeInteger(size.basePriceCents) && size.basePriceCents >= 0)).toBe(true);
    }
  });

<<<<<<< HEAD
  it('não carrega resíduos do domínio anterior', () => {
    const text = JSON.stringify(developmentCatalog).toLowerCase();
    expect(text).not.toContain('açaí');
    expect(text).not.toContain('acai');
    expect(text).not.toContain('milk-shake');
  });

  it('deixa preço e horário oficiais para configuração da unidade', () => {
    expect(developmentCatalog.products.every((product) => product.sizes.every((size) => size.basePriceCents === 0))).toBe(true);
    expect(developmentStoreConfig.hours.find((day) => day.day === 0)?.closed).toBe(true);
    expect(developmentStoreConfig.hours.filter((day) => day.day > 0).every((day) => day.windows[0]?.open === '19:00' && day.windows[0]?.close === '23:00')).toBe(true);
    expect(developmentStoreConfig.deliveryConfig).toEqual({ mode: 'CONFIRM' });
=======
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
>>>>>>> origin/main
  });
});
