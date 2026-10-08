'use client';

import { collection, limit, onSnapshot, query, where } from 'firebase/firestore';
import { Bike, Check, Clock3, Loader2, MapPin, PackageCheck, RefreshCw, ShieldCheck } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { AdminShell } from '@/components/admin-shell';
import { useAuth } from '@/components/providers';
import { Button } from '@/components/ui/button';
import { cancelDelivery, assignReadyOrder, reviewDeliveryReceipt } from '@/lib/delivery-operations';
import { getFirebaseClient } from '@/lib/firebase/client';
import { TEIKO_BRAND_ID, type OrderStatus } from '@/shared/domain';
import { deliveryStatusLabels, type DeliveryDriver, type DeliveryRecord, type DeliveryReceiptRequest } from '@/shared/delivery';

interface ReadyOrder {
  id: string;
  orderNumber: string;
  customer: { name: string; address?: DeliveryRecord['address'] };
  fulfillment: { mode: 'PICKUP' | 'DELIVERY' };
  pricing: { totalCents: number };
  payment: { method: 'PIX' | 'CARD' | 'CASH' };
  status: OrderStatus;
  customerApproval?: string;
  createdAt?: { toDate?: () => Date };
}

export default function DeliveriesPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<ReadyOrder[]>([]);
  const [drivers, setDrivers] = useState<DeliveryDriver[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryRecord[]>([]);
  const [receipts, setReceipts] = useState<DeliveryReceiptRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    let db: ReturnType<typeof getFirebaseClient>['db'];
    try { db = getFirebaseClient().db; }
    catch { setError('Firebase da Teiko não está configurado neste ambiente.'); setLoading(false); return; }
    let loaded = 0;
    const settle = () => { loaded += 1; if (loaded >= 4) setLoading(false); };
    const stops = [
      onSnapshot(query(collection(db, 'orders'), where('brandId', '==', TEIKO_BRAND_ID), where('status', 'in', ['READY', 'OUT_FOR_DELIVERY']), limit(100)), (snap) => {
        setOrders(snap.docs.map((item) => ({ id: item.id, ...item.data() }) as ReadyOrder)); settle();
      }, () => { setError('Não foi possível carregar pedidos prontos. Atualize a página e tente novamente.'); settle(); }),
      onSnapshot(query(collection(db, 'deliveryDrivers'), where('brandId', '==', TEIKO_BRAND_ID), limit(100)), (snap) => {
        setDrivers(snap.docs.map((item) => ({ id: item.id, ...item.data() }) as DeliveryDriver)); settle();
      }, () => { setError('Não foi possível consultar a equipe de entrega.'); settle(); }),
      onSnapshot(query(collection(db, 'deliveries'), where('brandId', '==', TEIKO_BRAND_ID), limit(200)), (snap) => {
        setDeliveries(snap.docs.map((item) => ({ id: item.id, ...item.data() }) as DeliveryRecord)); settle();
      }, () => { setError('Não foi possível carregar as corridas.'); settle(); }),
      onSnapshot(query(collection(db, 'deliveryReceiptRequests'), where('brandId', '==', TEIKO_BRAND_ID), where('status', '==', 'PENDING'), limit(100)), (snap) => {
        setReceipts(snap.docs.map((item) => ({ id: item.id, ...item.data() }) as DeliveryReceiptRequest)); settle();
      }, () => { setError('Não foi possível consultar os códigos aguardando conferência.'); settle(); }),
    ];
    return () => stops.forEach((stop) => stop());
  }, []);

  const eligibleOrders = useMemo(() => orders.filter((order) => {
    const previousAttempt = deliveries.find((delivery) => delivery.orderId === order.id);
    const canDispatch = order.status === 'READY'
      || (order.status === 'OUT_FOR_DELIVERY' && previousAttempt?.status === 'DELIVERY_FAILED');
    return canDispatch && order.fulfillment?.mode === 'DELIVERY' && order.customerApproval !== 'PENDING';
  }), [deliveries, orders]);
  const activeDeliveries = deliveries.filter((delivery) => !['DELIVERED', 'CANCELLED'].includes(delivery.status)).sort((a, b) => timestampSeconds(b.updatedAt) - timestampSeconds(a.updatedAt));
  const historyDeliveries = deliveries.filter((delivery) => ['DELIVERED', 'CANCELLED', 'DELIVERY_FAILED'].includes(delivery.status)).sort((a, b) => timestampSeconds(b.updatedAt) - timestampSeconds(a.updatedAt));
  const assignmentCount = eligibleOrders.filter((order) => !activeDeliveries.some((delivery) => delivery.orderId === order.id && !['READY_FOR_DELIVERY', 'DELIVERY_FAILED'].includes(delivery.status))).length;
  const availableDrivers = drivers.filter((driver) => driver.enabled && driver.status === 'AVAILABLE' && !driver.currentDeliveryId);

  async function assign(orderId: string, driverId: string) {
    if (!driverId) { setError('Escolha um motoboy disponível antes de atribuir.'); return; }
    setBusy(orderId); setError(''); setNotice('');
    try {
      if (!user) throw new Error('Entre novamente com uma conta Teiko autorizada.');
      await assignReadyOrder({ orderId, driverId, actorUid: user.uid });
      setNotice('Corrida atribuída. O motoboy receberá a solicitação no portal.');
    } catch (cause) { setError(friendlyError(cause, 'Não foi possível atribuir a corrida. Confira o pedido e a disponibilidade do motoboy.')); }
    finally { setBusy(''); }
  }

  async function cancel(delivery: DeliveryRecord, reason: string) {
    if (!user) return;
    setBusy(delivery.id); setError(''); setNotice('');
    try {
      await cancelDelivery({ delivery, actorUid: user.uid, reason });
      setNotice(`Corrida ${delivery.orderNumber} cancelada e liberada da fila.`);
    } catch (cause) { setError(friendlyError(cause, 'Não foi possível cancelar a corrida. Atualize os dados antes de tentar novamente.')); }
    finally { setBusy(''); }
  }

  async function verify(receipt: DeliveryReceiptRequest, paymentConfirmed: boolean) {
    if (!user) return;
    setBusy(receipt.id); setError(''); setNotice('');
    try {
      const result = await reviewDeliveryReceipt({ deliveryId: receipt.deliveryId, actorUid: user.uid, paymentConfirmed });
      if (!result.verified) setError('O código informado não confere. Avise o motoboy para conferir com o cliente e enviar novamente.');
      else setNotice('Código e recebimento conferidos. Pedido concluído, financeiro atualizado e motoboy liberado.');
    } catch (cause) { setError(friendlyError(cause, 'Não foi possível finalizar esta entrega. Confira o código, o pagamento e o caixa aberto.')); }
    finally { setBusy(''); }
  }

  return <AdminShell adminOnly>
    <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div><p className="text-xs font-black uppercase tracking-[.18em] text-[#b5232b]">Expedição e última milha</p><h1 className="teiko-display mt-2 text-4xl tracking-[-.04em]">Central de entregas</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#66716a]">Atribua pedidos prontos, acompanhe cada etapa e só conclua depois da conferência do código e do pagamento.</p></div>
      <span className="inline-flex w-fit items-center gap-2 rounded-full bg-[#0b100e] px-4 py-2 text-sm font-black text-white"><Bike className="size-4 text-[#c7a773]" /> {assignmentCount} aguardando · {availableDrivers.length} disponíveis</span>
    </header>
    {(error || notice) && <p role={error ? 'alert' : 'status'} className={`mt-5 rounded-2xl border p-4 text-sm font-bold ${error ? 'border-[#b5232b]/20 bg-[#fff0ef] text-[#9d1723]' : 'border-[#2d7c4b]/20 bg-[#e7f1df] text-[#27523a]'}`}>{error || notice}</p>}
    {loading ? <div className="mt-8 grid gap-3 md:grid-cols-2"><div className="h-52 animate-pulse rounded-[26px] bg-white" /><div className="h-52 animate-pulse rounded-[26px] bg-white" /></div> : <>
      <section className="mt-7">
        <PanelHeading icon={<PackageCheck />} eyebrow="Fila da cozinha" title="Prontos para delivery" count={eligibleOrders.length} />
        <div className="mt-4 grid gap-3 xl:grid-cols-2">{eligibleOrders.map((order) => {
          const existing = activeDeliveries.find((delivery) => delivery.orderId === order.id);
          return <AssignCard key={order.id} order={order} existing={existing} drivers={availableDrivers} busy={busy === order.id} onAssign={(driverId) => void assign(order.id, driverId)} />;
        })}{!eligibleOrders.length && <Empty text="Não há pedidos prontos aguardando entrega." />}</div>
      </section>

      <section className="mt-8">
        <PanelHeading icon={<Clock3 />} eyebrow="Acompanhamento" title="Corridas em acompanhamento" count={activeDeliveries.length} />
        <div className="mt-4 grid gap-3 xl:grid-cols-2">{activeDeliveries.map((delivery) => <ActiveDelivery key={delivery.id} delivery={delivery} busy={busy === delivery.id} onCancel={(reason) => void cancel(delivery, reason)} />)}{!activeDeliveries.length && <Empty text="As corridas atribuídas aparecerão aqui em tempo real." />}</div>
      </section>

      <section className="mt-8">
        <PanelHeading icon={<ShieldCheck />} eyebrow="Validação antes de concluir" title="Código e pagamento para conferir" count={receipts.length} />
        <div className="mt-4 grid gap-3 xl:grid-cols-2">{receipts.map((receipt) => <ReceiptCard key={receipt.id} receipt={receipt} delivery={deliveries.find((delivery) => delivery.id === receipt.deliveryId)} busy={busy === receipt.id} onVerify={(confirmed) => void verify(receipt, confirmed)} />)}{!receipts.length && <Empty text="Nenhum cliente aguarda a conferência final neste momento." />}</div>
      </section>

      <section className="mt-8">
        <PanelHeading icon={<Clock3 />} eyebrow="Rastreabilidade" title="Histórico recente" count={historyDeliveries.length} />
        <div className="mt-4 grid gap-3 xl:grid-cols-2">{historyDeliveries.slice(0, 30).map((delivery) => <HistoryDelivery key={delivery.id} delivery={delivery} />)}{!historyDeliveries.length && <Empty text="As corridas concluídas ou falhas aparecerão aqui." />}</div>
      </section>
    </>}
  </AdminShell>;
}

function PanelHeading({ icon, eyebrow, title, count }: { icon: ReactNode; eyebrow: string; title: string; count: number }) {
  return <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-[#0b100e] text-[#c7a773]">{icon}</span><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#b5232b]">{eyebrow}</p><h2 className="mt-0.5 text-xl font-black">{title}</h2></div></div><span className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-[#66716a]">{count}</span></div>;
}

function AssignCard({ order, existing, drivers, busy, onAssign }: { order: ReadyOrder; existing?: DeliveryRecord; drivers: DeliveryDriver[]; busy: boolean; onAssign: (driverId: string) => void }) {
  const [driverId, setDriverId] = useState(drivers[0]?.id ?? '');
  const available = drivers.some((driver) => driver.id === driverId) ? driverId : (drivers[0]?.id ?? '');
  const canAssign = !existing || ['READY_FOR_DELIVERY', 'DELIVERY_FAILED'].includes(existing.status);
  return <article className="rounded-[26px] border border-[#070a08]/8 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><span className="inline-flex rounded-full bg-[#e7f1df] px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[#27523a]">Pedido pronto</span><h3 className="mt-3 text-lg font-black">{order.orderNumber}</h3><p className="mt-1 text-sm text-[#66716a]">{order.customer?.name || 'Cliente'}</p></div><strong className="text-sm">{order.payment?.method === 'CASH' ? 'Dinheiro' : order.payment?.method === 'CARD' ? 'Cartão' : 'Pix'}</strong></div><p className="mt-4 flex items-start gap-2 text-sm leading-6 text-[#66716a]"><MapPin className="mt-1 size-4 shrink-0 text-[#b5232b]" />{order.customer?.address ? `${order.customer.address.street} ${order.customer.address.number}, ${order.customer.address.neighborhood}` : 'Endereço será validado ao atribuir a corrida.'}</p>{existing && <p className="mt-3 text-xs font-bold text-[#9d1723]">Tentativa anterior: {deliveryStatusLabels[existing.status]}{existing.failureReason ? ` · ${existing.failureReason}` : ''}</p>}<div className="mt-5 flex flex-col gap-2 sm:flex-row"><label className="min-w-0 flex-1 text-xs font-black text-[#66716a]">Motoboy disponível<select value={available} onChange={(event) => setDriverId(event.target.value)} disabled={!drivers.length || !canAssign || busy} className="mt-1 h-11 w-full rounded-xl border border-[#070a08]/15 bg-[#faf9f5] px-3 text-sm font-bold text-[#111613] disabled:opacity-50"><option value="">Selecione</option>{drivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.name} · {driver.phone}</option>)}</select></label><Button type="button" disabled={busy || !available || !canAssign} onClick={() => onAssign(available)} className="mt-auto min-h-11 rounded-full bg-[#b5232b] px-5 font-black text-white">{busy ? <Loader2 className="size-4 animate-spin" /> : <Bike className="size-4" />}{existing ? 'Reatribuir' : 'Atribuir corrida'}</Button></div>{!drivers.length && <p className="mt-3 text-xs font-bold text-[#9d1723]">Nenhum motoboy disponível. Confira os acessos em Motoboys.</p>}</article>;
}

function ActiveDelivery({ delivery, busy, onCancel }: { delivery: DeliveryRecord; busy: boolean; onCancel: (reason: string) => void }) {
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');
  return <article className="rounded-[26px] border border-[#070a08]/8 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><h3 className="text-lg font-black">{delivery.orderNumber}</h3><p className="mt-1 text-sm text-[#66716a]">{delivery.customerName} · {delivery.driverName || 'Motoboy'}</p></div><span className="rounded-full bg-[#fff2d8] px-3 py-1.5 text-xs font-black text-[#76510a]">{deliveryStatusLabels[delivery.status]}</span></div><p className="mt-3 text-sm leading-6 text-[#66716a]">{delivery.address.street}, {delivery.address.number} · {delivery.address.neighborhood}{delivery.address.complement ? ` · ${delivery.address.complement}` : ''}</p><div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#070a08]/8 pt-4"><span className="text-xs font-bold text-[#66716a]">{delivery.paymentMethod === 'CASH' ? 'Pagamento em dinheiro' : delivery.paymentMethod === 'CARD' ? 'Pagamento no cartão' : 'Pagamento via Pix'}</span>{cancelOpen ? <form className="flex w-full flex-wrap gap-2" onSubmit={(event) => { event.preventDefault(); onCancel(reason); }}><label className="min-w-[180px] flex-1 text-xs font-bold">Motivo para o registro<input value={reason} onChange={(event) => setReason(event.target.value)} minLength={3} maxLength={200} required className="mt-1 h-10 w-full rounded-xl border px-3 text-sm" placeholder="Ex.: cliente solicitou cancelamento" /></label><Button disabled={busy || reason.trim().length < 3} className="mt-auto min-h-10 rounded-full bg-[#9d1723] text-white">{busy ? <Loader2 className="size-4 animate-spin" /> : null} Confirmar cancelamento</Button><Button type="button" variant="outline" className="mt-auto min-h-10 rounded-full" onClick={() => setCancelOpen(false)}>Voltar</Button></form> : <Button type="button" variant="outline" disabled={busy} onClick={() => setCancelOpen(true)} className="min-h-10 rounded-full border-[#b5232b]/25 text-[#9d1723]">Cancelar corrida</Button>}</div></article>;
}

function ReceiptCard({ receipt, delivery, busy, onVerify }: { receipt: DeliveryReceiptRequest; delivery?: DeliveryRecord; busy: boolean; onVerify: (confirmed: boolean) => void }) {
  const [confirmed, setConfirmed] = useState(false);
  return <article className="rounded-[26px] border border-[#c7a773]/50 bg-[#fffdf7] p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><span className="inline-flex rounded-full bg-[#f3f0e8] px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[#76510a]">Conferência humana necessária</span><h3 className="mt-3 text-lg font-black">{delivery?.orderNumber ?? receipt.orderId}</h3><p className="mt-1 text-sm text-[#66716a]">{delivery?.customerName ?? 'Cliente'} · {delivery?.driverName ?? 'Motoboy'}</p></div><ShieldCheck className="size-6 text-[#b5232b]" /></div><div className="mt-4 rounded-2xl bg-white p-4 text-sm leading-6 text-[#66716a]"><p>Peça ao cliente os quatro números do código de entrega e confirme o valor recebido no comprovante, maquininha ou dinheiro entregue pelo motoboy.</p><p className="mt-2 font-bold text-[#111613]">O código não é exibido para a equipe: o sistema compara o hash e evita registrar tentativas em texto aberto.</p></div><label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-[#070a08]/10 p-3 text-xs font-bold leading-5"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-0.5 size-4 accent-[#b5232b]" />Conferi pessoalmente o código com o cliente e confirmei o recebimento do pagamento.</label><Button type="button" disabled={busy || !confirmed} onClick={() => onVerify(confirmed)} className="mt-4 min-h-11 w-full rounded-full bg-[#0b100e] font-black text-white">{busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Validar e concluir pedido</Button></article>;
}

function HistoryDelivery({ delivery }: { delivery: DeliveryRecord }) {
  return <article className="rounded-[24px] border border-[#070a08]/8 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-black">{delivery.orderNumber}</h3><p className="mt-1 text-sm text-[#66716a]">{delivery.customerName} · {delivery.driverName || 'Motoboy não identificado'}</p></div><span className={`rounded-full px-3 py-1.5 text-xs font-black ${delivery.status === 'DELIVERED' ? 'bg-[#e7f1df] text-[#27523a]' : 'bg-[#fff0ef] text-[#9d1723]'}`}>{deliveryStatusLabels[delivery.status]}</span></div><p className="mt-3 text-sm text-[#66716a]">{delivery.address.street}, {delivery.address.number} · {delivery.address.neighborhood}</p>{delivery.failureReason && <p className="mt-3 rounded-xl bg-[#fff0ef] p-3 text-xs font-bold text-[#9d1723]">Motivo registrado: {delivery.failureReason}</p>}</article>;
}

function Empty({ text }: { text: string }) { return <div className="rounded-[24px] border border-dashed border-[#070a08]/15 bg-white p-8 text-center text-sm text-[#66716a] md:col-span-2"><RefreshCw className="mx-auto size-5 text-[#b5232b]" /><p className="mt-3">{text}</p></div>; }
function timestampSeconds(value: unknown) { return typeof value === 'object' && value !== null && 'seconds' in value && typeof value.seconds === 'number' ? value.seconds : 0; }
function friendlyError(cause: unknown, fallback: string) {
  if (!(cause instanceof Error)) return fallback;
  if (/permission-denied|unauthenticated/i.test(cause.message)) return 'Sua sessão não tem permissão de administração. Entre novamente com uma conta Teiko autorizada.';
  if (/unavailable|network|offline/i.test(cause.message)) return 'A conexão caiu. A operação não foi confirmada; atualize a página antes de repetir.';
  return cause.message.length < 220 ? cause.message : fallback;
}
