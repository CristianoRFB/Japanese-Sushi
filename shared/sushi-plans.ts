/**
 * Commercial contract for Sushi only. Planned features are not advertised here.
 * Security, authentication and tenant isolation are never plan-gated.
 * A plan grant alone does not activate a feature: operational flags still apply.
 */
export type SushiPlanId = 'essencial' | 'pro' | 'premium';
export type SubscriptionStatus = 'trial' | 'active' | 'past_due' | 'suspended' | 'cancelled' | 'demo';
export type SushiFeature = 'pickup_orders' | 'reservations';
type Plan = { id: SushiPlanId; name: string; rank: number; monthlyPriceCents: number;
  recommended: boolean; features: readonly SushiFeature[]; limits: Readonly<Record<string, number | null>> };
export const SUSHI_PLANS: Readonly<Record<SushiPlanId, Plan>> = {
  essencial: { id: 'essencial', name: 'Essencial', rank: 1, monthlyPriceCents: 8990,
    recommended: false, features: ['pickup_orders'], limits: {} },
  pro: { id: 'pro', name: 'Pro', rank: 2, monthlyPriceCents: 14990,
    recommended: true, features: ['pickup_orders', 'reservations'], limits: {} },
  premium: { id: 'premium', name: 'Premium', rank: 3, monthlyPriceCents: 21990,
    recommended: false, features: ['pickup_orders', 'reservations'], limits: {} },
};
/** Do not invent premium-only capabilities or numerical usage ceilings. */
export type CommercialTenant = {
  planId?: unknown; subscriptionStatus?: unknown; trialUntil?: unknown;
  entitlementOverrides?: unknown;
};
export function canUseSushiFeature(
  tenant: CommercialTenant | null | undefined, feature: SushiFeature,
  now = new Date(), emulator = false,
): boolean {
  if (!tenant || !Object.prototype.hasOwnProperty.call(SUSHI_PLANS, tenant.planId)) return false;
  const status = tenant.subscriptionStatus;
  if (status === 'trial' && tenant.trialUntil != null) {
    const until = typeof tenant.trialUntil === 'string' ? Date.parse(tenant.trialUntil)
      : typeof tenant.trialUntil === 'object' && tenant.trialUntil !== null
        && 'toDate' in tenant.trialUntil && typeof tenant.trialUntil.toDate === 'function'
        ? tenant.trialUntil.toDate().getTime() : NaN;
    if (!Number.isFinite(until) || until <= now.getTime()) return false;
  } else if (status !== 'trial' && status !== 'active' && !(status === 'demo' && emulator)) {
    return false;
  }
  const plan = SUSHI_PLANS[tenant.planId as SushiPlanId];
  const overrides = tenant.entitlementOverrides;
  if (overrides && typeof overrides === 'object' && !Array.isArray(overrides) &&
    Object.prototype.hasOwnProperty.call(overrides, feature)) {
    const setting = (overrides as Record<string, unknown>)[feature];
    if (typeof setting !== 'boolean') return false;
    return setting;
  }
  return plan.features.includes(feature);
}
