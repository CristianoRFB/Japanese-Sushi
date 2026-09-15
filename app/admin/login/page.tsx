'use client';

import { signInWithEmailAndPassword } from 'firebase/auth';
import { Loader2, LockKeyhole } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { getFirebaseClient, hasFirebaseConfig } from '@/lib/firebase/client';

export default function AdminLoginPage() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (!hasFirebaseConfig) {
      setError('Firebase não configurado.');
      return;
    }
    const data = new FormData(event.currentTarget);
    setLoading(true);
    try {
      await signInWithEmailAndPassword(
        getFirebaseClient().auth,
        String(data.get('email')),
        String(data.get('password')),
      );
      window.location.assign('/admin');
    } catch (cause) {
      const code =
        cause instanceof Error && 'code' in cause
          ? String((cause as { code?: unknown }).code)
          : '';
      setError(
        code === 'auth/unauthorized-domain'
          ? 'Este endereço ainda não está autorizado no Firebase.'
          : code === 'auth/network-request-failed'
            ? 'Não foi possível conectar ao Firebase. Tente novamente.'
            : 'E-mail, senha ou permissão inválidos.',
      );
      setLoading(false);
    }
  }
  return (
    <main className="grid min-h-screen place-items-center bg-[#180e16] p-4">
      <div className="w-full max-w-md rounded-[32px] bg-[#fff7ea] p-6 shadow-2xl sm:p-8">
        <img src="/brand/teiko-logo.jpg" alt="Logo Teiko Sushi" className="size-16 rounded-full object-cover ring-2 ring-[#c13a43]/30" />
        <h1 className="mt-6 text-3xl font-black tracking-[-.04em]">
          Entrar no painel
        </h1>
        <p className="mt-2 text-sm text-[#765665]">
          Acesso exclusivo da equipe autorizada.
        </p>
        <form onSubmit={submit} className="mt-7 space-y-4">
          <label className="block text-sm font-bold">
            E-mail
            <input
              name="email"
              type="email"
              required
              autoComplete="username"
              className="mt-2 h-12 w-full rounded-2xl border border-[#8c234f]/15 bg-white px-4 font-normal outline-none focus:border-[#8c234f]"
            />
          </label>
          <label className="block text-sm font-bold">
            Senha
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="mt-2 h-12 w-full rounded-2xl border border-[#8c234f]/15 bg-white px-4 font-normal outline-none focus:border-[#8c234f]"
            />
          </label>
          {error && (
            <p
              role="alert"
              className="rounded-xl bg-[#f8e9ef] p-3 text-sm text-[#c13a43]"
            >
              {error}
            </p>
          )}
          <Button
            type="submit"
            disabled={loading}
            className="h-12 w-full rounded-full bg-[#8c234f] font-black text-white"
          >
            {loading ? <Loader2 className="animate-spin" /> : <LockKeyhole />}{' '}
            Entrar
          </Button>
        </form>
        <p className="mt-5 text-center text-xs text-[#765665]">
          Usuários e roles são gerenciados pelo Firebase; nenhuma senha fica no
          código.
        </p>
      </div>
    </main>
  );
}
