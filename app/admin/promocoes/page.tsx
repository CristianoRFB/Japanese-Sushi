'use client';

import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { BadgePercent, Plus, Save, X } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';

import { AdminField, AdminTextarea } from '@/components/admin-form';
import { AdminShell } from '@/components/admin-shell';
import { Button } from '@/components/ui/button';
import { getFirebaseClient } from '@/lib/firebase/client';
import { parseBRLToCents } from '@/shared/finance';
import {
  formatPromotionValue,
  TEIKO_BRAND_ID,
  type Product,
  type Promotion,
} from '@/shared/domain';

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export default function PromotionsPage() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [editing, setEditing] = useState<Promotion | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [discountTypeDraft, setDiscountTypeDraft] = useState<Promotion['discountType']>('PERCENTAGE');

  useEffect(() => {
    const db = getFirebaseClient().db;
    const promotionsStop = onSnapshot(
      query(collection(db, 'promotions'), where('brandId', '==', TEIKO_BRAND_ID)),
      (snap) => setPromotions(snap.docs.map((item) => ({ id: item.id, ...item.data() }) as Promotion).sort((a, b) => a.startsAt.localeCompare(b.startsAt))),
      (cause) => setError(friendlyAdminError(cause)),
    );
    const productsStop = onSnapshot(
      query(collection(db, 'products'), where('brandId', '==', TEIKO_BRAND_ID)),
      (snap) => setProducts(snap.docs.map((item) => ({ id: item.id, ...item.data() }) as Product).sort((a, b) => a.name.localeCompare(b.name))),
      (cause) => setError(friendlyAdminError(cause)),
    );
    return () => {
      promotionsStop();
      productsStop();
    };
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const data = new FormData(event.currentTarget);
    const discountType = String(data.get('discountType')) as Promotion['discountType'];
    const rawDiscount = String(data.get('discountValue') || '0');
    const discountValue = discountType === 'FIXED' ? parseBRLToCents(rawDiscount) : Number(rawDiscount);
    const startsAt = String(data.get('startsAt'));
    const endsAt = String(data.get('endsAt'));
    const payload = {
      brandId: TEIKO_BRAND_ID,
      name: String(data.get('name')).trim(),
      description: String(data.get('description')).trim(),
      active: data.get('active') === 'on',
      discountType,
      discountValue,
      startsAt,
      endsAt,
      productIds: selectedProductIds,
      updatedAt: serverTimestamp(),
    };
    try {
      if (!payload.name || payload.name.length > 80) throw new Error('Informe um nome de promoção com até 80 caracteres.');
      if (!['PERCENTAGE', 'FIXED'].includes(discountType)) throw new Error('Escolha o tipo de desconto.');
      if (!Number.isSafeInteger(discountValue) || discountValue <= 0 || (discountType === 'PERCENTAGE' && discountValue > 100)) throw new Error(discountType === 'PERCENTAGE' ? 'O percentual deve ficar entre 1 e 100.' : 'Informe um desconto fixo válido em reais.');
      if (!validDate(startsAt) || !validDate(endsAt) || startsAt > endsAt) throw new Error('Informe um período válido para a promoção.');
      const db = getFirebaseClient().db;
      if (editing) await setDoc(doc(db, 'promotions', editing.id), payload, { merge: true });
      else await addDoc(collection(db, 'promotions'), payload);
      setShowForm(false);
      setEditing(null);
    } catch (cause) {
      setError(friendlyAdminError(cause, 'Não foi possível salvar a promoção.'));
    }
  }

  return (
    <AdminShell adminOnly>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#8b1e2b]">Comunicação</p>
          <h1 className="mt-2 text-3xl font-black tracking-[-.04em]">Promoções</h1>
          <p className="mt-2 text-sm text-[#7b887d]">Crie ofertas para o período e produtos escolhidos. As promoções ativas aparecem no cardápio.</p>
        </div>
        <Button onClick={() => { setEditing(null); setSelectedProductIds([]); setDiscountTypeDraft('PERCENTAGE'); setError(''); setShowForm(true); }} className="rounded-full bg-[#b5232b] text-white"><Plus /> Nova promoção</Button>
      </div>
      {error && <p role="alert" className="mt-5 rounded-2xl border border-[#e3262e]/25 bg-[#e8efe5] p-4 text-sm font-bold text-[#e3262e]">{error}</p>}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {promotions.map((promotion) => (
          <article key={promotion.id} className="rounded-[24px] bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <span className="grid size-10 place-items-center rounded-full bg-[#e8efe5] text-[#b5232b]"><BadgePercent className="size-5" /></span>
              <button onClick={() => updateDoc(doc(getFirebaseClient().db, 'promotions', promotion.id), { active: !promotion.active, updatedAt: serverTimestamp() })} className={`rounded-full px-2.5 py-1 text-[10px] font-black ${promotion.active ? 'bg-[#d6e7bf]/25 text-[#3a5b35]' : 'bg-[#d6ded4] text-[#7b887d]'}`}>{promotion.active ? 'ATIVA' : 'PAUSADA'}</button>
            </div>
            <h2 className="mt-4 text-xl font-black">{promotion.name}</h2>
            <p className="mt-2 text-sm text-[#7b887d]">{promotion.description || 'Sem descrição.'}</p>
            <strong className="mt-4 block text-lg text-[#b5232b]">{formatPromotionValue(promotion)}</strong>
            <p className="mt-1 text-xs text-[#7b887d]">{promotion.startsAt} até {promotion.endsAt}</p>
            <p className="mt-3 text-xs font-bold text-[#7b887d]">{promotion.productIds.length ? `${promotion.productIds.length} produto(s) selecionado(s)` : 'Todos os produtos elegíveis'}</p>
            <button onClick={() => { setEditing(promotion); setSelectedProductIds(promotion.productIds); setDiscountTypeDraft(promotion.discountType); setError(''); setShowForm(true); }} className="mt-5 text-sm font-black text-[#b5232b]">Editar promoção</button>
          </article>
        ))}
      </div>
      {!promotions.length && <div className="mt-8 rounded-[26px] border border-dashed border-[#c7a773]/50 p-10 text-center"><strong className="text-xl">Nenhuma promoção cadastrada</strong><p className="mt-2 text-sm text-[#7b887d]">Crie a primeira oferta para destacar no cardápio.</p></div>}
      {showForm && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-[#070a08]/50 p-4 backdrop-blur-sm">
          <form onSubmit={save} className="mx-auto my-4 max-w-2xl rounded-[28px] bg-white p-5 shadow-2xl sm:p-7">
            <div className="flex items-center justify-between"><h2 className="text-2xl font-black">{editing ? 'Editar promoção' : 'Nova promoção'}</h2><button type="button" onClick={() => setShowForm(false)} className="grid size-9 place-items-center rounded-full bg-[#e8efe5]"><X className="size-4" /></button></div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <AdminField label="Nome da promoção" name="name" required defaultValue={editing?.name} />
              <label className="block text-sm font-bold">Tipo de desconto<select name="discountType" value={discountTypeDraft} onChange={(event) => setDiscountTypeDraft(event.target.value as Promotion['discountType'])} className="mt-2 h-11 w-full rounded-xl border border-[#b5232b]/15 bg-[#f3f0e8] px-3 font-normal"><option value="PERCENTAGE">Percentual</option><option value="FIXED">Valor fixo em reais</option></select></label>
              <AdminField key={`discount-${discountTypeDraft}-${editing?.id ?? 'new'}`} label={discountTypeDraft === 'FIXED' ? 'Desconto (R$)' : 'Desconto (%)'} name="discountValue" type="number" min="0.01" step="0.01" max={discountTypeDraft === 'PERCENTAGE' ? 100 : undefined} required defaultValue={discountTypeDraft === 'FIXED' ? ((editing?.discountValue ?? 0) / 100).toFixed(2) : editing?.discountValue ?? 10} />
              <label className="block text-sm font-bold">Início<input name="startsAt" type="date" required defaultValue={editing?.startsAt} className="mt-2 h-11 w-full rounded-xl border border-[#b5232b]/15 bg-[#f3f0e8] px-3 font-normal" /></label>
              <label className="block text-sm font-bold">Fim<input name="endsAt" type="date" required defaultValue={editing?.endsAt} className="mt-2 h-11 w-full rounded-xl border border-[#b5232b]/15 bg-[#f3f0e8] px-3 font-normal" /></label>
              <label className="flex items-center gap-2 self-end pb-2 text-sm font-bold"><input type="checkbox" name="active" defaultChecked={editing?.active ?? true} /> Promoção ativa</label>
            </div>
            <div className="mt-4"><AdminTextarea label="Descrição para o cliente" name="description" rows={3} defaultValue={editing?.description} /></div>
            <fieldset className="mt-4 rounded-2xl border border-[#b5232b]/15 bg-[#f3f0e8] p-4"><legend className="px-1 text-sm font-black">Produtos participantes</legend><p className="mt-1 text-xs font-normal text-[#7b887d]">Deixe todos desmarcados para aplicar a oferta a todos os produtos elegíveis.</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{products.filter((product) => product.active).map((product) => <label key={product.id} className="flex items-center gap-2 rounded-xl bg-white p-3 text-sm font-bold"><input type="checkbox" checked={selectedProductIds.includes(product.id)} onChange={(event) => setSelectedProductIds((current) => event.target.checked ? [...current, product.id] : current.filter((id) => id !== product.id))} /> {product.name}</label>)}</div></fieldset>
            <Button type="submit" className="mt-6 h-12 rounded-full bg-[#b5232b] px-6 font-black text-white"><Save /> Salvar promoção</Button>
          </form>
        </div>
      )}
    </AdminShell>
  );
}

function friendlyAdminError(cause: unknown, fallback = 'Não foi possível atualizar as promoções.') {
  const text = cause instanceof Error ? cause.message : '';
  if (/permission-denied|unauthenticated/i.test(text)) return 'Sua sessão não tem permissão para editar promoções.';
  if (/network|offline|unavailable/i.test(text)) return 'A conexão com a unidade caiu. Tente novamente em instantes.';
  return text && !/FirebaseError|failed-precondition/i.test(text) ? text : fallback;
}
