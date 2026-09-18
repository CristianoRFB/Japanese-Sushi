'use client';

import { addDoc, collection, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { ArrowDownLeft, ArrowUpRight, CalendarDays, Pencil, Plus, Save, WalletCards, X } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';

import { AdminField, AdminTextarea } from '@/components/admin-form';
import { AdminShell } from '@/components/admin-shell';
import { useAuth } from '@/components/providers';
import { Button } from '@/components/ui/button';
import { getFirebaseClient } from '@/lib/firebase/client';
import { formatBRL, TEIKO_BRAND_ID } from '@/shared/domain';
import { FINANCE_CATEGORIES, formatDateKey, parseBRLToCents, type FinanceEntry, type FinanceEntryKind, type FinanceEntryStatus } from '@/shared/finance';

const today = () => { const value = new Date(); return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`; };
const money = (cents?: number) => cents === undefined ? '' : (cents / 100).toFixed(2).replace('.', ',');

export default function FinancesPage() {
  const { role } = useAuth();
  const [entries, setEntries] = useState<FinanceEntry[]>([]);
  const [month, setMonth] = useState(() => today().slice(0, 7));
  const [kind, setKind] = useState<'ALL' | FinanceEntryKind>('ALL');
  const [editing, setEditing] = useState<FinanceEntry | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (role !== 'admin') {
      setLoading(false);
      return undefined;
    }
    return onSnapshot(query(collection(getFirebaseClient().db, 'financeEntries'), where('brandId', '==', TEIKO_BRAND_ID)), (snapshot) => {
      setEntries(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as FinanceEntry).sort((a, b) => `${b.date}-${b.id}`.localeCompare(`${a.date}-${a.id}`)));
      setLoading(false);
    }, () => {
      setLoading(false);
      setError('Não foi possível carregar o caixa. Confira sua conexão e tente novamente.');
    });
  }, [role]);
  const visible = useMemo(() => entries.filter((entry) => entry.date.startsWith(month) && (kind === 'ALL' || entry.kind === kind)), [entries, month, kind]);
  const summary = useMemo(() => {
    const income = visible.filter((entry) => entry.kind === 'INCOME');
    const expense = visible.filter((entry) => entry.kind === 'EXPENSE');
    const pending = income.filter((entry) => entry.status === 'PENDING').reduce((sum, entry) => sum + entry.amountCents, 0);
    return { income: income.reduce((sum, entry) => sum + entry.amountCents, 0), expense: expense.reduce((sum, entry) => sum + entry.amountCents, 0), balance: income.filter((entry) => entry.status === 'PAID').reduce((sum, entry) => sum + entry.amountCents, 0) - expense.filter((entry) => entry.status === 'PAID').reduce((sum, entry) => sum + entry.amountCents, 0), pending };
  }, [visible]);
  function openForm(entry: FinanceEntry | null) { setEditing(entry); setFormOpen(true); setError(''); setNotice(''); }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setNotice('');
    const data = new FormData(event.currentTarget); const description = String(data.get('description') || '').trim(); const category = String(data.get('category') || '').trim(); const date = String(data.get('date') || ''); const amountCents = parseBRLToCents(String(data.get('amount') || ''));
    if (!description || !category || !/^\d{4}-\d{2}-\d{2}$/.test(date) || amountCents <= 0) { setError('Preencha descrição, categoria, data e um valor em reais maior que zero.'); return; }
    const payload = { brandId: TEIKO_BRAND_ID, kind: String(data.get('kind') || 'INCOME') as FinanceEntryKind, category, description, date, amountCents, status: String(data.get('status') || 'PAID') as FinanceEntryStatus, orderNumber: String(data.get('orderNumber') || '').trim() || null, notes: String(data.get('notes') || '').trim() || null, updatedAt: serverTimestamp() };
    try { const db = getFirebaseClient().db; if (editing) await updateDoc(doc(db, 'financeEntries', editing.id), payload); else await addDoc(collection(db, 'financeEntries'), { ...payload, createdAt: serverTimestamp() }); setFormOpen(false); setEditing(null); setNotice(editing ? 'Lançamento atualizado.' : 'Lançamento adicionado ao caixa.'); } catch { setError('Não foi possível salvar o lançamento. Confira sua conexão e tente novamente.'); }
  }
  async function toggle(entry: FinanceEntry) { try { await updateDoc(doc(getFirebaseClient().db, 'financeEntries', entry.id), { status: entry.status === 'PAID' ? 'PENDING' : 'PAID', updatedAt: serverTimestamp() }); setNotice(entry.status === 'PAID' ? 'Lançamento marcado como pendente.' : 'Lançamento marcado como pago.'); } catch { setError('Não foi possível atualizar o status do lançamento.'); } }
  return <AdminShell adminOnly><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#8b1e2b]">Gestão da loja</p><h1 className="mt-2 text-3xl font-black tracking-[-.04em]">Finanças</h1><p className="mt-2 max-w-2xl text-sm text-[#7b887d]">Controle do caixa: vendas de sushi, insumos frescos, embalagens e despesas.</p></div><Button type="button" onClick={() => openForm(null)} className="rounded-full bg-[#b5232b] text-white"><Plus /> Novo lançamento</Button></div>
    {error && <p role="alert" className="mt-5 rounded-xl bg-[#e8efe5] p-3 text-sm text-[#e3262e]">{error}</p>}{notice && <p role="status" className="mt-5 rounded-xl bg-[#d6e7bf]/25 p-3 text-sm text-[#3a5b35]">{notice}</p>}
    <section className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Summary label="Receitas lançadas" value={formatBRL(summary.income)} icon={<ArrowUpRight />} tone="text-emerald-700 bg-emerald-50" /><Summary label="Despesas lançadas" value={formatBRL(summary.expense)} icon={<ArrowDownLeft />} tone="text-red-700 bg-red-50" /><Summary label="Saldo já pago" value={formatBRL(summary.balance)} icon={<WalletCards />} tone="text-[#b5232b] bg-[#e8efe5]" /><Summary label="A receber" value={formatBRL(summary.pending)} icon={<CalendarDays />} tone="text-amber-700 bg-amber-50" /></section>
    {formOpen && <section className="mt-7 rounded-[26px] bg-white p-5 shadow-sm sm:p-7"><div className="flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-wider text-[#8b1e2b]">Caixa</p><h2 className="mt-1 text-2xl font-black">{editing ? 'Editar lançamento' : 'Adicionar ao caixa'}</h2></div><button type="button" onClick={() => setFormOpen(false)} aria-label="Fechar formulário"><X /></button></div><form onSubmit={save} className="mt-6"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><SelectField label="Tipo" name="kind" defaultValue={editing?.kind ?? 'INCOME'} options={[['INCOME', 'Receita (entrada)'], ['EXPENSE', 'Despesa (saída)']]} /><SelectField label="Categoria" name="category" defaultValue={editing?.category ?? FINANCE_CATEGORIES[0]} options={FINANCE_CATEGORIES.map((item) => [item, item])} /><AdminField label="Valor (R$)" name="amount" inputMode="decimal" required defaultValue={money(editing?.amountCents)} placeholder="Ex.: 39,90" /><AdminField label="Data" name="date" type="date" required defaultValue={editing?.date ?? today()} /></div><div className="mt-4 grid gap-4 sm:grid-cols-2"><AdminField label="Descrição" name="description" required defaultValue={editing?.description} placeholder="Ex.: Venda de combinado" /><AdminField label="Pedido relacionado (opcional)" name="orderNumber" defaultValue={editing?.orderNumber} /></div><div className="mt-4 grid gap-4 sm:grid-cols-2"><SelectField label="Situação" name="status" defaultValue={editing?.status ?? 'PAID'} options={[['PAID', 'Pago / recebido'], ['PENDING', 'Pendente']]} /><AdminTextarea label="Observação (opcional)" name="notes" defaultValue={editing?.notes} /></div><Button type="submit" className="mt-5 rounded-full bg-[#b5232b] text-white"><Save /> Salvar lançamento</Button></form></section>}
    {loading ? <FinanceLoading /> : <section className="mt-7 rounded-[26px] bg-white p-5 shadow-sm sm:p-7"><div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end"><div><p className="text-xs font-black uppercase tracking-wider text-[#8b1e2b]">Movimentações</p><h2 className="mt-1 text-2xl font-black">Caixa da Teiko</h2></div><div className="flex gap-2"><label className="text-xs font-bold text-[#7b887d]">Mês<input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="mt-1 h-10 rounded-xl border px-3 text-sm font-bold" /></label><SelectField label="Exibir" name="filter" value={kind} onChange={(event) => setKind(event.target.value as 'ALL' | FinanceEntryKind)} options={[['ALL', 'Tudo'], ['INCOME', 'Receitas'], ['EXPENSE', 'Despesas']]} /></div></div><div className="mt-6 overflow-hidden rounded-2xl border border-[#b5232b]/10"><div className="hidden grid-cols-[110px_1fr_150px_130px_110px] gap-4 bg-[#f3f0e8] px-4 py-3 text-[10px] font-black uppercase tracking-wider text-[#7b887d] md:grid"><span>Data</span><span>Lançamento</span><span>Categoria</span><span>Situação</span><span>Valor</span></div>{visible.map((entry) => <article key={entry.id} className="grid gap-3 border-b border-[#b5232b]/8 px-4 py-4 last:border-0 md:grid-cols-[110px_1fr_150px_130px_110px] md:items-center md:gap-4"><span className="text-xs font-bold text-[#7b887d]">{formatDateKey(entry.date)}</span><span><strong className="block text-sm">{entry.description}</strong><small className="text-xs text-[#7b887d]">{entry.orderNumber ? `Pedido ${entry.orderNumber}` : entry.notes || 'Sem observações'}</small></span><span className="w-fit rounded-full bg-[#e8efe5] px-2.5 py-1 text-[11px] font-bold text-[#b5232b]">{entry.category}</span><button type="button" onClick={() => void toggle(entry)} className={`w-fit rounded-full px-2.5 py-1 text-[11px] font-black ${entry.status === 'PAID' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{entry.status === 'PAID' ? 'Pago / recebido' : 'Pendente'}</button><div className="flex items-center justify-between gap-3 md:justify-end"><strong className={entry.kind === 'INCOME' ? 'text-emerald-700' : 'text-red-700'}>{entry.kind === 'INCOME' ? '+' : '-'} {formatBRL(entry.amountCents)}</strong><button type="button" onClick={() => openForm(entry)} aria-label={`Editar ${entry.description}`} className="grid size-8 place-items-center rounded-full bg-[#f8f1f4] text-[#b5232b]"><Pencil className="size-3.5" /></button></div></article>)}{!visible.length && <div className="p-10 text-center"><WalletCards className="mx-auto size-8 text-[#8b1e2b]" /><h3 className="mt-3 font-black">Nenhum lançamento neste filtro</h3><p className="mt-1 text-sm text-[#7b887d]">Adicione vendas, despesas ou altere o mês selecionado.</p></div>}</div></section>}
  </AdminShell>;
}

function FinanceLoading() {
  return <section className="mt-7 rounded-[26px] bg-white p-5 shadow-sm sm:p-7" aria-busy="true" aria-label="Carregando movimentações">
    <div className="h-7 w-44 animate-pulse rounded bg-[#e8efe5]" />
    <div className="mt-6 space-y-3">
      {[1, 2, 3, 4].map((item) => <div key={item} className="h-14 animate-pulse rounded-xl bg-[#f3f0e8]" />)}
    </div>
  </section>;
}

function SelectField({ label, name, options, value, defaultValue, onChange }: { label: string; name: string; options: Array<[string, string]>; value?: string; defaultValue?: string; onChange?: (event: React.ChangeEvent<HTMLSelectElement>) => void }) { return <label className="block text-sm font-bold">{label}<select name={name} value={value} defaultValue={defaultValue} onChange={onChange} className="mt-2 h-11 w-full rounded-xl border border-[#b5232b]/15 bg-[#f3f0e8] px-3 font-normal">{options.map(([option, text]) => <option key={option} value={option}>{text}</option>)}</select></label>; }
function Summary({ label, value, icon, tone }: { label: string; value: string; icon: ReactNode; tone: string }) { return <article className="rounded-[22px] bg-white p-5 shadow-sm"><span className={`grid size-10 place-items-center rounded-2xl ${tone}`}>{icon}</span><p className="mt-4 text-xs font-bold text-[#7b887d]">{label}</p><strong className="mt-1 block text-2xl font-black tracking-tight">{value}</strong></article>; }
