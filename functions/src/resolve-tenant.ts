import { getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { validTenantSlug } from '../../shared/tenancy.js';

const region = 'southamerica-east1';
const enforceAppCheck = process.env.ENFORCE_APP_CHECK === 'true';

function publicBranding(value: unknown) {
  const data = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const displayName = typeof data.displayName === 'string' ? data.displayName.trim().slice(0, 90) : '';
  const color = typeof data.primaryColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(data.primaryColor)
    ? data.primaryColor : undefined;
  const logo = typeof data.logoUrl === 'string'
    && (data.logoUrl.startsWith('/brand/') || /^https:\/\//i.test(data.logoUrl))
    ? data.logoUrl.slice(0, 500) : undefined;
  return { displayName: displayName || 'Restaurante', ...(color && { primaryColor: color }), ...(logo && { logoUrl: logo }) };
}

export const resolvePublicTenant = onCall(
  { region, timeoutSeconds: 10, memory: '256MiB', enforceAppCheck },
  async (request) => {
    const input = request.data;
    const slug = typeof input?.slug === 'string' ? input.slug : '';
    if (!validTenantSlug(slug))
      throw new HttpsError('invalid-argument', 'Identificador de restaurante inválido.');
    const db = getFirestore();
    const snap = await db.doc('tenants/' + slug).get();
    if (snap.exists) {
      const tenant = snap.data()!;
      if (tenant.slug !== slug) throw new HttpsError('not-found', 'Restaurante não encontrado.');
      const status = tenant.status === 'ACTIVE' ? 'ACTIVE' : 'SUSPENDED';
      return {
        id: slug,
        slug,
        status,
        branding: status === 'ACTIVE' ? publicBranding(tenant.branding) : { displayName: 'Restaurante indisponível' },
        orderingEnabled: status === 'ACTIVE' && slug !== 'teiko' && tenant.orderingEnabled === true
          && tenant.migrationState !== 'EMULATOR_COPY_ONLY',
        // Pro+ reservation entitlement enforcement is not yet in production.
        reservationsEnabled: !!process.env.FIRESTORE_EMULATOR_HOST && !!process.env.FIREBASE_AUTH_EMULATOR_HOST
          && status === 'ACTIVE' && slug !== 'teiko' && tenant.reservationsEnabled === true
          && tenant.migrationState !== 'EMULATOR_COPY_ONLY',
      };
    }
    // Backward-compatible Teiko resolution while tenant migration is pending.
    // Never treat this fallback as proof that the production Tenant record exists.
    if (slug !== 'teiko') throw new HttpsError('not-found', 'Restaurante não encontrado.');
    const config = (await db.doc('storePublicConfig/main').get()).data();
    if (!config || config.brandId !== 'teiko')
      throw new HttpsError('not-found', 'Restaurante não encontrado.');
    const status = config.status === 'INACTIVE' || config.status === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE';
    return {
      id: 'teiko',
      slug: 'teiko',
      status,
      branding: status === 'ACTIVE'
        ? publicBranding({ displayName: config.storeName || 'Teiko Sushi', logoUrl: '/brand/teiko-logo.jpg' })
        : { displayName: 'Restaurante indisponível' },
      legacyFallback: true,
    };
  },
);
