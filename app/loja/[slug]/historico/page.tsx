'use client';

import { onAuthStateChanged } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { getFirebaseClient, hasFirebaseConfig } from '@/lib/firebase/client';
import { validTenantSlug } from '@/shared/tenancy';

type HistoryOrder = { id: string; orderNumber: string; totalCents: number; status: string; createdAt: string | null };

export default function TenantCustomerHistory() {
  const params = useParams();
  const tenantId = typeof params.slug === 'string' ? params.slug : '';
  const valid = hasFirebaseConfig && tenantId !== 'teiko' && validTenantSlug(tenantId);
  const [orders, setOrders] = useState<HistoryOrder[]>([]);
  const [sessionUid, setSessionUid] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!valid) { setError('Restaurante inválido.'); setBusy(false); return; }
    let active = true;
    const unsubscribe = onAuthStateChanged(getFirebaseClient().auth, user => {
      if (!active) return;
      setSessionUid(user?.uid ?? null);
      if (!user) { setError('Use o mesmo navegador e a mesma sessão em que enviou seus pedidos.'); setBusy(false); return; }
      void load();
    });
    async function load() {
      setBusy(true); setError('');
      try {
        const result = await httpsCallable(getFirebaseClient().functions, 'listMyTenantOrders')({ tenantId });
        if (active) setOrders((result.data as { orders: HistoryOrder[] }).orders ?? []);
      } catch { if (active) setError('Não foi possível consultar seu histórico.'); }
      finally { if (active) setBusy(false); }
    }
    return () => { active = false; unsubscribe(); };
  }, [tenantId, valid]);

  async function refresh() {
    if (!sessionUid) return;
    setBusy(true); setError('');
    try {
      const result = await httpsCallable(getFirebaseClient().functions, 'listMyTenantOrders')({ tenantId });
      setOrders((result.data as { orders: HistoryOrder[] }).orders ?? []);
    } catch { setError('Não foi possível atualizar seus pedidos.'); }
    finally { setBusy(false); }
  }
  return <main className="min-h-screen bg-[#f3f0e8] p-4 text-[#111613] sm:p-8">
    <div className="mx-auto max-w-3xl rounded-3xl bg-white p-6">
      <h1 className="text-3xl font-black">Meus pedidos</h1>
      <p className="mt-2 text-sm text-gray-600">
        Apenas pedidos associados à sua sessão neste restaurante. O histórico não é recuperado pelo nome ou telefone.
      </p>
      {busy && <p role="status" className="mt-5">Consultando pedidos…</p>}
      {error && <p role="alert" className="mt-5 rounded-xl bg-red-100 p-4 text-red-800">{error}</p>}
      {!busy && !error && orders.length === 0 && <p role="status" className="mt-5">Nenhum pedido encontrado nesta sessão.</p>}
      {!busy && orders.length > 0 && <div className="mt-5 grid gap-3">{orders.map(order =>
        <Link key={order.id} href={'/loja/' + tenantId + '/acompanhar/' + order.id}
          className="rounded-xl border p-4 hover:bg-[#f3f0e8]">
          <div className="flex flex-wrap justify-between gap-3">
            <span className="font-bold">{order.orderNumber}</span>
            <span>{(order.totalCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
          </div>
          <p className="mt-2 text-sm">Status: {order.status}</p>
        </Link>)}</div>}
      <div className="mt-5 flex flex-wrap items-center gap-4">
        {sessionUid && <Button variant="outline" disabled={busy} onClick={() => void refresh()}>Atualizar histórico</Button>}
        <Link className="text-sm underline" href={'/loja/' + tenantId}>Voltar ao cardápio</Link>
      </div>
    </div>
  </main>;
}
