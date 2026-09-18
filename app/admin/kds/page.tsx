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
import { Check, ChefHat, Clock3, Loader2, PauseCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { AdminShell } from '@/components/admin-shell';
import { useAuth } from '@/components/providers';
import { getFirebaseClient } from '@/lib/firebase/client';
import {
  ORDER_TRANSITIONS,
  TEIKO_BRAND_ID,
  type OrderStatus,
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
  fulfillment: { mode: 'PICKUP' | 'DELIVERY' };
  status: OrderStatus;
  customerApproval?: 'NONE' | 'PENDING' | 'ACCEPTED' | 'DECLINED';
}

const lanes: Array<{
  status: Extract<OrderStatus, 'NEW' | 'CONFIRMED' | 'PREPARING' | 'READY'>;
  label: string;
  hint: string;
  tone: string;
}> = [
  { status: 'NEW', label: 'Entrada', hint: 'Aceite e confira', tone: 'bg-[#fbe7c6] text-[#8b1e2b]' },
  { status: 'CONFIRMED', label: 'Confirmados', hint: 'Aguardando produção', tone: 'bg-[#e8efe5] text-[#3a5b35]' },
  { status: 'PREPARING', label: 'Em preparo', hint: 'Produção em andamento', tone: 'bg-[#d6e7bf] text-[#23452b]' },
  { status: 'READY', label: 'Prontos', hint: 'Aguardando retirada ou saída', tone: 'bg-[#c7a773] text-[#070a08]' },
];

const statusLabels: Record<KitchenOrder['status'], string> = {
  NEW: 'Novo',
  CONFIRMED: 'Confirmado',
  PREPARING: 'Em preparo',
  READY: 'Pronto',
  OUT_FOR_DELIVERY: 'Saiu para entrega',
  COMPLETED: 'Concluído',
  CANCELLED: 'Cancelado',
};

export default function KdsPage() {
  const { user, role } = useAuth();
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

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
        (snapshot) => {
          setOrders(
            snapshot.docs.map(
              (item) => ({ id: item.id, ...item.data() }) as KitchenOrder,
            ),
          );
          setLoading(false);
        },
        (cause) => {
          setError(friendlyAdminError(cause));
          setLoading(false);
        },
      ),
    [],
  );

  const counts = useMemo(
    () => lanes.map((lane) => orders.filter((order) => order.status === lane.status).length),
    [orders],
  );

  async function advance(order: KitchenOrder, status: OrderStatus) {
    setBusy(order.id);
    setError('');
    try {
      if (!user || !role) throw new Error('Sessão administrativa indisponível.');
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
      setError(friendlyAdminError(cause));
    } finally {
      setBusy('');
    }
  }

  return (
    <AdminShell>
      <header>
        <p className="text-xs font-black uppercase tracking-[.18em] text-[#e3262e]">Produção</p>
        <div className="mt-2 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <h1 className="flex items-center gap-3 text-3xl font-black tracking-[-.04em]">
              <ChefHat className="size-8" /> Cozinha (KDS)
            </h1>
            <p className="mt-2 text-sm text-[#7b887d]">Acompanhe cada pedido por etapa e avance a produção com uma ação.</p>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {lanes.map((lane, index) => (
              <span key={lane.status} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-black ${lane.tone}`}>
                {lane.label} {counts[index]}
              </span>
            ))}
          </div>
        </div>
      </header>

      {error && <p role="alert" className="mt-5 rounded-xl border border-[#e3262e]/20 bg-[#fff0ef] p-3 text-sm font-bold text-[#b5232b]">{error}</p>}

      <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {lanes.map((lane) => {
          const laneOrders = orders.filter((order) => order.status === lane.status);
          return (
            <section key={lane.status} aria-labelledby={`kds-${lane.status}`} className="min-w-0 overflow-hidden rounded-[22px] border border-[#070a08]/10 bg-[#f3f0e8]">
              <header className="border-b border-[#070a08]/10 bg-white px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 id={`kds-${lane.status}`} className="font-black">{lane.label}</h2>
                    <p className="mt-1 text-xs text-[#7b887d]">{lane.hint}</p>
                  </div>
                  <strong className={`grid size-8 place-items-center rounded-full text-sm ${lane.tone}`}>{laneOrders.length}</strong>
                </div>
              </header>
              <div className="space-y-3 p-3">
                {loading && <><div className="h-44 animate-pulse rounded-2xl bg-white/70" /><div className="h-36 animate-pulse rounded-2xl bg-white/70" /></>}
                {!loading && laneOrders.map((order) => (
                  <KitchenCard key={order.id} order={order} busy={busy === order.id || Boolean(busy)} onAdvance={advance} />
                ))}
                {!loading && !laneOrders.length && <p className="rounded-2xl border border-dashed border-[#070a08]/15 p-5 text-center text-xs leading-relaxed text-[#7b887d]">Nenhum pedido nesta etapa.</p>}
              </div>
            </section>
          );
        })}
      </div>
    </AdminShell>
  );
}

function KitchenCard({
  order,
  busy,
  onAdvance,
}: {
  order: KitchenOrder;
  busy: boolean;
  onAdvance: (order: KitchenOrder, status: OrderStatus) => Promise<void>;
}) {
  const nextStatus = order.status === 'READY' && order.fulfillment.mode === 'DELIVERY'
    ? 'OUT_FOR_DELIVERY'
    : ORDER_TRANSITIONS[order.status].find((status) => ['CONFIRMED', 'PREPARING', 'READY'].includes(status));
  const waitingCustomer = order.customerApproval === 'PENDING';
  return (
    <article className="rounded-2xl border border-[#070a08]/10 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <a href={`/admin/pedidos/${order.id}`} className="block text-lg font-black text-[#070a08] hover:text-[#b5232b]">{order.orderNumber}</a>
          <p className="mt-1 truncate text-xs text-[#7b887d]">{order.customer?.name || 'Cliente'}</p>
        </div>
        <span className="flex shrink-0 items-center gap-1 text-[11px] font-bold text-[#7b887d]">
          <Clock3 className="size-3.5" /> {order.createdAt?.toDate().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) || 'agora'}
        </span>
      </div>
      <div className="mt-4 space-y-3 border-t border-[#070a08]/10 pt-3">
        {order.items.map((item, index) => (
          <div key={`${item.productName}-${index}`}>
            <div className="flex justify-between gap-3 text-sm">
              <strong>{item.quantity}x {item.productName}</strong>
              <span className="shrink-0 text-xs text-[#7b887d]">{item.sizeLabel}</span>
            </div>
            {item.modifierSelections.filter((group) => group.items.length).map((group) => (
              <p key={group.groupName} className="mt-1 text-xs leading-relaxed text-[#7b887d]"><b className="text-[#070a08]">{group.groupName}:</b> {group.items.map((entry) => `${entry.quantity > 1 ? `${entry.quantity}x ` : ''}${entry.name}`).join(', ')}</p>
            ))}
            {item.notes && <p className="mt-2 rounded-lg bg-[#f3f0e8] p-2 text-xs italic text-[#8b1e2b]">{item.notes}</p>}
          </div>
        ))}
      </div>
      {waitingCustomer ? (
        <div className="mt-4 flex items-start gap-2 rounded-xl bg-[#f3f0e8] p-3 text-xs font-bold text-[#8b1e2b]"><PauseCircle className="mt-0.5 size-4 shrink-0" /> Aguardando aprovação do cliente para continuar.</div>
      ) : nextStatus ? (
        <button type="button" disabled={busy} onClick={() => void onAdvance(order, nextStatus)} className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-[#070a08] font-black text-white transition hover:bg-[#b5232b] disabled:opacity-50">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          {nextStatus === 'CONFIRMED' ? 'Aceitar pedido' : nextStatus === 'PREPARING' ? 'Iniciar preparo' : nextStatus === 'READY' ? 'Marcar pronto' : 'Despachar para entrega'}
        </button>
      ) : (
        <p className="mt-4 rounded-xl bg-[#d6e7bf]/45 p-3 text-center text-xs font-black text-[#23452b]">Pronto para retirada ou saída.</p>
      )}
      <span className="sr-only">Status atual: {statusLabels[order.status]}</span>
    </article>
  );
}

function friendlyAdminError(cause: unknown): string {
  const text = cause instanceof Error ? cause.message : '';
  if (/permission-denied|unauthenticated/i.test(text)) return 'Sua sessão não tem permissão para atualizar a cozinha.';
  if (/failed-precondition|index/i.test(text)) return 'A fila não pôde ser organizada agora. Tente atualizar a página.';
  if (/network|offline|unavailable/i.test(text)) return 'A conexão com a unidade caiu. A fila será atualizada quando voltar.';
  return 'Não foi possível atualizar a fila da cozinha agora.';
}
