'use client';

import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { ArrowRight, Search, TicketCheck } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';

import { getFirebaseClient, hasFirebaseConfig } from '@/lib/firebase/client';

interface RecentOrder { publicCode: string; orderNumber?: string; savedAt: number }
const RECENT_ORDERS_KEY = 'teiko-sushi-recent-orders';

export function OrderLookup() {
  const [code, setCode] = useState('');
  const [recent, setRecent] = useState<RecentOrder | null>(null);
  const [error, setError] = useState('');
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(RECENT_ORDERS_KEY) || '[]') as RecentOrder[];
      const first = Array.isArray(saved) ? saved.find((item) => item?.publicCode && Date.now() - item.savedAt < 30 * 86400000) : undefined;
      if (first) setRecent(first);
    } catch { localStorage.removeItem(RECENT_ORDERS_KEY); }
  }, []);

  async function go(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = code.trim().replace(/^#/, '').toUpperCase();
    if (!normalized) { setError('Digite o código ou número do pedido para acompanhar.'); return; }
    setSearching(true); setError('');
    try {
      if (hasFirebaseConfig && normalized.startsWith('T')) {
        const snapshot = await getDocs(query(collection(getFirebaseClient().db, 'orders'), where('orderNumber', '==', `#${normalized}`), limit(1)));
        const match = snapshot.docs[0];
        if (match) { const publicCode = String(match.data().publicCode || match.id); window.location.href = `/pedido/${encodeURIComponent(publicCode)}`; return; }
      }
      window.location.href = `/pedido/${encodeURIComponent(normalized)}`;
    } catch { setError('Não foi possível procurar agora. Tente novamente em alguns instantes.'); }
    finally { setSearching(false); }
  }

  return <section id="acompanhar" className="mx-auto max-w-6xl scroll-mt-24 px-4 pt-8 sm:px-6"><div className="grid gap-5 rounded-[30px] border border-[#c7a773]/35 bg-[#10261a] p-6 text-[#f3f0e8] shadow-[0_18px_50px_rgba(0,0,0,.22)] sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center"><div><div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-full bg-[#e3262e]/20 text-[#c7a773]"><TicketCheck className="size-5" /></span><div><p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#c7a773]">Pedido online</p><h2 className="mt-1 text-2xl font-black tracking-[-.04em]">Acompanhe seu pedido</h2></div></div><p className="mt-3 max-w-xl text-sm leading-relaxed text-[#c1cdc3]">Digite o código exibido após a confirmação. O código é exclusivo deste pedido.</p><form onSubmit={go} className="mt-5 flex flex-col gap-2 sm:flex-row sm:max-w-xl"><label className="sr-only" htmlFor="order-lookup-code">Código ou número do pedido</label><input id="order-lookup-code" value={code} onChange={(event) => { setCode(event.target.value); setError(''); }} placeholder="Ex.: #T20260917 ou código salvo" autoComplete="off" className="h-12 min-w-0 flex-1 rounded-full border border-white/15 bg-[#070a08] px-5 text-sm font-bold text-[#f3f0e8] outline-none placeholder:text-[#c1cdc3]/70 focus:border-[#c7a773] focus:ring-2 focus:ring-[#c7a773]/20" /><button type="submit" disabled={searching} className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#d6e7bf] px-5 text-sm font-black text-[#070a08] transition hover:bg-[#e7f47f] disabled:opacity-60"><Search className="size-4" />{searching ? 'Procurando' : 'Acompanhar'}<ArrowRight className="size-4" /></button></form>{error && <p role="alert" className="mt-2 text-sm font-bold text-[#ffb4b4]">{error}</p>}</div>{recent && <div className="rounded-2xl border border-white/10 bg-[#070a08] p-4 lg:min-w-56"><p className="text-xs font-bold uppercase tracking-wider text-[#c7a773]">Último pedido</p><p className="mt-1 text-lg font-black text-[#f3f0e8]">{recent.orderNumber || `#${recent.publicCode.slice(-6).toUpperCase()}`}</p><a href={`/pedido/${encodeURIComponent(recent.publicCode)}`} className="mt-3 inline-flex items-center gap-1 text-sm font-black text-[#d6e7bf]">Abrir acompanhamento <ArrowRight className="size-4" /></a></div>}</div></section>;
}
