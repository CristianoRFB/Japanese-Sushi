'use client';

import { ArrowUpRight, Info, ShoppingBag } from 'lucide-react';
import { useCart } from '@/components/providers';

export function PublicHeader() {
  const { items } = useCart();
  const count = items.reduce((total, item) => total + item.quantity, 0);
  return <header className="sticky top-0 z-30 border-b border-[#122b36]/10 bg-[#f7f4ee]/95 backdrop-blur-xl"><div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-4 sm:px-8"><a className="flex items-center gap-3" href="/" aria-label="Teiko Sushi, início"><span className="grid size-10 place-items-center rounded-full bg-[#c84d43] text-[17px] font-black text-white shadow-[0_5px_14px_rgba(200,77,67,.22)]">T</span><span><strong className="block text-[15px] font-black tracking-[-0.03em] text-[#122b36]">Teiko Sushi</strong><small className="hidden text-[10px] font-bold uppercase tracking-[.18em] text-[#738082] sm:block">Sushi bar • Santa Fé</small></span></a><nav className="flex items-center gap-2" aria-label="Navegação principal"><a className="hidden items-center gap-1 rounded-full px-4 py-2 text-sm font-bold text-[#536568] transition hover:bg-[#ebe7df] sm:flex" href="#cardapio">Cardápio <ArrowUpRight className="size-3.5" /></a><a className="grid size-10 place-items-center rounded-full text-[#536568] transition hover:bg-[#ebe7df]" href="/informacoes" aria-label="Informações"><Info className="size-[18px]" /></a><a className="relative flex h-11 items-center gap-2 rounded-full bg-[#122b36] px-4 text-sm font-bold text-white shadow-[0_7px_18px_rgba(18,43,54,.18)] transition hover:bg-[#21434f]" href="/carrinho" aria-label={`Carrinho com ${count} itens`}><ShoppingBag className="size-[18px]" /><span className="hidden sm:inline">Sacola</span><span className="grid size-5 items-center justify-center rounded-full bg-[#d9ac64] text-[10px] font-black text-[#122b36]">{count}</span></a></nav></div></header>;
}
