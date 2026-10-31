import { describe, expect, it } from 'vitest';
import { SUSHI_PLANS, canUseSushiFeature } from '../shared/sushi-plans';

describe('F5 contrato Sushi sem ativação implícita', () => {
  const active = { planId: 'essencial', subscriptionStatus: 'active' };
  it('mantém preço e herança local, sem inventar limites', () => {
    expect(Object.values(SUSHI_PLANS).map(x => x.monthlyPriceCents)).toEqual([8990, 14990, 21990]);
    expect(SUSHI_PLANS.pro.recommended).toBe(true);
    expect(canUseSushiFeature(active, 'pickup_orders')).toBe(true);
    expect(canUseSushiFeature(active, 'reservations')).toBe(false);
    expect(canUseSushiFeature({ ...active, planId: 'pro' }, 'reservations')).toBe(true);
    expect(canUseSushiFeature({ ...active, planId: 'premium' }, 'reservations')).toBe(true);
  });
  it('nega sem assinatura explícita, atrasos, suspensão e trial expirado', () => {
    for (const status of ['past_due', 'suspended', 'cancelled', undefined])
      expect(canUseSushiFeature({ ...active, subscriptionStatus: status }, 'pickup_orders')).toBe(false);
    expect(canUseSushiFeature({ ...active, planId: 'inexistente' }, 'pickup_orders')).toBe(false);
    expect(canUseSushiFeature({ ...active, subscriptionStatus: 'trial', trialUntil: '2020-01-01T00:00:00Z' },
      'pickup_orders', new Date('2026-01-01T00:00:00Z'))).toBe(false);
    expect(canUseSushiFeature({ ...active, subscriptionStatus: 'trial' }, 'pickup_orders')).toBe(true);
  });
  it('usa overrides booleanos apenas com status válido; demo só em emuladores', () => {
    expect(canUseSushiFeature({ ...active, entitlementOverrides: { pickup_orders: false } }, 'pickup_orders')).toBe(false);
    expect(canUseSushiFeature({ ...active, entitlementOverrides: { reservations: true } }, 'reservations')).toBe(true);
    expect(canUseSushiFeature({ ...active, entitlementOverrides: { reservations: 'true' } }, 'reservations')).toBe(false);
    expect(canUseSushiFeature({ ...active, subscriptionStatus: 'suspended',
      entitlementOverrides: { reservations: true } }, 'reservations')).toBe(false);
    const demo = { ...active, subscriptionStatus: 'demo' };
    expect(canUseSushiFeature(demo, 'pickup_orders')).toBe(false);
    expect(canUseSushiFeature(demo, 'pickup_orders', new Date(), true)).toBe(true);
  });
});
