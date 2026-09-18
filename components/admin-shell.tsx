'use client';

import {
  Boxes,
  Bell,
  BadgePercent,
  CalendarDays,
  ChefHat,
  LayoutDashboard,
  Link2,
  LogOut,
  Settings,
  ShoppingBag,
  SlidersHorizontal,
  SquareStack,
  WalletCards,
} from 'lucide-react';
import { signOut } from 'firebase/auth';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';

import { useAuth } from '@/components/providers';
import { getFirebaseClient, hasFirebaseConfig } from '@/lib/firebase/client';
import { BrandMark } from '@/components/brand-mark';
import { AdminNotifications } from '@/components/admin-notifications';
import { TEIKO_BRAND_ID } from '@/shared/domain';

const links = [
  { href: '/admin', label: 'Visão geral', icon: LayoutDashboard },
  { href: '/admin/pedidos', label: 'Pedidos', icon: ShoppingBag },
  { href: '/admin/pdv', label: 'PDV', icon: ShoppingBag },
  { href: '/admin/kds', label: 'Cozinha (KDS)', icon: ChefHat },
  { href: '/admin/reservas', label: 'Reservas', icon: CalendarDays },
  { href: '/admin/mesas', label: 'Mesas', icon: SquareStack },
  { href: '/admin/catalogo', label: 'Cardápio', icon: Boxes },
  { href: '/admin/adicionais', label: 'Adicionais', icon: SlidersHorizontal },
  { href: '/admin/promocoes', label: 'Promoções', icon: BadgePercent },
  { href: '/admin/financas', label: 'Finanças', icon: WalletCards },
  { href: '/admin/integracao', label: 'Integrações', icon: Link2 },
  { href: '/admin/configuracoes', label: 'Configurações', icon: Settings },
];

export function AdminShell({
  children,
  adminOnly = false,
}: {
  children: ReactNode;
  adminOnly?: boolean;
}) {
  const { user, role, loading } = useAuth();
  const pathname = usePathname();
  const [newOrderCount, setNewOrderCount] = useState(0);
  useEffect(() => {
    if (!loading && (!user || !role)) window.location.href = '/admin/login';
  }, [loading, user, role]);
  useEffect(() => {
    if (loading || !user || !role || !hasFirebaseConfig) return;
    return onSnapshot(
      query(
        collection(getFirebaseClient().db, 'orders'),
        where('brandId', '==', TEIKO_BRAND_ID),
      ),
      (snapshot) =>
        setNewOrderCount(
          snapshot.docs.filter(
            (item) =>
              item.data().status === 'NEW' &&
              item.data().customerApproval !== 'PENDING',
          ).length,
        ),
      () => setNewOrderCount(0),
    );
  }, [loading, role, user]);
  if (!hasFirebaseConfig)
    return (
      <AdminMessage
        title="Firebase não configurado"
        text="Configure .env.local antes de acessar o painel."
      />
    );
  if (loading)
    return (
      <AdminMessage
        title="Carregando painel…"
        text="Validando sua sessão e permissão."
      />
    );
  if (!user || !role) return null;
  if (adminOnly && role !== 'admin')
    return (
      <AdminMessage
        title="Acesso restrito"
        text="Esta área exige a função admin."
      />
    );
  const isActive = (href: string) => href === '/admin' ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  const activeMobileHref = links.find(({ href }) => isActive(href))?.href ?? '/admin';
  return (
    <div className="min-h-screen bg-[#f3f0e8] text-[#070a08]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-[#070a08] p-5 text-white lg:flex">
        <a href="/admin" aria-label="Teiko Sushi, painel operacional">
          <BrandMark />
        </a>
        <nav className="mt-8 space-y-1">
          {links.map(({ href, label, icon: Icon }) => (
            <a
              key={href}
              href={href}
              aria-current={isActive(href) ? 'page' : undefined}
              className={`flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-bold transition ${isActive(href) ? 'bg-[#b5232b] text-white shadow-[0_8px_18px_rgba(181,35,43,.22)]' : 'text-white/70 hover:bg-white/8 hover:text-white'}`}
            >
              <Icon className={`size-4 ${isActive(href) ? 'text-[#f5dfb1]' : ''}`} />
              {label}
            </a>
          ))}
        </nav>
        <div className="mt-auto rounded-2xl bg-white/6 p-3">
          <span className="block truncate text-xs font-bold">{user.email}</span>
          <span className="mt-1 block text-[10px] uppercase tracking-widest text-[#c7a773]">
            {role}
          </span>
          <button
            onClick={() => signOut(getFirebaseClient().auth)}
            className="mt-3 flex items-center gap-2 text-xs text-white/60 hover:text-white"
          >
            <LogOut className="size-3.5" /> Sair
          </button>
        </div>
      </aside>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-white/90 px-4 backdrop-blur lg:px-8">
          <a href="/admin" className="font-black lg:hidden" aria-label="Teiko Admin">
            <BrandMark size="sm" showName={false} />
          </a>
          <label className="min-w-0 flex-1 lg:hidden">
            <span className="sr-only">Seção do painel</span>
            <select
              value={activeMobileHref}
              onChange={(event) => { window.location.href = event.target.value; }}
              aria-label="Seção do painel"
              className="h-10 w-full min-w-0 rounded-xl border border-[#070a08]/10 bg-[#f3f0e8] px-3 text-xs font-black text-[#070a08] outline-none focus:border-[#b5232b]"
            >
              {links.map(({ href, label }) => <option key={href} value={href}>{label}</option>)}
            </select>
          </label>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-[#7b887d] lg:block">
              Operação em tempo real
            </span>
            <a
              href="/admin/pedidos"
              aria-label={
                newOrderCount
                  ? `Pedidos novos: ${newOrderCount}`
                  : 'Pedidos novos'
              }
              title="Pedidos novos"
              className="relative grid size-10 place-items-center rounded-full text-[#b5232b] transition hover:bg-[#e8efe5]"
            >
              <Bell className="size-5" />
              {newOrderCount > 0 && (
                <span className="absolute right-0 top-0 grid min-w-4 place-items-center rounded-full bg-[#e3262e] px-1 text-[10px] font-black text-white">
                  {newOrderCount > 9 ? '9+' : newOrderCount}
                </span>
              )}
            </a>
            <span className="hidden rounded-full bg-[#e8efe5] px-3 py-1 text-xs font-bold text-[#3a5b35] sm:inline">
              Online
            </span>
          </div>
        </header>
        <main className="p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
      <AdminNotifications />
    </div>
  );
}

function AdminMessage({ title, text }: { title: string; text: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f3f0e8] p-6 text-center">
      <div>
        <img src="/brand/teiko-logo.jpg" alt="Logo Teiko Sushi" className="mx-auto size-16 rounded-full object-cover ring-2 ring-[#c7a773]/40" />
        <h1 className="mt-5 text-2xl font-black">{title}</h1>
        <p className="mt-2 text-sm text-[#7b887d]">{text}</p>
      </div>
    </main>
  );
}
