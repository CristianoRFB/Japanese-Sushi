'use client';

import {
  arrayUnion,
  collection,
  deleteField,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  Timestamp,
} from 'firebase/firestore';
import { AlertCircle, CalendarDays, Check, Loader2, Search, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { AdminShell } from '@/components/admin-shell';
import { useAuth } from '@/components/providers';
import { getFirebaseClient } from '@/lib/firebase/client';
import {
  isValidReservationDate,
  RESERVATION_YEAR,
  TEIKO_BRAND_ID,
  type ReservationStatus,
  type DiningTable,
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
  tableId?: string;
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
type ReservationFilter = 'UPCOMING' | 'TODAY' | 'REQUESTED' | 'CONFIRMED' | 'ALL';
const reservationFilters: Array<[ReservationFilter, string]> = [
  ['UPCOMING', 'Próximas'],
  ['TODAY', 'Hoje'],
  ['REQUESTED', 'Aguardando'],
  ['CONFIRMED', 'Confirmadas'],
  ['ALL', 'Todas'],
];

export default function ReservationsPage() {
  const { user, role } = useAuth();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [tables, setTables] = useState<DiningTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ReservationFilter>('UPCOMING');
  const [search, setSearch] = useState('');
  useEffect(
    () =>
      onSnapshot(
        query(
          collection(getFirebaseClient().db, 'reservations'),
          where('brandId', '==', TEIKO_BRAND_ID),
          orderBy('date', 'asc'),
        ),
        (snapshot) => {
          setReservations(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Reservation)
            .filter((item) => isValidReservationDate(item.date))
            .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`)));
          setLoading(false);
        },
        () => { setError('Não foi possível carregar a fila de reservas agora.'); setLoading(false); },
      ),
    [],
  );
  useEffect(
    () =>
      onSnapshot(
        query(
          collection(getFirebaseClient().db, 'tables'),
          where('brandId', '==', TEIKO_BRAND_ID),
        ),
        (snapshot) =>
          setTables(
            snapshot.docs
              .map((item) => ({ id: item.id, ...item.data() }) as DiningTable)
              .filter((table) => table.active)
              .sort((a, b) => a.displayOrder - b.displayOrder),
          ),
        () => setError('Não foi possível carregar as mesas para a agenda.'),
      ),
    [],
  );
  function hasConflict(reservation: Reservation, tableId: string) {
    return reservations.some(
      (other) =>
        other.id !== reservation.id &&
        other.tableId === tableId &&
        other.date === reservation.date &&
        other.time === reservation.time &&
        ['REQUESTED', 'CONFIRMED'].includes(other.status),
    );
  }
  function tableCapacityError(reservation: Reservation, tableId: string) {
    const table = tables.find((candidate) => candidate.id === tableId);
    return table && reservation.people > table.capacity
      ? `A ${table.name} comporta até ${table.capacity} pessoas.`
      : '';
  }
  async function assignTable(reservation: Reservation, tableId: string) {
    if (tableId && hasConflict(reservation, tableId)) {
      setError('Esta mesa já está vinculada a outra reserva ativa no mesmo dia e horário.');
      return;
    }
    if (tableId) {
      const capacityError = tableCapacityError(reservation, tableId);
      if (capacityError) {
        setError(capacityError);
        return;
      }
    }
    setBusy(`${reservation.id}:table`);
    setError('');
    try {
      await updateDoc(doc(getFirebaseClient().db, 'reservations', reservation.id), {
        ...(tableId ? { tableId } : { tableId: deleteField() }),
        updatedAt: serverTimestamp(),
      });
    } catch {
      setError('Não foi possível vincular esta mesa à reserva.');
    } finally {
      setBusy('');
    }
  }
  const requestedCount = useMemo(() => reservations.filter((reservation) => reservation.status === 'REQUESTED').length, [reservations]);
  const confirmedCount = useMemo(() => reservations.filter((reservation) => reservation.status === 'CONFIRMED').length, [reservations]);
  const todayKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const todayCount = useMemo(() => reservations.filter((reservation) => reservation.date === todayKey && ['REQUESTED', 'CONFIRMED'].includes(reservation.status)).length, [reservations, todayKey]);
  const visibleReservations = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR');
    return reservations.filter((reservation) => {
      const matchesFilter = filter === 'ALL'
        ? true
        : filter === 'UPCOMING'
          ? reservation.date >= todayKey && ['REQUESTED', 'CONFIRMED'].includes(reservation.status)
          : filter === 'TODAY'
            ? reservation.date === todayKey && ['REQUESTED', 'CONFIRMED'].includes(reservation.status)
            : reservation.status === filter;
      const matchesSearch = !term || `${reservation.name} ${reservation.whatsapp}`.toLocaleLowerCase('pt-BR').includes(term);
      return matchesFilter && matchesSearch;
    });
  }, [reservations, filter, search, todayKey]);
  async function change(id: string, status: ReservationStatus) {
    const reservation = reservations.find((candidate) => candidate.id === id);
    if (status === 'CONFIRMED' && reservation && tables.length) {
      if (!reservation.tableId) {
        setError('Escolha uma mesa antes de confirmar a reserva.');
        return;
      }
      const capacityError = tableCapacityError(reservation, reservation.tableId);
      if (capacityError || hasConflict(reservation, reservation.tableId)) {
        setError(capacityError || 'Esta mesa já está vinculada a outra reserva ativa no mesmo dia e horário.');
        return;
      }
    }
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
        <p className="text-xs font-black uppercase tracking-[.18em] text-[#e3262e]">
          Atendimento
        </p>
        <h1 className="mt-2 text-3xl font-black">Reservas</h1>
        <p className="mt-2 text-sm text-[#7b887d]">
          Solicitações de {RESERVATION_YEAR} aguardando confirmação da equipe.
        </p>
      </div>
      <section aria-label="Resumo da agenda" className="mt-6 grid gap-px overflow-hidden rounded-2xl border border-[#070a08]/10 bg-[#070a08]/10 sm:grid-cols-3">
        <Summary label="Aguardando decisão" value={String(requestedCount)} />
        <Summary label="Confirmadas" value={String(confirmedCount)} />
        <Summary label="Hoje" value={String(todayCount)} />
      </section>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative block min-w-0 flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#7b887d]" />
          <span className="sr-only">Buscar reserva</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome ou WhatsApp" aria-label="Buscar por nome ou WhatsApp" className="h-11 w-full rounded-full border border-[#070a08]/10 bg-white pl-10 pr-4 text-sm outline-none focus:border-[#b5232b]" />
        </label>
        <span className="text-xs font-bold text-[#7b887d]">{visibleReservations.length} {visibleReservations.length === 1 ? 'reserva' : 'reservas'}</span>
      </div>
      <div className="teiko-scrollbar-none mt-3 flex gap-2 overflow-x-auto pb-2">
        {reservationFilters.map(([value, label]) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} className={`shrink-0 rounded-full px-4 py-2 text-xs font-black ${filter === value ? 'bg-[#070a08] text-white' : 'bg-white text-[#7b887d]'}`}>{label}</button>)}
      </div>
      {error && (
        <div
          role="alert"
          aria-live="assertive"
          className="mt-5 flex items-start gap-3 rounded-2xl border border-[#e3262e]/30 bg-[#e8efe5] p-4 text-sm text-[#e3262e]"
        >
          <AlertCircle className="mt-0.5 size-5 shrink-0" />
          <div>
            <strong className="block">Não foi possível concluir</strong>
            <span>{error}</span>
          </div>
        </div>
      )}
      <div className="mt-7 grid gap-4 lg:grid-cols-2">
        {loading && <><div className="h-72 animate-pulse rounded-[26px] bg-white" /><div className="h-72 animate-pulse rounded-[26px] bg-white" /></>}
        {!loading && visibleReservations.map((reservation) => (
          <article
            key={reservation.id}
            className="rounded-[26px] bg-white p-5 shadow-sm"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">{reservation.name}</h2>
                <p className="mt-1 text-sm text-[#7b887d]">
                  {reservation.whatsapp}
                </p>
              </div>
              <span className="rounded-full bg-[#f3f0e8] px-3 py-1 text-xs font-black text-[#7b887d]">
                {labels[reservation.status]}
              </span>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-3 border-y border-[#070a08]/10 py-4 text-sm">
              <span>
                <small className="block text-xs text-[#7b887d]">Data</small>
                    <strong>{reservation.date.split('-').reverse().join('/')}</strong>
              </span>
              <span>
                <small className="block text-xs text-[#7b887d]">Horário</small>
                <strong>{reservation.time}</strong>
              </span>
              <span>
                <small className="block text-xs text-[#7b887d]">Pessoas</small>
                <strong>{reservation.people}</strong>
              </span>
            </div>
            {reservation.notes && (
              <p className="mt-4 rounded-xl bg-[#f3f0e8] p-3 text-sm">
                {reservation.notes}
              </p>
            )}
            <label className="mt-4 block text-sm font-bold">
              Mesa para confirmação
              <select
                value={reservation.tableId ?? ''}
                onChange={(event) => void assignTable(reservation, event.target.value)}
                disabled={Boolean(busy)}
                className="mt-2 h-11 w-full rounded-xl border border-[#070a08]/15 bg-[#f3f0e8] px-3 font-normal outline-none focus:border-[#c7a773]"
              >
                <option value="">Definir depois</option>
                {tables.map((table) => (
                  <option key={table.id} value={table.id}>
                    {table.name} · até {table.capacity} pessoas
                  </option>
                ))}
              </select>
              {reservation.tableId && hasConflict(reservation, reservation.tableId) && (
                <span className="mt-1 block text-xs font-bold text-[#e3262e]">Conflito: revise esta mesa antes de confirmar.</span>
              )}
              {reservation.tableId && tableCapacityError(reservation, reservation.tableId) && (
                <span className="mt-1 block text-xs font-bold text-[#e3262e]">{tableCapacityError(reservation, reservation.tableId)}</span>
              )}
            </label>
            {next[reservation.status].length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2">
                {next[reservation.status].map((status) => (
                  <button
                    key={status}
                    disabled={Boolean(busy)}
                    onClick={() => void change(reservation.id, status)}
                    className={`inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-xs font-black ${status === 'REFUSED' || status === 'CANCELLED' ? 'bg-[#e8efe5] text-[#e3262e]' : 'bg-[#070a08] text-white'}`}
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
        {!loading && !visibleReservations.length && (
          <div className="rounded-[26px] border border-dashed border-[#070a08]/20 p-10 text-center text-sm text-[#7b887d]">
            <CalendarDays className="mx-auto size-8" />
            <p className="mt-3">{search ? 'Nenhuma reserva encontrada para essa busca.' : 'Nenhuma reserva nesta visão.'}</p>
          </div>
        )}
      </div>
    </AdminShell>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return <article className="bg-white p-4"><p className="text-xs font-bold text-[#7b887d]">{label}</p><strong className="mt-1 block text-2xl font-black">{value}</strong></article>;
}
