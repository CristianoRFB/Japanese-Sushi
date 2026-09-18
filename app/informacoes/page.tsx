'use client';

import {
  ArrowRight,
  AtSign,
  Bike,
  CalendarDays,
  Clock3,
  MapPin,
  Phone,
  ShieldCheck,
} from 'lucide-react';

import { PublicFooter } from '@/components/public-footer';
import { PublicHeader } from '@/components/public-header';
import { WhatsAppCta } from '@/components/whatsapp-cta';
import { useCatalog } from '@/components/providers';
import { formatBRL, getDeliveryEstimate } from '@/shared/domain';

const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export default function InformationPage() {
  const { config, development, loading, error } = useCatalog();
  const estimate = getDeliveryEstimate(new Date(), config);
  const address = [config.address, config.city].filter(Boolean).join(' · ');
  const hours = [...config.hours].sort((a, b) => a.day - b.day);

  return (
    <main className="min-h-screen overflow-hidden bg-teiko-paper text-teiko-ink">
      <PublicHeader tone="light" />

      <section className="relative isolate overflow-hidden border-b border-teiko-ink/10">
        <div aria-hidden="true" className="absolute -right-40 -top-40 -z-10 size-[34rem] rounded-full bg-teiko-lime/65" />
        <div aria-hidden="true" className="absolute -bottom-52 -left-44 -z-10 size-[30rem] rounded-full bg-teiko-gold/65" />
        <div className="mx-auto grid max-w-6xl gap-10 px-4 pb-14 pt-12 sm:px-6 sm:pb-20 sm:pt-16 lg:grid-cols-[.86fr_1.14fr] lg:items-center lg:gap-20">
          <div>
            <p className="text-xs font-black uppercase tracking-[.2em] text-teiko-wine">Teiko Sushi · Santa Fé do Sul</p>
            <h1 className="teiko-display mt-5 max-w-xl text-6xl leading-[.86] tracking-[-.055em] sm:text-7xl">A unidade por trás da mesa.</h1>
            <p className="mt-7 max-w-lg text-base leading-relaxed text-teiko-muted sm:text-lg">
              {loading ? 'Carregando as informações da unidade…' : config.orderInstructions || 'Escolha seus favoritos e confirme os detalhes do atendimento com a unidade.'}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#horarios" className="inline-flex h-12 items-center gap-2 rounded-full bg-teiko-ink px-5 text-sm font-black text-teiko-paper transition hover:bg-teiko-ink-soft">
                Ver horários <ArrowRight className="size-4" />
              </a>
              <a href="/reserva" className="inline-flex h-12 items-center gap-2 rounded-full border border-teiko-ink/25 px-5 text-sm font-black transition hover:bg-white">
                Reservar mesa <CalendarDays className="size-4" />
              </a>
            </div>
            {development && <p className="mt-6 rounded-2xl border border-teiko-gold/40 bg-teiko-paper/80 p-3 text-sm text-teiko-wine">Dados de desenvolvimento: contato e preços oficiais devem ser cadastrados pela equipe.</p>}
          </div>

          <div className="relative min-h-[380px] sm:min-h-[470px]">
            <figure className="absolute inset-x-[8%] top-0 aspect-[4/5] overflow-hidden rounded-[38px] bg-teiko-ink shadow-teiko-lift sm:rounded-[48px]">
              <img src="/menu/combinado-teiko.png" alt="Combinado Teiko servido à mesa" className="size-full object-cover" fetchPriority="high" />
              <div className="absolute inset-0 bg-gradient-to-t from-teiko-ink/90 via-transparent to-transparent" />
              <figcaption className="absolute inset-x-0 bottom-0 p-6 text-teiko-paper sm:p-8">
                <span className="text-xs font-black uppercase tracking-[.18em] text-teiko-gold">A experiência Teiko</span>
                <strong className="mt-2 block max-w-xs text-2xl leading-tight sm:text-3xl">Sushi, sashimi e combinados para o seu ritmo.</strong>
              </figcaption>
            </figure>
            <figure className="absolute bottom-0 left-0 z-10 w-[43%] rounded-[26px] border-8 border-teiko-paper bg-white p-2 shadow-xl sm:rounded-[32px] sm:border-[10px]">
              <img src="/menu/sashimi-salmao.png" alt="Sashimi de salmão preparado pela Teiko Sushi" className="aspect-square w-full rounded-[18px] object-cover sm:rounded-[24px]" loading="lazy" />
              <figcaption className="px-1 pb-1 pt-2 text-sm font-black sm:px-2 sm:pb-2 sm:pt-3 sm:text-base">Feito na hora.</figcaption>
            </figure>
            <div className="absolute bottom-8 right-0 z-10 rounded-2xl bg-teiko-ink px-4 py-3 text-teiko-paper shadow-xl sm:bottom-12 sm:px-5 sm:py-4">
              <span className="block text-[10px] font-black uppercase tracking-[.18em] text-teiko-gold">Buffet</span>
              <strong className="mt-1 block text-sm sm:text-base">por kg ou à vontade</strong>
            </div>
          </div>
        </div>
      </section>

      {error && <p role="alert" className="mx-auto max-w-6xl border-b border-teiko-cherry/30 bg-teiko-wine/10 px-4 py-4 text-sm font-bold text-teiko-wine sm:px-6">As informações da unidade estão temporariamente indisponíveis. Tente novamente em instantes.</p>}

      <section className="bg-teiko-ink text-teiko-paper">
        <div className="mx-auto grid max-w-6xl divide-y divide-white/10 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <Fact icon={MapPin} label="Onde estamos" value={loading ? 'Carregando endereço…' : address || 'Endereço a confirmar'} />
          <Fact icon={Clock3} label="Atendimento" value={loading ? 'Carregando horários…' : config.holidayHoursNote || 'Segunda a sábado, das 19h às 23h.'} />
          <Fact icon={Bike} label="Entrega" value={loading ? 'Carregando estimativa…' : config.deliveryConfig.mode === 'FIXED' ? `Taxa fixa: ${formatBRL(config.deliveryConfig.fixedFeeCents ?? 0)}` : `Estimativa ${estimate.label}`} />
        </div>
      </section>

      <section id="horarios" className="scroll-mt-20 bg-teiko-paper px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[.82fr_1.18fr] lg:gap-20">
          <div>
            <p className="text-xs font-black uppercase tracking-[.18em] text-teiko-wine">Planeje sua visita</p>
            <h2 className="teiko-display mt-4 max-w-md text-5xl leading-[.9] sm:text-6xl">Tudo no mesmo ritmo.</h2>
            <p className="mt-6 max-w-md text-base leading-relaxed text-teiko-muted">Consulte o horário da unidade, escolha como receber e fale com a equipe quando precisar.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <WhatsAppCta config={config} message="Olá, Teiko Sushi. Gostaria de confirmar o atendimento." />
              {config.phoneDisplay && <a href={`tel:${config.phoneDisplay.replace(/\D/g, '')}`} className="inline-flex h-12 items-center gap-2 rounded-full border border-teiko-ink/20 px-5 text-sm font-black transition hover:bg-white"><Phone className="size-4" /> {config.phoneDisplay}</a>}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <section className="rounded-[28px] bg-teiko-ink p-6 text-teiko-paper sm:col-span-2 sm:p-8">
              <div className="flex items-start gap-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-teiko-gold text-teiko-ink"><Clock3 className="size-5" /></span>
                <div><h3 className="text-xl font-black">Horários</h3><p className="mt-1 text-sm text-teiko-cloud">{config.holidayHoursNote || 'Exceções devem ser configuradas pela unidade.'}</p></div>
              </div>
              <div className="mt-6 grid gap-x-8 divide-y divide-white/10 sm:grid-cols-2 sm:divide-y-0">
                {loading && <p className="py-3 text-sm text-teiko-cloud sm:col-span-2">Carregando horários…</p>}
                {!loading && hours.map((day) => <div key={day.day} className="flex justify-between gap-4 border-b border-white/10 py-3 text-sm last:border-0 sm:nth-[2n]:border-b-0"><strong>{dayNames[day.day]}</strong><span className="text-right text-teiko-cloud">{day.closed ? 'Fechado' : day.windows.map((window) => `${window.open} às ${window.close}`).join(' / ')}</span></div>)}
                {!loading && !hours.length && <p className="py-3 text-sm text-teiko-cloud sm:col-span-2">Horários ainda não publicados.</p>}
              </div>
            </section>

            <InfoCard icon={MapPin} title="Endereço"><p>{loading ? 'Carregando endereço…' : config.address || 'A confirmar'}</p><p>{loading ? '' : config.city || 'Santa Fé do Sul/SP'}</p></InfoCard>
            <InfoCard icon={AtSign} title="Contato"><p>{loading ? 'Carregando contato…' : config.phoneDisplay || 'Telefone a confirmar'}</p>{!loading && config.instagramHandle && <p>{config.instagramHandle}</p>}</InfoCard>
            <InfoCard icon={ShieldCheck} title="Privacidade" className="sm:col-span-2"><p>{loading ? 'Carregando aviso de privacidade…' : config.privacyNotice || 'Seus dados são usados somente para atender este pedido ou reserva.'}</p></InfoCard>
          </div>
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}

function Fact({ icon: Icon, label, value }: { icon: typeof MapPin; label: string; value: string }) {
  return <div className="flex items-start gap-3 px-4 py-6 sm:px-6"><Icon className="mt-0.5 size-5 shrink-0 text-teiko-gold" /><div><span className="block text-[10px] font-black uppercase tracking-[.18em] text-teiko-gold">{label}</span><strong className="mt-1 block text-sm leading-relaxed">{value}</strong></div></div>;
}

function InfoCard({ icon: Icon, title, children, className = '' }: { icon: typeof MapPin; title: string; children: React.ReactNode; className?: string }) {
  return <section className={`rounded-[26px] border border-teiko-ink/10 bg-white p-6 ${className}`}><span className="grid size-10 place-items-center rounded-2xl bg-teiko-blush text-teiko-wine"><Icon className="size-5" /></span><h3 className="mt-4 text-lg font-black">{title}</h3><div className="mt-2 space-y-1 text-sm leading-relaxed text-teiko-muted">{children}</div></section>;
}
