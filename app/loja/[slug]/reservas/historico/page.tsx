'use client';

import { onAuthStateChanged } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { getFirebaseClient, hasFirebaseConfig } from '@/lib/firebase/client';
import { validTenantSlug } from '@/shared/tenancy';

type Reservation = {
  id: string; status: string; date: string; time: string; people: number; createdAt: string | null;
};
const statusLabel: Record<string, string> = {
  REQUESTED: 'Aguardando confirmação', CONFIRMED: 'Confirmada',
  REFUSED: 'Recusada', CANCELLED: 'Cancelada', COMPLETED: 'Atendida',
};
export default function MyTenantReservations() {
  const params = useParams();
  const tenantId = typeof params.slug === 'string' ? params.slug : '';
  const valid = hasFirebaseConfig && tenantId !== 'teiko' && validTenantSlug(tenantId);
  const [rows, setRows] = useState<Reservation[]>([]);
  const [session, setSession] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!valid) { setBusy(false); setError('Restaurante inválido.'); return; }
    let live = true;
    const stop = onAuthStateChanged(getFirebaseClient().auth, user => {
      if (!live) return;
      setSession(!!user);
      if (!user) {
        setBusy(false); setRows([]);
        setError('Use a mesma sessão em que enviou a solicitação.');
        return;
      }
      void load();
    });
    async function load() {
      setBusy(true); setError('');
      try {
        const result = await httpsCallable(getFirebaseClient().functions, 'tenantListMyReservations')({ tenantId });
        if (live) setRows((result.data as { reservations: Reservation[] }).reservations ?? []);
      } catch { if (live) setError('Não foi possível consultar suas reservas.'); }
      finally { if (live) setBusy(false); }
    }
    return () => { live = false; stop(); };
  }, [tenantId, valid]);

  async function refresh() {
    setBusy(true); setError('');
    try {
      const result = await httpsCallable(getFirebaseClient().functions, 'tenantListMyReservations')({ tenantId });
      setRows((result.data as { reservations: Reservation[] }).reservations ?? []);
    } catch { setError('Não foi possível atualizar o histórico.'); }
    finally { setBusy(false); }
  }
  return <main className="min-h-screen bg-[#f3f0e8] p-4 text-[#111613] sm:p-8">
    <div className="mx-auto max-w-2xl rounded-3xl bg-white p-6 shadow-sm">
      <h1 className="text-3xl font-black">Minhas solicitações</h1>
      <p className="mt-2 text-sm text-gray-600">Reservas somente da sessão atual neste restaurante. Nenhum dado de outros clientes é exibido.</p>
      {busy && <p role="status" className="mt-4">Consultando reservas…</p>}
      {error && <p role="alert" className="mt-4 rounded-lg bg-red-100 p-4 text-red-800">{error}</p>}
      {!busy && !error && rows.length === 0 && <p className="mt-4">Nenhuma solicitação encontrada nesta sessão.</p>}
      <div className="mt-5 grid gap-3">{rows.map(reservation =>
        <Link key={reservation.id} href={'/loja/' + tenantId + '/reservas/' + reservation.id}
          className="rounded-xl border p-4 hover:bg-[#f3f0e8]">
          <p className="font-semibold">{reservation.date} às {reservation.time} · {reservation.people} pessoas</p>
          <p className="mt-2 text-sm">{statusLabel[reservation.status] ?? reservation.status}</p>
        </Link>)}</div>
      <div className="mt-6 flex flex-wrap gap-4">
        {session && <Button variant="outline" disabled={busy} onClick={() => void refresh()}>Atualizar</Button>}
        <Link className="text-sm font-semibold underline" href={'/loja/' + tenantId + '/reservas'}>Solicitar reserva</Link>
        <Link className="text-sm font-semibold underline" href={'/loja/' + tenantId}>Voltar ao restaurante</Link>
      </div>
    </div>
  </main>;
}
