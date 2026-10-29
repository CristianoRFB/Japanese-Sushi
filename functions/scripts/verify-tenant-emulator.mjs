import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const host = value => /^(127\.0\.0\.1|localhost):\d{2,5}$/.test(value || '');
if (!host(process.env.FIRESTORE_EMULATOR_HOST) || !host(process.env.FIREBASE_AUTH_EMULATOR_HOST)) {
  console.error('BLOCKED: verifier must run with local Auth and Firestore Emulators.');
  process.exit(2);
}
if (!getApps().length) initializeApp({ projectId: 'sushi-cbfd2' });
const auth = getAuth(), db = getFirestore();
const platform = await auth.getUserByEmail('platform-fixture@example.test');
if (platform.customClaims?.platform_owner !== true) throw new Error('Missing synthetic platform claim');
for (const [tenantId,email,productId,otherId] of [
  ['tenant-a','owner-a@example.test','sushi-a','temaki-b'],
  ['tenant-b','owner-b@example.test','temaki-b','sushi-a'],
]) {
  const user = await auth.getUserByEmail(email);
  const [tenant, membership, product, forbidden] = await Promise.all([
    db.doc('tenants/' + tenantId).get(),
    db.doc('tenantMemberships/' + tenantId + '_' + user.uid).get(),
    db.doc('tenants/' + tenantId + '/products/' + productId).get(),
    db.doc('tenants/' + tenantId + '/products/' + otherId).get(),
  ]);
  if (tenant.data()?.status !== 'ACTIVE' || tenant.data()?.developmentSeed !== true
    || tenant.data()?.orderingEnabled !== true)
    throw new Error('Synthetic tenant invalid');
  if (membership.data()?.tenantId !== tenantId || membership.data()?.userUid !== user.uid
    || membership.data()?.role !== 'tenant_owner' || membership.data()?.active !== true)
    throw new Error('Missing tenant membership');
  if (product.data()?.tenantId !== tenantId || product.data()?.active !== true || forbidden.exists)
    throw new Error('Cross-tenant fixture product leakage');
}
console.log('PASS: synthetic Tenant A/B, memberships, catalogs and Platform Owner claims verified in local emulators.');
