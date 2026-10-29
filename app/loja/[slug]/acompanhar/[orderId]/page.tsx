'use client';

import { onAuthStateChanged } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { getFirebaseClient, hasFirebaseConfig } from '@/lib/firebase/client';
import { validTenantSlug } from '@/shared/tenancy';

type Receipt = {
  orderId: string; orderNumber: string; status: string;
  pricing: { totalCents: number; currency: string };
  fulfillment: { mode: string };
  items: Array<{ name: string; quantity: number; totalPriceCents: number }>;
  createdAt?: string;
};
const labels: Record<string, string> = {
  NEW: 'Pedido recebido', CONFIRMED: 'Confirmado pela equipe',
  PREPARING: 'Em preparo', READY: 'Pronto para retirada',
  COMPLETED: 'Retirado e finalizado', CANCELLED: 'Cancelado',
};

export default function TenantOrderReceiptPage() {
  const params = useParams();
  const slug = typeof params.slug === 'string' ? params.slug : '';
  const orderId = typeof params.orderId === 'string' ? params.orderId : '';
  const valid = hasFirebaseConfig && slug !== 'teiko' && validTenantSlug(slug)
    && /^[A-Za-z0-9_-]{10,128}$/.test(orderId);
  const [order, setOrder] = useState<Receipt | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [sessionUid, setSessionUid] = useState<string | null>(null);

  useEffect(() => {
    if (!valid) { setBusy(false); setError('Identificador de pedido inválido.'); return; }
    let active = true;
    const unsubscribe = onAuthStateChanged(getFirebaseClient().auth, user => {
      if (!active) return;
      setSessionUid(user?.uid ?? null);
      if (!user) {
        setBusy(false);
        setError('Não há sessão neste navegador. Entre pela mesma sessão em que fez o pedido.');
        return;
      }
      void loadReceipt();
    });
    async function loadReceipt() {
      setBusy(true); setError('');
      try {
        const response = await httpsCallable(getFirebaseClient().functions, 'getMyTenantOrder')({
          tenantId: slug, orderId,
        });
        if (active) setOrder(response.data as Receipt);
      } catch {
        if (active) { setError('Não foi possível consultar este pedido nesta sessão.'); setOrder(null); }
      } finally { if (active) setBusy(false); }
    }
    return () => { active = false; unsubscribe(); };
  }, [slug, orderId, valid]);

  async function refresh() {
    if (!valid || !sessionUid) return;
    setBusy(true); setError('');
    try {
      const response = await httpsCallable(getFirebaseClient().functions, 'getMyTenantOrder')({
        tenantId: slug, orderId,
      });
      setOrder(response.data as Receipt);
    } catch { setError('Não foi possível atualizar o pedido.'); }
    finally { setBusy(false); }
  }
  return <main className="min-h-screen bg-[#f3f0e8] p-4 text-[#111613] sm:p-8">
    <div className="mx-auto max-w-2xl rounded-3xl bg-white p-6 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-widest text-[#b5232b]">Acompanhamento da retirada</p>
      <h1 className="mt-2 text-3xl font-black">Seu pedido</h1>
      {busy && <p role="status" className="mt-5">Consultando o status…</p>}
      {error && <p role="alert" className="mt-5 rounded-xl bg-red-100 p-4 text-red-800">{error}</p>}
      {order && <div className="mt-6">
        <p className="text-xl font-bold">{order.orderNumber}</p>
        <p className="mt-2 rounded-xl bg-[#f3f0e8] p-4 font-semibold" role="status">
          {labels[order.status] ?? 'Em acompanhamento'}
        </p>
        <ul className="mt-5 space-y-2 text-sm">
          {order.items.map((item, index) => <li key={index} className="flex justify-between gap-3">
            <span>{item.quantity}× {item.name}</span>
            <span>{(item.totalPriceCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
          </li>)}
        </ul>
        <p className="mt-4 border-t pt-4 text-xl font-bold">
          {(order.pricing.totalCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        </p>
        <p className="mt-2 text-sm text-gray-600">
          Pagamento presencial em dinheiro, confirmado pela equipe no caixa. Nenhum pagamento eletrônico é processado aqui.
        </p>
        <Button variant="outline" disabled={busy} onClick={() => void refresh()} className="mt-5">Atualizar status</Button>
      </div>}
      <div className="mt-6">
        <Link className="mr-4 text-sm font-semibold underline" href={'/loja/' + slug}>Voltar ao cardápio</Link>
        <Link className="text-sm font-semibold underline" href={'/loja/' + slug + '/historico'}>Meus pedidos</Link>
      </div>
    </div>
  </main>;
}
