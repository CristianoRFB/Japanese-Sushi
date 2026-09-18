import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  Timestamp,
  updateDoc,
  setDoc,
  where,
  query,
} from 'firebase/firestore';
import { afterAll, beforeAll, describe, it } from 'vitest';

let env: RulesTestEnvironment;
const testRunId = crypto.randomUUID().replace(/-/g, '').slice(0, 10);
const config = {
  brandId: 'teiko',
  defaultUnitId: 'santa-fe-do-sul',
};

function orderData(ownerUid: string, status = 'NEW') {
  const now = Timestamp.now();
  return {
    brandId: 'teiko',
    ownerUid,
    clientRequestId: crypto.randomUUID(),
    publicCode: crypto.randomUUID().replace(/-/g, ''),
    orderNumber: '#TLOCAL01',
    createdAt: now,
    updatedAt: now,
    unitId: 'santa-fe-do-sul',
    customer: { name: 'Cliente Teiko', whatsapp: '17999999999' },
    items: [{ productId: 'simple', productName: 'Sushi', quantity: 1 }],
    fulfillment: { mode: 'PICKUP' },
    payment: { method: 'PIX', needsChange: false },
    pricing: {
      subtotalCents: 1800,
      deliveryFeeCents: 0,
      totalCents: 1800,
      currency: 'BRL',
      quoteType: 'CLIENT_PREVIEW',
    },
    status,
    customerApproval: 'NONE',
    source: 'WEB',
    notes: '',
    statusHistory: [{ status, at: now, actor: ownerUid }],
  };
}

function reservationData(ownerUid: string) {
  const now = Timestamp.now();
  return {
    brandId: 'teiko',
    ownerUid,
    clientRequestId: crypto.randomUUID(),
    unitId: 'santa-fe-do-sul',
    name: 'Cliente Teiko',
    whatsapp: '17999999999',
    date: '2026-12-10',
    time: '19:30',
    people: 2,
    notes: '',
    status: 'REQUESTED',
    createdAt: now,
    updatedAt: now,
    statusHistory: [{ status: 'REQUESTED', at: now, actor: 'customer' }],
  };
}

beforeAll(async () => {
  const [host, port] = (
    process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8180'
  ).split(':');
  env = await initializeTestEnvironment({
    projectId: 'sushi-cbfd2',
    firestore: {
      host,
      port: Number(port),
      rules: readFileSync(resolve('firestore.rules'), 'utf8'),
    },
  });
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'storePublicConfig', 'main'), config);
    await setDoc(doc(db, 'products', 'active'), {
      brandId: 'teiko',
      active: true,
      displayOrder: 1,
    });
    await setDoc(doc(db, 'users', 'admin-uid'), {
      brandId: 'teiko',
      role: 'admin',
      active: true,
    });
    await setDoc(doc(db, 'users', 'staff-uid'), {
      brandId: 'teiko',
      role: 'staff',
      active: true,
    });
    await setDoc(doc(db, 'promotions', 'active-promo'), {
      brandId: 'teiko',
      name: 'Oferta ativa',
      active: true,
      discountType: 'PERCENTAGE',
      discountValue: 10,
      startsAt: '2026-09-01',
      endsAt: '2026-09-30',
      productIds: [],
    });
    await setDoc(doc(db, 'promotions', 'paused-promo'), {
      brandId: 'teiko',
      name: 'Oferta pausada',
      active: false,
      discountType: 'FIXED',
      discountValue: 500,
      startsAt: '2026-09-01',
      endsAt: '2026-09-30',
      productIds: [],
    });
  });
});

afterAll(() => env.cleanup());

describe('Firestore Rules Spark Teiko', () => {
  it('permite catálogo público, mas nega pedidos alheios e promoção de cliente', async () => {
    const publicDb = env.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(publicDb, 'products', 'active')));
    await assertSucceeds(getDoc(doc(publicDb, 'storePublicConfig', 'main')));
    await assertFails(
      setDoc(doc(publicDb, 'products', 'hacked'), { active: true }),
    );

    const customerDb = env.authenticatedContext('customer-uid').firestore();
    const customerOrder = orderData('customer-uid');
    await assertSucceeds(
      setDoc(doc(customerDb, 'orders', `customer-order-${testRunId}`), customerOrder),
    );
    await assertSucceeds(getDoc(doc(customerDb, 'orders', `customer-order-${testRunId}`)));
    await assertSucceeds(
      getDocs(
        query(
          collection(customerDb, 'orders'),
          where('ownerUid', '==', 'customer-uid'),
          where('publicCode', '==', customerOrder.publicCode),
        ),
      ),
    );
    await assertFails(
      getDoc(
        doc(
          env.authenticatedContext('other-uid').firestore(),
          'orders',
          `customer-order-${testRunId}`,
        ),
      ),
    );
    await assertFails(
      updateDoc(doc(customerDb, 'orders', `customer-order-${testRunId}`), {
        status: 'COMPLETED',
      }),
    );
    await assertFails(
      setDoc(doc(customerDb, 'users', 'customer-uid'), {
        brandId: 'teiko',
        role: 'admin',
        active: true,
      }),
    );
  });

  it('expõe somente promoções ativas ao cliente e restringe escrita ao admin', async () => {
    const publicDb = env.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(publicDb, 'promotions', 'active-promo')));
    await assertFails(getDoc(doc(publicDb, 'promotions', 'paused-promo')));
    await assertFails(setDoc(doc(publicDb, 'promotions', 'hacked'), { brandId: 'teiko', active: true }));
    await assertSucceeds(setDoc(doc(env.authenticatedContext('admin-uid').firestore(), 'promotions', `created-${testRunId}`), {
      brandId: 'teiko', name: 'Nova oferta', active: true, discountType: 'FIXED', discountValue: 300,
      startsAt: '2026-09-01', endsAt: '2026-09-30', productIds: [],
    }));
  });

  it('restringe o caixa ao admin Teiko e valida lançamentos', async () => {
    const adminDb = env.authenticatedContext('admin-uid').firestore();
    await assertSucceeds(setDoc(doc(adminDb, 'financeEntries', `sale-${testRunId}`), {
      brandId: 'teiko', kind: 'INCOME', category: 'Vendas de sushi', description: 'Combinado Teiko',
      amountCents: 4200, date: '2026-09-17', status: 'PAID',
    }));
    await assertFails(setDoc(doc(env.authenticatedContext('staff-uid').firestore(), 'financeEntries', `staff-${testRunId}`), {
      brandId: 'teiko', kind: 'EXPENSE', category: 'Insumos frescos', description: 'Salmão',
      amountCents: 12000, date: '2026-09-17', status: 'PAID',
    }));
    await assertFails(setDoc(doc(adminDb, 'financeEntries', `invalid-${testRunId}`), {
      brandId: 'teiko', kind: 'INCOME', category: 'Vendas de sushi', description: 'Valor inválido',
      amountCents: 0, date: '2026-09-17', status: 'PAID',
    }));
  });

  it('permite staff operar status válido e bloqueia transição inválida', async () => {
    const staffDb = env.authenticatedContext('staff-uid').firestore();
    await assertSucceeds(
      getDocs(
        query(collection(staffDb, 'orders'), where('brandId', '==', 'teiko')),
      ),
    );
    await assertSucceeds(
      updateDoc(doc(staffDb, 'orders', `customer-order-${testRunId}`), {
        status: 'CONFIRMED',
        updatedAt: Timestamp.now(),
        statusHistory: arrayUnion({
          status: 'CONFIRMED',
          at: Timestamp.now(),
          actorUid: 'staff-uid',
        }),
      }),
    );
    await assertFails(
      updateDoc(doc(staffDb, 'orders', `customer-order-${testRunId}`), {
        status: 'COMPLETED',
        updatedAt: Timestamp.now(),
        statusHistory: arrayUnion({
          status: 'COMPLETED',
          at: Timestamp.now(),
          actorUid: 'staff-uid',
        }),
      }),
    );
  });

  it('permite proposta de alteração pelo staff e decisão somente do cliente dono', async () => {
    const ownerDb = env.authenticatedContext('customer-edit-uid').firestore();
    const staffDb = env.authenticatedContext('staff-uid').firestore();
    const original = orderData('customer-edit-uid');
    await assertSucceeds(setDoc(doc(ownerDb, 'orders', `edit-order-${testRunId}`), original));
    const proposal = {
      state: 'PENDING',
      items: original.items,
      pricing: original.pricing,
      reason: 'A unidade propôs uma alteração.',
    };
    await assertSucceeds(
      updateDoc(doc(staffDb, 'orders', `edit-order-${testRunId}`), {
        customerApproval: 'PENDING',
        proposedChanges: proposal,
        editReason: proposal.reason,
        updatedAt: Timestamp.now(),
        statusHistory: arrayUnion({
          status: 'NEW',
          kind: 'EDIT_PROPOSED',
          at: Timestamp.now(),
          actorUid: 'staff-uid',
        }),
      }),
    );
    await assertFails(
      updateDoc(doc(env.authenticatedContext('other-uid').firestore(), 'orders', `edit-order-${testRunId}`), {
        customerApproval: 'ACCEPTED',
        items: original.items,
        pricing: original.pricing,
        proposedChanges: { ...proposal, state: 'ACCEPTED' },
        updatedAt: Timestamp.now(),
        statusHistory: arrayUnion({ status: 'NEW', kind: 'CUSTOMER_ACCEPTED_EDIT', at: Timestamp.now() }),
      }),
    );
    await assertSucceeds(
      updateDoc(doc(ownerDb, 'orders', `edit-order-${testRunId}`), {
        customerApproval: 'ACCEPTED',
        items: original.items,
        pricing: original.pricing,
        proposedChanges: { ...proposal, state: 'ACCEPTED' },
        updatedAt: Timestamp.now(),
        statusHistory: arrayUnion({ status: 'NEW', kind: 'CUSTOMER_ACCEPTED_EDIT', at: Timestamp.now() }),
      }),
    );
  });

  it('permite reserva própria e gestão administrativa', async () => {
    const customerDb = env.authenticatedContext('customer-uid').firestore();
    await assertSucceeds(
      setDoc(
        doc(customerDb, 'reservations', `reservation-${testRunId}`),
        reservationData('customer-uid'),
      ),
    );
    await assertSucceeds(
      getDoc(doc(customerDb, 'reservations', `reservation-${testRunId}`)),
    );
    await assertFails(
      getDoc(
        doc(
          env.authenticatedContext('other-uid').firestore(),
          'reservations',
          `reservation-${testRunId}`,
        ),
      ),
    );
    const adminDb = env.authenticatedContext('admin-uid').firestore();
    await assertSucceeds(
      updateDoc(doc(adminDb, 'reservations', `reservation-${testRunId}`), {
        tableId: 'table-1',
        updatedAt: Timestamp.now(),
      }),
    );
    await assertSucceeds(
      updateDoc(doc(adminDb, 'reservations', `reservation-${testRunId}`), {
        status: 'CONFIRMED',
        updatedAt: Timestamp.now(),
        statusHistory: arrayUnion({
          status: 'CONFIRMED',
          at: Timestamp.now(),
          actorUid: 'admin-uid',
        }),
      }),
    );
  });

  it('bloqueia reserva fora de 2026 e datas impossíveis', async () => {
    const customerDb = env.authenticatedContext('reservation-invalid-uid').firestore();
    await assertFails(
      setDoc(
        doc(customerDb, 'reservations', `reservation-2027-${testRunId}`),
        { ...reservationData('reservation-invalid-uid'), date: '2027-02-11' },
      ),
    );
    await assertFails(
      setDoc(
        doc(customerDb, 'reservations', `reservation-impossible-${testRunId}`),
        { ...reservationData('reservation-invalid-uid'), date: '2026-02-31' },
      ),
    );
  });
});
