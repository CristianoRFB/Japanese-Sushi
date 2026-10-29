import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

function localEmulator(name) {
  const value = process.env[name] || '';
  return /^(?:127\.0\.0\.1|localhost):\d{2,5}$/.test(value);
}
if (!localEmulator('FIRESTORE_EMULATOR_HOST') || !localEmulator('FIREBASE_AUTH_EMULATOR_HOST')
  || (process.env.GCLOUD_PROJECT && process.env.GCLOUD_PROJECT !== 'sushi-cbfd2')) {
  console.error('BLOCKED: requer Auth + Firestore Emulator locais no projeto sushi-cbfd2.');
  process.exit(2);
}
if (!getApps().length) initializeApp({ projectId: 'sushi-cbfd2' });
const auth = getAuth();
const db = getFirestore();

async function account(email, password) {
  try { return await auth.getUserByEmail(email); }
  catch (error) {
    if (error?.code !== 'auth/user-not-found') throw error;
    return await auth.createUser({ email, password, emailVerified: true });
  }
}
const fakePassword = 'EMULATOR_ONLY_Never_Use_in_Production_2026!';
const platform = await account('platform-fixture@example.test', fakePassword);
// Claim is created ONLY inside local Auth Emulator, not for a real customer.
await auth.setCustomUserClaims(platform.uid, { platform_owner: true });

const fixtures = [
  { tenantId: 'tenant-a', name: 'Restaurante A (ficção)', ownerEmail: 'owner-a@example.test',
    categoryId: 'sushis', productId: 'sushi-a', productName: 'Sushi fictício A' },
  { tenantId: 'tenant-b', name: 'Restaurante B (ficção)', ownerEmail: 'owner-b@example.test',
    categoryId: 'temakis', productId: 'temaki-b', productName: 'Temaki fictício B' },
];
for (const entry of fixtures) {
  const owner = await account(entry.ownerEmail, fakePassword);
  const tenantRef = db.doc('tenants/' + entry.tenantId);
  // Protect against overwriting a non-fixture tenant with the same slug.
  const existing = await tenantRef.get();
  if (existing.exists && existing.data()?.developmentSeed !== true) {
    throw new Error('BLOCKED: tenant ID reservado por dados não-fictícios.');
  }
  const batch = db.batch();
  batch.set(tenantRef, {
    id: entry.tenantId, slug: entry.tenantId, status: 'ACTIVE',
    branding: { displayName: entry.name, primaryColor: '#9b2639' },
    developmentSeed: true, orderingEnabled: true, updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  batch.set(db.doc('tenantMemberships/' + entry.tenantId + '_' + owner.uid), {
    tenantId: entry.tenantId, userUid: owner.uid, role: 'tenant_owner', active: true,
    developmentSeed: true, updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  batch.set(db.doc('tenants/' + entry.tenantId + '/categories/' + entry.categoryId), {
    tenantId: entry.tenantId, name: 'Categoria fictícia', active: true,
    displayOrder: 0, developmentSeed: true,
  }, { merge: true });
  batch.set(db.doc('tenants/' + entry.tenantId + '/products/' + entry.productId), {
    tenantId: entry.tenantId, slug: entry.productId, name: entry.productName,
    description: 'Dado sintético — não é item comercial real.', active: true,
    categoryId: entry.categoryId, productType: 'SIMPLE',
    sizes: [{ id: 'unico', label: 'Padrão', basePriceCents: 1990, active: true, displayOrder: 0 }],
    unitIds: [], modifierGroupIds: [], displayOrder: 0, developmentSeed: true,
  }, { merge: true });
  await batch.commit();
}
console.log('Fixtures apenas nos emuladores locais. Usuários de teste: platform-fixture@example.test, owner-a@example.test, owner-b@example.test.');
console.log('Senha das contas sintéticas está no código da fixture; nunca a utilize em produção.');
console.log('Teiko real e a coleção legada não foram modificadas.');
