'use client';

import { signInWithEmailAndPassword } from 'firebase/auth';
import { Bike, Loader2, ShieldCheck } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';

import { useAuth } from '@/components/providers';
import { Button } from '@/components/ui/button';
import { getFirebaseClient, hasFirebaseConfig } from '@/lib/firebase/client';

export default function DriverLoginPage() {
  const { user, role, loading: authLoading } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && user && role === 'driver') window.location.replace('/entregador');
    else if (!authLoading && user && role && role !== 'driver') window.location.replace('/admin');
  }, [authLoading, user, role]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') ?? '').trim().toLowerCase();
    const password = String(form.get('password') ?? '');
    if (!email || !password || email.length > 254 || password.length > 128) {
      setError('Informe o e-mail e a senha fornecidos pela administração.'); setBusy(false); return;
    }
    try {
      await signInWithEmailAndPassword(getFirebaseClient().auth, email, password);
      window.location.replace('/entregador');
    } catch (cause) {
      const code = typeof cause === 'object' && cause && 'code' in cause ? String(cause.code) : '';
      setError(code === 'auth/too-many-requests'
        ? 'Muitas tentativas. Aguarde alguns minutos e tente novamente.'
        : code === 'auth/network-request-failed'
          ? 'Sem conexão com a internet. Verifique o sinal e tente novamente.'
          : 'Não foi possível entrar. Confira o e-mail, a senha e se o acesso continua ativo.');
    } finally { setBusy(false); }
  }

  return <main className="grid min-h-screen place-items-center bg-[#0b100e] p-4 text-[#111613]">
    <section className="w-full max-w-md rounded-[32px] bg-[#faf9f5] p-6 shadow-2xl sm:p-9">
      <span className="grid size-14 place-items-center rounded-2xl bg-[#0b100e] text-[#c7a773]"><Bike className="size-7" /></span>
      <p className="mt-6 text-xs font-black uppercase tracking-[.2em] text-[#b5232b]">Teiko Sushi · Entregas</p>
      <h1 className="teiko-display mt-2 text-4xl">Acesso do motoboy</h1>
      <p className="mt-3 text-sm leading-6 text-[#66716a]">Entre com as credenciais individuais fornecidas pela administração. Seu acesso mostra apenas as corridas atribuídas a você.</p>
      {!hasFirebaseConfig && <p role="alert" className="mt-5 rounded-2xl bg-[#fff0ef] p-4 text-sm font-bold text-[#9d1723]">O Firebase dedicado da Teiko ainda não está configurado neste ambiente.</p>}
      {error && <p role="alert" className="mt-5 rounded-2xl bg-[#fff0ef] p-4 text-sm font-bold text-[#9d1723]">{error}</p>}
      <form onSubmit={submit} className="mt-6 grid gap-4">
        <label className="text-sm font-bold">E-mail<input name="email" type="email" autoComplete="username" required maxLength={254} className="mt-2 h-12 w-full rounded-xl border border-[#070a08]/15 bg-white px-4 outline-none focus:border-[#b5232b]" /></label>
        <label className="text-sm font-bold">Senha<input name="password" type="password" autoComplete="current-password" required maxLength={128} className="mt-2 h-12 w-full rounded-xl border border-[#070a08]/15 bg-white px-4 outline-none focus:border-[#b5232b]" /></label>
        <Button type="submit" disabled={busy || !hasFirebaseConfig} className="mt-2 min-h-12 rounded-full bg-[#b5232b] font-black text-white">{busy ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />} Entrar no portal</Button>
      </form>
      <p className="mt-5 text-center text-xs leading-5 text-[#66716a]">Problemas com o acesso? Fale diretamente com a administração da Teiko Sushi.</p>
    </section>
  </main>;
}
