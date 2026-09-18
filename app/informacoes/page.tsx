'use client';

import { AtSign, Bike, Clock3, MapPin, Phone, ShieldCheck } from 'lucide-react';

import { PublicHeader } from '@/components/public-header';
import { PublicFooter } from '@/components/public-footer';
import { WhatsAppCta } from '@/components/whatsapp-cta';
import { useCatalog } from '@/components/providers';
import { formatBRL, getDeliveryEstimate } from '@/shared/domain';

const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export default function InformationPage() {
  const { config, development } = useCatalog();
  const estimate = getDeliveryEstimate(new Date(), config);
  return <main className="min-h-screen bg-[#070a08] text-[#f3f0e8]"><PublicHeader /><div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16"><p className="text-xs font-black uppercase tracking-[.18em] text-[#c7a773]">Teiko Sushi</p><h1 className="mt-3 text-4xl font-black tracking-[-.05em]">Informações da unidade</h1>{development && <p className="mt-5 rounded-2xl border border-[#c7a773]/30 bg-[#10261a] p-4 text-sm text-[#c7a773]">Dados de desenvolvimento: endereço, contato, horários e preços oficiais devem ser cadastrados pela equipe.</p>}<section className="mt-8 rounded-[28px] border border-[#c7a773]/25 bg-[#10261a] p-6 sm:p-8"><h2 className="text-2xl font-black">Como fazer seu pedido</h2><p className="mt-3 leading-relaxed text-[#c1cdc3]">{config.orderInstructions}</p><p className="mt-5 font-bold text-[#c7a773]">{config.gratitudeMessage}</p><div className="mt-6"><WhatsAppCta config={config} message="Olá, Teiko Sushi. Gostaria de tirar uma dúvida sobre o atendimento." /></div></section><div className="mt-4 grid gap-4 sm:grid-cols-2"><InfoCard icon={MapPin} title="Endereço"><p>{config.address || 'A confirmar'}</p><p>{config.city}</p></InfoCard><InfoCard icon={Phone} title="Contato"><p>{config.phoneDisplay || 'Telefone a confirmar'}</p>{config.whatsappEnabled && <p>WhatsApp habilitado para contato</p>}</InfoCard><InfoCard icon={AtSign} title="Instagram"><p>{config.instagramHandle || 'A confirmar'}</p></InfoCard><InfoCard icon={Bike} title="Entrega"><p>{config.deliveryConfig.mode === 'FIXED' ? `Taxa fixa: ${formatBRL(config.deliveryConfig.fixedFeeCents ?? 0)}` : 'Taxa confirmada pela unidade'}</p><p>Estimativa: {estimate.label}</p></InfoCard></div><section className="mt-4 rounded-[28px] bg-[#f3f0e8] p-6 text-[#070a08]"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-full bg-[#e3262e] text-white"><Clock3 className="size-5" /></span><div><h2 className="text-xl font-black">Horários</h2><p className="text-xs text-[#7b887d]">{config.holidayHoursNote || 'Exceções devem ser configuradas pela unidade.'}</p></div></div><div className="mt-5 divide-y divide-[#070a08]/10">{[...config.hours].sort((a, b) => a.day - b.day).map((day) => <div key={day.day} className="flex justify-between gap-4 py-3 text-sm"><strong>{dayNames[day.day]}</strong><span className="text-right text-[#7b887d]">{day.closed ? 'Fechado' : day.windows.map((window) => `${window.open} às ${window.close}`).join(' / ')}</span></div>)}</div></section><InfoCard icon={ShieldCheck} title="Privacidade"><p>{config.privacyNotice}</p></InfoCard></div><PublicFooter /></main>;
}

function InfoCard({ icon: Icon, title, children }: { icon: typeof MapPin; title: string; children: React.ReactNode }) { return <section className="rounded-[26px] bg-[#10261a] p-6"><span className="grid size-10 place-items-center rounded-full bg-[#e3262e] text-white"><Icon className="size-5" /></span><h2 className="mt-4 text-lg font-black">{title}</h2><div className="mt-2 space-y-1 text-sm leading-relaxed text-[#c1cdc3]">{children}</div></section>; }
