'use client';

import {
  arrayUnion,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  Timestamp,
} from 'firebase/firestore';
import { AlertCircle, CalendarDays, Check, Loader2, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { AdminShell } from '@/components/admin-shell';
import { useAuth } from '@/components/providers';
import { getFirebaseClient } from '@/lib/firebase/client';
import {
  isValidReservationDate,
  RESERVATION_YEAR,
  TEIKO_BRAND_ID,
  type ReservationStatus,
} from '@/shared/domain';

interface Reservation {
  id: string;
  name: string;
  whatsapp: string;
  date: string;
  time: string;
  people: number;
  notes?: string;
  status: ReservationStatus;
}
const labels: Record<ReservationStatus, string> = {
  REQUESTED: 'Solicitada',
  CONFIRMED: 'Confirmada',
  REFUSED: 'Recusada',
  CANCELLED: 'Cancelada',
  COMPLETED: 'Concluída',
};
const next: Record<ReservationStatus, ReservationStatus[]> = {
  REQUESTED: ['CONFIRMED', 'REFUSED', 'CANCELLED'],
  CONFIRMED: ['COMPLETED', 'CANCELLED'],
  REFUSED: [],
  CANCELLED: [],
  COMPLETED: [],
};

export default function ReservationsPage() {
  const { user, role } = useAuth();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  useEffect(
    () =>
      onSnapshot(
        query(
          collection(getFirebaseClient().db, 'reservations'),
          where('brandId', '==', TEIKO_BRAND_ID),
          orderBy('date', 'asc'),
        ),
        (snapshot) =>
          setReservations(
            snapshot.docs.map(
              (item) => ({ id: item.id, ...item.data() }) as Reservation,
            ).filter((item) => isValidReservationDate(item.date)),
          ),
        () => setError('Não foi possível carregar a fila de reservas agora.'),
      ),
    [],
  );
  async function change(id: string, status: ReservationStatus) {
    setBusy(`${id}:${status}`);
    setError('');
    try {
      if (!user || !role)
        throw new Error('Sessão administrativa indisponível.');
      await updateDoc(doc(getFirebaseClient().db, 'reservations', id), {
        status,
        updatedAt: serverTimestamp(),
        statusHistory: arrayUnion({
          status,
          at: Timestamp.now(),
          actorUid: user.uid,
          actorRole: role,
        }),
      });
    } catch (cause) {
      const code = cause && typeof cause === 'object' && 'code' in cause ? String(cause.code) : '';
      setError(
        code.includes('permission-denied')
          ? 'Você não tem permissão para atualizar esta reserva.'
          : 'Não foi possível atualizar esta reserva. Tente novamente.',
      );
    } finally {
      setBusy('');
    }
  }
  return (
    <AdminShell>
      <div>
        <p className="text-xs font-black uppercase tracking-[.18em] text-[#c13a43]">
          Atendimento
        </p>
        <h1 className="mt-2 text-3xl font-black">Reservas</h1>
        <p className="mt-2 text-sm text-[#765665]">
          Solicitações de {RESERVATION_YEAR} aguardando confirmação da equipe.
        </p>
      </div>
      {error && (
        <div
          role="alert"
          aria-live="assertive"
          className="mt-5 flex items-start gap-3 rounded-2xl border border-[#c13a43]/30 bg-[#f8e9ef] p-4 text-sm text-[#c13a43]"
        >
          <AlertCircle className="mt-0.5 size-5 shrink-0" />
          <div>
            <strong className="block">Não foi possível concluir</strong>
            <span>{error}</span>
          </div>
        </div>
      )}
      <div className="mt-7 grid gap-4 lg:grid-cols-2">
        {reservations.map((reservation) => (
          <article
            key={reservation.id}
            className="rounded-[26px] bg-white p-5 shadow-sm"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">{reservation.name}</h2>
                <p className="mt-1 text-sm text-[#765665]">
                  {reservation.whatsapp}
                </p>
              </div>
              <span className="rounded-full bg-[#fff7ea] px-3 py-1 text-xs font-black text-[#765665]">
                {labels[reservation.status]}
              </span>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-3 border-y border-[#180e16]/10 py-4 text-sm">
              <span>
                <small className="block text-xs text-[#765665]">Data</small>
                    <strong>{reservation.date.split('-').reverse().join('/')}</strong>
              </span>
              <span>
                <small className="block text-xs text-[#765665]">Horário</small>
                <strong>{reservation.time}</strong>
              </span>
              <span>
                <small className="block text-xs text-[#765665]">Pessoas</small>
                <strong>{reservation.people}</strong>
              </span>
            </div>
            {reservation.notes && (
              <p className="mt-4 rounded-xl bg-[#fff8ef] p-3 text-sm">
                {reservation.notes}
              </p>
            )}
            {next[reservation.status].length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2">
                {next[reservation.status].map((status) => (
                  <button
                    key={status}
                    disabled={Boolean(busy)}
                    onClick={() => void change(reservation.id, status)}
                    className={`inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-xs font-black ${status === 'REFUSED' || status === 'CANCELLED' ? 'bg-[#f8e9ef] text-[#c13a43]' : 'bg-[#180e16] text-white'}`}
                  >
                    {busy === `${reservation.id}:${status}` ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : status === 'CONFIRMED' ? (
                      <Check className="size-4" />
                    ) : (
                      <X className="size-4" />
                    )}
                    {labels[status]}
                  </button>
                ))}
              </div>
            )}
          </article>
        ))}
        {!reservations.length && (
          <div className="rounded-[26px] border border-dashed border-[#180e16]/20 p-10 text-center text-sm text-[#765665]">
            <CalendarDays className="mx-auto size-8" />
            <p className="mt-3">Nenhuma reserva encontrada.</p>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
