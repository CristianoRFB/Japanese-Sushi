'use client';

import { arrayUnion, collection, doc, limit, onSnapshot, query, serverTimestamp, Timestamp, updateDoc, where } from 'firebase/firestore';
import { Bell, Check, ExternalLink, Loader2, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { useAuth } from '@/components/providers';
import { Button } from '@/components/ui/button';
import { getFirebaseClient, hasFirebaseConfig } from '@/lib/firebase/client';
import { formatBRL, type OrderStatus } from '@/shared/domain';

interface NewOrder { id: string; orderNumber: string; customer?: { name?: string }; pricing?: { totalCents?: number }; fulfillment?: { mode?: string }; customerApproval?: string }

export function AdminNotifications() {
  const { user, role } = useAuth();
  const [orders, setOrders] = useState<NewOrder[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (!role || !hasFirebaseConfig) return undefined;
    return onSnapshot(query(collection(getFirebaseClient().db, 'orders'), where('brandId', '==', 'teiko'), where('status', '==', 'NEW'), limit(25)), (snapshot) => setOrders(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as NewOrder).filter((order) => order.customerApproval !== 'PENDING')), () => setMessage('Notificações indisponíveis no momento.'));
  }, [role]);
  async function quickAction(orderId: string, status: Extract<OrderStatus, 'CONFIRMED' | 'CANCELLED'>) {
    if (!user || !role) return;
    setBusy(orderId); setMessage('');
    try {
      await updateDoc(doc(getFirebaseClient().db, 'orders', orderId), { status, updatedAt: serverTimestamp(), ...(status === 'CANCELLED' ? { cancellationReason: 'Recusado pela loja', cancelledAt: serverTimestamp() } : {}), statusHistory: arrayUnion({ status, at: Timestamp.now(), actorUid: user.uid, actorRole: role }) });
      setMessage(status === 'CONFIRMED' ? 'Pedido aceito.' : 'Pedido recusado.');
    } catch { setMessage('Não foi possível atualizar o pedido. Abra o detalhe para tentar novamente.'); }
    finally { setBusy(null); }
  }
  return <div className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 z-40 flex max-w-[calc(100vw-2rem)] flex-col items-end gap-3 sm:bottom-5 sm:right-5">{open && <section className="w-[min(100%,380px)] overflow-hidden rounded-3xl border border-[#b5232b]/10 bg-white shadow-2xl" aria-label="Pedidos novos"><div className="flex items-center justify-between bg-[#351924] px-5 py-4 text-white"><div><p className="text-xs font-bold uppercase tracking-widest text-[#c7a773]">Atenção</p><h2 className="text-lg font-black">Pedidos novos</h2></div><button type="button" onClick={() => setOpen(false)} aria-label="Fechar notificações" className="grid size-9 place-items-center rounded-full bg-white/10"><X className="size-4" /></button></div>{message && <p role="status" className="border-b bg-[#f3f0e8] px-5 py-3 text-xs font-bold text-[#7b887d]">{message}</p>}<div className="max-h-[min(60vh,480px)] overflow-y-auto">{!orders.length ? <p className="p-6 text-center text-sm text-[#7b887d]">Nenhum pedido aguardando aceite.</p> : orders.map((order) => <article key={order.id} className="border-b border-[#b5232b]/8 p-4 last:border-0"><div className="flex items-start justify-between gap-3"><div><strong className="block text-base">{order.orderNumber}</strong><span className="text-xs text-[#7b887d]">{order.customer?.name || 'Cliente'} · {order.fulfillment?.mode === 'DELIVERY' ? 'Entrega' : 'Retirada'}</span></div><strong className="text-[#b5232b]">{formatBRL(order.pricing?.totalCents ?? 0)}</strong></div><div className="mt-3 flex gap-2"><Button type="button" disabled={busy === order.id} onClick={() => void quickAction(order.id, 'CONFIRMED')} className="h-9 flex-1 rounded-full bg-[#d6e7bf] text-xs font-black text-[#351924]">{busy === order.id ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Aceitar</Button><Button type="button" disabled={busy === order.id} onClick={() => void quickAction(order.id, 'CANCELLED')} className="h-9 rounded-full bg-[#e8efe5] px-3 text-xs font-black text-[#e3262e]"><X className="size-4" /> Recusar</Button><Button type="button" variant="outline" className="h-9 rounded-full px-3" render={<a href={`/admin/pedidos/${order.id}`} aria-label={`Abrir ${order.orderNumber}`} />}><ExternalLink className="size-4" /></Button></div></article>)}</div><a href="/admin/pedidos" className="block border-t bg-[#f3f0e8] px-5 py-3 text-center text-xs font-black text-[#b5232b]">Ver todos os pedidos</a></section>}<button type="button" onClick={() => setOpen((value) => !value)} aria-label={orders.length ? `${orders.length} pedidos novos` : 'Abrir notificações'} aria-expanded={open} className="relative grid size-14 place-items-center rounded-full bg-[#b5232b] text-white shadow-xl transition hover:scale-105 focus:outline-none focus:ring-4 focus:ring-[#b5232b]/25"><Bell className="size-6" />{orders.length > 0 && <span className="absolute -right-1 -top-1 grid min-w-6 place-items-center rounded-full border-2 border-white bg-[#c7a773] px-1.5 py-0.5 text-xs font-black text-[#351924]">{orders.length > 99 ? '99+' : orders.length}</span>}</button></div>;
}
