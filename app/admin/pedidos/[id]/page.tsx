'use client';

import {
  arrayUnion,
  doc,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { ArrowLeft, CheckCircle2, Loader2, Minus, Plus, Save, XCircle } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { useAuth } from '@/components/providers';
import { Button } from '@/components/ui/button';
import { getFirebaseClient } from '@/lib/firebase/client';
import {
  formatBRL,
  ORDER_TRANSITIONS,
  type CustomerOrderApproval,
  type OrderStatus,
  type PricedItem,
} from '@/shared/domain';

interface FullOrder {
  id: string;
  orderNumber: string;
  customer: {
    name: string;
    whatsapp: string;
    address?: Record<string, string>;
  };
  items: PricedItem[];
  fulfillment: { mode: string; deliveryFeePending?: boolean };
  payment: { method: string; changeForCents?: number };
  pricing: {
    subtotalCents: number;
    deliveryFeeCents: number;
    totalCents: number;
  };
  status: OrderStatus;
  customerApproval?: CustomerOrderApproval;
  proposedChanges?: {
    state: 'PENDING' | 'ACCEPTED' | 'DECLINED';
    items: PricedItem[];
    pricing: FullOrder['pricing'];
    reason?: string;
  };
  editReason?: string;
  notes?: string;
  statusHistory: Array<{ status: OrderStatus; at: Timestamp; reason?: string }>;
}
const labels: Record<OrderStatus, string> = {
  NEW: 'Novo',
  CONFIRMED: 'Confirmado',
  PREPARING: 'Em preparo',
  READY: 'Pronto',
  OUT_FOR_DELIVERY: 'Saiu para entrega',
  COMPLETED: 'Concluído',
  CANCELLED: 'Cancelado',
};
function itemTotal(item: PricedItem) {
  return Number.isFinite(item.totalPriceCents)
    ? item.totalPriceCents
    : (item.unitPriceCents ?? 0) * item.quantity;
}
export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, role } = useAuth();
  const [order, setOrder] = useState<FullOrder | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [draftItems, setDraftItems] = useState<PricedItem[]>([]);
  const [editReason, setEditReason] = useState('');
  useEffect(
    () =>
      onSnapshot(
        doc(getFirebaseClient().db, 'orders', id),
        (snapshot) =>
          setOrder(
            snapshot.exists()
              ? ({ id: snapshot.id, ...snapshot.data() } as FullOrder)
              : null,
          ),
        (cause) => setError(cause.message),
      ),
    [id],
  );
  async function update(status: OrderStatus) {
    if (!order) return;
    if (order.customerApproval === 'PENDING') {
      setError('Aguarde o cliente responder à alteração antes de avançar o status.');
      return;
    }
    let reason: string | undefined;
    if (status === 'CANCELLED') {
      reason = window.prompt(order.status === 'NEW' ? 'Motivo da recusa:' : 'Motivo do cancelamento:')?.trim();
      if (!reason) return;
    }
    setBusy(true);
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
          ...(reason ? { reason } : {}),
        }),
        ...(status === 'CANCELLED'
          ? { cancelledAt: serverTimestamp(), cancellationReason: reason || '' }
          : {}),
      });
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Não foi possível atualizar.',
      );
    } finally {
      setBusy(false);
    }
  }
  function startEditing() {
    if (!order) return;
    setDraftItems(order.items.map((item) => ({ ...item })));
    setEditReason('');
    setError('');
    setEditing(true);
  }
  function changeQuantity(index: number, delta: number) {
    setDraftItems((items) =>
      items.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              quantity: Math.max(1, Math.min(20, item.quantity + delta)),
              totalPriceCents:
                (item.unitPriceCents ?? 0) * Math.max(1, Math.min(20, item.quantity + delta)),
            }
          : item,
      ),
    );
  }
  async function proposeEdit() {
    if (!order || !user || !role || !draftItems.length) return;
    const items = draftItems.map((item) => ({
      ...item,
      totalPriceCents: (item.unitPriceCents ?? 0) * item.quantity,
    }));
    const subtotalCents = items.reduce((total, item) => total + item.totalPriceCents, 0);
    const pricing = {
      ...order.pricing,
      subtotalCents,
      totalCents: subtotalCents + order.pricing.deliveryFeeCents,
    };
    setBusy(true);
    setError('');
    try {
      await updateDoc(doc(getFirebaseClient().db, 'orders', order.id), {
        customerApproval: 'PENDING',
        proposedChanges: {
          state: 'PENDING',
          items,
          pricing,
          reason: editReason.trim() || 'A unidade propôs uma alteração no pedido.',
          proposedAt: Timestamp.now(),
        },
        editReason: editReason.trim(),
        updatedAt: serverTimestamp(),
        statusHistory: arrayUnion({
          status: order.status,
          kind: 'EDIT_PROPOSED',
          at: Timestamp.now(),
          actorUid: user.uid,
          actorRole: role,
        }),
      });
      setEditing(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível enviar a alteração.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <AdminShell>
      {!order ? (
        <div className="py-20 text-center">{error || 'Carregando pedido…'}</div>
      ) : (
        <>
          <a
            href="/admin/pedidos"
            className="inline-flex items-center gap-2 text-sm font-bold text-[#8c234f]"
          >
            <ArrowLeft className="size-4" /> Voltar
          </a>
          <div className="mt-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-[#b13b6b]">
                Pedido
              </p>
              <h1 className="mt-1 text-4xl font-black tracking-[-.05em]">
                {order.orderNumber}
              </h1>
              <p className="mt-2 text-sm text-[#765665]">
                {order.customer.name} • {order.customer.whatsapp}
              </p>
            </div>
            <span className="w-fit rounded-full bg-[#180e16] px-4 py-2 text-sm font-black text-white">
              {order.customerApproval === 'PENDING'
                ? 'Aguardando cliente'
                : labels[order.status]}
            </span>
          </div>
          {error && (
            <p
              role="alert"
              className="mt-5 rounded-xl bg-[#f8e9ef] p-3 text-sm text-[#c13a43]"
            >
              {error}
            </p>
          )}
          <div className="mt-7 grid gap-5 xl:grid-cols-[1fr_360px]">
            <section className="rounded-[26px] bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-black">Itens</h2>
                {order.status !== 'CANCELLED' && order.status !== 'COMPLETED' && order.customerApproval !== 'PENDING' && (
                  <Button type="button" variant="outline" onClick={startEditing} className="rounded-full text-xs">
                    Editar pedido
                  </Button>
                )}
              </div>
              {order.customerApproval === 'PENDING' && (
                <div className="mt-4 rounded-2xl border border-[#d9b66f]/40 bg-[#fff7ea] p-4 text-sm text-[#180e16]">
                  <strong>Alteração aguardando o cliente</strong>
                  <p className="mt-1 text-[#765665]">O preparo fica pausado até o cliente aceitar ou recusar a nova composição.</p>
                  {order.proposedChanges?.reason && <p className="mt-2 font-bold text-[#8c234f]">Motivo: {order.proposedChanges.reason}</p>}
                </div>
              )}
              <div className="mt-5 divide-y divide-[#8c234f]/8">
                {order.items.map((item, index) => (
                  <div key={index} className="py-5 first:pt-0">
                    <div className="flex justify-between gap-3">
                      {item.imageUrl ? <img src={item.imageUrl} alt="" className="size-14 rounded-xl object-cover" /> : null}
                      <strong className="flex-1">
                        {item.quantity}x {item.productName}
                      </strong>
                      <strong>{formatBRL(itemTotal(item))}</strong>
                    </div>
                    <p className="mt-1 text-sm text-[#8c234f]">
                      {item.sizeLabel}
                    </p>
                    {(item.modifierSelections ?? [])
                      .filter((group) => group.items.length)
                      .map((group) => (
                        <p
                          key={group.groupId}
                          className="mt-1 text-xs text-[#765665]"
                        >
                          <b>{group.groupName}:</b>{' '}
                          {group.items
                            .map((item) => `${item.quantity}x ${item.name}`)
                            .join(', ')}
                        </p>
                      ))}
                    {item.notes && (
                      <p className="mt-2 rounded-lg bg-[#fff7ea] p-2 text-xs text-[#765665]">
                        {item.notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
              {order.notes && (
                <div className="mt-5 rounded-xl bg-[#fff7ea] p-3 text-sm text-[#765665]">
                  <strong>Observação:</strong> {order.notes}
                </div>
              )}
              {editing && (
                <div className="mt-6 rounded-2xl border border-[#8c234f]/15 bg-[#f8e9ef] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-black">Propor alteração ao cliente</h3>
                      <p className="mt-1 text-xs text-[#765665]">A alteração só vale depois da aprovação do cliente.</p>
                    </div>
                    <button type="button" onClick={() => setEditing(false)} className="text-xs font-black text-[#8c234f]">Fechar</button>
                  </div>
                  <div className="mt-4 space-y-3">
                    {draftItems.map((item, index) => (
                      <div key={`${item.productId}-${index}`} className="flex items-center justify-between gap-3 rounded-xl bg-white p-3">
                        <div className="min-w-0"><strong className="block truncate text-sm">{item.productName}</strong><span className="text-xs text-[#765665]">{formatBRL(item.unitPriceCents ?? 0)} por unidade</span></div>
                        <div className="flex items-center gap-2 rounded-full border border-[#8c234f]/15 p-1"><button type="button" aria-label={`Diminuir ${item.productName}`} onClick={() => changeQuantity(index, -1)} className="grid size-7 place-items-center rounded-full"><Minus className="size-3" /></button><span className="w-5 text-center text-sm font-black">{item.quantity}</span><button type="button" aria-label={`Aumentar ${item.productName}`} onClick={() => changeQuantity(index, 1)} className="grid size-7 place-items-center rounded-full bg-[#180e16] text-white"><Plus className="size-3" /></button></div>
                      </div>
                    ))}
                  </div>
                  <label className="mt-4 block text-sm font-bold">Explique a alteração
                    <textarea value={editReason} onChange={(event) => setEditReason(event.target.value)} maxLength={300} className="mt-2 min-h-20 w-full rounded-xl border border-[#8c234f]/15 bg-white p-3 text-sm font-normal outline-none focus:border-[#8c234f]" placeholder="Ex.: substituição solicitada pela unidade" />
                  </label>
                  <Button type="button" disabled={busy} onClick={() => void proposeEdit()} className="mt-4 h-11 w-full rounded-full bg-[#8c234f] font-black text-white"><Save /> Enviar para aprovação</Button>
                </div>
              )}
            </section>
            <aside className="space-y-5">
              <section className="rounded-[26px] bg-[#180e16] p-5 text-white">
                <h2 className="text-lg font-black">Atualizar status</h2>
                <div className="mt-4 grid gap-2">
                  {ORDER_TRANSITIONS[order.status]
                    .filter((status) => status !== 'CANCELLED')
                    .map((status) => (
                      <Button
                        key={status}
                        disabled={busy}
                        onClick={() => update(status)}
                        className="h-11 justify-start rounded-xl bg-[#d9ed55] px-4 font-black text-[#180e16] hover:bg-[#d9ed55]"
                      >
                        {busy ? (
                          <Loader2 className="animate-spin" />
                        ) : (
                          <CheckCircle2 />
                        )}{' '}
                        Marcar: {labels[status]}
                      </Button>
                    ))}
                  {ORDER_TRANSITIONS[order.status].includes('CANCELLED') && (
                    <Button
                      disabled={busy}
                      onClick={() => update('CANCELLED')}
                      className="h-11 justify-start rounded-xl bg-[#f8e9ef]0/15 px-4 text-[#ffe1e1] hover:bg-[#f8e9ef]0/25"
                    >
                      <XCircle /> {order.status === 'NEW' ? 'Recusar pedido' : 'Cancelar pedido'}
                    </Button>
                  )}
                  {!ORDER_TRANSITIONS[order.status].length && (
                    <p className="text-sm text-white/55">Fluxo encerrado.</p>
                  )}
                </div>
              </section>
              <section className="rounded-[26px] bg-white p-5 shadow-sm">
                <h2 className="text-lg font-black">Entrega e pagamento</h2>
                <dl className="mt-4 space-y-3 text-sm">
                  <div>
                    <dt className="text-xs text-[#765665]">Recebimento</dt>
                    <dd className="font-bold">
                      {order.fulfillment.mode === 'PICKUP'
                        ? 'Retirada'
                        : 'Delivery'}
                    </dd>
                  </div>
                  {order.customer.address && (
                    <div>
                      <dt className="text-xs text-[#765665]">Endereço</dt>
                      <dd className="font-bold">
                        {order.customer.address.street},{' '}
                        {order.customer.address.number}
                        <br />
                        {order.customer.address.neighborhood}
                        {order.customer.address.reference
                          ? ` • ${order.customer.address.reference}`
                          : ''}
                      </dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-xs text-[#765665]">
                      Pagamento informado
                    </dt>
                    <dd className="font-bold">
                      {order.payment.method}
                      {order.payment.changeForCents
                        ? ` • troco para ${formatBRL(order.payment.changeForCents)}`
                        : ''}
                    </dd>
                  </div>
                </dl>
                <div className="mt-5 border-t pt-4">
                  <div className="flex justify-between text-sm">
                    <span>Total</span>
                    <strong className="text-xl text-[#8c234f]">
                      {formatBRL(order.pricing.totalCents)}
                    </strong>
                  </div>
                </div>
              </section>
            </aside>
          </div>
        </>
      )}
    </AdminShell>
  );
}
