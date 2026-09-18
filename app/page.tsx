'use client';

<<<<<<< HEAD
import {
  ArrowRight,
  CalendarDays,
  Clock3,
  MapPin,
  Search,
  Utensils,
} from 'lucide-react';
import { useEffect, useState } from 'react';
=======
import { ArrowRight, Check, Clock3, MapPin, Timer, WalletCards } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
>>>>>>> origin/main

import { PublicHeader } from '@/components/public-header';
import { OrderLookup } from '@/components/order-lookup';
import { useCatalog } from '@/components/providers';
<<<<<<< HEAD
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
=======
import { formatBRL, formatNextOpening, getStoreAvailability, type Product, type ProductCategory } from '@/shared/domain';
>>>>>>> origin/main

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
<<<<<<< HEAD
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
            <h1 className="mt-6 max-w-2xl text-5xl font-black leading-[.94] tracking-[-.06em] sm:text-7xl">
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
            <div className="relative overflow-hidden rounded-[32px] border border-[#c7a773]/25 bg-[#10261a] shadow-[0_24px_60px_rgba(0,0,0,.26)]">
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
      <section id="cardapio" className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[.18em] text-[#c7a773]">
              Cardápio
            </p>
            <h2 className="mt-2 text-4xl font-black tracking-[-.05em]">
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
=======
  const primary = products.find((product) => product.categoryId === 'combinados') ?? products[0];
  const sundayHours = config.hours.find((day) => day.day === 0)?.windows.map((window) => `${window.open} às ${window.close}`).join(' / ') || 'A confirmar';

  return <main className="min-h-screen bg-[#f7f4ee] text-[#122b36]"><PublicHeader />
    <section className="mx-auto max-w-7xl px-4 pb-10 pt-5 sm:px-8 sm:pb-16 sm:pt-8">
      <div className="teiko-grain relative overflow-hidden rounded-[28px] bg-[#122b36] text-white shadow-[0_24px_70px_rgba(18,43,54,.18)] sm:rounded-[40px]">
        <div className="absolute -right-24 -top-24 size-72 rounded-full border-[28px] border-[#d9ac64]/20" /><div className="absolute -bottom-24 left-1/3 size-64 rounded-full border-[18px] border-[#c84d43]/20" />
        <div className="relative grid min-h-[520px] items-center gap-10 px-6 py-10 sm:px-12 sm:py-14 lg:grid-cols-[1fr_420px] lg:px-16">
          <div className="max-w-2xl"><div className="flex flex-wrap items-center gap-3 text-[11px] font-black uppercase tracking-[.2em] text-[#d9ac64]"><span>Teiko Sushi</span><span className="size-1 rounded-full bg-[#c84d43]" /><span>Comida japonesa</span></div><h1 className="teiko-display mt-7 max-w-xl text-[3.5rem] leading-[.94] tracking-[-.055em] text-[#f7f4ee] sm:text-7xl">Peixe fresco.<br /><em className="text-[#d9ac64]">Tempo de verdade.</em></h1><p className="mt-6 max-w-md text-base leading-relaxed text-white/65 sm:text-lg">Combinados montados na hora, sabores honestos e aquele cuidado que chega até sua mesa.</p><div className="mt-7 flex flex-wrap items-center gap-3"><a className="inline-flex h-12 items-center gap-3 rounded-full bg-[#c84d43] px-6 text-sm font-black text-white shadow-[0_10px_25px_rgba(200,77,67,.25)] transition hover:bg-[#dc5b50]" href={primary ? `/montar/${primary.id}` : '#cardapio'}>Pedir agora <ArrowRight className="size-4" /></a><a className="inline-flex h-12 items-center rounded-full border border-white/20 px-5 text-sm font-bold text-white/80 transition hover:bg-white/10" href="#cardapio">Explorar cardápio</a></div><div className="mt-8 flex items-center gap-2 text-xs text-white/55"><span className={`size-2 rounded-full ${availability.acceptingOrders ? 'bg-emerald-400' : 'bg-[#d9ac64]'}`} />{availability.acceptingOrders ? `Aberto agora · ${availability.estimate.label}` : `Abre ${formatNextOpening(availability.nextOpening)}`}</div></div>
          <SushiComposition />
        </div>
      </div>
    </section>

    <section className="mx-auto grid max-w-7xl gap-3 px-4 sm:grid-cols-3 sm:px-8"><Feature icon={<Timer />} title={availability.estimate.label} text="Tempo estimado para seu pedido" /><Feature icon={<WalletCards />} title={formatBRL(config.deliveryConfig.fixedFeeCents ?? 0)} text="Taxa fixa de entrega" /><Feature icon={<MapPin />} title={config.city ?? 'Sua região'} text="Retire ou receba em casa" /></section>

    <section id="cardapio" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-16 sm:px-8 sm:py-24"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="text-[11px] font-black uppercase tracking-[.22em] text-[#c84d43]">O menu</p><h2 className="teiko-display mt-3 text-4xl tracking-[-.04em] text-[#122b36] sm:text-5xl">Escolha seu momento</h2></div>{development && <span className="w-fit rounded-full border border-[#d9ac64]/50 bg-[#fffdfa] px-3 py-2 text-[11px] font-black uppercase tracking-wider text-[#8c6a32]">Prévia do cardápio</span>}</div><nav aria-label="Categorias do cardápio" className="mt-8 flex gap-2 overflow-x-auto pb-2">{categories.map((category) => <a key={category.id} href={`#categoria-${category.id}`} className="shrink-0 rounded-full border border-[#d9d4ca] bg-[#fffdfa] px-4 py-2.5 text-sm font-bold text-[#536568] transition hover:border-[#c84d43] hover:text-[#c84d43]">{category.name}</a>)}</nav>{loading && <div className="mt-10 grid gap-5 sm:grid-cols-2"><div className="h-72 animate-pulse rounded-[24px] bg-[#ebe7df]" /><div className="h-72 animate-pulse rounded-[24px] bg-[#ebe7df]" /></div>}{error && <div role="alert" className="mt-8 rounded-2xl bg-red-50 p-4 text-sm text-red-800">Não foi possível carregar o cardápio: {error}</div>}{!loading && !products.length && <div className="mt-8 rounded-[24px] border border-dashed border-[#c84d43]/35 bg-[#fffdfa] p-8 text-center"><strong>Cardápio em configuração</strong><p className="mt-1 text-sm text-[#6f7d7e]">A loja ainda não publicou produtos.</p></div>}{!loading && categories.map((category) => <Category key={category.id} category={category} products={products.filter((product) => product.categoryId === category.id)} />)}<div className="mt-16 flex flex-col gap-5 rounded-[26px] border border-[#d9d4ca] bg-[#fffdfa] p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8"><div className="flex items-start gap-4"><span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#f5e8df] text-[#c84d43]"><Clock3 className="size-5" /></span><div><strong className="block text-base">Domingo é dia de Teiko</strong><p className="mt-1 text-sm text-[#6f7d7e]">{sundayHours} · {config.city}</p></div></div><a className="inline-flex items-center gap-2 text-sm font-black text-[#c84d43]" href="/informacoes">Ver informações da loja <ArrowRight className="size-4" /></a></div></section>
    <footer className="border-t border-[#122b36]/10 px-4 py-8 text-center text-xs font-bold text-[#7a8585] sm:px-8">Teiko Sushi · feito com cuidado em {config.city ?? 'sua região'}</footer>
  </main>;
}

function SushiComposition() { return <div className="relative mx-auto h-[350px] w-full max-w-[390px]" aria-hidden="true"><div className="absolute inset-5 rotate-[-6deg] rounded-[30px] bg-[#d9ac64] p-4 shadow-[0_20px_40px_rgba(0,0,0,.18)]"><div className="grid h-full place-items-center rounded-[22px] border border-[#122b36]/20 bg-[#e7d7be]"><span className="teiko-vertical text-[12px] font-black uppercase tracking-[.4em] text-[#122b36]/65">sushi · bar · teiko</span></div></div><div className="absolute right-5 top-3 grid size-28 rotate-12 place-items-center rounded-full border-[13px] border-[#c84d43] bg-[#f28a66] shadow-xl"><span className="text-5xl">🍣</span></div><div className="absolute bottom-4 left-0 grid size-32 -rotate-12 place-items-center rounded-full border-[12px] border-[#122b36] bg-[#f2d7b8] shadow-xl"><span className="text-5xl">🍱</span></div><div className="absolute bottom-7 right-2 rounded-2xl bg-[#f7f4ee] px-4 py-3 text-[#122b36] shadow-xl"><span className="flex items-center gap-2 text-xs font-black"><Check className="size-3.5 text-[#c84d43]" /> Feito na hora</span><span className="mt-1 block text-[10px] font-bold text-[#6f7d7e]">sabor que fica</span></div></div>; }
function Feature({ icon, title, text }: { icon: ReactNode; title: string; text: string }) { return <div className="flex items-center gap-3 border-b border-[#d9d4ca] bg-[#fffdfa] px-4 py-4 first:rounded-t-2xl last:rounded-b-2xl sm:border-b-0 sm:px-5 sm:first:rounded-l-2xl sm:first:rounded-tr-none sm:last:rounded-r-2xl sm:last:rounded-bl-none"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#f5e8df] text-[#c84d43]">{icon}</span><div><strong className="block text-sm font-black text-[#122b36]">{title}</strong><span className="text-xs text-[#6f7d7e]">{text}</span></div></div>; }
function Category({ category, products }: { category: ProductCategory; products: Product[] }) { return <section id={`categoria-${category.id}`} className="scroll-mt-24 pt-14 first:pt-12"><div className="flex items-baseline justify-between border-b border-[#d9d4ca] pb-3"><div><h3 className="text-2xl font-black tracking-[-.035em] text-[#122b36]">{category.name}</h3><p className="mt-1 text-xs font-bold text-[#7a8585]">{products.length} {products.length === 1 ? 'opção' : 'opções'}</p></div>{category.id === 'combinados' && <span className="text-xs font-black uppercase tracking-wider text-[#c84d43]">Mais pedidos</span>}</div><div className="mt-5 grid gap-4 sm:grid-cols-2">{products.map((product) => <ProductCard key={product.id} product={product} category={category} />)}</div></section>; }
function ProductCard({ product, category }: { product: Product; category: ProductCategory }) { const activeSizes = product.sizes.filter((size) => size.active); const starting = activeSizes.length ? Math.min(...activeSizes.map((size) => size.basePriceCents)) : 0; return <a href={`/montar/${product.id}`} className="group grid min-h-[148px] grid-cols-[1fr_118px] gap-4 rounded-[22px] border border-[#e3ded5] bg-[#fffdfa] p-4 transition hover:-translate-y-1 hover:border-[#d9ac64] hover:shadow-[0_16px_35px_rgba(18,43,54,.08)] sm:grid-cols-[1fr_150px] sm:p-5"><div className="flex min-w-0 flex-col"><span className="text-[10px] font-black uppercase tracking-[.16em] text-[#c84d43]">{category.name}</span><h4 className="mt-2 text-lg font-black tracking-[-.03em] text-[#122b36]">{product.name}</h4><p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[#6f7d7e]">{product.description}</p><span className="mt-auto pt-4 text-sm font-black text-[#122b36]">A partir de {formatBRL(starting)}</span></div><div className="relative min-h-[116px] overflow-hidden rounded-[17px] bg-gradient-to-br from-[#21434f] via-[#356978] to-[#d9ac64]">{product.imageUrl ? <img src={product.imageUrl} alt="" className="size-full object-cover opacity-90 transition duration-500 group-hover:scale-110" /> : <div className="grid size-full place-items-center text-5xl">🍣</div>}<span className="absolute bottom-2 right-2 grid size-8 place-items-center rounded-full bg-[#f7f4ee] text-[#c84d43] shadow-sm"><ArrowRight className="size-3.5" /></span></div></a>; }
>>>>>>> origin/main
