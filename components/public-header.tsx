'use client';

import { CalendarDays, Info, ShoppingBag } from 'lucide-react';
import { useCart } from '@/components/providers';
import { BrandMark } from '@/components/brand-mark';

export function PublicHeader() {
  const { items } = useCart();
  const count = items.reduce((total, item) => total + item.quantity, 0);
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[#180e16]/95 backdrop-blur-xl">
      <div className="mx-auto flex h-18 max-w-6xl items-center justify-between px-4 sm:px-6">
        <a href="/" aria-label="Teiko Sushi, início">
          <BrandMark size="sm" />
        </a>
        <nav className="flex items-center gap-1" aria-label="Navegação principal">
          <a className="grid size-10 place-items-center rounded-full text-[#d9c4cf] transition hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-[#d9b66f]" href="/reserva" aria-label="Reservar mesa">
            <CalendarDays className="size-5" />
          </a>
          <a className="grid size-10 place-items-center rounded-full text-[#d9c4cf] transition hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-[#d9b66f]" href="/informacoes" aria-label="Informações">
            <Info className="size-5" />
          </a>
          <a className="relative grid size-11 place-items-center rounded-full bg-[#fff7ea] text-[#180e16] transition hover:bg-white focus-visible:ring-2 focus-visible:ring-[#d9b66f]" href="/carrinho" aria-label={`Carrinho com ${count} itens`}>
            <ShoppingBag className="size-5" />
            <span className="absolute -right-0.5 -top-0.5 grid size-5 place-items-center rounded-full bg-[#c13a43] text-[10px] font-black text-white">{count}</span>
          </a>
        </nav>
      </div>
    </header>
  );
}
