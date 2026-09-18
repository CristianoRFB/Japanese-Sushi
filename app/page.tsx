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
        (!product.unitIds?.length || product.unitIds.includes(config.defaultUnitId)),
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
  const activePromotions = promotions.filter((promotion) =>
    isPromotionActive(promotion, now),
  );
  const imageFor = (id: string, fallback: string) =>
    catalog.products.find((product) => product.id === id)?.imageUrl || fallback;
  const heroImage = imageFor('combinado-teiko', '/menu/combinado-teiko.png');
  const secondaryImage = imageFor('sushi-salmao', '/menu/sushi-salmao.png');
  const detailImage = imageFor('sashimi-salmao', '/menu/sashimi-salmao.png');

  return (
    <main className="min-h-screen overflow-hidden bg-teiko-paper text-teiko-ink">
      <PublicHeader tone="light" />

      <section className="relative isolate overflow-hidden border-b border-teiko-ink/10 bg-teiko-paper">
        <div aria-hidden="true" className="absolute -left-28 top-44 -z-10 size-[28rem] rounded-full bg-teiko-gold/80 sm:size-[42rem]" />
        <div aria-hidden="true" className="absolute right-[-12rem] top-[-10rem] -z-10 size-[34rem] rounded-full bg-teiko-lime/60" />
        <div className="mx-auto max-w-6xl px-4 pb-10 pt-8 sm:px-6 sm:pb-16 sm:pt-12 lg:pb-20">
          <div className="grid items-center gap-8 lg:grid-cols-[.92fr_1.08fr] lg:gap-12">
            <div className="relative z-10">
              <div className="flex flex-wrap items-center gap-3 text-[11px] font-black uppercase tracking-[.2em] text-teiko-wine">
                <span>Teiko Sushi</span>
                <span className="size-1.5 rounded-full bg-teiko-wine" />
                <span>Santa Fé do Sul</span>
              </div>
              <div className="mt-10 flex items-start gap-7 sm:mt-16 sm:gap-10">
                <div>
                  <h1 className="teiko-display max-w-xl text-[clamp(4.4rem,13vw,9.2rem)] leading-[.78] text-teiko-ink">
                    Sushi
                    <br />
                    <span className="text-teiko-wine">com presença.</span>
                  </h1>
                  <p className="mt-8 max-w-md text-base leading-relaxed text-teiko-muted sm:text-lg">
                    Uma experiência japonesa contemporânea, feita para chegar bem à mesa — seja em casa ou na unidade.
                  </p>
                  <div className="mt-8 flex flex-wrap gap-3">
                    <Button
                      className="h-12 rounded-full bg-teiko-ink px-6 font-black text-teiko-paper hover:bg-teiko-ink-soft"
                      nativeButton={false}
                      render={<a href="#cardapio" />}
                    >
                      Ver cardápio <ArrowRight className="size-4" />
                    </Button>
                    <Button
                      variant="outline"
                      className="h-12 rounded-full border-teiko-ink/25 bg-transparent px-6 font-black text-teiko-ink hover:bg-white"
                      nativeButton={false}
                      render={<a href="/reserva" />}
                    >
                      Reservar mesa <CalendarDays className="size-4" />
                    </Button>
                  </div>
                </div>
                <span aria-hidden="true" className="hidden pt-2 text-4xl leading-[1.45] text-teiko-gold sm:block [writing-mode:vertical-rl]">
                  寿司
                </span>
              </div>
            </div>

            <div className="relative min-h-[470px] sm:min-h-[590px]">
              <div aria-hidden="true" className="absolute left-[9%] top-[12%] size-[78%] rounded-full border-[18px] border-teiko-gold/35 sm:border-[28px]" />
              <div className="absolute right-0 top-2 z-20 text-right text-teiko-ink">
                <strong className="teiko-display block text-5xl leading-none sm:text-6xl">19h</strong>
                <span className="text-xs font-black uppercase tracking-[.18em] text-teiko-muted">até 23h</span>
              </div>
              <figure className="absolute inset-x-[7%] top-12 z-10 aspect-[4/5] overflow-hidden rounded-[38px] bg-teiko-ink shadow-teiko-lift sm:top-16 sm:rounded-[48px]">
                <img
                  src={heroImage}
                  alt="Seleção de sushi da Teiko Sushi"
                  className="size-full object-cover"
                  fetchPriority="high"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-teiko-ink/85 via-transparent to-transparent" />
                <figcaption className="absolute inset-x-0 bottom-0 p-5 text-teiko-paper sm:p-7">
                  <span className="text-xs font-black uppercase tracking-[.18em] text-teiko-gold">Uma noite bem servida</span>
                  <strong className="mt-2 block max-w-xs text-2xl leading-tight sm:text-3xl">Escolha o seu ritmo. A mesa começa aqui.</strong>
                </figcaption>
              </figure>
              <figure className="absolute bottom-0 left-0 z-20 w-[48%] rounded-[28px] border-8 border-teiko-paper bg-white p-2 shadow-xl sm:rounded-[34px] sm:border-[10px]">
                <img src={secondaryImage} alt="Sushi de salmão da Teiko Sushi" className="aspect-square w-full rounded-[20px] object-cover sm:rounded-[26px]" />
                <figcaption className="px-2 pb-2 pt-3 text-sm font-black text-teiko-ink sm:text-base">Feito na hora.</figcaption>
              </figure>
              <div className="absolute bottom-16 right-0 z-20 hidden rounded-2xl bg-teiko-ink px-4 py-3 text-teiko-paper shadow-xl sm:block">
                <span className="block text-[10px] font-black uppercase tracking-[.18em] text-teiko-gold">Buffet</span>
                <strong className="mt-1 block text-sm">por kg ou à vontade</strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-teiko-ink text-teiko-paper">
        <div className="mx-auto grid max-w-6xl divide-y divide-white/10 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <div className="flex items-start gap-3 px-4 py-6 sm:px-6">
            <MapPin className="mt-0.5 size-5 shrink-0 text-teiko-gold" />
            <div><span className="block text-[10px] font-black uppercase tracking-[.18em] text-teiko-gold">Onde estamos</span><strong className="mt-1 block text-sm">{config.address || 'Rua 23, 624 - Centro'}</strong></div>
          </div>
            <div className="flex items-start gap-3 px-4 py-6 sm:px-6">
            <Clock3 className="mt-0.5 size-5 shrink-0 text-teiko-gold" />
            <div><span className="block text-[10px] font-black uppercase tracking-[.18em] text-teiko-gold">Atendimento</span><strong className="mt-1 block text-sm">{availability.acceptingOrders ? `Pedidos abertos${availability.closesAt ? ` até ${availability.closesAt}` : ''}` : formatNextOpening(availability.nextOpening)}</strong></div>
          </div>
          <div className="flex items-start gap-3 px-4 py-6 sm:px-6">
            <Utensils className="mt-0.5 size-5 shrink-0 text-teiko-gold" />
            <div><span className="block text-[10px] font-black uppercase tracking-[.18em] text-teiko-gold">Experiência</span><strong className="mt-1 block text-sm">Sushi, sashimi e combinados</strong></div>
          </div>
        </div>
      </section>

      {activePromotions.length > 0 && (
        <section className="border-b border-teiko-ink/10 bg-teiko-gold/20 text-teiko-ink">
          <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div><p className="text-xs font-black uppercase tracking-[.18em] text-teiko-wine">Ofertas da unidade</p><h2 className="teiko-display mt-2 text-3xl">Uma boa noite pode começar assim.</h2></div>
              <span className="text-sm font-bold text-teiko-muted">Válidas enquanto estiverem publicadas.</span>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {activePromotions.map((promotion) => <article key={promotion.id} className="border-l-2 border-teiko-wine bg-teiko-paper/80 p-5"><span className="text-sm font-black text-teiko-wine">{formatPromotionValue(promotion)}</span><h3 className="mt-2 text-xl font-black">{promotion.name}</h3><p className="mt-2 text-sm text-teiko-muted">{promotion.description || 'Oferta válida durante o período informado.'}</p><p className="mt-4 text-xs font-bold text-teiko-muted">Válida até {promotion.endsAt}</p></article>)}
            </div>
          </div>
        </section>
      )}

      <section className="bg-teiko-paper px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[.82fr_1.18fr] lg:gap-20">
          <div>
            <p className="text-xs font-black uppercase tracking-[.18em] text-teiko-wine">A experiência Teiko</p>
            <h2 className="teiko-display mt-5 max-w-xl text-5xl leading-[.92] sm:text-6xl">O primeiro olhar também faz parte do sabor.</h2>
            <p className="mt-6 max-w-lg text-base leading-relaxed text-teiko-muted">{config.orderInstructions || 'Escolha seus favoritos, monte seu pedido e deixe a equipe cuidar do restante.'}</p>
            <div className="mt-8 flex flex-wrap gap-3"><Button className="h-11 rounded-full bg-teiko-wine px-5 font-black text-white hover:bg-teiko-berry" nativeButton={false} render={<a href="#cardapio" />}>Explorar o cardápio <ArrowRight className="size-4" /></Button><a href="/informacoes" className="inline-flex h-11 items-center rounded-full border border-teiko-ink/20 px-5 text-sm font-black text-teiko-ink">Ver a unidade</a></div>
          </div>
          <div className="relative grid min-h-[420px] grid-cols-[1.08fr_.92fr] gap-4 sm:min-h-[520px] sm:gap-6">
            <figure className="relative overflow-hidden rounded-[34px] bg-teiko-ink shadow-teiko-lift"><img src={detailImage} alt="Sashimi preparado pela Teiko Sushi" className="size-full object-cover" loading="lazy" /><figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-teiko-ink/90 to-transparent p-5 pt-20 text-teiko-paper"><span className="text-xs font-black uppercase tracking-[.16em] text-teiko-gold">Precisão em cada corte</span></figcaption></figure>
            <div className="mt-14 space-y-4 sm:mt-24 sm:space-y-6"><figure className="overflow-hidden rounded-[30px] border-8 border-teiko-paper bg-white shadow-xl sm:border-[10px]"><img src={secondaryImage} alt="Detalhe de sushi da Teiko Sushi" className="aspect-square w-full object-cover" loading="lazy" /></figure><div className="bg-teiko-lime p-5 sm:p-6"><span className="text-xs font-black uppercase tracking-[.16em] text-teiko-wine">Para o seu momento</span><strong className="mt-2 block text-2xl leading-tight">Da primeira escolha ao último pedaço.</strong></div></div>
          </div>
        </div>
      </section>

      <section className="bg-teiko-lime/60 px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-end justify-between gap-5"><div><p className="text-xs font-black uppercase tracking-[.18em] text-teiko-wine">Por que Teiko</p><h2 className="teiko-display mt-3 text-5xl leading-[.9] sm:text-6xl">Uma pausa bem feita.</h2></div><p className="max-w-sm text-sm leading-relaxed text-teiko-muted">Sabor, cuidado e uma experiência que começa antes de o pedido chegar.</p></div>
          <div className="mt-12 grid gap-8 md:grid-cols-3 md:gap-10">
            <EditorialFeature image={heroImage} alt="Seleção de sushi" title="Ingredientes que aparecem" text="Produtos e imagens com o protagonismo que a comida merece." />
            <EditorialFeature image={secondaryImage} alt="Sushi de salmão" title="Feito para compartilhar" text="Escolha seu ritmo, monte sua mesa e conte com a unidade." />
            <EditorialFeature image={detailImage} alt="Sashimi de salmão" title="Presença na cidade" text="Uma experiência japonesa contemporânea em Santa Fé do Sul." />
          </div>
        </div>
      </section>

      <section id="cardapio" className="scroll-mt-20 rounded-t-[42px] bg-teiko-ink px-4 py-16 text-teiko-paper sm:px-6 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div><p className="text-xs font-black uppercase tracking-[.18em] text-teiko-gold">Cardápio</p><h2 className="teiko-display mt-3 text-5xl leading-[.92] sm:text-6xl">Escolha sua experiência.</h2></div>
            {development && <span className="rounded-full border border-teiko-gold/30 px-3 py-1.5 text-xs font-bold text-teiko-gold">Dados de desenvolvimento</span>}
          </div>
          <div className="mt-8">
            <label className="relative block"><span className="sr-only">Buscar no cardápio</span><Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-teiko-cloud" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar sushi, sashimi, temaki…" className="h-12 w-full rounded-full border border-white/15 bg-teiko-ink-soft pl-12 pr-5 text-base text-teiko-paper outline-none placeholder:text-teiko-cloud focus:border-teiko-gold" /></label>
            <nav aria-label="Categorias do cardápio" className="teiko-scrollbar-none sticky top-[72px] z-20 -mx-4 mt-3 flex gap-2 overflow-x-auto border-y border-white/10 bg-teiko-ink/95 px-4 py-3 backdrop-blur-xl sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-1">{visibleCategories.map((category) => <a key={category.id} href={`#categoria-${category.id}`} className="shrink-0 rounded-full border border-teiko-gold/25 bg-teiko-ink-soft px-4 py-3 text-sm font-bold text-teiko-gold transition hover:border-teiko-gold">{category.name}</a>)}</nav>
          </div>
          {error && <p role="alert" className="mt-6 rounded-2xl border border-teiko-cherry/35 bg-teiko-wine/80 p-4 text-sm text-white">Não foi possível carregar o cardápio: {error}</p>}
          {loading && <div className="mt-8 grid gap-4 sm:grid-cols-2"><div className="h-48 animate-pulse rounded-[26px] bg-white/10" /><div className="h-48 animate-pulse rounded-[26px] bg-white/10" /></div>}
          {!loading && !products.length && <div className="mt-8 rounded-[26px] border border-dashed border-teiko-gold/35 p-8 text-center"><strong className="text-xl">Cardápio em configuração</strong><p className="mt-2 text-teiko-cloud">A unidade ainda não publicou produtos e preços oficiais.</p></div>}
          {!loading && products.length > 0 && !filteredProducts.length && <div className="mt-8 rounded-[26px] border border-dashed border-teiko-gold/35 p-8 text-center"><strong className="text-xl">Nenhum item encontrado</strong><p className="mt-2 text-teiko-cloud">Tente outro termo ou limpe a busca.</p></div>}
          {visibleCategories.map((category) => <section key={category.id} id={`categoria-${category.id}`} className="scroll-mt-24 pt-12"><div className="flex items-baseline justify-between border-b border-white/10 pb-4"><h3 className="teiko-display text-3xl">{category.name}</h3><span className="text-sm text-teiko-cloud">{filteredProducts.filter((product) => product.categoryId === category.id).length} opções</span></div><div className="mt-5 grid gap-4 sm:grid-cols-2">{products.filter((product) => product.categoryId === category.id && filteredProducts.includes(product)).map((product) => <ProductCard key={product.id} product={product} category={category} promotion={activePromotions.find((candidate) => !candidate.productIds.length || candidate.productIds.includes(product.id))} />)}</div></section>)}
        </div>
      </section>
      <OrderLookup />
      <PublicFooter />
    </main>
  );
}

function EditorialFeature({ image, alt, title, text }: { image: string; alt: string; title: string; text: string }) {
  return <article><div className="mx-auto size-40 overflow-hidden rounded-full border-[10px] border-teiko-paper bg-teiko-paper shadow-lg sm:size-48"><img src={image} alt={alt} className="size-full object-cover" loading="lazy" /></div><h3 className="mt-6 text-center text-xl font-black text-teiko-ink">{title}</h3><p className="mx-auto mt-2 max-w-xs text-center text-sm leading-relaxed text-teiko-muted">{text}</p></article>;
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
    <a href={`/montar/${product.id}`} className="group grid min-h-44 grid-cols-[1fr_108px] gap-4 rounded-[26px] border border-white/10 bg-teiko-ink-soft p-5 transition hover:-translate-y-0.5 hover:border-teiko-gold/50 sm:grid-cols-[1fr_140px]">
      <div className="flex flex-col"><span className="text-xs font-bold uppercase tracking-[.12em] text-teiko-gold">{category.name}</span><h4 className="mt-2 text-xl font-black">{product.name}</h4><p className="mt-2 text-sm leading-relaxed text-teiko-cloud">{product.description}</p><span className="mt-auto pt-5 text-sm font-black text-teiko-gold">{starting > 0 ? `A partir de ${formatBRL(starting)}` : 'Preço a confirmar'}</span>{promotion && <span className="mt-2 w-fit rounded-full bg-teiko-lime px-2.5 py-1 text-xs font-black text-teiko-ink">{formatPromotionValue(promotion)}</span>}</div>
      <div className="relative overflow-hidden rounded-[20px] bg-teiko-cherry text-center text-sm font-black text-white"><img src={product.imageUrl || '/brand/teiko-sushi-atmosphere.png'} alt={`Foto de ${product.name}`} className="absolute inset-0 size-full object-cover transition duration-500 group-hover:scale-105" loading="lazy" /><div className="absolute inset-0 bg-gradient-to-t from-teiko-ink/90 via-teiko-ink/20 to-transparent" /><span className="absolute inset-x-3 bottom-3">Ver item</span></div>
    </a>
  );
}
