'use client';

import { httpsCallable } from 'firebase/functions';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { ensureAnonymousUser, getFirebaseClient, hasFirebaseConfig } from '@/lib/firebase/client';
import { changeTenantCart, isSimpleTenantProduct, quoteTenantCart, sanitizeTenantCart,
  type TenantCartItem, type TenantCartProduct } from '@/shared/tenant-cart';
import { tenantCacheKey, validTenantSlug } from '@/shared/tenancy';

type PublicTenant = {
  id: string; slug: string; status: 'ACTIVE' | 'SUSPENDED'; orderingEnabled?: boolean;
  branding: { displayName: string; primaryColor?: string; logoUrl?: string };
  legacyFallback?: boolean;
};
type CatalogProduct = TenantCartProduct & { description?: string };
type CartState = { slug: string; items: TenantCartItem[] };
function brl(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}
function checkoutError(error: unknown): string {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  if (/failed-precondition/.test(code)) return 'A loja, o item ou o preço mudou. Atualize o carrinho e tente novamente.';
  if (/resource-exhausted/.test(code)) return 'Muitas tentativas. Tente novamente mais tarde.';
  if (/unavailable|deadline-exceeded|network/.test(code))
    return 'Conexão instável. Clique novamente sem alterar o carrinho para consultar a mesma tentativa.';
  if (/unauthenticated/.test(code)) return 'Não foi possível autenticar sua sessão. Tente novamente.';
  return 'Não foi possível confirmar o pedido. Confira os dados e tente novamente.';
}

export default function TenantStorefrontPage() {
  const params = useParams();
  const router = useRouter();
  const slug = typeof params.slug === 'string' ? params.slug : '';
  const [tenant, setTenant] = useState<PublicTenant | null>(null);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [checkoutErrorText, setCheckoutErrorText] = useState('');
  const [cart, setCart] = useState<CartState>({ slug: '', items: [] });
  const [customerName, setCustomerName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const pendingId = useRef<{ signature: string; id: string } | null>(null);
  const cartItems = cart.slug === slug ? cart.items : [];
  const quote = useMemo(() => quoteTenantCart(slug, cartItems, products), [slug, cartItems, products]);

  useEffect(() => {
    if (!validTenantSlug(slug) || slug === 'teiko' || typeof window === 'undefined') return;
    let saved: unknown = [];
    try { saved = JSON.parse(window.localStorage.getItem(tenantCacheKey(slug, 'cart')) ?? '[]'); }
    catch { /* invalid cache is treated as empty; no customer fields are restored */ }
    setCart({ slug, items: sanitizeTenantCart(saved) });
    pendingId.current = null;
  }, [slug]);

  useEffect(() => {
    if (!validTenantSlug(slug) || slug === 'teiko' || cart.slug !== slug) return;
    try { window.localStorage.setItem(tenantCacheKey(slug, 'cart'), JSON.stringify(cart.items)); }
    catch { /* private browsing may not permit caching; checkout remains available */ }
  }, [slug, cart]);

  useEffect(() => {
    if (slug === 'teiko') { window.location.replace('/'); return; }
    if (!hasFirebaseConfig || !validTenantSlug(slug)) {
      setError('Restaurante não encontrado ou configuração indisponível.');
      setLoading(false);
      return;
    }
    let active = true;
    let stopProducts: (() => void) | undefined;
    setLoading(true); setError(''); setProducts([]); setTenant(null);
    const { db, functions } = getFirebaseClient();
    void httpsCallable(functions, 'resolvePublicTenant')({ slug }).then((response) => {
      if (!active) return;
      const result = response.data as PublicTenant;
      if (result?.id !== slug || result.status !== 'ACTIVE') {
        setError('Este restaurante está indisponível.');
        setLoading(false);
        return;
      }
      setTenant(result);
      stopProducts = onSnapshot(query(
        collection(db, 'tenants', slug, 'products'),
        where('tenantId', '==', slug),
        where('active', '==', true),
      ), (snapshot) => {
        if (!active) return;
        setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CatalogProduct)));
        setLoading(false);
      }, () => { if (active) { setError('Cardápio temporariamente indisponível.'); setLoading(false); } });
    }).catch(() => { if (active) { setError('Não foi possível consultar o restaurante.'); setLoading(false); } });
    return () => { active = false; stopProducts?.(); };
  }, [slug]);

  function adjustCart(productId: string, delta: number) {
    pendingId.current = null;
    setCheckoutErrorText('');
    setCart(current => ({ slug, items: changeTenantCart(current.slug === slug ? current.items : [], productId, delta) }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || !tenant?.orderingEnabled || loading || quote.invalid || quote.items.length === 0) return;
    const name = customerName.trim();
    if (name.length < 2 || name.length > 80) {
      setCheckoutErrorText('Informe um nome válido de 2 a 80 caracteres.');
      return;
    }
    const signature = JSON.stringify({ slug, items: quote.items, totalCents: quote.totalCents, name });
    if (pendingId.current?.signature !== signature)
      pendingId.current = { signature, id: crypto.randomUUID() };
    setSubmitting(true); setCheckoutErrorText('');
    try {
      await ensureAnonymousUser();
      const result = await httpsCallable(getFirebaseClient().functions, 'createTenantPickupOrder')({
        tenantId: slug, clientRequestId: pendingId.current.id,
        customerName: name, items: quote.items, clientPreviewTotalCents: quote.totalCents,
      });
      const data = result.data as { orderId?: string };
      if (!data.orderId || !/^[A-Za-z0-9_-]{10,128}$/.test(data.orderId))
        throw new Error('Identificador inválido.');
      pendingId.current = null;
      setCart({ slug, items: [] });
      try { window.localStorage.removeItem(tenantCacheKey(slug, 'cart')); } catch { /* optional */ }
      router.push('/loja/' + slug + '/acompanhar/' + data.orderId);
    } catch (cause) {
      setCheckoutErrorText(checkoutError(cause));
    } finally { setSubmitting(false); }
  }

  return <main className="min-h-screen bg-[#f3f0e8] p-4 text-[#111613] sm:p-8">
    <div className="mx-auto max-w-5xl">
      <header className="rounded-3xl bg-white p-6 shadow-sm">
        {tenant?.branding.logoUrl && <img src={tenant.branding.logoUrl} alt="Logo do restaurante" className="mb-3 size-16 rounded-xl object-cover" />}
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: tenant?.branding.primaryColor ?? '#b5232b' }}>Cardápio do restaurante</p>
        <h1 className="mt-2 text-3xl font-black">{tenant?.branding.displayName ?? 'Restaurante'}</h1>
        <p className="mt-3 text-sm text-gray-600">Pedidos simples para retirada, pagos presencialmente em dinheiro quando a unidade estiver habilitada.</p>
      </header>
      {loading && <p role="status" className="mt-6 rounded-xl bg-white p-4">Carregando o cardápio…</p>}
      {error && <p role="alert" className="mt-6 rounded-xl bg-red-100 p-4 text-red-900">{error}</p>}
      {tenant && !tenant.orderingEnabled && <p role="status" className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900">
        Pedidos online indisponíveis para esta unidade. Você pode consultar o cardápio.
      </p>}
      {!loading && !error && products.length === 0 && <p className="mt-6 rounded-xl bg-white p-5">Nenhum produto disponível neste momento.</p>}
      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section aria-label="Produtos disponíveis" className="grid gap-3">
          {products.map((product) => {
            const simple = isSimpleTenantProduct(slug, product);
            const qty = cartItems.find(x => x.productId === product.id)?.quantity ?? 0;
            return <article key={product.id} className="rounded-2xl bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold">{product.name}</h2>
              {product.description && <p className="mt-1 text-sm text-gray-600">{product.description}</p>}
              {product.sizes?.[0] && Number.isSafeInteger(product.sizes[0].basePriceCents) &&
                <p className="mt-3 font-bold">{brl(product.sizes[0].basePriceCents)}</p>}
              {simple && tenant?.orderingEnabled
                ? <div className="mt-4 flex items-center gap-3">
                    <Button variant="outline" disabled={submitting || qty === 0} onClick={() => adjustCart(product.id, -1)} aria-label={'Remover ' + product.name}>−</Button>
                    <span className="min-w-6 text-center font-semibold" aria-live="polite">{qty}</span>
                    <Button variant="outline" disabled={submitting || qty >= 20} onClick={() => adjustCart(product.id, 1)} aria-label={'Adicionar ' + product.name}>+</Button>
                  </div>
                : <p className="mt-3 text-xs text-gray-500">Disponível apenas para consulta neste momento.</p>}
            </article>;
          })}
        </section>
        {tenant?.orderingEnabled && <aside className="rounded-2xl bg-white p-5 shadow-sm" aria-label="Carrinho e checkout">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xl font-black">Seu pedido</h2>
            <Button type="button" variant="outline" disabled={submitting || cartItems.length === 0}
              onClick={() => { pendingId.current = null; setCheckoutErrorText(''); setCart({ slug, items: [] }); }}>
              Esvaziar
            </Button>
          </div>
          {cartItems.length === 0 && <p className="mt-3 text-sm text-gray-600">Adicione produtos para retirada.</p>}
          <ul className="mt-4 space-y-2 text-sm">{cartItems.map(item => {
            const product = products.find(p => p.id === item.productId);
            return <li key={item.productId} className="flex justify-between gap-3">
              <div className="min-w-0">
                <span>{item.quantity}× {product?.name ?? 'Produto indisponível'}</span>
                <button type="button" disabled={submitting} className="ml-2 text-xs text-red-700 underline"
                  onClick={() => { pendingId.current = null; adjustCart(item.productId, -1); }}>
                  Remover 1
                </button>
              </div>
              <span>{product?.sizes?.[0] ? brl(item.quantity * product.sizes[0].basePriceCents) : '—'}</span>
            </li>;
          })}</ul>
          {quote.invalid && <p role="alert" className="mt-3 text-sm text-red-700">
            O carrinho contém item indisponível ou preço inválido. Remova os itens afetados antes de confirmar.
          </p>}
          <p className="mt-4 border-t pt-3 text-lg font-black">Total estimado: {brl(quote.totalCents)}</p>
          <form onSubmit={submit} className="mt-4 grid gap-3">
            <label className="text-sm font-semibold">Nome para retirada
              <input required minLength={2} maxLength={80} autoComplete="name" value={customerName}
                onChange={event => { setCustomerName(event.target.value); pendingId.current = null; }}
                className="mt-1 w-full rounded-lg border p-3" />
            </label>
            <p className="text-xs text-gray-600">A cobrança será confirmada presencialmente no caixa. Este site não processa PIX ou cartão.</p>
            {checkoutErrorText && <p role="alert" className="text-sm text-red-700">{checkoutErrorText}</p>}
            <Button type="submit" disabled={submitting || loading || quote.invalid || quote.items.length === 0}>
              {submitting ? 'Confirmando pedido…' : 'Confirmar retirada'}
            </Button>
          </form>
          <p className="mt-3 text-xs text-gray-600">O valor final é recalculado no servidor. Não armazene dados pessoais no carrinho.</p>
        </aside>}
      </div>
      <footer className="mt-8 text-sm text-gray-600">
        <Link href="/" className="underline">Voltar à Teiko</Link>
      </footer>
    </div>
  </main>;
}
