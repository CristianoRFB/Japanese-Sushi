import { ArrowRight, CircleDollarSign, Settings, ShoppingBag, WalletCards } from 'lucide-react';

import { AdminShell } from '@/components/admin-shell';

const cards = [
  { href: '/admin/pedidos', title: 'Pedidos', text: 'Acompanhe a fila e atualize o preparo.', icon: ShoppingBag, color: 'bg-[#172d3d]' },
  { href: '/admin/caixa', title: 'Caixa', text: 'Abra o turno, registre movimentações e feche o caixa.', icon: WalletCards, color: 'bg-[#f1c46a] text-[#172d3d]' },
  { href: '/admin/financeiro', title: 'Financeiro', text: 'Consulte vendas, pagamentos, estornos e indicadores.', icon: CircleDollarSign, color: 'bg-[#dceef1] text-[#172d3d]' },
  { href: '/admin/catalogo', title: 'Cardápio', text: 'Produtos, porções, preços e categorias.', icon: ShoppingBag, color: 'bg-[#dbe8ee] text-[#172d3d]' },
  { href: '/admin/configuracoes', title: 'Configurações', text: 'Horários, delivery, pagamentos e dados da loja.', icon: Settings, color: 'bg-[#23475a]' },
];
export default function AdminDashboard() { return <AdminShell><div><p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#b07a2e]">Teiko Sushi</p><h1 className="mt-2 text-3xl font-black tracking-[-.04em]">Visão geral</h1><p className="mt-2 text-sm text-[#607681]">Pedidos, operação de caixa e financeiro em um só painel.</p></div><div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{cards.map(({ href, title, text, icon: Icon, color }) => <a key={href} href={href} className="group rounded-[26px] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><span className={`grid size-11 place-items-center rounded-2xl ${color}`}><Icon className="size-5" /></span><h2 className="mt-5 text-xl font-black">{title}</h2><p className="mt-1 text-sm text-[#607681]">{text}</p><span className="mt-5 flex items-center gap-2 text-sm font-black text-[#23475a]">Abrir <ArrowRight className="size-4 transition group-hover:translate-x-1" /></span></a>)}</div></AdminShell>; }
