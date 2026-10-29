/**
 * Core multitenant types (F4 foundation). No pricing gates or real tenant
 * resolver are enabled by introducing these models.
 */
export type TenantStatus = 'ACTIVE' | 'SUSPENDED';
export type TenantRole = 'tenant_owner' | 'staff' | 'driver';
export type PlatformRole = 'platform_owner';

export interface TenantBranding {
  displayName: string;
  logoUrl?: string;
  primaryColor?: string;
  accentColor?: string;
}

export interface TenantRecord {
  id: string;
  slug: string;
  status: TenantStatus;
  branding: TenantBranding;
  createdAt?: unknown;
  updatedAt?: unknown;
  // Approved commercial mechanics: metadata only until secure entitlement enforcement exists.
  planId?: string;
  subscriptionStatus?: 'trial' | 'active' | 'past_due' | 'suspended' | 'cancelled' | 'demo';
  trialUntil?: unknown;
  entitlementOverrides?: Record<string, unknown>;
}

export interface TenantMembership {
  tenantId: string;
  userUid: string;
  role: TenantRole;
  active: boolean;
}

export function validTenantSlug(slug: string): boolean {
  return /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(slug)
    && !slug.includes('--');
}

export function membershipDocumentId(tenantId: string, uid: string): string {
  if (!validTenantSlug(tenantId) || !/^[A-Za-z0-9_-]{1,128}$/.test(uid)) {
    throw new Error('Identificador inválido para membership.');
  }
  return tenantId + '_' + uid;
}

export function tenantCacheKey(tenantId: string, resource: string, uid?: string): string {
  if (!validTenantSlug(tenantId) || !/^[a-z0-9-]{2,32}$/.test(resource)
    || (uid !== undefined && !/^[A-Za-z0-9_-]{1,128}$/.test(uid))) {
    throw new Error('Chave de cache do tenant inválida.');
  }
  return ['sushi', tenantId, resource, uid ?? 'public', 'v1'].join(':');
}

export function hasTenantAccess(
  uid: string,
  tenantId: string,
  membership: TenantMembership | null,
  tenantStatus: TenantStatus,
): boolean {
  return tenantStatus === 'ACTIVE' && membership?.active === true
    && membership.userUid === uid && membership.tenantId === tenantId;
}
