import { describe, expect, it } from 'vitest';
import { hasTenantAccess, membershipDocumentId, tenantCacheKey, validTenantSlug, type TenantMembership } from '../shared/tenancy';

describe('base de tenancy F4 — segurança e escopos', () => {
  const m: TenantMembership = { userUid: 'user-a', tenantId: 'teiko', role: 'staff', active: true };
  it('valida slug estável e proíbe separadores perigosos', () => {
    expect(validTenantSlug('teiko')).toBe(true);
    expect(validTenantSlug('beta-sushi')).toBe(true);
    for (const slug of ['', 'a', 'TEIKO', '../teiko', 'teiko--admin', '-teiko', 'teiko-']) {
      expect(validTenantSlug(slug)).toBe(false);
    }
  });
  it('membership é escopada e não concede acesso por UID apenas', () => {
    expect(hasTenantAccess('user-a', 'teiko', m, 'ACTIVE')).toBe(true);
    expect(hasTenantAccess('user-a', 'beta-sushi', m, 'ACTIVE')).toBe(false);
    expect(hasTenantAccess('other', 'teiko', m, 'ACTIVE')).toBe(false);
    expect(hasTenantAccess('user-a', 'teiko', m, 'SUSPENDED')).toBe(false);
    expect(hasTenantAccess('user-a', 'teiko', { ...m, active: false }, 'ACTIVE')).toBe(false);
  });
  it('id e localStorage não colidem entre tenants e usuários', () => {
    expect(membershipDocumentId('teiko', 'user-a')).toBe('teiko_user-a');
    expect(membershipDocumentId('beta-sushi', 'user-a')).not.toBe('teiko_user-a');
    expect(tenantCacheKey('teiko', 'cart')).not.toBe(tenantCacheKey('beta-sushi', 'cart'));
    expect(tenantCacheKey('teiko', 'cart', 'user-a')).not.toBe(tenantCacheKey('teiko', 'cart', 'user-b'));
    expect(() => membershipDocumentId('../a', 'user-a')).toThrow();
    expect(() => tenantCacheKey('teiko', '../config')).toThrow();
  });
});
