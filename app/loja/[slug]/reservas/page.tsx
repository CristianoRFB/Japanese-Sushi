'use client';

import { httpsCallable } from 'firebase/functions';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { ensureAnonymousUser, getFirebaseClient, hasFirebaseConfig } from '@/lib/firebase/client';
import { validTenantSlug } from '@/shared/tenancy';

type ReservationResult = { reservationId: string; status: string };
type PublicTenant = { id: string; status: string; reservationsEnabled?: boolean; branding: { displayName: string } };

export default function TenantReservationPage() {
  const params = useParams();
  const tenantId = typeof params.slug === 'string' ? params.slug : '';
  const [active, setActive] = useState(false);
  const [restaurantName, setRestaurantName] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState<ReservationResult | null>(null);
  const [formValues, setFormValues] = useState({ name: '', phone: '', date: '', time: '19:00', people: 2, notes: '' });
  const pendingId = useRef<string | null>(null);
  const valid = hasFirebaseConfig && validTenantSlug(tenantId) && tenantId !== 'teiko';
  useEffect(() => {
    if (!valid) { setLoading(false); setError('Restaurante não encontrado.'); return; }
    let attached = true;
    void httpsCallable(getFirebaseClient().functions, 'resolvePublicTenant')({ slug: tenantId })
      .then(response => {
        if (!attached) return;
        const result = response.data as PublicTenant;
        setRestaurantName(result.branding?.displayName ?? '');
        setActive(result.id === tenantId && result.status === 'ACTIVE' && result.reservationsEnabled === true);
      })
      .catch(() => { if (attached) setError('Não foi possível consultar o restaurante.'); })
      .finally(() => { if (attached) setLoading(false); });
    return () => { attached = false; };
  }, [tenantId, valid]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!active || busy) return;
    setBusy(true); setError('');
    if (!pendingId.current) pendingId.current = crypto.randomUUID();
    try {
      await ensureAnonymousUser();
      const result = await httpsCallable(getFirebaseClient().functions, 'tenantCreateReservation')({
        tenantId, clientRequestId: pendingId.current,
        name: formValues.name.trim(), phone: formValues.phone.replace(/\D/g, ''),
        date: formValues.date, time: formValues.time,
        people: formValues.people, notes: formValues.notes.trim(),
      });
      setReceipt(result.data as ReservationResult);
    } catch {
      setError('Não foi possível registrar a solicitação. Confira os campos e tente novamente sem alterar os dados.');
    } finally { setBusy(false); }
  }
  function update<K extends keyof typeof formValues>(key: K, value: (typeof formValues)[K]) {
    pendingId.current = null; setReceipt(null);
    setFormValues(current => ({ ...current, [key]: value }));
  }
  return <main className="min-h-screen bg-[#f3f0e8] p-4 text-[#111613] sm:p-8">
    <div className="mx-auto max-w-xl rounded-3xl bg-white p-6 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-widest text-[#b5232b]">Sushi SaaS · {restaurantName || tenantId}</p>
      <h1 className="mt-2 text-3xl font-black">Solicitar reserva</h1>
      <p className="mt-2 text-sm text-gray-600">Uma solicitação não garante mesa. A equipe precisa confirmar manualmente a disponibilidade.</p>
      {loading && <p role="status" className="mt-4">Verificando disponibilidade da funcionalidade…</p>}
      {error && <p role="alert" className="mt-4 rounded-lg bg-red-100 p-4 text-red-800">{error}</p>}
      {!loading && !active && <p role="status" className="mt-4 rounded-lg bg-amber-50 p-4 text-amber-900">Reservas online indisponíveis nesta unidade.</p>}
      {receipt && <div role="status" className="mt-5 rounded-xl border p-4">
        <p className="font-bold">Solicitação recebida — ainda não confirmada.</p>
        <p className="mt-2 text-sm">Protocolo: {receipt.reservationId}</p>
        <Link className="mt-3 inline-block text-sm font-semibold underline" href={'/loja/' + tenantId + '/reservas/' + receipt.reservationId}>Acompanhar solicitação</Link>
      </div>}
      {active && !receipt && <form onSubmit={submit} className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="sm:col-span-2">Nome
          <input required minLength={2} maxLength={80} autoComplete="name" value={formValues.name}
            onChange={e => update('name', e.target.value)} className="mt-1 w-full rounded-lg border p-3"/>
        </label>
        <label className="sm:col-span-2">Telefone para contato (somente dígitos)
          <input required inputMode="tel" pattern="\d{10,13}" minLength={10} maxLength={13} value={formValues.phone}
            onChange={e => update('phone', e.target.value)} className="mt-1 w-full rounded-lg border p-3"/>
        </label>
        <label>Data
          <input required type="date" value={formValues.date} onChange={e => update('date', e.target.value)}
            className="mt-1 w-full rounded-lg border p-3"/>
        </label>
        <label>Horário
          <input required type="time" value={formValues.time} onChange={e => update('time', e.target.value)}
            className="mt-1 w-full rounded-lg border p-3"/>
        </label>
        <label>Pessoas
          <input required type="number" min={1} max={30} value={formValues.people}
            onChange={e => update('people', Number(e.target.value))}
            className="mt-1 w-full rounded-lg border p-3"/>
        </label>
        <label className="sm:col-span-2">Observações (opcional)
          <textarea maxLength={500} value={formValues.notes} onChange={e => update('notes', e.target.value)}
            className="mt-1 w-full rounded-lg border p-3"/>
        </label>
        <Button className="sm:col-span-2" type="submit" disabled={busy}>{busy ? 'Enviando…' : 'Enviar solicitação'}</Button>
      </form>}
      <Link href={'/loja/' + tenantId} className="mt-6 inline-block text-sm font-semibold underline">Voltar ao restaurante</Link>
    </div>
  </main>;
}
