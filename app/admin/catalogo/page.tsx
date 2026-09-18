'use client';

import { addDoc, collection, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import { ImagePlus, Plus, Save, X } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';

import { AdminField, AdminTextarea } from '@/components/admin-form';
import { AdminShell } from '@/components/admin-shell';
import { Button } from '@/components/ui/button';
import { getFirebaseClient } from '@/lib/firebase/client';
import { parseBRLToCents } from '@/shared/finance';
import { TEIKO_BRAND_ID, formatBRL, type ModifierGroup, type Product, type ProductCategory, type ProductSize } from '@/shared/domain';

const defaultSizes: ProductSize[] = [{ id: 'unico', label: 'Tamanho único', active: true, basePriceCents: 0, displayOrder: 1 }];

function slugify(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export default function CatalogPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [groups, setGroups] = useState<ModifierGroup[]>([]);
  const [editing, setEditing] = useState<Product | null>(null);
  const [draftSizes, setDraftSizes] = useState<ProductSize[]>(defaultSizes);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const db = getFirebaseClient().db;
    const stopProducts = onSnapshot(query(collection(db, 'products'), where('brandId', '==', TEIKO_BRAND_ID), orderBy('displayOrder')), (snap) => setProducts(snap.docs.map((item) => ({ id: item.id, ...item.data() }) as Product)));
    const stopCategories = onSnapshot(query(collection(db, 'categories'), where('brandId', '==', TEIKO_BRAND_ID), orderBy('displayOrder')), (snap) => setCategories(snap.docs.map((item) => ({ id: item.id, ...item.data() }) as ProductCategory)));
    const stopGroups = onSnapshot(query(collection(db, 'modifierGroups'), where('brandId', '==', TEIKO_BRAND_ID), orderBy('displayOrder')), (snap) => setGroups(snap.docs.map((item) => ({ id: item.id, ...item.data() }) as ModifierGroup)));
    return () => { stopProducts(); stopCategories(); stopGroups(); };
  }, []);

  function openEditor(product: Product | null) {
    setEditing(product);
    setDraftSizes(product?.sizes?.length ? product.sizes.map((size) => ({ ...size })) : defaultSizes);
    setSelectedGroupIds(product?.modifierGroupIds ?? []);
    setError('');
    setShowForm(true);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const data = new FormData(event.currentTarget);
    const name = String(data.get('name') || '').trim();
    const sizes = draftSizes.filter((size) => size.label.trim()).map((size, index) => ({ ...size, id: size.id || `tamanho-${index + 1}`, label: size.label.trim(), active: true, displayOrder: index + 1, basePriceCents: Math.max(0, Math.round(size.basePriceCents)) }));
    try {
      if (!name || name.length > 80) throw new Error('Informe um nome de produto com até 80 caracteres.');
      if (!sizes.length) throw new Error('Adicione pelo menos um tamanho ou apresentação.');
      const categoryId = String(data.get('categoryId') || '');
      if (!categoryId) throw new Error('Escolha uma categoria.');
      const payload = { brandId: TEIKO_BRAND_ID, name, slug: slugify(name), description: String(data.get('description') || '').trim(), active: data.get('active') === 'on', categoryId, productType: String(data.get('productType') || 'SIMPLE'), imageUrl: String(data.get('imageUrl') || '').trim(), displayOrder: editing?.displayOrder ?? products.length + 1, sizes, modifierGroupIds: selectedGroupIds, unitIds: ['santa-fe-do-sul'], updatedAt: serverTimestamp() };
      const db = getFirebaseClient().db;
      if (editing) await setDoc(doc(db, 'products', editing.id), payload, { merge: true }); else await addDoc(collection(db, 'products'), payload);
      setShowForm(false);
      setEditing(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar o produto.');
    }
  }

  async function saveCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get('name') || '').trim();
    if (name.length < 2 || name.length > 40) return setError('Informe um nome de categoria entre 2 e 40 caracteres.');
    try {
      const id = slugify(name);
      await setDoc(doc(getFirebaseClient().db, 'categories', id), { brandId: TEIKO_BRAND_ID, name, active: true, displayOrder: categories.length + 1, updatedAt: serverTimestamp() });
      setShowCategoryForm(false);
      setError('');
    } catch { setError('Não foi possível criar a categoria.'); }
  }

  return <AdminShell adminOnly>
    <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-black uppercase tracking-[.18em] text-[#8b1e2b]">Cardápio</p><h1 className="mt-2 text-3xl font-black tracking-[-.04em]">Produtos e preços</h1><p className="mt-2 text-sm text-[#7b887d]">Edite o que o cliente vê sem IDs, JSON ou novo deploy.</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => { setError(''); setShowCategoryForm(true); }} className="rounded-full"><Plus /> Categoria</Button><Button onClick={() => openEditor(null)} className="rounded-full bg-[#b5232b] text-white"><Plus /> Produto</Button></div></header>
    {error && <p role="alert" className="mt-5 rounded-xl bg-[#e8efe5] p-3 text-sm font-bold text-[#e3262e]">{error}</p>}
    <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{products.map((product) => <article key={product.id} className="overflow-hidden rounded-[24px] bg-white shadow-sm"><div className="relative aspect-[16/8] bg-[#10261a]"><img src={product.imageUrl || '/brand/teiko-sushi-atmosphere.png'} alt={`Foto de ${product.name}`} className="size-full object-cover" loading="lazy" /><span className={`absolute right-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-black ${product.active ? 'bg-[#d6e7bf] text-[#23452b]' : 'bg-[#f3f0e8] text-[#7b887d]'}`}>{product.active ? 'Publicado' : 'Oculto'}</span></div><div className="p-5"><span className="text-xs font-bold uppercase tracking-wide text-[#8b1e2b]">{categories.find((category) => category.id === product.categoryId)?.name || 'Sem categoria'}</span><h2 className="mt-1 text-xl font-black">{product.name}</h2><p className="mt-2 line-clamp-2 text-sm text-[#7b887d]">{product.description || 'Sem descrição cadastrada.'}</p><div className="mt-4 flex flex-wrap gap-2">{product.sizes.map((size) => <span key={size.id} className="rounded-full bg-[#e8efe5] px-2.5 py-1 text-xs font-bold text-[#b5232b]">{size.label} · {size.basePriceCents ? formatBRL(size.basePriceCents) : 'Preço pendente'}</span>)}</div><div className="mt-5 flex items-center justify-between gap-3"><button type="button" onClick={() => void updateDoc(doc(getFirebaseClient().db, 'products', product.id), { active: !product.active, updatedAt: serverTimestamp() })} className="text-xs font-black text-[#7b887d]">{product.active ? 'Ocultar produto' : 'Publicar produto'}</button><button type="button" onClick={() => openEditor(product)} className="text-sm font-black text-[#b5232b]">Editar produto</button></div></div></article>)}</div>
    {!products.length && <div className="mt-8 rounded-[26px] border border-dashed border-[#c7a773]/50 p-10 text-center"><ImagePlus className="mx-auto size-8 text-[#8b1e2b]" /><strong className="mt-3 block text-xl">Seu cardápio ainda está vazio</strong><p className="mt-2 text-sm text-[#7b887d]">Cadastre uma categoria e depois o primeiro produto.</p></div>}
    {showCategoryForm && <div className="fixed inset-0 z-50 grid place-items-center bg-[#070a08]/50 p-4 backdrop-blur-sm"><form onSubmit={saveCategory} className="w-full max-w-md rounded-[26px] bg-white p-6 shadow-2xl"><div className="flex items-center justify-between"><h2 className="text-2xl font-black">Nova categoria</h2><button type="button" onClick={() => setShowCategoryForm(false)} aria-label="Fechar"><X className="size-5" /></button></div><div className="mt-6"><AdminField label="Nome da categoria" name="name" placeholder="Ex.: Combinados" required /></div><Button type="submit" className="mt-6 h-11 w-full rounded-full bg-[#b5232b] font-black text-white"><Save /> Criar categoria</Button></form></div>}
    {showForm && <div className="fixed inset-0 z-50 overflow-y-auto bg-[#070a08]/50 p-4 backdrop-blur-sm"><form onSubmit={save} className="mx-auto my-4 max-w-2xl rounded-[28px] bg-white p-5 shadow-2xl sm:p-7"><div className="flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-[.16em] text-[#8b1e2b]">Cardápio</p><h2 className="mt-1 text-2xl font-black">{editing ? 'Editar produto' : 'Novo produto'}</h2></div><button type="button" onClick={() => setShowForm(false)} aria-label="Fechar"><X className="size-5" /></button></div><div className="mt-6 grid gap-4 sm:grid-cols-2"><AdminField label="Nome do produto" name="name" required defaultValue={editing?.name} /><label className="block text-sm font-bold">Categoria<select name="categoryId" required defaultValue={editing?.categoryId || categories[0]?.id || ''} className="mt-2 h-11 w-full rounded-xl border bg-[#f3f0e8] px-3 font-normal">{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label className="block text-sm font-bold">Tipo<select name="productType" defaultValue={editing?.productType ?? 'SIMPLE'} className="mt-2 h-11 w-full rounded-xl border bg-[#f3f0e8] px-3 font-normal"><option value="SIMPLE">Item simples</option><option value="CUSTOMIZABLE">Personalizável</option></select></label><AdminField label="Foto do produto (URL opcional)" name="imageUrl" defaultValue={editing?.imageUrl} placeholder="https://..." /></div><div className="mt-5"><AdminTextarea label="Descrição para o cliente" name="description" required defaultValue={editing?.description} rows={3} /></div><section className="mt-5 rounded-2xl border border-[#070a08]/10 bg-[#f3f0e8] p-4"><div className="flex items-center justify-between gap-3"><div><h3 className="font-black">Tamanhos e preços</h3><p className="text-xs text-[#7b887d]">Informe o preço em reais.</p></div><button type="button" onClick={() => setDraftSizes((current) => [...current, { id: `tamanho-${current.length + 1}`, label: '', active: true, basePriceCents: 0, displayOrder: current.length + 1 }])} className="inline-flex items-center gap-1 text-xs font-black text-[#b5232b]"><Plus className="size-4" /> Adicionar tamanho</button></div><div className="mt-4 space-y-3">{draftSizes.map((size, index) => <div key={`${size.id}-${index}`} className="grid gap-2 sm:grid-cols-[1fr_150px_auto]"><label className="text-xs font-bold">Nome<input value={size.label} onChange={(event) => setDraftSizes((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item))} placeholder="Ex.: 8 peças" className="mt-1 h-10 w-full rounded-xl border bg-white px-3 text-sm font-normal" /></label><label className="text-xs font-bold">Preço<input type="number" min="0" step="0.01" value={(size.basePriceCents / 100).toFixed(2)} onChange={(event) => setDraftSizes((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, basePriceCents: parseBRLToCents(event.target.value) } : item))} className="mt-1 h-10 w-full rounded-xl border bg-white px-3 text-sm font-normal" /></label><button type="button" disabled={draftSizes.length === 1} onClick={() => setDraftSizes((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="self-end p-2 text-[#8b1e2b] disabled:opacity-30" aria-label={`Remover ${size.label || 'tamanho'}`}><X className="size-4" /></button></div>)}</div></section><section className="mt-5"><h3 className="font-black">Adicionais disponíveis</h3><p className="mt-1 text-xs text-[#7b887d]">Escolha os grupos que aparecem neste produto.</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{groups.filter((group) => group.active).map((group) => <label key={group.id} className="flex items-center gap-2 rounded-xl border border-[#070a08]/10 bg-[#f3f0e8] p-3 text-sm font-bold"><input type="checkbox" checked={selectedGroupIds.includes(group.id)} onChange={(event) => setSelectedGroupIds((current) => event.target.checked ? [...current, group.id] : current.filter((id) => id !== group.id))} />{group.name}</label>)}{!groups.filter((group) => group.active).length && <p className="text-sm text-[#7b887d]">Nenhum grupo ativo cadastrado.</p>}</div></section><label className="mt-5 flex items-center gap-2 text-sm font-bold"><input type="checkbox" name="active" defaultChecked={editing?.active ?? true} /> Publicar no cardápio</label><Button type="submit" className="mt-6 h-12 w-full rounded-full bg-[#b5232b] font-black text-white"><Save /> Salvar produto</Button></form></div>}
  </AdminShell>;
}
