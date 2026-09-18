'use client';

import { MessageCircle } from 'lucide-react';

import { getWhatsappNumber, type StorePublicConfig } from '@/shared/domain';

export function WhatsAppCta({
  config,
  message = 'Olá, Teiko Sushi. Gostaria de tirar uma dúvida.',
  compact = false,
}: {
  config: StorePublicConfig;
  message?: string;
  compact?: boolean;
}) {
  const number = getWhatsappNumber(config);
  if (!config.whatsappEnabled || !number) return null;
  return (
    <a
      href={`https://wa.me/${number}?text=${encodeURIComponent(message)}`}
      target="_blank"
      rel="noreferrer"
      className={`inline-flex items-center justify-center gap-2 rounded-full bg-[#d6e7bf] font-black text-[#070a08] transition hover:bg-[#e7f77b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c7a773] ${compact ? 'h-10 px-4 text-xs' : 'h-12 px-5 text-sm'}`}
    >
      <MessageCircle className="size-4" /> Falar no WhatsApp
    </a>
  );
}
