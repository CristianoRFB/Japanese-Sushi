'use client';

import {
  Check,
  ChefHat,
  Clock3,
  MessageCircle,
  PackageCheck,
  RefreshCw,
} from 'lucide-react';
import {
  arrayUnion,
  collection,
  doc,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { PublicHeader } from '@/components/public-header';
import { Button } from '@/components/ui/button';
import { useCatalog } from '@/components/providers';
import {
  ensureAnonymousUser,
  getFirebaseClient,
  hasFirebaseConfig,
} from '@/lib/firebase/client';
import { formatBRL, type CustomerOrderApproval, type OrderStatus, type PricedItem } from '@/shared/domain';

interface PublicOrder {
  id: string;
  message?: string;
  orderNumber: string;
  createdAt?: string;
  items: PricedItem[];
  pricing: { totalCents: number };
  fulfillment: { mode: 'PICKUP' | 'DELIVERY' };
  status: OrderStatus;
  customerApproval?: CustomerOrderApproval;
  proposedChanges?: {
    state: 'PENDING' | 'ACCEPTED' | 'DECLINED';
    items: PricedItem[];
    pricing: { subtotalCents: number; deliveryFeeCents: number; totalCents: number };
    reason?: string;
  };
  updatedAt?: string;
}
const steps: Array<{
  statuses: OrderStatus[];
  label: string;
  icon: typeof Clock3;
}> = [
  { statuses: ['NEW'], label: 'Recebido', icon: Check },
  { statuses: ['CONFIRMED'], label: 'Confirmado', icon: Clock3 },
  { statuses: ['PREPARING'], label: 'Em preparo', icon: ChefHat },
  {
    statuses: ['READY', 'OUT_FOR_DELIVERY'],
    label: 'Pronto',
    icon: PackageCheck,
  },
  { statuses: ['COMPLETED'], label: 'Concluído', icon: Check },
];
function itemTotal(item: PricedItem) {
  return Number.isFinite(item.totalPriceCents)
    ? item.totalPriceCents
    : (item.unitPriceCents ?? 0) * item.quantity;
}

export default function OrderPage() {
  const { publicCode } = useParams<{ publicCode: string }>();
  const search = useSearchParams();
  const { config } = useCatalog();
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadToken, setReloadToken] = useState(0);
  const [decisionBusy, setDecisionBusy] = useState(false);
  const [decisionError, setDecisionError] = useState('');
  const [decisionMessage, setDecisionMessage] = useState('');
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!hasFirebaseConfig) {
      setError('Firebase não configurado.');
      setLoading(false);
      return;
    }
    let active = true;
    let stop = () => {};
    void (async () => {
      try {
        const { db } = getFirebaseClient();
        const user = await ensureAnonymousUser();
        if (!active) return;
        stop = onSnapshot(
          query(
            collection(db, 'orders'),
            where('ownerUid', '==', user.uid),
            where('publicCode', '==', publicCode),
            limit(1),
          ),
          (snapshot) => {
            const item = snapshot.docs[0];
            setOrder(item ? ({ id: item.id, ...item.data() } as PublicOrder) : null);
            setError(
              item
                ? ''
                : 'Pedido não encontrado ou temporariamente indisponível.',
            );
            setLoading(false);
          },
          () => {
            setError('Pedido não encontrado ou temporariamente indisponível.');
            setLoading(false);
          },
        );
      } catch {
        setError('Pedido não encontrado ou temporariamente indisponível.');
        setLoading(false);
      }
    })();
    return () => {
      active = false;
      stop();
    };
  }, [publicCode, reloadToken]);
  function load() {
    setLoading(true);
    setReloadToken((value) => value + 1);
  }
  async function decideOnChanges(accept: boolean) {
    if (!order?.proposedChanges || order.customerApproval !== 'PENDING') return;
    setDecisionBusy(true);
    setDecisionError('');
    setDecisionMessage('');
    try {
      const { db } = getFirebaseClient();
      const proposal = order.proposedChanges;
      await updateDoc(doc(db, 'orders', order.id), {
        ...(accept ? { items: proposal.items, pricing: proposal.pricing } : {}),
        customerApproval: accept ? 'ACCEPTED' : 'DECLINED',
        proposedChanges: { ...proposal, state: accept ? 'ACCEPTED' : 'DECLINED', decidedAt: Timestamp.now() },
        updatedAt: serverTimestamp(),
        statusHistory: arrayUnion({
          status: accept ? order.status : 'CANCELLED',
          kind: accept ? 'CUSTOMER_ACCEPTED_EDIT' : 'CUSTOMER_DECLINED_EDIT',
          at: Timestamp.now(),
          actor: 'customer',
        }),
        ...(accept ? {} : { status: 'CANCELLED', cancelledAt: serverTimestamp(), cancellationReason: 'Cliente não aprovou as alterações.' }),
      });
      setDecisionMessage(accept ? 'Alterações aceitas. A unidade já pode continuar o preparo.' : 'Alterações recusadas. O pedido foi encerrado para evitar divergência.');
    } catch (cause) {
      setDecisionError(cause instanceof Error ? cause.message : 'Não foi possível registrar sua decisão.');
    } finally {
      setDecisionBusy(false);
    }
  }
  async function copyCode() {
    try {
      await navigator.clipboard.writeText(publicCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setDecisionError('Selecione e guarde o código exibido acima para consultar o pedido.');
    }
  }
  function whatsappUrl() {
    if (!order || !config.whatsappNumber) return '#';
    const summary = order.items
      .map(
        (item) => `${item.quantity}x ${item.productName} (${item.sizeLabel})`,
      )
      .join('\n');
    const message = `Olá! Pedido ${order.orderNumber}\n${summary}\nTotal: ${formatBRL(order.pricing.totalCents)}\n${order.fulfillment.mode === 'PICKUP' ? 'Retirada' : 'Delivery'}`;
    return `https://wa.me/${config.whatsappNumber.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
  }
  if (loading)
    return (
      <main className="grid min-h-screen place-items-center bg-[#f3f0e8]">
        <RefreshCw className="size-6 animate-spin text-[#b5232b]" />
      </main>
    );
  if (!order)
    return (
      <main className="min-h-screen bg-[#f3f0e8]">
        <PublicHeader />
        <div className="mx-auto max-w-lg px-6 py-24 text-center">
          <h1 className="teiko-display text-3xl">Não encontramos esse pedido</h1>
          <p className="mt-2 text-sm text-[#7b887d]">{error}</p>
          <Button
            className="mt-6 rounded-full bg-[#b5232b] text-white"
            onClick={load}
          >
            Tentar novamente
          </Button>
        </div>
      </main>
    );
  const activeIndex = steps.findIndex((step) =>
    step.statuses.includes(order.status),
  );
  return (
    <main className="min-h-screen bg-[#f3f0e8] text-[#070a08]">
      <PublicHeader />
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <div className="rounded-[32px] bg-[#070a08] p-6 text-white sm:p-9">
          {search.get('novo') === '1' && (
            <span className="inline-flex items-center gap-2 rounded-full bg-[#d6e7bf] px-3 py-1.5 text-xs font-black text-[#070a08]">
              <Check className="size-3.5" /> Pedido salvo
            </span>
          )}
          <p className="mt-5 text-sm text-white/60">Acompanhe seu pedido</p>
          <h1 className="teiko-display mt-1 text-4xl tracking-[-.05em]">
            {order.orderNumber}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-white/65">
            {order.message ??
              'Pedido recebido pela loja. Acompanhe a atualização nesta página.'}
          </p>
          <div className="mt-8 grid grid-cols-5 gap-1">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const done = activeIndex >= index && order.status !== 'CANCELLED';
              return (
                <div key={step.label} className="text-center">
                  <span
                    className={`mx-auto grid size-9 place-items-center rounded-full ${done ? 'bg-[#d6e7bf] text-[#070a08]' : 'bg-white/10 text-white/35'}`}
                  >
                    <Icon className="size-4" />
                  </span>
                  <span
                    className={`mt-2 block text-[10px] font-bold ${done ? 'text-white' : 'text-white/35'}`}
                  >
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
          {order.status === 'CANCELLED' && (
            <div className="mt-6 rounded-2xl bg-[#e3262e]/15 p-4 text-sm font-bold text-[#ffe1e1]">
              Este pedido foi cancelado. Entre em contato com a loja se precisar
              de ajuda.
            </div>
          )}
        </div>
        <section className="mt-5 rounded-[24px] border border-[#c7a773]/40 bg-[#f3f0e8] p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[.16em] text-[#b5232b]">Guarde para consultar</p>
              <h2 className="mt-1 text-lg font-black">Código do pedido</h2>
              <p className="mt-1 text-sm text-[#7b887d]">Use este código sempre que quiser acompanhar este pedido.</p>
            </div>
            <Button type="button" variant="outline" onClick={() => void copyCode()} className="rounded-full border-[#b5232b]/20 text-[#b5232b]">{copied ? 'Copiado' : 'Copiar código'}</Button>
          </div>
          <code className="mt-4 block overflow-x-auto rounded-xl bg-[#070a08] px-4 py-3 text-center text-sm font-black tracking-[.12em] text-[#d6e7bf]">{publicCode}</code>
        </section>
        {order.customerApproval === 'PENDING' && order.proposedChanges && (
          <section className="mt-5 rounded-[28px] border-2 border-[#c7a773] bg-[#e8efe5] p-5 sm:p-6">
            <p className="text-xs font-black uppercase tracking-[.16em] text-[#b5232b]">Atenção necessária</p>
            <h2 className="teiko-display mt-2 text-2xl">A unidade propôs uma alteração</h2>
            <p className="mt-2 text-sm leading-relaxed text-[#7b887d]">Confira a nova composição abaixo. O pedido só segue depois que você decidir.</p>
            {order.proposedChanges.reason && <p className="mt-3 rounded-xl bg-white/70 p-3 text-sm font-bold text-[#070a08]">{order.proposedChanges.reason}</p>}
            <div className="mt-4 space-y-2 rounded-2xl bg-white p-4">
              {order.proposedChanges.items.map((item, index) => <div key={`${item.productId}-${index}`} className="flex items-center justify-between gap-3 border-b border-[#b5232b]/10 py-2 last:border-0"><span className="text-sm font-bold">{item.quantity}x {item.productName}</span><strong className="text-sm text-[#b5232b]">{formatBRL(item.totalPriceCents)}</strong></div>)}
              <div className="flex justify-between border-t border-[#b5232b]/15 pt-3"><span className="text-sm font-bold">Novo total</span><strong className="text-lg text-[#b5232b]">{formatBRL(order.proposedChanges.pricing.totalCents)}</strong></div>
            </div>
            {(decisionError || decisionMessage) && <p role="alert" className="mt-4 rounded-xl bg-white p-3 text-sm font-bold text-[#b5232b]">{decisionError || decisionMessage}</p>}
            {!decisionMessage && <div className="mt-4 grid gap-2 sm:grid-cols-2"><Button type="button" disabled={decisionBusy} onClick={() => void decideOnChanges(true)} className="h-12 rounded-full bg-[#b5232b] font-black text-white">{decisionBusy ? 'Salvando…' : 'Aceitar alterações'}</Button><Button type="button" disabled={decisionBusy} onClick={() => void decideOnChanges(false)} variant="outline" className="h-12 rounded-full border-[#b5232b]/30 font-black text-[#b5232b]">Recusar e encerrar pedido</Button></div>}
          </section>
        )}
        <section className="mt-6 rounded-[28px] bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black">Resumo</h2>
            <strong className="text-xl font-black text-[#b5232b]">
              {formatBRL(order.pricing.totalCents)}
            </strong>
          </div>
          <div className="mt-5 space-y-4">
            {order.items.map((item, index) => (
              <div
                key={index}
                className="border-t border-[#b5232b]/8 pt-4 first:border-0 first:pt-0"
              >
                <div className="flex justify-between gap-3">
                  <strong>
                    {item.quantity}x {item.productName}
                  </strong>
                  <span className="text-sm font-bold">
                    {formatBRL(itemTotal(item))}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[#7b887d]">{item.sizeLabel}</p>
                {(item.modifierSelections ?? [])
                  .filter((group) => group.items.length)
                  .map((group) => (
                    <p
                      key={group.groupId}
                      className="mt-1 text-xs text-[#7b887d]"
                    >
                      {group.groupName}:{' '}
                      {group.items
                        .map(
                          (selected) =>
                            `${selected.quantity > 1 ? `${selected.quantity}x ` : ''}${selected.name}`,
                        )
                        .join(', ')}
                    </p>
                  ))}
              </div>
            ))}
          </div>
        </section>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button
            variant="outline"
            className="h-12 flex-1 rounded-full"
            onClick={load}
          >
            <RefreshCw /> Atualizar status
          </Button>
          {config.whatsappEnabled && config.whatsappNumber && (
            <Button
              className="h-12 flex-1 rounded-full bg-[#3a5b35] text-white hover:bg-[#3a5b35]"
              nativeButton={false}
              render={
                <a href={whatsappUrl()} target="_blank" rel="noreferrer" />
              }
            >
              <MessageCircle /> Abrir WhatsApp
            </Button>
          )}
        </div>
        <p className="mt-5 text-center text-xs text-[#7b887d]">
          Guarde este link para acompanhar o pedido. O código não permite listar
          outros pedidos.
        </p>
      </div>
    </main>
  );
}
