'use client';

import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { getFirebaseClient, hasFirebaseConfig } from '@/lib/firebase/client';
import { validTenantSlug } from '@/shared/tenancy';

type Reservation = { id: string; name: string; phone: string; date: string; time: string; people: number; status: string; notes: string };
const transitions: Record<string, Array<{ status: string; label: string }>> = {
  REQUESTED: [{ status: 'CONFIRMED', label: 'Confirmar manualmente' }, { status: 'REFUSED', label: 'Recusar' }],
  CONFIRMED: [{ status: 'COMPLETED', label: 'Atendimento realizado' }, { status: 'CANCELLED', label: 'Cancelar' }],
};
export default function TenantReservationsAdmin() {
  const params = useParams();
  const tenantId = typeof params.slug === 'string' ? params.slug : '';
  const valid = hasFirebaseConfig && validTenantSlug(tenantId) && tenantId !== 'teiko';
  const [user, setUser] = useState<User | null>(null);
  const [allowed, setAllowed] = useState(false);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function refresh() {
    const response = await httpsCallable(getFirebaseClient().functions, 'tenantListReservations')({ tenantId });
    setReservations((response.data as { reservations: Reservation[] }).reservations ?? []);
  }
  useEffect(() => {
    if (!valid) { setError('Restaurante indisponível.'); setLoading(false); return; }
    let generation = 0;
    return onAuthStateChanged(getFirebaseClient().auth, current => {
      const seq = ++generation;
      const account = current?.isAnonymous ? null : current;
      setUser(account); setAllowed(false);
      if (!account) { setLoading(false); setReservations([]); return; }
      setLoading(true);
      void httpsCallable(getFirebaseClient().functions, 'getMyTenantAccess')({ tenantId }).then(async response => {
        if (seq !== generation) return;
        const role = (response.data as { role?: string }).role;
        if (role !== 'tenant_owner' && role !== 'staff')
          throw new Error('Acesso negado.');
        await refresh();
        if (seq === generation) { setAllowed(true); setError(''); }
      }).catch(() => { if (seq === generation) setError('Você não tem acesso às reservas deste restaurante.'); })
        .finally(() => { if (seq === generation) setLoading(false); });
    });
  }, [tenantId, valid]);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    const form = new FormData(event.currentTarget);
    try {
      await signInWithEmailAndPassword(getFirebaseClient().auth,
        String(form.get('email')), String(form.get('password')));
    } catch { setError('Não foi possível autenticar.'); }
    finally { setBusy(false); }
  }
  async function update(item: Reservation, status: string) {
    setBusy(true); setError(''); setNotice('');
    try {
      await httpsCallable(getFirebaseClient().functions, 'tenantSetReservationStatus')({
        tenantId, reservationId: item.id, status,
      });
      await refresh();
      setNotice('Reserva atualizada. A confirmação exige verificação humana da disponibilidade de mesa.');
    } catch { setError('Falha na transição; atualize a lista antes de tentar novamente.'); }
    finally { setBusy(false); }
  }
  return <main className="min-h-screen bg-[#f3f0e8] p-4 text-[#111613] sm:p-8">
    <div className="mx-auto max-w-4xl">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-widest text-[#b5232b]">Reservas · {tenantId}</p><h1 className="text-3xl font-black">Solicitações</h1></div>
        {user && <Button variant="outline" onClick={() => void signOut(getFirebaseClient().auth)}>Sair</Button>}
      </header>
      <p className="mt-3 text-sm text-gray-600">Reservas de teste do novo namespace. A capacidade de mesas deve ser conferida manualmente antes da confirmação. Não representa disponibilidade automática.</p>
      {error && <p role="alert" className="mt-5 rounded-lg bg-red-100 p-4 text-red-800">{error}</p>}
      {notice && <p role="status" className="mt-5 rounded-lg bg-green-100 p-4">{notice}</p>}
      {loading && <p role="status" className="mt-5">Validando acesso…</p>}
      {!user && !loading && <form onSubmit={login} className="mt-6 grid max-w-md gap-3 rounded-2xl bg-white p-5">
        <h2 className="font-bold">Entrar como equipe</h2>
        <label>E-mail<input type="email" required name="email" autoComplete="username" className="mt-1 w-full rounded-lg border p-3"/></label>
        <label>Senha<input type="password" required name="password" autoComplete="current-password" className="mt-1 w-full rounded-lg border p-3"/></label>
        <Button type="submit" disabled={busy}>Entrar</Button>
      </form>}
      {allowed && !loading && <>
        <div className="mt-5 flex justify-end">
          <Button variant="outline" disabled={busy} onClick={() => void refresh().catch(() => setError('Falha ao atualizar.'))}>Atualizar lista</Button>
        </div>
        {reservations.length === 0 && <p role="status" className="mt-4 rounded-2xl bg-white p-5">Nenhuma solicitação encontrada.</p>}
        <div className="mt-4 grid gap-3">
          {reservations.map(item => <article key={item.id} className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="flex flex-wrap justify-between gap-3"><h2 className="font-bold">{item.name}</h2><span>{item.status}</span></div>
            <p className="mt-2 text-sm">{item.date} às {item.time} · {item.people} pessoas</p>
            <p className="mt-1 text-sm">Contato: {item.phone}</p>
            {item.notes && <p className="mt-2 text-sm text-gray-600">Observações: {item.notes}</p>}
            <div className="mt-4 flex flex-wrap gap-2">{(transitions[item.status] ?? []).map(action =>
              <Button key={action.status} variant={action.status === 'CONFIRMED' ? 'default' : 'outline'}
                disabled={busy} onClick={() => void update(item, action.status)}>{action.label}</Button>)}</div>
          </article>)}
        </div>
      </>}
      <Link href={'/loja/' + tenantId} className="mt-6 inline-block text-sm font-semibold underline">Voltar à loja</Link>
    </div>
  </main>;
}
