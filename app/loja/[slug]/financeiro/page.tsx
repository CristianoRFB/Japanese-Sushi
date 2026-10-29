'use client';

import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { getFirebaseClient, hasFirebaseConfig } from '@/lib/firebase/client';
import { validTenantSlug } from '@/shared/tenancy';

type Movement = {
  id: string; orderId: string; type: 'REVENUE' | 'REFUND';
  amountCents: number; createdAt: string | null;
};
type Finance = {
  scope: 'RECENT_100_ENTRIES'; limit: number; hasMore: boolean;
  revenueCents: number; refundCents: number; netCents: number;
  movements: Movement[];
};
const brl = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function TenantRecentFinancePage() {
  const params = useParams();
  const tenantId = typeof params.slug === 'string' ? params.slug : '';
  const ready = hasFirebaseConfig && validTenantSlug(tenantId) && tenantId !== 'teiko';
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [finance, setFinance] = useState<Finance | null>(null);
  const [error, setError] = useState('');

  async function fetchFinance() {
    const result = await httpsCallable(getFirebaseClient().functions, 'tenantGetRecentFinanceSummary')({
      tenantId,
    });
    setFinance(result.data as Finance);
  }
  useEffect(() => {
    if (!ready) { setLoading(false); return; }
    let generation = 0;
    return onAuthStateChanged(getFirebaseClient().auth, account => {
      const current = ++generation;
      const authenticated = account && !account.isAnonymous ? account : null;
      setUser(authenticated); setFinance(null);
      if (!authenticated) { setLoading(false); return; }
      setLoading(true); setError('');
      void fetchFinance()
        .catch(() => { if (current === generation) setError('Apenas o proprietário pode acessar este relatório.'); })
        .finally(() => { if (current === generation) setLoading(false); });
    });
  }, [ready, tenantId]);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    setBusy(true); setError('');
    try {
      await signInWithEmailAndPassword(getFirebaseClient().auth,
        String(fields.get('email')), String(fields.get('password')));
    } catch { setError('Falha na autenticação. Verifique sua conta.'); }
    finally { setBusy(false); }
  }

  async function refresh() {
    setBusy(true); setError('');
    try { await fetchFinance(); }
    catch { setError('Não foi possível atualizar o financeiro.'); }
    finally { setBusy(false); }
  }

  if (!ready) return <main role="alert" className="p-8">
    {tenantId === 'teiko' ? 'O financeiro original da Teiko continua no painel legado.' : 'Restaurante não disponível.'}
  </main>;
  return <main className="min-h-screen bg-[#f3f0e8] p-4 text-[#111613] sm:p-8">
    <div className="mx-auto max-w-5xl">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[#b5232b]">{tenantId}</p>
          <h1 className="mt-1 text-3xl font-black">Financeiro recente</h1>
        </div>
        {user && <Button variant="outline" onClick={() => void signOut(getFirebaseClient().auth)}>Sair</Button>}
      </header>
      <p className="mt-3 text-sm text-gray-600">
        Lançamentos em dinheiro dos últimos 100 registros. Não representa todo o histórico,
        vendas de cartão/PIX ou conciliação bancária.
      </p>
      {loading && <p role="status" className="mt-5">Verificando permissões…</p>}
      {error && <p role="alert" className="mt-5 rounded-xl bg-red-100 p-4 text-red-800">{error}</p>}
      {!loading && !user && <form onSubmit={login} className="mt-6 grid max-w-md gap-3 rounded-2xl bg-white p-5">
        <label>E-mail<input required type="email" name="email" autoComplete="username" className="mt-1 w-full rounded-lg border p-3" /></label>
        <label>Senha<input required type="password" name="password" autoComplete="current-password" className="mt-1 w-full rounded-lg border p-3" /></label>
        <Button type="submit" disabled={busy}>Entrar</Button>
      </form>}
      {finance && !loading && <div className="mt-6 grid gap-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-white p-5"><p className="text-sm text-gray-600">Vendas do período amostrado</p><p className="mt-1 text-2xl font-bold">{brl(finance.revenueCents)}</p></div>
          <div className="rounded-xl bg-white p-5"><p className="text-sm text-gray-600">Devoluções manuais</p><p className="mt-1 text-2xl font-bold">{brl(finance.refundCents)}</p></div>
          <div className="rounded-xl bg-white p-5"><p className="text-sm text-gray-600">Saldo líquido dos registros</p><p className="mt-1 text-2xl font-bold">{brl(finance.netCents)}</p></div>
        </div>
        {finance.hasMore && <p role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm">
          Limite de 100 lançamentos atingido. Os totais acima são apenas uma amostra recente; não feche contabilidade com eles.
        </p>}
        <section className="rounded-2xl bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-bold">Lançamentos recentes</h2>
            <Button variant="outline" disabled={busy} onClick={() => void refresh()}>Atualizar</Button>
          </div>
          {finance.movements.length === 0 && <p className="mt-3 text-sm">Nenhum registro recente.</p>}
          <ul className="mt-4 grid gap-2">
            {finance.movements.map(m => <li key={m.id} className="flex flex-wrap justify-between gap-3 rounded-lg border p-3 text-sm">
              <span><strong>{m.type === 'REFUND' ? 'Devolução' : 'Venda'}</strong>
                <span className="ml-2 text-gray-600">{m.orderId}</span></span>
              <span className="font-bold">{brl(m.amountCents)}</span>
            </li>)}
          </ul>
        </section>
      </div>}
      <p className="mt-6 text-sm"><Link href={'/loja/' + tenantId + '/caixa'} className="underline">Voltar ao caixa</Link></p>
    </div>
  </main>;
}
