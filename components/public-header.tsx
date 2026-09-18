'use client';

import { CalendarDays, Info, ShoppingBag } from 'lucide-react';
import { useCart, useCatalog } from '@/components/providers';
import { BrandMark } from '@/components/brand-mark';
import { WhatsAppCta } from '@/components/whatsapp-cta';

export function PublicHeader({ tone = 'dark' }: { tone?: 'dark' | 'light' }) {
  const { items } = useCart();
  const { config } = useCatalog();
  const count = items.reduce((total, item) => total + item.quantity, 0);
  const light = tone === 'light';
  return (
    <header className={`sticky top-0 z-30 border-b backdrop-blur-xl ${light ? 'border-teiko-ink/10 bg-teiko-paper/90' : 'border-white/10 bg-teiko-ink/95'}`}>
      <div className="mx-auto flex h-18 max-w-6xl items-center justify-between px-4 sm:px-6">
        <a href="/" aria-label="Teiko Sushi, início">
          <BrandMark size="sm" tone={tone} />
        </a>
        <nav className="flex items-center gap-1" aria-label="Navegação principal">
          <WhatsAppCta config={config} compact message="Olá, Teiko Sushi. Preciso de atendimento." />
          <a className={`inline-flex h-10 items-center justify-center gap-2 rounded-full px-3 transition focus-visible:ring-2 focus-visible:ring-teiko-gold ${light ? 'text-teiko-ink hover:bg-teiko-blush' : 'text-teiko-cloud hover:bg-white/10'}`} href="/reserva" aria-label="Reservar mesa">
            <CalendarDays className="size-5" />
            <span className="hidden text-xs font-black sm:inline">Mesa</span>
          </a>
          <a className={`inline-flex h-10 items-center justify-center gap-2 rounded-full px-3 transition focus-visible:ring-2 focus-visible:ring-teiko-gold ${light ? 'text-teiko-ink hover:bg-teiko-blush' : 'text-teiko-cloud hover:bg-white/10'}`} href="/informacoes" aria-label="Informações">
            <Info className="size-5" />
            <span className="hidden text-xs font-black sm:inline">Unidade</span>
          </a>
          <a className={`relative inline-flex h-11 items-center justify-center gap-2 rounded-full px-3 transition focus-visible:ring-2 focus-visible:ring-teiko-gold ${light ? 'bg-teiko-ink text-teiko-paper hover:bg-teiko-ink-soft' : 'bg-teiko-paper text-teiko-ink hover:bg-white'}`} href="/carrinho" aria-label={`Carrinho com ${count} itens`}>
            <ShoppingBag className="size-5" />
            <span className="hidden text-xs font-black sm:inline">Carrinho</span>
            {count > 0 && <span className="absolute -right-0.5 -top-0.5 grid size-5 place-items-center rounded-full bg-[#e3262e] text-[10px] font-black text-white">{count > 99 ? '99+' : count}</span>}
          </a>
        </nav>
      </div>
    </header>
  );
}
