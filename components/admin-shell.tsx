'use client';

import { BarChart3, Boxes, CircleDollarSign, LayoutDashboard, LogOut, Settings, ShoppingBag, SlidersHorizontal, WalletCards } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { useEffect, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';

import { useAuth } from '@/components/providers';
import { getFirebaseClient, hasFirebaseConfig } from '@/lib/firebase/client';

const links = [
  { href: '/admin', label: 'Visão geral', icon: LayoutDashboard },
  { href: '/admin/pedidos', label: 'Pedidos', icon: ShoppingBag },
  { href: '/admin/caixa', label: 'Caixa', icon: WalletCards },
  { href: '/admin/financeiro', label: 'Financeiro', icon: CircleDollarSign },
  { href: '/admin/catalogo', label: 'Cardápio', icon: Boxes },
  { href: '/admin/adicionais', label: 'Adicionais', icon: SlidersHorizontal },
  { href: '/admin/integracao', label: 'Integrações', icon: BarChart3 },
  { href: '/admin/configuracoes', label: 'Configurações', icon: Settings },
];

export function AdminShell({ children, adminOnly = false }: { children: ReactNode; adminOnly?: boolean }) {
  const { user, role, loading } = useAuth();
  const pathname = usePathname();
  useEffect(() => { if (!loading && (!user || !role)) window.location.href = '/admin/login'; }, [loading, user, role]);
  if (!hasFirebaseConfig) return <AdminMessage title="Firebase não configurado" text="Configure o ambiente antes de acessar o painel." />;
  if (loading) return <AdminMessage title="Carregando painel…" text="Validando sua sessão e permissão." />;
  if (!user || !role) return null;
  if (adminOnly && role !== 'admin') return <AdminMessage title="Acesso restrito" text="Esta área exige a função administrador." />;
  return <div className="min-h-screen bg-[#f4f2ed] text-[#122b36]"><aside className="fixed inset-y-0 left-0 z-30 hidden w-[270px] flex-col bg-[#122b36] px-5 py-6 text-white lg:flex"><a href="/admin" className="flex items-center gap-3 px-2"><span className="grid size-10 place-items-center rounded-full bg-[#c84d43] font-black text-white">T</span><span><strong className="block tracking-[-.03em]">Teiko Sushi</strong><small className="text-[10px] font-bold uppercase tracking-[.16em] text-white/45">Painel operacional</small></span></a><div className="my-8 h-px bg-white/10" /><p className="px-3 text-[10px] font-black uppercase tracking-[.18em] text-[#d9ac64]">Operação</p><nav className="mt-3 space-y-1">{links.slice(0, 4).map((link) => <NavItem key={link.href} {...link} active={pathname === link.href} />)}</nav><p className="mt-8 px-3 text-[10px] font-black uppercase tracking-[.18em] text-[#d9ac64]">Gestão</p><nav className="mt-3 space-y-1">{links.slice(4).map((link) => <NavItem key={link.href} {...link} active={pathname === link.href} />)}</nav><div className="mt-auto rounded-2xl border border-white/10 bg-white/5 p-3"><span className="block truncate text-xs font-bold text-white/80">{user.email}</span><span className="mt-1 block text-[10px] font-black uppercase tracking-[.15em] text-[#d9ac64]">{role === 'admin' ? 'Administrador' : 'Operador'}</span><button onClick={() => signOut(getFirebaseClient().auth)} className="mt-4 flex items-center gap-2 text-xs font-bold text-white/55 transition hover:text-white"><LogOut className="size-3.5" /> Sair</button></div></aside><div className="lg:pl-[270px]"><header className="sticky top-0 z-20 flex min-h-[76px] items-center justify-between border-b border-[#122b36]/10 bg-[#f7f4ee]/92 px-4 backdrop-blur-xl sm:px-8"><div><span className="text-[10px] font-black uppercase tracking-[.18em] text-[#c84d43]">Teiko Sushi</span><span className="mt-1 hidden text-sm font-bold text-[#6f7d7e] sm:block">Operação em tempo real</span></div><div className="flex items-center gap-3"><span className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700"><span className="size-1.5 rounded-full bg-emerald-500" /> Online</span><span className="hidden size-9 place-items-center rounded-full bg-[#e9d8bd] text-xs font-black text-[#122b36] sm:grid">{(user.email?.[0] ?? 'T').toUpperCase()}</span></div></header><nav className="flex gap-1 overflow-x-auto border-b border-[#122b36]/10 bg-[#fffdfa] px-4 py-2 lg:hidden">{links.slice(0, 5).map(({ href, label, icon: Icon }) => <a key={href} href={href} className={`flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-xs font-black ${pathname === href ? 'bg-[#122b36] text-white' : 'text-[#6f7d7e]'}`}><Icon className="size-3.5" />{label}</a>)}</nav><main className="p-4 sm:p-6 lg:p-8">{children}</main></div></div>;
}

function NavItem({ href, label, icon: Icon, active }: { href: string; label: string; icon: typeof LayoutDashboard; active: boolean }) { return <a href={href} className={`flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-bold transition ${active ? 'bg-[#d9ac64] text-[#122b36] shadow-[0_7px_18px_rgba(217,172,100,.15)]' : 'text-white/65 hover:bg-white/10 hover:text-white'}`}><Icon className="size-4" />{label}</a>; }
function AdminMessage({ title, text }: { title: string; text: string }) { return <main className="grid min-h-screen place-items-center bg-[#f4f2ed] p-6 text-center"><div><span className="mx-auto grid size-12 place-items-center rounded-full bg-[#c84d43] font-black text-white">T</span><h1 className="mt-5 text-2xl font-black text-[#122b36]">{title}</h1><p className="mt-2 text-sm text-[#6f7d7e]">{text}</p></div></main>; }
