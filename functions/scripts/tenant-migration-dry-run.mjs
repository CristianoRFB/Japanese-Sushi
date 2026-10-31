// Emulators-only inspection: NO writes, no production credentials, no client PII.
if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error('BLOCKED: o inventário de migração só é permitido no Firestore Emulator.');
  process.exit(2);
}
if (process.env.GCLOUD_PROJECT && process.env.GCLOUD_PROJECT !== 'sushi-cbfd2') {
  console.error('BLOCKED: identificador Firebase inesperado.');
  process.exit(2);
}
const { getApps, initializeApp } = await import('firebase-admin/app');
const { getFirestore } = await import('firebase-admin/firestore');
if (!getApps().length) initializeApp({ projectId: 'sushi-cbfd2' });
const db = getFirestore();

const tenantOwnedCollections = [
  'products', 'categories', 'modifierGroups', 'modifiers', 'promotions',
  'orders', 'orderRequests', 'reservations', 'reservationRequests', 'tables',
  'financeEntries', 'cashRegisters', 'cashMovements', 'deliveryDrivers',
  'deliveries', 'deliveryEvents', 'orderDeliveryCodes', 'deliverySecrets',
  'deliveryReceiptRequests', 'driverPushTokens', 'driverPushDispatches',
  'storePublicConfig',
];
const collectionStats = {};
for (const name of tenantOwnedCollections) {
  const snapshot = await db.collection(name).select('tenantId', 'brandId').get();
  let legacyTeiko = 0;
  let alreadyScoped = 0;
  let unknown = 0;
  for (const doc of snapshot.docs) {
    if (doc.data().tenantId === 'teiko') alreadyScoped++;
    else if (doc.data().brandId === 'teiko') legacyTeiko++;
    else unknown++;
  }
  collectionStats[name] = { documents: snapshot.size, legacyTeiko, alreadyScoped, unknown };
}
console.log(JSON.stringify({
  mode: 'DRY_RUN_ONLY', project: 'sushi-cbfd2', emulator: true,
  noWrite: true, collections: collectionStats,
}, null, 2));
