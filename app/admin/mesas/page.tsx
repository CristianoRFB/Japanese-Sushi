'use client';

import { addDoc, collection, onSnapshot, query, serverTimestamp, updateDoc, doc, where } from 'firebase/firestore';
import { Armchair, Check, Loader2, Plus, Power, SquareStack } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';

import { AdminField } from '@/components/admin-form';
import { AdminShell } from '@/components/admin-shell';
import { Button } from '@/components/ui/button';
import { getFirebaseClient } from '@/lib/firebase/client';
import { TEIKO_BRAND_ID, type DiningTable } from '@/shared/domain';

export default function TablesPage() {
  const [tables, setTables] = useState<DiningTable[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');

  useEffect(() => onSnapshot(
    query(collection(getFirebaseClient().db, 'tables'), where('brandId', '==', TEIKO_BRAND_ID)),
    (snapshot) => setTables(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as DiningTable).sort((a, b) => a.displayOrder - b.displayOrder)),
    () => setError('Não foi possível carregar as mesas da unidade.'),
  ), []);

  async function createTable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMessage('');
    const data = new FormData(event.currentTarget);
    const name = String(data.get('name') || '').trim();
    const capacity = Number(data.get('capacity'));
    if (name.length < 2 || name.length > 40) return setError('Informe um nome de mesa entre 2 e 40 caracteres.');
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 30) return setError('A capacidade deve ficar entre 1 e 30 pessoas.');
    setBusy('create');
    try {
      const { db } = getFirebaseClient();
      await addDoc(collection(db, 'tables'), {
        brandId: TEIKO_BRAND_ID,
        unitId: 'santa-fe-do-sul',
        name,
        capacity,
        active: true,
        displayOrder: tables.length + 1,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      event.currentTarget.reset();
      setMessage('Mesa adicionada à agenda.');
    } catch {
      setError('Não foi possível adicionar a mesa. Confira sua permissão administrativa.');
    } finally {
      setBusy('');
    }
  }

  async function toggleTable(table: DiningTable) {
    setBusy(table.id);
    setError('');
    setMessage('');
    try {
      await updateDoc(doc(getFirebaseClient().db, 'tables', table.id), {
        active: !table.active,
        updatedAt: serverTimestamp(),
      });
      setMessage(`${table.name} ${table.active ? 'desativada' : 'ativada'}.`);
    } catch {
      setError('Não foi possível atualizar a mesa.');
    } finally {
      setBusy('');
    }
  }

  return <AdminShell adminOnly>
    <div><p className="text-xs font-black uppercase tracking-[.18em] text-[#e3262e]">Salão</p><h1 className="mt-2 text-3xl font-black">Mesas</h1><p className="mt-2 text-sm text-[#7b887d]">Cadastre a capacidade do salão e use as mesas para confirmar reservas sem conflito.</p></div>
    {error && <p role="alert" className="mt-5 rounded-2xl border border-[#e3262e]/30 bg-[#e8efe5] p-4 text-sm text-[#e3262e]">{error}</p>}
    {message && <p role="status" className="mt-5 rounded-2xl border border-[#3a5b35]/20 bg-[#eef6c8] p-4 text-sm text-[#3a5b35]">{message}</p>}
    <div className="mt-7 grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
      <form onSubmit={createTable} className="rounded-[26px] bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-2xl bg-[#c7a773] text-[#070a08]"><Plus className="size-5" /></span><div><h2 className="text-xl font-black">Nova mesa</h2><p className="text-xs text-[#7b887d]">A equipe poderá vinculá-la a uma reserva.</p></div></div>
        <div className="mt-6 space-y-4"><AdminField label="Identificação" name="name" placeholder="Ex.: Mesa 01" required /><AdminField label="Capacidade" name="capacity" type="number" min="1" max="30" defaultValue="2" required /></div>
        <Button type="submit" disabled={busy === 'create'} className="mt-6 h-11 w-full rounded-full bg-[#b5232b] font-black text-white">{busy === 'create' ? <Loader2 className="animate-spin" /> : <Plus />} Adicionar mesa</Button>
      </form>
      <section className="rounded-[26px] bg-white p-5 shadow-sm sm:p-6"><div className="flex items-center justify-between gap-3"><div><h2 className="text-xl font-black">Mapa de mesas</h2><p className="mt-1 text-sm text-[#7b887d]">Somente mesas ativas aparecem como opção de confirmação.</p></div><SquareStack className="size-6 text-[#b5232b]" /></div><div className="mt-5 grid gap-3 sm:grid-cols-2">{tables.map((table) => <article key={table.id} className={`rounded-2xl border p-4 ${table.active ? 'border-[#c7a773]/50 bg-[#f3f0e8]' : 'border-[#070a08]/10 bg-[#f3edf0] opacity-70'}`}><div className="flex items-start justify-between gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[#e3262e] text-white"><Armchair className="size-5" /></span><span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${table.active ? 'bg-[#d6e7bf] text-[#070a08]' : 'bg-[#070a08]/10 text-[#7b887d]'}`}>{table.active ? 'Ativa' : 'Inativa'}</span></div><h3 className="mt-4 font-black">{table.name}</h3><p className="mt-1 text-sm text-[#7b887d]">Até {table.capacity} pessoas</p><button type="button" disabled={busy === table.id} onClick={() => void toggleTable(table)} className="mt-4 inline-flex items-center gap-2 text-xs font-black text-[#b5232b]">{busy === table.id ? <Loader2 className="size-4 animate-spin" /> : table.active ? <Power className="size-4" /> : <Check className="size-4" />}{table.active ? 'Desativar' : 'Ativar'}</button></article>)}{!tables.length && <div className="rounded-2xl border border-dashed border-[#070a08]/20 p-8 text-center text-sm text-[#7b887d] sm:col-span-2">Nenhuma mesa cadastrada. Adicione a primeira ao lado.</div>}</div></section>
    </div>
  </AdminShell>;
}
