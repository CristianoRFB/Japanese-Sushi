import { describe, expect, it } from 'vitest';
import { validTenantSlug } from '../shared/tenancy';

describe('public tenant storefront routing preconditions', () => {
  it('rejects unsafe tenant identifiers before any callable', () => {
    for (const value of ['', '.', '../orders', 'tenant--x', 'TEIKO', 'store?x=1']) {
      expect(validTenantSlug(value)).toBe(false);
    }
    expect(validTenantSlug('beta-sushi')).toBe(true);
  });
});
