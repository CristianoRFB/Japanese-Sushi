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
import { PublicFooter } from '@/components/public-footer';
import { OrderLookup } from '@/components/order-lookup';
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
    <main className="min-h-screen bg-[#070a08] text-[#f3f0e8]">
      <PublicHeader />
      <section className="border-b border-[#c7a773]/20 bg-[radial-gradient(circle_at_85%_15%,rgba(181,44,53,.28),transparent_35%),linear-gradient(145deg,#070a08,#10261a)]">
        <div className="mx-auto grid max-w-6xl items-end gap-8 px-4 py-12 sm:px-6 sm:py-20 lg:grid-cols-[1.05fr_.95fr]">
          <div>
            <div className="mb-8"><img src="/brand/teiko-logo.jpg" alt="Logo oficial Teiko Sushi" className="size-24 rounded-full object-cover ring-2 ring-[#c7a773]/45 shadow-[0_0_0_8px_rgba(228,198,129,.05)]" /></div>
            <span className="inline-flex items-center gap-2 rounded-full border border-[#c7a773]/35 px-3 py-1.5 text-xs font-bold uppercase tracking-[.18em] text-[#c7a773]">
              <Utensils className="size-3.5" /> Uma pausa para comer bem
            </span>
            <h1 className="teiko-display mt-6 max-w-2xl text-5xl leading-[.94] sm:text-7xl">
              Sushi com presença, feito para o seu momento.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-[#c1cdc3]">
              Cardápio, pedidos e reservas da Teiko Sushi em Santa Fé do Sul.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button
                className="h-12 rounded-full bg-[#e3262e] px-6 font-black text-white hover:bg-[#e3262e]"
                nativeButton={false}
                render={<a href="#cardapio" />}
              >
                Ver cardápio <ArrowRight className="size-4" />
              </Button>
              <Button
                variant="outline"
                className="h-12 rounded-full border-[#c7a773]/40 bg-transparent px-6 font-black text-[#f3f0e8] hover:bg-white/10"
                nativeButton={false}
                render={<a href="/reserva" />}
              >
                Reservar mesa <CalendarDays className="size-4" />
              </Button>
            </div>
          </div>
          <div className="space-y-5">
            <div className="relative overflow-hidden rounded-[32px] border border-[#c7a773]/25 bg-[#10261a] shadow-teiko-lift">
              <img src="/brand/teiko-sushi-atmosphere.png" alt="Ambiente noturno de sushi com pratos sobre o balcão" className="aspect-[4/3] w-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#070a08] via-[#070a08]/70 to-transparent px-5 pb-5 pt-16">
                <p className="text-sm font-bold text-[#f3f0e8]">Uma noite com sabor de casa.</p>
                <p className="mt-1 text-xs text-[#c1cdc3]">Imagem de atmosfera; consulte o cardápio para disponibilidade.</p>
              </div>
            </div>
            <div className="rounded-[28px] border border-[#c7a773]/25 bg-[#f3f0e8]/[.06] p-6 backdrop-blur sm:p-7">
            <p className="text-xs font-black uppercase tracking-[.18em] text-[#c7a773]">
              Atendimento da unidade
            </p>
            <h2 className="mt-3 text-3xl font-black">
              {config.city || 'Santa Fé do Sul/SP'}
            </h2>
            <div className="mt-6 flex items-start gap-3 text-sm text-[#c1cdc3]">
              <MapPin className="mt-0.5 size-5 shrink-0 text-[#c7a773]" />
              <span>
                {config.address || 'Endereço a confirmar pela unidade.'}
              </span>
            </div>
            <div className="mt-4 flex items-start gap-3 text-sm text-[#c1cdc3]">
              <Clock3 className="mt-0.5 size-5 shrink-0 text-[#c7a773]" />
              <span>
                {availability.acceptingOrders
                  ? `Pedidos abertos${availability.closesAt ? ` até ${availability.closesAt}` : ''}`
                  : `Fechado no momento · ${availability.reason === 'OUTSIDE_HOURS' ? formatNextOpening(availability.nextOpening) : config.pauseMessage || 'consulte a unidade'}`}
              </span>
            </div>
            <div className="mt-6 border-t border-white/10 pt-5 text-sm text-[#c1cdc3]">
              <strong className="text-[#f3f0e8]">
                {availability.estimate.label}
              </strong>
              <span className="ml-2">{availability.estimate.detail}</span>
            </div>
            </div>
          </div>
        </div>
      </section>
      {activePromotions.length > 0 && (
        <section className="border-b border-[#c7a773]/20 bg-[#f3f0e8] text-[#070a08]">
          <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
            <p className="text-xs font-black uppercase tracking-[.18em] text-[#b5232b]">Ofertas da unidade</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {activePromotions.map((promotion) => <article key={promotion.id} className="rounded-[24px] border border-[#c7a773]/45 bg-white p-5 shadow-sm"><span className="text-sm font-black text-[#b5232b]">{formatPromotionValue(promotion)}</span><h2 className="mt-2 text-xl font-black">{promotion.name}</h2><p className="mt-2 text-sm text-[#7b887d]">{promotion.description || 'Oferta válida durante o período informado.'}</p><p className="mt-4 text-xs font-bold text-[#7b887d]">Válida até {promotion.endsAt}</p></article>)}
            </div>
          </div>
        </section>
      )}
      <section className="border-y border-[#c7a773]/15 bg-[#10261a]">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[.9fr_1.1fr] lg:items-center lg:gap-16 lg:py-20">
          <div>
            <p className="text-xs font-black uppercase tracking-[.18em] text-[#c7a773]">A experiência Teiko</p>
            <h2 className="teiko-display mt-4 max-w-xl text-4xl leading-[.98] sm:text-5xl">Uma pausa que começa no olhar e termina na mesa.</h2>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-[#c1cdc3]">{config.orderInstructions || 'Escolha seus favoritos, monte seu pedido e deixe a equipe cuidar do restante.'}</p>
            <div className="mt-7 flex flex-wrap gap-3"><Button className="h-11 rounded-full bg-[#e3262e] px-5 font-black text-white hover:bg-[#e3262e]" nativeButton={false} render={<a href="#cardapio" />}>Explorar o cardápio <ArrowRight className="size-4" /></Button><a href="/informacoes" className="inline-flex h-11 items-center rounded-full border border-[#c7a773]/40 px-5 text-sm font-black text-[#f3f0e8]">Ver a unidade</a></div>
          </div>
          <div className="grid grid-cols-[1.15fr_.85fr] gap-3 sm:gap-5">
            <div className="relative min-h-72 overflow-hidden rounded-[28px] border border-[#c7a773]/25"><img src={products[0]?.imageUrl || '/brand/teiko-sushi-atmosphere.png'} alt={products[0] ? `Foto de ${products[0].name}` : 'Ambiente da Teiko Sushi'} className="size-full object-cover" loading="lazy" /><div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#070a08] to-transparent p-5 pt-20"><span className="text-xs font-black uppercase tracking-[.14em] text-[#c7a773]">{products[0]?.name || 'Teiko Sushi'}</span></div></div>
            <div className="mt-10 relative min-h-56 overflow-hidden rounded-[28px] border border-[#c7a773]/25 sm:mt-16"><img src={products[1]?.imageUrl || '/brand/teiko-sushi-atmosphere.png'} alt={products[1] ? `Foto de ${products[1].name}` : 'Atmosfera da Teiko Sushi'} className="size-full object-cover" loading="lazy" /><div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#070a08] to-transparent p-4 pt-16"><span className="text-xs font-black uppercase tracking-[.14em] text-[#c7a773]">{products[1]?.name || 'Uma noite bem servida'}</span></div></div>
          </div>
        </div>
      </section>
      <section id="cardapio" className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[.18em] text-[#c7a773]">
              Cardápio
            </p>
            <h2 className="teiko-display mt-2 text-4xl">
              Escolha sua experiência
            </h2>
          </div>
          {development && (
            <span className="rounded-full border border-[#c7a773]/30 px-3 py-1.5 text-xs font-bold text-[#c7a773]">
              Dados de desenvolvimento
            </span>
          )}
        </div>
        <div className="mt-6">
          <label className="relative flex-1">
            <span className="sr-only">Buscar no cardápio</span>
            <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#c1cdc3]" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar sushi, sashimi, temaki…" className="h-12 w-full rounded-full border border-white/15 bg-[#10261a] pl-12 pr-5 text-base text-[#f3f0e8] outline-none placeholder:text-[#c1cdc3] focus:border-[#c7a773]" />
          </label>
          <nav aria-label="Categorias do cardápio" className="teiko-scrollbar-none sticky top-[72px] z-20 -mx-4 mt-3 flex gap-2 overflow-x-auto border-y border-white/10 bg-[#070a08]/95 px-4 py-3 backdrop-blur-xl sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-1">
            {visibleCategories.map((category) => <a key={category.id} href={`#categoria-${category.id}`} className="shrink-0 rounded-full border border-[#c7a773]/25 bg-[#10261a] px-4 py-3 text-sm font-bold text-[#c7a773] transition hover:border-[#c7a773]">{category.name}</a>)}
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
          <div className="mt-8 rounded-[26px] border border-dashed border-[#c7a773]/35 p-8 text-center">
            <strong className="text-xl">Cardápio em configuração</strong>
            <p className="mt-2 text-[#c1cdc3]">
              A unidade ainda não publicou produtos e preços oficiais.
            </p>
          </div>
        )}
        {!loading && products.length > 0 && !filteredProducts.length && (
          <div className="mt-8 rounded-[26px] border border-dashed border-[#c7a773]/35 p-8 text-center">
            <strong className="text-xl">Nenhum item encontrado</strong>
            <p className="mt-2 text-[#c1cdc3]">Tente outro termo ou limpe a busca.</p>
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
              <span className="text-sm text-[#c1cdc3]">
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
      <OrderLookup />
      <PublicFooter />
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
      className="group grid min-h-44 grid-cols-[1fr_108px] gap-4 rounded-[26px] border border-white/10 bg-[#10261a] p-5 transition hover:-translate-y-0.5 hover:border-[#c7a773]/50 sm:grid-cols-[1fr_140px]"
    >
      <div className="flex flex-col">
        <span className="text-xs font-bold uppercase tracking-[.12em] text-[#c7a773]">
          {category.name}
        </span>
        <h4 className="mt-2 text-xl font-black">{product.name}</h4>
        <p className="mt-2 text-sm leading-relaxed text-[#c1cdc3]">
          {product.description}
        </p>
        <span className="mt-auto pt-5 text-sm font-black text-[#c7a773]">
          {starting > 0
            ? `A partir de ${formatBRL(starting)}`
            : 'Preço a confirmar'}
        </span>
        {promotion && <span className="mt-2 w-fit rounded-full bg-[#d6e7bf] px-2.5 py-1 text-xs font-black text-[#070a08]">{formatPromotionValue(promotion)}</span>}
      </div>
      <div className="relative overflow-hidden rounded-[20px] bg-[#e3262e]/80 text-center text-sm font-black text-white">
        <img
          src={product.imageUrl || '/brand/teiko-sushi-atmosphere.png'}
          alt={`Foto de ${product.name}`}
          className="absolute inset-0 size-full object-cover transition duration-500 group-hover:scale-105"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#070a08]/90 via-[#070a08]/20 to-transparent" />
        <span className="absolute inset-x-3 bottom-3">Ver item</span>
      </div>
    </a>
  );
}
