'use client';

import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { useParams } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { getFirebaseClient, hasFirebaseConfig } from '@/lib/firebase/client';
import { brlToCents } from '@/shared/money';
import { validTenantSlug } from '@/shared/tenancy';

type Category = { id: string; name: string; active: boolean };
type CatalogSize = { id: string; label: string; active: boolean; basePriceCents: number };
type VariantRow = { id: string; label: string; price: string; active: boolean };
type Product = { id: string; name: string; description: string; categoryId: string; priceCents: number;
  active: boolean; productType?: 'SIMPLE' | 'VARIANT'; sizes?: CatalogSize[] };
const emptyVariants = (): VariantRow[] => [
  { id: 'pequeno', label: '', price: '', active: true },
  { id: 'grande', label: '', price: '', active: true },
];

export default function TenantCatalogManagementPage() {
  const params = useParams();
  const tenantId = typeof params.slug === 'string' ? params.slug : '';
  const [user, setUser] = useState<User | null>(null);
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [editing, setEditing] = useState<Product | null>(null);
  const [variantEditing, setVariantEditing] = useState<Product | null>(null);
  const [variantRows, setVariantRows] = useState<VariantRow[]>(emptyVariants);

  const ready = validTenantSlug(tenantId) && tenantId !== 'teiko' && hasFirebaseConfig;

  async function fetchCatalog() {
    const data = (await httpsCallable(getFirebaseClient().functions, 'tenantGetManageCatalog')({ tenantId })).data as {
      categories?: Category[]; products?: Product[];
    };
    setCategories(data.categories ?? []);
    setProducts(data.products ?? []);
  }
  useEffect(() => {
    if (!ready) { setLoading(false); return; }
    let generation = 0;
    return onAuthStateChanged(getFirebaseClient().auth, (current) => {
      const sequence = ++generation;
      setUser(current?.isAnonymous ? null : current);
      setAuthorized(false);
      if (!current || current.isAnonymous) { setLoading(false); return; }
      setLoading(true);
      void httpsCallable(getFirebaseClient().functions, 'getMyTenantAccess')({ tenantId }).then(async (result) => {
        if (generation !== sequence) return;
        if ((result.data as { role?: string }).role !== 'tenant_owner')
          throw new Error('Somente o proprietário deste restaurante pode editar o catálogo.');
        await fetchCatalog();
        if (generation !== sequence) return;
        setAuthorized(true);
        setError('');
      }).catch((cause) => {
        if (generation === sequence) setError(cause instanceof Error ? cause.message : 'Acesso não autorizado.');
      }).finally(() => { if (generation === sequence) setLoading(false); });
    });
  }, [ready, tenantId]);
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true); setError('');
    try {
      await signInWithEmailAndPassword(getFirebaseClient().auth, String(form.get('email')), String(form.get('password')));
    } catch { setError('Falha no login ou na conexão. Confira os dados.'); }
    finally { setBusy(false); }
  }
  async function mutate(task: () => Promise<unknown>, success: string) {
    setBusy(true); setError(''); setNotice('');
    try { await task(); await fetchCatalog(); setNotice(success); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível salvar.'); }
    finally { setBusy(false); }
  }
  async function saveCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    await mutate(async () => {
      await httpsCallable(getFirebaseClient().functions, 'tenantUpsertCategory')({
        tenantId, categoryId: String(fields.get('id') ?? '').trim().toLowerCase(),
        name: String(fields.get('name') ?? '').trim(),
      });
      form.reset();
    }, 'Categoria salva com segurança.');
  }
  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    const priceCents = brlToCents(String(fields.get('price') ?? ''));
    if (priceCents === null) { setError('Informe preço válido, por exemplo 19,90.'); return; }
    await mutate(async () => {
      await httpsCallable(getFirebaseClient().functions, 'tenantUpsertSimpleProduct')({
        tenantId, productId: String(fields.get('id') ?? '').trim().toLowerCase(),
        categoryId: String(fields.get('categoryId') ?? ''),
        name: String(fields.get('name') ?? '').trim(),
        description: String(fields.get('description') ?? '').trim(),
        active: fields.get('active') === 'on', priceCents,
      });
      setEditing(null);
      form.reset();
    }, 'Produto salvo. Seu catálogo público foi atualizado.');
  }
  function resetVariant() {
    setVariantEditing(null);
    setVariantRows(emptyVariants());
  }
  async function saveVariantProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    const sizes = variantRows.map(row => ({
      id: row.id.trim().toLowerCase(), label: row.label.trim(),
      priceCents: brlToCents(row.price), active: row.active,
    }));
    if (sizes.length < 2 || sizes.length > 20 ||
      new Set(sizes.map(row => row.id)).size !== sizes.length ||
      sizes.some(row => row.priceCents === null || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.id)
        || row.label.length < 1)) {
      setError('Tamanhos inválidos. Informe identificadores únicos, descrições e preços válidos.');
      return;
    }
    await mutate(async () => {
      await httpsCallable(getFirebaseClient().functions, 'tenantUpsertVariantProduct')({
        tenantId, productId: String(fields.get('id') ?? '').trim().toLowerCase(),
        categoryId: String(fields.get('categoryId') ?? ''),
        name: String(fields.get('name') ?? '').trim(),
        description: String(fields.get('description') ?? '').trim(),
        active: fields.get('active') === 'on',
        sizes,
      });
      resetVariant(); form.reset();
    }, 'Produto com tamanhos atualizado no cardápio.');
  }
  function editVariant(product: Product) {
    if (product.productType !== 'VARIANT') return;
    setEditing(null);
    setVariantEditing(product);
    setVariantRows(product.sizes?.map(row => ({
      id: row.id, label: row.label,
      price: (row.basePriceCents / 100).toFixed(2).replace('.', ','),
      active: row.active,
    })) ?? emptyVariants());
  }
  async function toggleProduct(product: Product) {
    await mutate(() => product.productType === 'VARIANT'
      ? httpsCallable(getFirebaseClient().functions, 'tenantUpsertVariantProduct')({
          tenantId, productId: product.id, categoryId: product.categoryId,
          name: product.name, description: product.description, active: !product.active,
          sizes: (product.sizes ?? []).map(row => ({
            id: row.id, label: row.label, priceCents: row.basePriceCents, active: row.active,
          })),
        })
      : httpsCallable(getFirebaseClient().functions, 'tenantUpsertSimpleProduct')({
          tenantId, productId: product.id, categoryId: product.categoryId,
          name: product.name, description: product.description, priceCents: product.priceCents,
          active: !product.active,
        }), product.active ? 'Produto desativado.' : 'Produto reativado.');
  }

  if (!ready) return <main className="min-h-screen p-8" role="alert">
    {tenantId === 'teiko' ? 'O painel da Teiko permanece na rota /admin até a migração autorizada.' : 'Tenant indisponível ou Firebase não configurado.'}
  </main>;
  return <main className="min-h-screen bg-[#f3f0e8] p-4 text-[#101612] sm:p-8">
    <div className="mx-auto max-w-5xl">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-wider text-[#b5232b]">Restaurante {tenantId}</p><h1 className="text-3xl font-black">Gerenciar cardápio</h1></div>
        {user && <Button variant="outline" onClick={() => void signOut(getFirebaseClient().auth)}>Sair</Button>}
      </header>
      {loading && <p role="status" className="mt-6 rounded-xl bg-white p-5">Verificando permissões…</p>}
      {error && <p role="alert" className="mt-5 rounded-xl bg-red-100 p-4 text-red-900">{error}</p>}
      {notice && <p role="status" className="mt-5 rounded-xl bg-green-100 p-4 text-green-900">{notice}</p>}
      {!user && !loading && <form onSubmit={login} className="mt-6 grid max-w-md gap-3 rounded-2xl bg-white p-6">
        <h2 className="font-bold">Entrar como proprietário da loja</h2>
        <label>E-mail<input name="email" autoComplete="username" required type="email" className="mt-1 w-full rounded-lg border p-3" /></label>
        <label>Senha<input name="password" autoComplete="current-password" required type="password" className="mt-1 w-full rounded-lg border p-3" /></label>
        <Button type="submit" disabled={busy}>Entrar</Button>
      </form>}
      {authorized && !loading && <div className="mt-6 grid gap-6">
        <section className="rounded-2xl bg-white p-5">
          <h2 className="text-xl font-bold">Categorias</h2>
          <p className="mt-2 text-sm text-gray-600">Cadastro de categorias ativas; as alterações são autorizadas no servidor.</p>
          <form onSubmit={saveCategory} className="mt-4 grid gap-3 sm:grid-cols-2">
            <label>Identificador<input name="id" required minLength={3} maxLength={64} pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="combinados" className="mt-1 w-full rounded-lg border p-3" /></label>
            <label>Nome<input name="name" required minLength={2} maxLength={80} placeholder="Combinados" className="mt-1 w-full rounded-lg border p-3" /></label>
            <Button type="submit" disabled={busy} className="sm:col-span-2">Salvar categoria</Button>
          </form>
          <ul className="mt-4 grid gap-2">{categories.map((c) => <li key={c.id} className="rounded-lg border p-3 text-sm">{c.name} <span className="text-gray-500">({c.id})</span></li>)}</ul>
        </section>
        <section className="rounded-2xl bg-white p-5">
          <h2 className="text-xl font-bold">Produtos simples</h2>
          <p className="mt-2 text-sm text-gray-600">Itens de preço único. O cadastro com múltiplos tamanhos está logo abaixo; adicionais ainda não estão disponíveis.</p>
          <form onSubmit={saveProduct} key={editing?.id ?? 'new'} className="mt-4 grid gap-3 sm:grid-cols-2">
            <label>Identificador<input name="id" required minLength={3} maxLength={64} pattern="[a-z0-9]+(-[a-z0-9]+)*" readOnly={!!editing} defaultValue={editing?.id ?? ''} className="mt-1 w-full rounded-lg border p-3" /></label>
            <label>Categoria<select name="categoryId" required defaultValue={editing?.categoryId ?? ''} className="mt-1 w-full rounded-lg border p-3">
              <option value="">Selecione</option>{categories.filter(c => c.active).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select></label>
            <label>Nome<input name="name" required minLength={2} maxLength={120} defaultValue={editing?.name ?? ''} className="mt-1 w-full rounded-lg border p-3" /></label>
            <label>Preço (R$)<input name="price" required inputMode="decimal" placeholder="19,90" defaultValue={editing ? (editing.priceCents / 100).toFixed(2).replace('.', ',') : ''} className="mt-1 w-full rounded-lg border p-3" /></label>
            <label className="sm:col-span-2">Descrição<textarea name="description" maxLength={600} defaultValue={editing?.description ?? ''} className="mt-1 w-full rounded-lg border p-3" /></label>
            <label className="flex items-center gap-2"><input type="checkbox" name="active" defaultChecked={editing?.active ?? true} />Disponível</label>
            <Button type="submit" disabled={busy || categories.length === 0}>{editing ? 'Salvar edição' : 'Criar produto'}</Button>
            {editing && <Button type="button" variant="outline" disabled={busy} onClick={() => setEditing(null)} className="sm:col-span-2">Cancelar edição</Button>}
          </form>
        </section>
        <section className="rounded-2xl bg-white p-5">
          <h2 className="text-xl font-bold">Produtos com tamanhos</h2>
          <p className="mt-2 text-sm text-gray-600">
            Cada tamanho tem seu próprio preço. O servidor recalcula o valor no pedido; nenhum adicional é cobrado neste formulário.
          </p>
          <form onSubmit={saveVariantProduct} key={variantEditing?.id ?? 'variant-new'} className="mt-4 grid gap-3 sm:grid-cols-2">
            <label>Identificador do produto
              <input name="id" required minLength={3} maxLength={64}
                pattern="[a-z0-9]+(-[a-z0-9]+)*" readOnly={!!variantEditing}
                defaultValue={variantEditing?.id ?? ''} className="mt-1 w-full rounded-lg border p-3" />
            </label>
            <label>Categoria
              <select name="categoryId" required defaultValue={variantEditing?.categoryId ?? ''}
                className="mt-1 w-full rounded-lg border p-3">
                <option value="">Selecione</option>
                {categories.filter(c => c.active).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label>Nome
              <input name="name" required minLength={2} maxLength={120} defaultValue={variantEditing?.name ?? ''}
                className="mt-1 w-full rounded-lg border p-3" />
            </label>
            <label className="flex items-center gap-2">
              <input name="active" type="checkbox" defaultChecked={variantEditing?.active ?? true} /> Produto ativo
            </label>
            <label className="sm:col-span-2">Descrição
              <textarea name="description" maxLength={600} defaultValue={variantEditing?.description ?? ''}
                className="mt-1 w-full rounded-lg border p-3" />
            </label>
            <div className="sm:col-span-2">
              <h3 className="font-bold">Tamanhos e preços</h3>
              {variantRows.map((row, index) => <div key={index}
                className="mt-3 grid items-end gap-2 rounded-xl border p-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
                <label className="text-sm">Código
                  <input required value={row.id} maxLength={64} pattern="[a-z0-9]+(-[a-z0-9]+)*"
                    onChange={event => setVariantRows(rows => rows.map((s,i) => i===index ? {...s,id:event.target.value.toLowerCase()} : s))}
                    className="mt-1 w-full rounded-lg border p-2" />
                </label>
                <label className="text-sm">Tamanho
                  <input required value={row.label} maxLength={60}
                    onChange={event => setVariantRows(rows => rows.map((s,i) => i===index ? {...s,label:event.target.value} : s))}
                    className="mt-1 w-full rounded-lg border p-2" />
                </label>
                <label className="text-sm">Preço R$
                  <input required inputMode="decimal" value={row.price}
                    onChange={event => setVariantRows(rows => rows.map((s,i) => i===index ? {...s,price:event.target.value} : s))}
                    className="mt-1 w-full rounded-lg border p-2" />
                </label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1 text-sm">
                    <input type="checkbox" checked={row.active}
                      onChange={event => setVariantRows(rows => rows.map((s,i) => i===index ? {...s,active:event.target.checked} : s))} />
                    Ativo
                  </label>
                  <button type="button" disabled={busy || variantRows.length <= 2}
                    className="text-sm text-red-700 underline"
                    onClick={() => setVariantRows(rows => rows.filter((_,i) => i !== index))}>Excluir</button>
                </div>
              </div>)}
              <Button variant="outline" type="button" disabled={busy || variantRows.length >= 20}
                onClick={() => setVariantRows(rows => [...rows, { id: '', label: '', price: '', active: true }])}
                className="mt-3">Adicionar tamanho</Button>
            </div>
            <Button type="submit" disabled={busy || categories.length === 0}>
              {variantEditing ? 'Salvar tamanhos' : 'Cadastrar produto com tamanhos'}
            </Button>
            {variantEditing && <Button type="button" variant="outline" disabled={busy}
              onClick={resetVariant}>Cancelar edição</Button>}
          </form>
        </section>
        <section className="rounded-2xl bg-white p-5">
          <h2 className="text-xl font-bold">Catálogo cadastrado</h2>
          {products.length === 0 && <p className="mt-3 text-sm">Nenhum produto cadastrado.</p>}
          <div className="mt-3 grid gap-2">{products.map(p => <article key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3">
            <div><strong>{p.name}</strong><p className="text-xs text-gray-600">
              {p.id} · {p.productType === 'VARIANT' ? (p.sizes?.length ?? 0) + ' tamanhos' :
                (p.priceCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              {' · '}{p.active ? 'Ativo' : 'Inativo'}
            </p></div>
            <div className="flex gap-2">
              <Button variant="outline" disabled={busy} onClick={() => {
                if (p.productType === 'VARIANT') editVariant(p);
                else { resetVariant(); setEditing(p); }
              }}>Editar</Button>
              <Button variant="outline" disabled={busy} onClick={() => void toggleProduct(p)}>{p.active ? 'Desativar' : 'Reativar'}</Button>
            </div>
          </article>)}</div>
        </section>
      </div>}
    </div>
  </main>;
}
