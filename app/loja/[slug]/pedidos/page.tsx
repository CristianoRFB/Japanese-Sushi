'use client';

import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { getFirebaseClient, hasFirebaseConfig } from '@/lib/firebase/client';
import { validTenantSlug } from '@/shared/tenancy';

type Status = 'NEW' | 'CONFIRMED' | 'PREPARING' | 'READY' | 'CANCELLED';
type QueueOrder = {
  id: string; orderNumber: string; customerName: string; status: Status;
  totalCents: number; createdAt: string | null;
  items: Array<{ name: string; quantity: number }>;
};
const actions: Partial<Record<Status, { status: Status; label: string }>> = {
  NEW: { status: 'CONFIRMED', label: 'Confirmar' },
  CONFIRMED: { status: 'PREPARING', label: 'Iniciar preparo' },
  PREPARING: { status: 'READY', label: 'Pronto para retirada' },
};

export default function TenantOrdersPage() {
  const params = useParams();
  const tenantId = typeof params.slug === 'string' ? params.slug : '';
  const ready = hasFirebaseConfig && validTenantSlug(tenantId) && tenantId !== 'teiko';
  const [user, setUser] = useState<User | null>(null);
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [orders, setOrders] = useState<QueueOrder[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function refresh() {
    const response = await httpsCallable(getFirebaseClient().functions, 'tenantListPickupOrders')({ tenantId });
    const data = response.data as { orders?: QueueOrder[] };
    setOrders(Array.isArray(data.orders) ? data.orders : []);
  }
  useEffect(() => {
    if (!ready) { setLoading(false); return; }
    let generation = 0;
    return onAuthStateChanged(getFirebaseClient().auth, current => {
      const gen = ++generation;
      const account = current?.isAnonymous ? null : current;
      setUser(account);
      setAuthorized(false);
      if (!account) { setOrders([]); setLoading(false); return; }
      setLoading(true); setError('');
      void httpsCallable(getFirebaseClient().functions, 'getMyTenantAccess')({ tenantId }).then(async response => {
        if (gen !== generation) return;
        const role = (response.data as { role?: string }).role;
        if (role !== 'tenant_owner' && role !== 'staff') throw new Error('Sem acesso à cozinha deste restaurante.');
        await refresh();
        if (gen === generation) setAuthorized(true);
      }).catch(cause => {
        if (gen === generation) setError(cause instanceof Error ? cause.message : 'Acesso negado.');
      }).finally(() => { if (gen === generation) setLoading(false); });
    });
  }, [ready, tenantId]);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true); setError('');
    try {
      await signInWithEmailAndPassword(getFirebaseClient().auth,
        String(data.get('email')), String(data.get('password')));
    } catch { setError('Não foi possível autenticar. Confira suas credenciais e a conexão.'); }
    finally { setBusy(false); }
  }
  async function advance(order: QueueOrder, status: Status) {
    setBusy(true); setError(''); setNotice('');
    try {
      await httpsCallable(getFirebaseClient().functions, 'tenantUpdatePickupStatus')({
        tenantId, orderId: order.id, status,
      });
      await refresh();
      setNotice('Pedido atualizado. A fila foi sincronizada.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao atualizar. Confira antes de tentar novamente.');
    } finally { setBusy(false); }
  }
  if (!ready) return <main role="alert" className="p-8">
    {tenantId === 'teiko' ? 'Os pedidos da Teiko continuam no painel /admin/kds.' : 'Restaurante indisponível.'}
  </main>;
  return <main className="min-h-screen bg-[#f3f0e8] p-4 text-[#111613] sm:p-8">
    <div className="mx-auto max-w-5xl">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div><p className="text-xs font-bold uppercase tracking-widest text-[#b5232b]">Cozinha · {tenantId}</p>
          <h1 className="mt-1 text-3xl font-black">Pedidos para retirada</h1></div>
        {user && <div className="flex flex-wrap items-center gap-2"><Link href={'/loja/' + tenantId + '/caixa'} className="rounded-lg border px-4 py-2 text-sm font-bold">Abrir caixa</Link><Button variant="outline" onClick={() => void signOut(getFirebaseClient().auth)}>Sair</Button></div>}
      </header>
      <p className="mt-2 text-sm text-gray-600">Fluxo inicial de preparo. Pagamento e conclusão financeira ainda são realizados fora deste painel.</p>
      {loading && <p role="status" className="mt-5 rounded-xl bg-white p-4">Validando acesso e pedidos…</p>}
      {error && <p role="alert" className="mt-5 rounded-xl bg-red-100 p-4 text-red-900">{error}</p>}
      {notice && <p role="status" className="mt-5 rounded-xl bg-green-100 p-4 text-green-900">{notice}</p>}
      {!user && !loading && <form onSubmit={login} className="mt-6 grid max-w-md gap-3 rounded-2xl bg-white p-6">
        <h2 className="font-bold">Acesso da equipe</h2>
        <label>E-mail<input required type="email" name="email" autoComplete="username" className="mt-1 w-full rounded-lg border p-3" /></label>
        <label>Senha<input required type="password" name="password" autoComplete="current-password" className="mt-1 w-full rounded-lg border p-3" /></label>
        <Button type="submit" disabled={busy}>Entrar</Button>
      </form>}
      {authorized && !loading && <>
        <div className="mt-5 flex justify-end"><Button variant="outline" disabled={busy} onClick={() => void refresh().catch(() => setError('Falha ao atualizar a fila.'))}>Atualizar fila</Button></div>
        {orders.length === 0 && <p role="status" className="mt-5 rounded-2xl bg-white p-6">Nenhum pedido para exibir.</p>}
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {orders.map(order => <article key={order.id} className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-black">{order.orderNumber}</h2>
              <span className="rounded-full bg-[#f3f0e8] px-3 py-1 text-xs font-bold">{order.status}</span></div>
            <p className="mt-2 text-sm">{order.customerName}</p>
            <ul className="mt-3 space-y-1 text-sm">{order.items.map((item, index) =>
              <li key={index}>{item.quantity}× {item.name}</li>)}</ul>
            <p className="mt-3 font-bold">{(order.totalCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
            <p className="mt-1 text-xs text-gray-600">Pagamento: pendente de conferência no caixa.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {actions[order.status] && <Button disabled={busy} onClick={() => void advance(order, actions[order.status]!.status)}>{actions[order.status]!.label}</Button>}
              {['NEW', 'CONFIRMED', 'PREPARING', 'READY'].includes(order.status) && <Button variant="outline" disabled={busy} onClick={() => void advance(order, 'CANCELLED')}>Cancelar</Button>}
            </div>
          </article>)}
        </div>
      </>}
    </div>
  </main>;
}
