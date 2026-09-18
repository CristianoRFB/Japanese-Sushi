'use client';

import {
  ArrowRight,
  CalendarDays,
  ChefHat,
  CircleDollarSign,
  ClipboardList,
  ShoppingBag,
} from 'lucide-react';
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  where,
} from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';

import { AdminShell } from '@/components/admin-shell';
import { getFirebaseClient } from '@/lib/firebase/client';
import {
  formatBRL,
  TEIKO_BRAND_ID,
  type OrderStatus,
  type ReservationStatus,
} from '@/shared/domain';

interface DashboardOrder {
  id: string;
  orderNumber: string;
  createdAt?: Timestamp;
  customer: { name: string };
  fulfillment: { mode: 'PICKUP' | 'DELIVERY' };
  pricing: { totalCents: number };
  status: OrderStatus;
  customerApproval?: string;
}

interface DashboardReservation {
  id: string;
  name: string;
  date: string;
  time: string;
  people: number;
  status: ReservationStatus;
}

const orderStatusLabel: Record<OrderStatus, string> = {
  NEW: 'Novo', CONFIRMED: 'Confirmado', PREPARING: 'Em preparo', READY: 'Pronto',
  OUT_FOR_DELIVERY: 'Em entrega', COMPLETED: 'Concluído', CANCELLED: 'Cancelado',
};

const reservationStatusLabel: Record<ReservationStatus, string> = {
  REQUESTED: 'A confirmar', CONFIRMED: 'Confirmada', REFUSED: 'Recusada',
  CANCELLED: 'Cancelada', COMPLETED: 'Concluída',
};

function localDateKey() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

function statusTone(status: OrderStatus) {
  if (status === 'NEW') return 'bg-[#fbe7c6] text-[#8b1e2b]';
  if (status === 'READY') return 'bg-[#d6e7bf] text-[#23452b]';
  if (status === 'CANCELLED') return 'bg-[#e8efe5] text-[#e3262e]';
  return 'bg-[#e8efe5] text-[#3a5b35]';
}

export default function AdminDashboard() {
  const [orders, setOrders] = useState<DashboardOrder[]>([]);
  const [reservations, setReservations] = useState<DashboardReservation[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const db = getFirebaseClient().db;
    const unsubscribeOrders = onSnapshot(
      query(collection(db, 'orders'), where('brandId', '==', TEIKO_BRAND_ID), orderBy('createdAt', 'desc'), limit(100)),
      (snapshot) => setOrders(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as DashboardOrder)),
      () => setError('Não foi possível atualizar os indicadores de pedidos.'),
    );
    const unsubscribeReservations = onSnapshot(
      query(collection(db, 'reservations'), where('brandId', '==', TEIKO_BRAND_ID), orderBy('date', 'asc'), limit(100)),
      (snapshot) => setReservations(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as DashboardReservation)),
      () => setError('Não foi possível atualizar a agenda.'),
    );
    return () => { unsubscribeOrders(); unsubscribeReservations(); };
  }, []);

  const summary = useMemo(() => {
    const today = localDateKey();
    const active = orders.filter((order) => !['COMPLETED', 'CANCELLED'].includes(order.status));
    const newOrders = active.filter((order) => order.status === 'NEW' && order.customerApproval !== 'PENDING');
    const preparing = active.filter((order) => ['CONFIRMED', 'PREPARING'].includes(order.status));
    const ready = active.filter((order) => ['READY', 'OUT_FOR_DELIVERY'].includes(order.status));
    const todayRevenue = orders.filter((order) => order.createdAt?.toDate().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }) === today && order.status !== 'CANCELLED').reduce((total, order) => total + (order.pricing?.totalCents ?? 0), 0);
    const todayReservations = reservations.filter((reservation) => reservation.date === today && ['REQUESTED', 'CONFIRMED'].includes(reservation.status));
    return { active, newOrders, preparing, ready, todayRevenue, todayReservations };
  }, [orders, reservations]);

  return <AdminShell>
    <section className="border-b border-[#070a08]/10 pb-6"><p className="text-xs font-black uppercase tracking-[.18em] text-[#8b1e2b]">Operação em tempo real</p><div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><h1 className="text-3xl font-black tracking-[-.04em]">Central da operação</h1><p className="mt-2 max-w-2xl text-sm text-[#7b887d]">Priorize o que precisa de decisão agora e acompanhe o salão sem sair da fila.</p></div><div className="flex flex-wrap gap-2"><QuickLink href="/admin/pedidos" icon={ClipboardList} label="Abrir fila" /><QuickLink href="/admin/kds" icon={ChefHat} label="Cozinha" tone="dark" /></div></div></section>
    {error && <p role="alert" className="mt-5 rounded-xl bg-[#e8efe5] p-3 text-sm text-[#e3262e]">{error}</p>}
    <section aria-label="Indicadores da operação" className="mt-6 grid gap-px overflow-hidden rounded-2xl border border-[#070a08]/10 bg-[#070a08]/10 sm:grid-cols-2 xl:grid-cols-4"><Metric icon={ShoppingBag} label="Pedidos em andamento" value={String(summary.active.length)} detail={`${summary.newOrders.length} novos para decidir`} /><Metric icon={ChefHat} label="Em preparo" value={String(summary.preparing.length)} detail={`${summary.ready.length} prontos ou saindo`} tone="gold" /><Metric icon={CalendarDays} label="Reservas de hoje" value={String(summary.todayReservations.length)} detail={`${summary.todayReservations.reduce((total, reservation) => total + reservation.people, 0)} lugares previstos`} /><Metric icon={CircleDollarSign} label="Vendas registradas hoje" value={formatBRL(summary.todayRevenue)} detail="Pedidos não cancelados" tone="green" /></section>
    <div className="mt-7 grid gap-7 xl:grid-cols-[minmax(0,1fr)_320px]">
      <section className="overflow-hidden rounded-[22px] border border-[#070a08]/10 bg-white"><div className="flex items-end justify-between gap-4 border-b border-[#070a08]/10 px-5 py-4"><div><p className="text-xs font-black uppercase tracking-[.14em] text-[#8b1e2b]">Fila agora</p><h2 className="mt-1 text-xl font-black">Pedidos que pedem atenção</h2></div><a href="/admin/pedidos" className="inline-flex items-center gap-1 text-sm font-black text-[#b5232b]">Ver todos <ArrowRight className="size-4" /></a></div><div className="hidden grid-cols-[112px_minmax(0,1fr)_112px_112px_96px] gap-3 border-b border-[#070a08]/10 bg-[#f3f0e8] px-5 py-3 text-[10px] font-black uppercase tracking-[.14em] text-[#7b887d] md:grid"><span>Pedido</span><span>Cliente</span><span>Entrega</span><span>Status</span><span className="text-right">Total</span></div>{summary.active.slice(0, 7).map((order) => <a key={order.id} href={`/admin/pedidos/${order.id}`} className="grid gap-2 border-b border-[#070a08]/8 px-5 py-4 transition hover:bg-[#f3f0e8] last:border-0 md:grid-cols-[112px_minmax(0,1fr)_112px_112px_96px] md:items-center md:gap-3"><span><strong className="block text-sm">{order.orderNumber}</strong><small className="text-xs text-[#7b887d]">{order.createdAt?.toDate().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) || 'Agora'}</small></span><strong className="truncate text-sm">{order.customer?.name || 'Cliente'}</strong><span className="text-xs text-[#7b887d]">{order.fulfillment?.mode === 'PICKUP' ? 'Retirada' : 'Delivery'}</span><span className={`w-fit rounded-full px-2.5 py-1 text-[11px] font-black ${statusTone(order.status)}`}>{order.customerApproval === 'PENDING' ? 'Aguardando cliente' : orderStatusLabel[order.status]}</span><strong className="text-sm md:text-right">{formatBRL(order.pricing?.totalCents ?? 0)}</strong></a>)}{!summary.active.length && <EmptyState icon={ShoppingBag} title="A fila está limpa" detail="Novos pedidos aparecerão aqui em tempo real." />}</section>
      <aside className="rounded-[22px] border border-[#070a08]/10 bg-[#10261a] p-5 text-[#f3f0e8]"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.14em] text-[#c7a773]">Agenda de hoje</p><h2 className="mt-1 text-xl font-black">Salão</h2></div><CalendarDays className="size-5 text-[#c7a773]" /></div><div className="mt-5 space-y-3">{summary.todayReservations.slice(0, 6).map((reservation) => <a key={reservation.id} href="/admin/reservas" className="block rounded-xl border border-white/10 px-3 py-3 transition hover:border-[#c7a773]/60"><div className="flex items-center justify-between gap-3"><strong className="text-sm">{reservation.time}</strong><span className="text-[11px] font-bold text-[#c1cdc3]">{reservation.people} pessoas</span></div><p className="mt-1 truncate text-sm text-[#c1cdc3]">{reservation.name}</p><span className="mt-2 block text-[10px] font-black uppercase tracking-wide text-[#c7a773]">{reservationStatusLabel[reservation.status]}</span></a>)}{!summary.todayReservations.length && <p className="rounded-xl border border-dashed border-white/15 p-4 text-sm text-[#c1cdc3]">Nenhuma reserva ativa para hoje.</p>}</div><a href="/admin/reservas" className="mt-5 inline-flex items-center gap-1 text-sm font-black text-[#d6e7bf]">Gerenciar agenda <ArrowRight className="size-4" /></a></aside>
    </div>
  </AdminShell>;
}

function Metric({ icon: Icon, label, value, detail, tone = 'red' }: { icon: typeof ShoppingBag; label: string; value: string; detail: string; tone?: 'red' | 'gold' | 'green' }) {
  const iconTone = tone === 'gold' ? 'bg-[#fbe7c6] text-[#8b1e2b]' : tone === 'green' ? 'bg-[#d6e7bf] text-[#23452b]' : 'bg-[#e8efe5] text-[#b5232b]';
  return <article className="bg-white p-5"><span className={`grid size-9 place-items-center rounded-xl ${iconTone}`}><Icon className="size-4" /></span><p className="mt-4 text-xs font-bold text-[#7b887d]">{label}</p><strong className="mt-1 block text-2xl font-black tracking-tight">{value}</strong><p className="mt-1 text-xs text-[#7b887d]">{detail}</p></article>;
}

function QuickLink({ href, icon: Icon, label, tone = 'light' }: { href: string; icon: typeof ShoppingBag; label: string; tone?: 'light' | 'dark' }) {
  return <a href={href} className={`inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-black ${tone === 'dark' ? 'bg-[#070a08] text-white' : 'bg-[#e8efe5] text-[#8b1e2b]'}`}><Icon className="size-4" />{label}</a>;
}

function EmptyState({ icon: Icon, title, detail }: { icon: typeof ShoppingBag; title: string; detail: string }) {
  return <div className="p-10 text-center"><Icon className="mx-auto size-7 text-[#8b1e2b]" /><h3 className="mt-3 font-black">{title}</h3><p className="mt-1 text-sm text-[#7b887d]">{detail}</p></div>;
}
