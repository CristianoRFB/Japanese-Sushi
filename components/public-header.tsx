'use client';

import { CalendarDays, Info, ShoppingBag } from 'lucide-react';
import { useCart, useCatalog } from '@/components/providers';
import { BrandMark } from '@/components/brand-mark';
import { WhatsAppCta } from '@/components/whatsapp-cta';

export function PublicHeader() {
  const { items } = useCart();
  const { config } = useCatalog();
  const count = items.reduce((total, item) => total + item.quantity, 0);
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[#070a08]/95 backdrop-blur-xl">
      <div className="mx-auto flex h-18 max-w-6xl items-center justify-between px-4 sm:px-6">
        <a href="/" aria-label="Teiko Sushi, início">
          <BrandMark size="sm" />
        </a>
        <nav className="flex items-center gap-1" aria-label="Navegação principal">
          <WhatsAppCta config={config} compact message="Olá, Teiko Sushi. Preciso de atendimento." />
          <a className="inline-flex h-10 items-center justify-center gap-2 rounded-full px-3 text-[#c1cdc3] transition hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-[#c7a773]" href="/reserva" aria-label="Reservar mesa">
            <CalendarDays className="size-5" />
            <span className="hidden text-xs font-black sm:inline">Mesa</span>
          </a>
          <a className="inline-flex h-10 items-center justify-center gap-2 rounded-full px-3 text-[#c1cdc3] transition hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-[#c7a773]" href="/informacoes" aria-label="Informações">
            <Info className="size-5" />
            <span className="hidden text-xs font-black sm:inline">Unidade</span>
          </a>
          <a className="relative inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#f3f0e8] px-3 text-[#070a08] transition hover:bg-white focus-visible:ring-2 focus-visible:ring-[#c7a773]" href="/carrinho" aria-label={`Carrinho com ${count} itens`}>
            <ShoppingBag className="size-5" />
            <span className="hidden text-xs font-black sm:inline">Carrinho</span>
            {count > 0 && <span className="absolute -right-0.5 -top-0.5 grid size-5 place-items-center rounded-full bg-[#e3262e] text-[10px] font-black text-white">{count > 99 ? '99+' : count}</span>}
          </a>
        </nav>
      </div>
    </header>
  );
}
