'use client';

import {
  Boxes,
  Bell,
  BadgePercent,
  CalendarDays,
  ChefHat,
  LayoutDashboard,
  LogOut,
  Settings,
  ShoppingBag,
  SlidersHorizontal,
} from 'lucide-react';
import { signOut } from 'firebase/auth';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useEffect, useState, type ReactNode } from 'react';

import { useAuth } from '@/components/providers';
import { getFirebaseClient, hasFirebaseConfig } from '@/lib/firebase/client';
import { BrandMark } from '@/components/brand-mark';
import { TEIKO_BRAND_ID } from '@/shared/domain';

const links = [
  { href: '/admin', label: 'Visão geral', icon: LayoutDashboard },
  { href: '/admin/pedidos', label: 'Pedidos', icon: ShoppingBag },
  { href: '/admin/pdv', label: 'PDV', icon: ShoppingBag },
  { href: '/admin/kds', label: 'Cozinha (KDS)', icon: ChefHat },
  { href: '/admin/reservas', label: 'Reservas', icon: CalendarDays },
  { href: '/admin/catalogo', label: 'Cardápio', icon: Boxes },
  { href: '/admin/adicionais', label: 'Adicionais', icon: SlidersHorizontal },
  { href: '/admin/promocoes', label: 'Promoções', icon: BadgePercent },
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
  return (
    <div className="min-h-screen bg-[#fff8ef] text-[#180e16]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-[#180e16] p-5 text-white lg:flex">
        <a href="/admin" aria-label="Teiko Sushi, painel operacional">
          <BrandMark />
        </a>
        <nav className="mt-8 space-y-1">
          {links.map(({ href, label, icon: Icon }) => (
            <a
              key={href}
              href={href}
              className="flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-bold text-white/70 hover:bg-white/8 hover:text-white"
            >
              <Icon className="size-4" />
              {label}
            </a>
          ))}
        </nav>
        <div className="mt-auto rounded-2xl bg-white/6 p-3">
          <span className="block truncate text-xs font-bold">{user.email}</span>
          <span className="mt-1 block text-[10px] uppercase tracking-widest text-[#d9b66f]">
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
          <nav className="flex gap-1 overflow-x-auto lg:hidden">
            {links.slice(1).map(({ href, label, icon: Icon }) => (
              <a
                key={href}
                href={href}
                aria-label={label}
                title={label}
                className="grid size-10 shrink-0 place-items-center rounded-full hover:bg-[#c13a43]/10"
              >
                <Icon className="size-4" />
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-[#765665] lg:block">
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
              className="relative grid size-10 place-items-center rounded-full text-[#8c234f] transition hover:bg-[#f8e9ef]"
            >
              <Bell className="size-5" />
              {newOrderCount > 0 && (
                <span className="absolute right-0 top-0 grid min-w-4 place-items-center rounded-full bg-[#c13a43] px-1 text-[10px] font-black text-white">
                  {newOrderCount > 9 ? '9+' : newOrderCount}
                </span>
              )}
            </a>
            <span className="rounded-full bg-[#f8e9ef] px-3 py-1 text-xs font-bold text-[#65741f]">
              Online
            </span>
          </div>
        </header>
        <main className="p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

function AdminMessage({ title, text }: { title: string; text: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#fff8ef] p-6 text-center">
      <div>
        <img src="/brand/teiko-logo.jpg" alt="Logo Teiko Sushi" className="mx-auto size-16 rounded-full object-cover ring-2 ring-[#d9b66f]/40" />
        <h1 className="mt-5 text-2xl font-black">{title}</h1>
        <p className="mt-2 text-sm text-[#765665]">{text}</p>
      </div>
    </main>
  );
}
