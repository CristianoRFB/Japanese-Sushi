'use client';

import { AlertTriangle, Link2, ShieldCheck } from 'lucide-react';

import { AdminShell } from '@/components/admin-shell';

export default function IntegrationPage() {
  return <AdminShell adminOnly>
    <div className="mx-auto max-w-4xl"><p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#8b1e2b]">Preparação operacional</p><h1 className="mt-2 text-3xl font-black tracking-[-.04em]">Integrações</h1><p className="mt-2 text-sm text-[#7b887d]">Área reservada para integrações futuras do atendimento e da cozinha.</p>
      <section className="mt-7 rounded-[28px] border border-[#c7a773]/35 bg-[#f3f0e8] p-6 sm:p-8"><div className="flex items-start gap-4"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#c7a773] text-[#070a08]"><Link2 className="size-5" /></span><div><h2 className="text-xl font-black">Operação Teiko independente</h2><p className="mt-2 text-sm leading-relaxed text-[#7b887d]">Os pedidos seguem pelo catálogo, fila, KDS e PDV da Teiko. Nenhum provedor externo está conectado neste ambiente.</p></div></div></section>
      <div className="mt-4 grid gap-4 sm:grid-cols-2"><section className="rounded-[26px] bg-white p-6 shadow-sm"><ShieldCheck className="size-7 text-[#3a5b35]" /><h2 className="mt-4 text-lg font-black">Status seguro</h2><p className="mt-2 text-sm leading-relaxed text-[#7b887d]">Firebase dedicado: sushi-cbfd2. As credenciais de terceiros não são armazenadas no navegador.</p></section><section className="rounded-[26px] bg-[#070a08] p-6 text-white"><AlertTriangle className="size-7 text-[#c7a773]" /><h2 className="mt-4 text-lg font-black">Ainda não habilitado</h2><p className="mt-2 text-sm leading-relaxed text-white/65">Não habilite Functions de produção, Cloud Run, Storage ou um integrador externo sem homologação e credenciais oficiais.</p></section></div>
    </div>
  </AdminShell>;
}
