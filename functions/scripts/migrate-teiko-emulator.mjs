import { createHash } from 'node:crypto';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const apply = process.argv.includes('--apply-emulator');
if (process.argv.some((x) => x.startsWith('--') && x !== '--apply-emulator')) {
  console.error('Unknown argument. Use default dry-run or --apply-emulator.');
  process.exit(2);
}
const host = (value) => /^(127\.0\.0\.1|localhost):\d{2,5}$/.test(value || '');
if (!host(process.env.FIRESTORE_EMULATOR_HOST)
  || (process.env.GCLOUD_PROJECT && process.env.GCLOUD_PROJECT !== 'sushi-cbfd2')) {
  console.error('BLOCKED: local Firestore Emulator required; production migration is NOT supported.');
  process.exit(2);
}
if (!getApps().length) initializeApp({ projectId: 'sushi-cbfd2' });
const db = getFirestore();
const config = await db.doc('storePublicConfig/main').get();
if (!config.exists || config.data()?.brandId !== 'teiko') {
  console.error('BLOCKED: no Teiko legacy config in emulator.');
  process.exit(2);
}
if (apply && config.data()?.developmentSeed !== true) {
  console.error('BLOCKED: --apply-emulator requires explicitly synthetic developmentSeed data.');
  process.exit(2);
}

const collections = [
  'categories', 'products', 'modifierGroups', 'modifiers', 'promotions',
  'orders', 'orderRequests', 'reservations', 'reservationRequests', 'tables',
  'financeEntries', 'cashRegisters', 'cashMovements', 'deliveryDrivers',
  'deliveries', 'deliveryEvents', 'orderDeliveryCodes', 'deliverySecrets',
  'deliveryReceiptRequests', 'driverPushTokens', 'driverPushDispatches',
  'storePublicConfig',
];
function normalize(value) {
  if (value && typeof value.toJSON === 'function') return normalize(value.toJSON());
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') return Object.fromEntries(
    Object.entries(value).sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => [k,normalize(v)]));
  return value;
}
const hash = (value) => createHash('sha256').update(JSON.stringify(normalize(value))).digest('hex');
let scanned=0, skipped=0, copies=0, unchanged=0;
const pending=[];
const digests=[];
for (const collection of collections) {
  const source = await db.collection(collection).get();
  for (const item of source.docs) {
    scanned++;
    if (item.data().brandId !== 'teiko') { skipped++; continue; }
    if (item.data().tenantId && item.data().tenantId !== 'teiko') {
      throw new Error('CONFLICT: wrong tenantId on legacy source; stopped before writing.');
    }
    const next = { ...item.data(), tenantId: 'teiko' };
    const target = db.doc('tenants/teiko/' + collection + '/' + item.id);
    const previous = await target.get();
    if (previous.exists) {
      if (hash(previous.data()) !== hash(next))
        throw new Error('CONFLICT: destination has different contents; stopped before writing.');
      unchanged++;
    } else {
      copies++;
      pending.push({ target, next });
    }
    // Evidence contains hash only, never a customer name/address/order content.
    digests.push(hash({ collection, id: item.id, contentHash: hash(next) }));
  }
}
const manifest = {
  mode: apply ? 'EMULATOR_APPLY' : 'DRY_RUN_ONLY',
  source: 'legacy-teiko-root',
  destination: 'tenants/teiko/{collection}/{same-document-id}',
  scanned, skipped, copies, unchanged,
  snapshotChecksum: hash(digests.sort()),
  leavesLegacyUntouched: true,
};
console.log(JSON.stringify(manifest, null, 2));
if (!apply) process.exit(0);

const tenantRef=db.doc('tenants/teiko');
const existingTenant=await tenantRef.get();
if (existingTenant.exists && existingTenant.data()?.developmentSeed !== true) {
  throw new Error('CONFLICT: Teiko tenant record was not created as emulator fixture.');
}
// Bounded, resumable batches, no delete / no destructive action. Teiko root
// remains the operational source of truth until a separately authorized cutover.
for(let i=0;i<pending.length;i+=350) {
  const batch=db.batch();
  for(const entry of pending.slice(i,i+350)) batch.create(entry.target,entry.next);
  await batch.commit();
}
if (!existingTenant.exists) {
  await tenantRef.create({
    id:'teiko',slug:'teiko',status:'SUSPENDED',developmentSeed:true,
    migrationState:'EMULATOR_COPY_ONLY',branding:{displayName:config.data().storeName||'Teiko Sushi'},
    createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp(),
  });
}
console.log('EMULATOR COPY COMPLETE. No production data, roles or memberships changed. Teiko new namespace remains SUSPENDED.');
