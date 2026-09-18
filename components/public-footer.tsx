'use client';

import { ArrowUpRight, Clock3, MapPin } from 'lucide-react';

import { useCatalog } from '@/components/providers';
import { BrandMark } from '@/components/brand-mark';
import { WhatsAppCta } from '@/components/whatsapp-cta';

export function PublicFooter() {
  const { config } = useCatalog();
  const address = [config.address, config.city].filter(Boolean).join(' · ');

  return (
    <footer className="border-t border-[#c7a773]/20 bg-[#070a08] text-[#f3f0e8]">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 sm:py-14 lg:grid-cols-[1.3fr_.8fr_1fr] lg:gap-16">
        <div>
          <BrandMark />
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-[#c1cdc3]">
            Uma experiência japonesa contemporânea em Santa Fé do Sul, feita para
            chegar bem à mesa — seja em casa ou na unidade.
          </p>
          <div className="mt-6">
            <WhatsAppCta
              config={config}
              compact
              message="Olá, Teiko Sushi. Preciso de atendimento."
            />
          </div>
        </div>

        <nav aria-label="Links do rodapé" className="text-sm">
          <p className="text-xs font-black uppercase tracking-[.18em] text-[#c7a773]">
            Atalhos
          </p>
          <div className="mt-4 grid gap-3">
            <a className="inline-flex w-fit items-center gap-2 text-[#c1cdc3] transition hover:text-[#f3f0e8]" href="/#cardapio">
              Cardápio <ArrowUpRight className="size-3.5" />
            </a>
            <a className="inline-flex w-fit items-center gap-2 text-[#c1cdc3] transition hover:text-[#f3f0e8]" href="/reserva">
              Reservar mesa <ArrowUpRight className="size-3.5" />
            </a>
            <a className="inline-flex w-fit items-center gap-2 text-[#c1cdc3] transition hover:text-[#f3f0e8]" href="/#acompanhar">
              Acompanhar pedido <ArrowUpRight className="size-3.5" />
            </a>
            <a className="inline-flex w-fit items-center gap-2 text-[#c1cdc3] transition hover:text-[#f3f0e8]" href="/informacoes">
              Informações da unidade <ArrowUpRight className="size-3.5" />
            </a>
          </div>
        </nav>

        <div className="space-y-4 text-sm text-[#c1cdc3]">
          <p className="text-xs font-black uppercase tracking-[.18em] text-[#c7a773]">
            A unidade
          </p>
          {address && (
            <p className="flex items-start gap-3">
              <MapPin className="mt-0.5 size-4 shrink-0 text-[#c7a773]" />
              <span>{address}</span>
            </p>
          )}
          <p className="flex items-start gap-3">
            <Clock3 className="mt-0.5 size-4 shrink-0 text-[#c7a773]" />
            <span>
              Atendimento conforme os horários publicados pela unidade.
            </span>
          </p>
          {config.phoneDisplay && <p>{config.phoneDisplay}</p>}
          {config.instagramHandle && <p>{config.instagramHandle}</p>}
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-4 text-xs text-[#7b887d] sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>Teiko Sushi · Santa Fé do Sul</span>
          <span>Pedidos, reservas e acompanhamento em um só lugar.</span>
        </div>
      </div>
    </footer>
  );
}
