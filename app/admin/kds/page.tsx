'use client';

import {
  arrayUnion,
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { Check, ChefHat, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { AdminShell } from '@/components/admin-shell';
import { useAuth } from '@/components/providers';
import { getFirebaseClient } from '@/lib/firebase/client';
import {
  TEIKO_BRAND_ID,
  type OrderStatus,
  ORDER_TRANSITIONS,
} from '@/shared/domain';

interface KitchenOrder {
  id: string;
  orderNumber: string;
  createdAt?: { toDate: () => Date };
  customer: { name: string };
  items: Array<{
    productName: string;
    quantity: number;
    sizeLabel: string;
    modifierSelections: Array<{
      groupName: string;
      items: Array<{ name: string; quantity: number }>;
    }>;
    notes?: string;
  }>;
  status: OrderStatus;
}
const labels: Partial<Record<OrderStatus, string>> = {
  NEW: 'Novo',
  CONFIRMED: 'Confirmado',
  PREPARING: 'Em preparo',
  READY: 'Pronto',
};

export default function KdsPage() {
  const { user, role } = useAuth();
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  useEffect(
    () =>
      onSnapshot(
        query(
          collection(getFirebaseClient().db, 'orders'),
          where('brandId', '==', TEIKO_BRAND_ID),
          where('status', 'in', ['NEW', 'CONFIRMED', 'PREPARING', 'READY']),
          orderBy('createdAt', 'asc'),
          limit(50),
        ),
        (snapshot) =>
          setOrders(
            snapshot.docs.map(
              (item) => ({ id: item.id, ...item.data() }) as KitchenOrder,
            ),
          ),
        (cause) => setError(cause.message),
      ),
    [],
  );
  async function advance(order: KitchenOrder, status: OrderStatus) {
    setBusy(order.id);
    setError('');
    try {
      if (!user || !role)
        throw new Error('Sessão administrativa indisponível.');
      await updateDoc(doc(getFirebaseClient().db, 'orders', order.id), {
        status,
        updatedAt: serverTimestamp(),
        statusHistory: arrayUnion({
          status,
          at: Timestamp.now(),
          actorUid: user.uid,
          actorRole: role,
        }),
      });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message.replace(/^FirebaseError:\s*/, '')
          : 'Não foi possível atualizar o pedido.',
      );
    } finally {
      setBusy('');
    }
  }
  return (
    <AdminShell>
      <div>
        <p className="text-xs font-black uppercase tracking-[.18em] text-[#c13a43]">
          Produção
        </p>
        <h1 className="mt-2 flex items-center gap-3 text-3xl font-black">
          <ChefHat className="size-8" /> Cozinha (KDS)
        </h1>
        <p className="mt-2 text-sm text-[#765665]">
          Fila ativa em tempo real, ordenada pela chegada.
        </p>
      </div>
      {error && (
        <p
          role="alert"
          className="mt-5 rounded-xl bg-[#f8e9ef] p-3 text-sm text-[#c13a43]"
        >
          {error}
        </p>
      )}
      <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {orders.map((order) => {
          const nextStatus = ORDER_TRANSITIONS[order.status].find((status) =>
            ['CONFIRMED', 'PREPARING', 'READY'].includes(status),
          );
          return (
            <article
              key={order.id}
              className="rounded-[26px] bg-[#180e16] p-5 text-white shadow-lg"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <strong className="text-2xl">{order.orderNumber}</strong>
                  <p className="mt-1 text-sm text-white/60">
                    {order.customer.name}
                  </p>
                </div>
                <span className="rounded-full bg-[#c13a43] px-3 py-1 text-xs font-black">
                  {labels[order.status]}
                </span>
              </div>
              <p className="mt-4 text-xs text-[#d9b66f]">
                {order.createdAt?.toDate().toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                }) || 'agora'}
              </p>
              <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
                {order.items.map((item, index) => (
                  <div key={index}>
                    <div className="flex justify-between gap-3">
                      <strong>
                        {item.quantity}x {item.productName}
                      </strong>
                      <span className="text-sm text-white/60">
                        {item.sizeLabel}
                      </span>
                    </div>
                    {item.modifierSelections
                      .filter((group) => group.items.length)
                      .map((group) => (
                        <p
                          key={group.groupName}
                          className="mt-1 text-xs text-white/60"
                        >
                          <b>{group.groupName}:</b>{' '}
                          {group.items
                            .map(
                              (entry) =>
                                `${entry.quantity > 1 ? `${entry.quantity}x ` : ''}${entry.name}`,
                            )
                            .join(', ')}
                        </p>
                      ))}
                    {item.notes && (
                      <p className="mt-1 text-xs italic text-[#d9b66f]">
                        {item.notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
              {nextStatus && (
                <button
                  disabled={Boolean(busy)}
                  onClick={() => void advance(order, nextStatus)}
                  className="mt-5 flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-[#d9b66f] font-black text-[#180e16]"
                >
                  {busy === order.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Check className="size-4" />
                  )}{' '}
                  {nextStatus === 'CONFIRMED'
                    ? 'Aceitar pedido'
                    : nextStatus === 'PREPARING'
                      ? 'Iniciar preparo'
                      : 'Marcar pronto'}
                </button>
              )}
            </article>
          );
        })}
        {!orders.length && (
          <div className="rounded-[26px] border border-dashed border-[#180e16]/20 p-10 text-center text-sm text-[#765665] md:col-span-2 xl:col-span-3">
            <ChefHat className="mx-auto size-8" />
            <p className="mt-3">A fila da cozinha está vazia.</p>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
