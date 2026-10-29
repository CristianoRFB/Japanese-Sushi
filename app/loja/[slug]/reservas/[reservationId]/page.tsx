'use client';

import { onAuthStateChanged } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { getFirebaseClient, hasFirebaseConfig } from '@/lib/firebase/client';
import { validTenantSlug } from '@/shared/tenancy';

type Reservation = { reservationId: string; status: string; name: string; date: string; time: string; people: number };
const labels: Record<string, string> = {
  REQUESTED: 'Solicitação recebida — aguardando confirmação',
  CONFIRMED: 'Confirmada pela equipe',
  REFUSED: 'Não foi possível confirmar',
  CANCELLED: 'Cancelada', COMPLETED: 'Atendimento realizado',
};

export default function TenantReservationReceipt() {
  const params = useParams();
  const tenantId = typeof params.slug === 'string' ? params.slug : '';
  const id = typeof params.reservationId === 'string' ? params.reservationId : '';
  const valid = hasFirebaseConfig && validTenantSlug(tenantId) && tenantId !== 'teiko'
    && /^[A-Za-z0-9_-]{10,128}$/.test(id);
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [session, setSession] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setBusy(true); setError('');
    try {
      const result = await httpsCallable(getFirebaseClient().functions, 'tenantGetMyReservation')({
        tenantId, reservationId: id,
      });
      setReservation(result.data as Reservation);
    } catch {
      setError('Não foi possível consultar a reserva na sessão atual.');
    } finally { setBusy(false); }
  }
  useEffect(() => {
    if (!valid) { setBusy(false); setError('Reserva inválida.'); return; }
    let active = true;
    return onAuthStateChanged(getFirebaseClient().auth, current => {
      if (!active) return;
      setSession(!!current);
      if (current) void load();
      else { setBusy(false); setError('Abra a mesma sessão em que enviou a reserva.'); setReservation(null); }
    });
  }, [tenantId, id, valid]);

  async function cancel() {
    if (!reservation) return;
    setBusy(true); setError('');
    try {
      await httpsCallable(getFirebaseClient().functions, 'tenantCancelMyReservation')({ tenantId, reservationId: id });
      await load();
    } catch { setError('Não foi possível cancelar esta reserva. Atualize o status antes de tentar novamente.'); }
    finally { setBusy(false); }
  }
  return <main className="min-h-screen bg-[#f3f0e8] p-4 text-[#111613] sm:p-8">
    <div className="mx-auto max-w-xl rounded-3xl bg-white p-6">
      <h1 className="text-3xl font-black">Sua reserva</h1>
      {busy && <p role="status" className="mt-5">Consultando reserva…</p>}
      {error && <p role="alert" className="mt-4 rounded-lg bg-red-100 p-4 text-red-800">{error}</p>}
      {reservation && <section className="mt-5">
        <p className="rounded-xl bg-[#f3f0e8] p-4 font-bold">{labels[reservation.status] ?? 'Em acompanhamento'}</p>
        <p className="mt-3 text-sm">{reservation.name} · {reservation.people} pessoas</p>
        <p className="mt-1 text-sm">{reservation.date} às {reservation.time}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button variant="outline" disabled={busy || !session} onClick={() => void load()}>Atualizar</Button>
          {['REQUESTED', 'CONFIRMED'].includes(reservation.status) &&
            <Button variant="outline" disabled={busy} onClick={() => void cancel()}>Cancelar solicitação</Button>}
        </div>
      </section>}
      <Link href={'/loja/' + tenantId} className="mt-6 inline-block text-sm font-semibold underline">Voltar ao restaurante</Link>
    </div>
  </main>;
}
