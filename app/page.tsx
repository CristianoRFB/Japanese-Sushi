'use client';

import {
  ArrowRight,
  CalendarDays,
  Clock3,
  MapPin,
  Search,
  Utensils,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import { PublicHeader } from '@/components/public-header';
import { useCatalog } from '@/components/providers';
import { Button } from '@/components/ui/button';
import {
  formatBRL,
  formatPromotionValue,
  formatNextOpening,
  getStoreAvailability,
  isPromotionActive,
  type Product,
  type ProductCategory,
  type Promotion,
} from '@/shared/domain';

export default function Home() {
  const { catalog, config, promotions, loading, error, development } = useCatalog();
  const [now, setNow] = useState(() => new Date());
  const [query, setQuery] = useState('');
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const products = catalog.products
    .filter(
      (product) =>
        product.active &&
        (!product.unitIds?.length ||
          product.unitIds.includes(config.defaultUnitId)),
    )
    .sort((a, b) => a.displayOrder - b.displayOrder);
  const categories = catalog.categories
    .filter(
      (category) =>
        category.active &&
        products.some((product) => product.categoryId === category.id),
    )
    .sort((a, b) => a.displayOrder - b.displayOrder);
  const normalizedQuery = query.trim().toLocaleLowerCase('pt-BR');
  const filteredProducts = normalizedQuery
    ? products.filter((product) =>
        `${product.name} ${product.description}`
          .toLocaleLowerCase('pt-BR')
          .includes(normalizedQuery),
      )
    : products;
  const visibleCategories = categories.filter((category) =>
    filteredProducts.some((product) => product.categoryId === category.id),
  );
  const availability = getStoreAvailability(now, config);
  const activePromotions = promotions.filter((promotion) => isPromotionActive(promotion, now));

  return (
    <main className="min-h-screen bg-[#180e16] text-[#fff7ea]">
      <PublicHeader />
      <section className="border-b border-[#d9b66f]/20 bg-[radial-gradient(circle_at_85%_15%,rgba(181,44,53,.28),transparent_35%),linear-gradient(145deg,#180e16,#28121f)]">
        <div className="mx-auto grid max-w-6xl items-end gap-8 px-4 py-12 sm:px-6 sm:py-20 lg:grid-cols-[1.05fr_.95fr]">
          <div>
            <div className="mb-8"><img src="/brand/teiko-logo.jpg" alt="Logo oficial Teiko Sushi" className="size-24 rounded-full object-cover ring-2 ring-[#d9b66f]/45 shadow-[0_0_0_8px_rgba(228,198,129,.05)]" /></div>
            <span className="inline-flex items-center gap-2 rounded-full border border-[#d9b66f]/35 px-3 py-1.5 text-xs font-bold uppercase tracking-[.18em] text-[#d9b66f]">
              <Utensils className="size-3.5" /> Uma pausa para comer bem
            </span>
            <h1 className="mt-6 max-w-2xl text-5xl font-black leading-[.94] tracking-[-.06em] sm:text-7xl">
              Sushi com presença, feito para o seu momento.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-[#d9c4cf]">
              Cardápio, pedidos e reservas da Teiko Sushi em Santa Fé do Sul.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button
                className="h-12 rounded-full bg-[#c13a43] px-6 font-black text-white hover:bg-[#c13a43]"
                nativeButton={false}
                render={<a href="#cardapio" />}
              >
                Ver cardápio <ArrowRight className="size-4" />
              </Button>
              <Button
                variant="outline"
                className="h-12 rounded-full border-[#d9b66f]/40 bg-transparent px-6 font-black text-[#fff7ea] hover:bg-white/10"
                nativeButton={false}
                render={<a href="/reserva" />}
              >
                Reservar mesa <CalendarDays className="size-4" />
              </Button>
            </div>
          </div>
          <div className="space-y-5">
            <div className="relative overflow-hidden rounded-[32px] border border-[#d9b66f]/25 bg-[#28121f] shadow-[0_24px_60px_rgba(0,0,0,.26)]">
              <img src="/brand/teiko-sushi-atmosphere.png" alt="Ambiente noturno de sushi com pratos sobre o balcão" className="aspect-[4/3] w-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#180e16] via-[#180e16]/70 to-transparent px-5 pb-5 pt-16">
                <p className="text-sm font-bold text-[#fff7ea]">Uma noite com sabor de casa.</p>
                <p className="mt-1 text-xs text-[#d9c4cf]">Imagem de atmosfera; consulte o cardápio para disponibilidade.</p>
              </div>
            </div>
            <div className="rounded-[28px] border border-[#d9b66f]/25 bg-[#fff7ea]/[.06] p-6 backdrop-blur sm:p-7">
            <p className="text-xs font-black uppercase tracking-[.18em] text-[#d9b66f]">
              Atendimento da unidade
            </p>
            <h2 className="mt-3 text-3xl font-black">
              {config.city || 'Santa Fé do Sul/SP'}
            </h2>
            <div className="mt-6 flex items-start gap-3 text-sm text-[#d9c4cf]">
              <MapPin className="mt-0.5 size-5 shrink-0 text-[#d9b66f]" />
              <span>
                {config.address || 'Endereço a confirmar pela unidade.'}
              </span>
            </div>
            <div className="mt-4 flex items-start gap-3 text-sm text-[#d9c4cf]">
              <Clock3 className="mt-0.5 size-5 shrink-0 text-[#d9b66f]" />
              <span>
                {availability.acceptingOrders
                  ? `Pedidos abertos${availability.closesAt ? ` até ${availability.closesAt}` : ''}`
                  : `Fechado no momento · ${availability.reason === 'OUTSIDE_HOURS' ? formatNextOpening(availability.nextOpening) : config.pauseMessage || 'consulte a unidade'}`}
              </span>
            </div>
            <div className="mt-6 border-t border-white/10 pt-5 text-sm text-[#d9c4cf]">
              <strong className="text-[#fff7ea]">
                {availability.estimate.label}
              </strong>
              <span className="ml-2">{availability.estimate.detail}</span>
            </div>
            </div>
          </div>
        </div>
      </section>
      {activePromotions.length > 0 && (
        <section className="border-b border-[#d9b66f]/20 bg-[#fff7ea] text-[#180e16]">
          <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
            <p className="text-xs font-black uppercase tracking-[.18em] text-[#8c234f]">Ofertas da unidade</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {activePromotions.map((promotion) => <article key={promotion.id} className="rounded-[24px] border border-[#d9b66f]/45 bg-white p-5 shadow-sm"><span className="text-sm font-black text-[#8c234f]">{formatPromotionValue(promotion)}</span><h2 className="mt-2 text-xl font-black">{promotion.name}</h2><p className="mt-2 text-sm text-[#765665]">{promotion.description || 'Oferta válida durante o período informado.'}</p><p className="mt-4 text-xs font-bold text-[#765665]">Válida até {promotion.endsAt}</p></article>)}
            </div>
          </div>
        </section>
      )}
      <section id="cardapio" className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[.18em] text-[#d9b66f]">
              Cardápio
            </p>
            <h2 className="mt-2 text-4xl font-black tracking-[-.05em]">
              Escolha sua experiência
            </h2>
          </div>
          {development && (
            <span className="rounded-full border border-[#d9b66f]/30 px-3 py-1.5 text-xs font-bold text-[#d9b66f]">
              Dados de desenvolvimento
            </span>
          )}
        </div>
        <div className="mt-6">
          <label className="relative flex-1">
            <span className="sr-only">Buscar no cardápio</span>
            <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#d9c4cf]" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar sushi, sashimi, temaki…" className="h-12 w-full rounded-full border border-white/15 bg-[#28121f] pl-12 pr-5 text-base text-[#fff7ea] outline-none placeholder:text-[#d9c4cf] focus:border-[#d9b66f]" />
          </label>
          <nav aria-label="Categorias do cardápio" className="sticky top-[72px] z-20 -mx-4 mt-3 flex gap-2 overflow-x-auto border-y border-white/10 bg-[#180e16]/95 px-4 py-3 backdrop-blur-xl sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-1">
            {visibleCategories.map((category) => <a key={category.id} href={`#categoria-${category.id}`} className="shrink-0 rounded-full border border-[#d9b66f]/25 bg-[#28121f] px-4 py-3 text-sm font-bold text-[#d9b66f] transition hover:border-[#d9b66f]">{category.name}</a>)}
          </nav>
        </div>
        {error && (
          <p
            role="alert"
            className="mt-6 rounded-2xl border border-[#ff8e8e]/35 bg-[#4b1523] p-4 text-sm text-[#ffe1e1]"
          >
            Não foi possível carregar o cardápio: {error}
          </p>
        )}
        {loading && (
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="h-48 animate-pulse rounded-[26px] bg-white/10" />
            <div className="h-48 animate-pulse rounded-[26px] bg-white/10" />
          </div>
        )}
        {!loading && !products.length && (
          <div className="mt-8 rounded-[26px] border border-dashed border-[#d9b66f]/35 p-8 text-center">
            <strong className="text-xl">Cardápio em configuração</strong>
            <p className="mt-2 text-[#d9c4cf]">
              A unidade ainda não publicou produtos e preços oficiais.
            </p>
          </div>
        )}
        {!loading && products.length > 0 && !filteredProducts.length && (
          <div className="mt-8 rounded-[26px] border border-dashed border-[#d9b66f]/35 p-8 text-center">
            <strong className="text-xl">Nenhum item encontrado</strong>
            <p className="mt-2 text-[#d9c4cf]">Tente outro termo ou limpe a busca.</p>
          </div>
        )}
        {visibleCategories.map((category) => (
          <section
            key={category.id}
            id={`categoria-${category.id}`}
            className="scroll-mt-24 pt-12"
          >
            <div className="flex items-baseline justify-between border-b border-white/10 pb-4">
              <h3 className="text-2xl font-black">{category.name}</h3>
              <span className="text-sm text-[#d9c4cf]">
                {
                  filteredProducts.filter(
                    (product) => product.categoryId === category.id,
                  ).length
                }{' '}
                opções
              </span>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {products
                .filter((product) => product.categoryId === category.id && filteredProducts.includes(product))
                .map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    category={category}
                    promotion={activePromotions.find((candidate) => !candidate.productIds.length || candidate.productIds.includes(product.id))}
                  />
                ))}
            </div>
          </section>
        ))}
      </section>
    </main>
  );
}

function ProductCard({
  product,
  category,
  promotion,
}: {
  product: Product;
  category: ProductCategory;
  promotion?: Promotion;
}) {
  const sizes = product.sizes.filter((size) => size.active);
  const starting = sizes.length
    ? Math.min(...sizes.map((size) => size.basePriceCents))
    : 0;
  return (
    <a
      href={`/montar/${product.id}`}
      className="group grid min-h-44 grid-cols-[1fr_108px] gap-4 rounded-[26px] border border-white/10 bg-[#28121f] p-5 transition hover:-translate-y-0.5 hover:border-[#d9b66f]/50 sm:grid-cols-[1fr_140px]"
    >
      <div className="flex flex-col">
        <span className="text-xs font-bold uppercase tracking-[.12em] text-[#d9b66f]">
          {category.name}
        </span>
        <h4 className="mt-2 text-xl font-black">{product.name}</h4>
        <p className="mt-2 text-sm leading-relaxed text-[#d9c4cf]">
          {product.description}
        </p>
        <span className="mt-auto pt-5 text-sm font-black text-[#d9b66f]">
          {starting > 0
            ? `A partir de ${formatBRL(starting)}`
            : 'Preço a confirmar'}
        </span>
        {promotion && <span className="mt-2 w-fit rounded-full bg-[#d9ed55] px-2.5 py-1 text-xs font-black text-[#180e16]">{formatPromotionValue(promotion)}</span>}
      </div>
      <div className="relative overflow-hidden rounded-[20px] bg-[#c13a43]/80 text-center text-sm font-black text-white">
        <img
          src={product.imageUrl || '/brand/teiko-sushi-atmosphere.png'}
          alt={`Foto de ${product.name}`}
          className="absolute inset-0 size-full object-cover transition duration-500 group-hover:scale-105"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#180e16]/90 via-[#180e16]/20 to-transparent" />
        <span className="absolute inset-x-3 bottom-3">Ver item</span>
      </div>
    </a>
  );
}
