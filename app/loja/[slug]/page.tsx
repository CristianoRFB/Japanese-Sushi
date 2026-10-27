'use client';

import { httpsCallable } from 'firebase/functions';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getFirebaseClient, hasFirebaseConfig } from '@/lib/firebase/client';
import { validTenantSlug } from '@/shared/tenancy';

type PublicTenant = {
  id: string; slug: string; status: 'ACTIVE' | 'SUSPENDED';
  branding: { displayName: string; primaryColor?: string; logoUrl?: string };
  legacyFallback?: boolean;
};
type CatalogProduct = {
  id: string; name: string; description?: string; active: boolean;
  tenantId: string; sizes?: Array<{ label: string; basePriceCents: number }>;
};

function formatPrice(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

export default function TenantStorefrontPage() {
  const params = useParams();
  const slug = typeof params.slug === 'string' ? params.slug : '';
  const [tenant, setTenant] = useState<PublicTenant | null>(null);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (slug === 'teiko') { window.location.replace('/'); return; }
    if (!hasFirebaseConfig || !validTenantSlug(slug)) {
      setError('Restaurante não encontrado ou configuração indisponível.');
      setBusy(false);
      return;
    }
    let active = true;
    let stopProducts: (() => void) | undefined;
    setBusy(true); setError(''); setProducts([]); setTenant(null);
    const { db, functions } = getFirebaseClient();
    void httpsCallable(functions, 'resolvePublicTenant')({ slug }).then((response) => {
      if (!active) return;
      const result = response.data as PublicTenant;
      if (result?.id !== slug || result.status !== 'ACTIVE') {
        setError('Este restaurante está indisponível.');
        setBusy(false);
        return;
      }
      setTenant(result);
      // Both predicates are required: Firestore rules must prove tenant ownership
      // and the public visibility of each returned product.
      stopProducts = onSnapshot(query(
        collection(db, 'tenants', slug, 'products'),
        where('tenantId', '==', slug),
        where('active', '==', true),
      ), (snapshot) => {
        if (!active) return;
        setProducts(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as CatalogProduct)));
        setBusy(false);
      }, () => { if (active) { setError('Cardápio temporariamente indisponível.'); setBusy(false); } });
    }).catch(() => { if (active) { setError('Não foi possível consultar o restaurante.'); setBusy(false); } });
    return () => { active = false; stopProducts?.(); };
  }, [slug]);

  return <main className="min-h-screen bg-[#f3f0e8] p-4 text-[#111613] sm:p-8">
    <div className="mx-auto max-w-4xl">
      <header className="rounded-3xl bg-white p-6 shadow-sm">
        {tenant?.branding.logoUrl && <img src={tenant.branding.logoUrl} alt="Logo do restaurante" className="mb-3 size-16 rounded-xl object-cover" />}
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: tenant?.branding.primaryColor ?? '#b5232b' }}>Cardápio do restaurante</p>
        <h1 className="mt-2 text-3xl font-black">{tenant?.branding.displayName ?? 'Restaurante'}</h1>
        <p className="mt-3 text-sm text-gray-600">Visualização pública do catálogo. Pedidos online desta unidade só serão ativados depois da homologação.</p>
      </header>
      {busy && <p role="status" className="mt-6 rounded-xl bg-white p-4">Carregando informações…</p>}
      {error && <p role="alert" className="mt-6 rounded-xl bg-red-100 p-4 text-red-900">{error}</p>}
      {!busy && !error && products.length === 0 && <p role="status" className="mt-6 rounded-xl bg-white p-5">Nenhum produto disponível neste momento.</p>}
      {!busy && !error && products.length > 0 && <section aria-label="Produtos disponíveis" className="mt-6 grid gap-3 sm:grid-cols-2">
        {products.map((product) => <article key={product.id} className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold">{product.name}</h2>
          {product.description && <p className="mt-1 text-sm text-gray-600">{product.description}</p>}
          {product.sizes?.[0] && Number.isSafeInteger(product.sizes[0].basePriceCents) && <p className="mt-3 font-bold">{formatPrice(product.sizes[0].basePriceCents)}</p>}
        </article>)}
      </section>}
    </div>
  </main>;
}
