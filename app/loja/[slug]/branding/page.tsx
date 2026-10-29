'use client';

import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { getFirebaseClient, hasFirebaseConfig } from '@/lib/firebase/client';
import { validTenantSlug } from '@/shared/tenancy';

type Branding = { displayName: string; primaryColor: string; accentColor: string; logoUrl: string };
const blank: Branding = {
  displayName: '', primaryColor: '#b5232b', accentColor: '#111613', logoUrl: '',
};

export default function TenantBrandingPage() {
  const params = useParams();
  const tenantId = typeof params.slug === 'string' ? params.slug : '';
  const ready = hasFirebaseConfig && validTenantSlug(tenantId) && tenantId !== 'teiko';
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [busy, setBusy] = useState(false);
  const [value, setValue] = useState<Branding>(blank);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!ready) { setLoading(false); return; }
    let seq = 0;
    return onAuthStateChanged(getFirebaseClient().auth, current => {
      const thisSeq = ++seq;
      const authenticated = current && !current.isAnonymous ? current : null;
      setUser(authenticated); setAuthorized(false);
      if (!authenticated) { setLoading(false); return; }
      setLoading(true); setError('');
      void httpsCallable(getFirebaseClient().functions, 'tenantGetBrandingSettings')({ tenantId })
        .then(result => {
          if (thisSeq !== seq) return;
          const data = result.data as { branding: Branding };
          setValue(data.branding);
          setAuthorized(true);
        })
        .catch(() => { if (thisSeq === seq) setError('Sua conta não possui acesso à identidade desta loja.'); })
        .finally(() => { if (thisSeq === seq) setLoading(false); });
    });
  }, [ready, tenantId]);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    setBusy(true); setError('');
    try {
      await signInWithEmailAndPassword(getFirebaseClient().auth,
        String(fields.get('email')), String(fields.get('password')));
    } catch { setError('Login inválido ou serviço indisponível.'); }
    finally { setBusy(false); }
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await httpsCallable(getFirebaseClient().functions, 'tenantUpdateBranding')({
        tenantId, branding: value,
      });
      const data = result.data as { updated: boolean };
      setNotice(data.updated ? 'Identidade visual atualizada.' : 'Nenhuma alteração necessária.');
    } catch {
      setError('Não foi possível salvar. Verifique URL HTTPS, cores e permissões.');
    } finally { setBusy(false); }
  }
  if (!ready) return <main className="p-8" role="alert">
    {tenantId === 'teiko' ? 'A identidade da Teiko só será migrada com autorização.' : 'Configuração indisponível.'}
  </main>;

  return <main className="min-h-screen bg-[#f3f0e8] p-4 text-[#111613] sm:p-8">
    <div className="mx-auto max-w-3xl">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-widest text-[#b5232b]">{tenantId}</p>
          <h1 className="mt-1 text-3xl font-black">Identidade visual</h1></div>
        {user && <Button variant="outline" onClick={() => void signOut(getFirebaseClient().auth)}>Sair</Button>}
      </header>
      <p className="mt-2 text-sm text-gray-600">Nome, cores e logo de apenas este restaurante. Não altera domínio, plano ou dados de outros clientes.</p>
      {error && <p role="alert" className="mt-4 rounded-xl bg-red-100 p-4 text-red-900">{error}</p>}
      {notice && <p role="status" className="mt-4 rounded-xl bg-green-100 p-4 text-green-900">{notice}</p>}
      {loading && <p role="status" className="mt-4">Verificando permissões…</p>}
      {!loading && !user && <form onSubmit={login} className="mt-5 grid max-w-md gap-3 rounded-2xl bg-white p-5">
        <label>E-mail<input required type="email" name="email" autoComplete="username" className="mt-1 w-full rounded-lg border p-3" /></label>
        <label>Senha<input required type="password" name="password" autoComplete="current-password" className="mt-1 w-full rounded-lg border p-3" /></label>
        <Button type="submit" disabled={busy}>Entrar</Button>
      </form>}
      {!loading && authorized && <>
        <form onSubmit={save} className="mt-5 grid gap-4 rounded-2xl bg-white p-5">
          <label>Nome público
            <input required minLength={2} maxLength={90} value={value.displayName}
              onChange={event => setValue(v => ({ ...v, displayName: event.target.value }))}
              className="mt-1 w-full rounded-lg border p-3" />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label>Cor principal
              <input type="color" value={value.primaryColor}
                onChange={event => setValue(v => ({ ...v, primaryColor: event.target.value }))}
                className="mt-1 block h-12 w-full rounded-lg border" />
            </label>
            <label>Cor secundária
              <input type="color" value={value.accentColor}
                onChange={event => setValue(v => ({ ...v, accentColor: event.target.value }))}
                className="mt-1 block h-12 w-full rounded-lg border" />
            </label>
          </div>
          <label>Logo (URL HTTPS ou caminho /brand/)
            <input type="text" maxLength={500} value={value.logoUrl} placeholder="https://.../logo.png"
              onChange={event => setValue(v => ({ ...v, logoUrl: event.target.value }))}
              className="mt-1 w-full rounded-lg border p-3" />
          </label>
          <Button type="submit" disabled={busy}>{busy ? 'Salvando…' : 'Salvar identidade visual'}</Button>
        </form>
        <section aria-label="Prévia da identidade visual" className="mt-5 rounded-2xl bg-white p-5">
          <h2 className="text-lg font-bold">Prévia local das configurações</h2>
          <div className="mt-3 rounded-xl border p-5" style={{ borderColor: value.primaryColor }}>
            <p className="text-sm font-semibold" style={{ color: value.primaryColor }}>{value.displayName}</p>
            <p className="mt-2 text-xs" style={{ color: value.accentColor }}>Cardápio público do restaurante</p>
          </div>
        </section>
      </>}
      <div className="mt-5"><Link href={'/loja/' + tenantId + '/gestao'} className="text-sm underline">
        Voltar à gestão do cardápio
      </Link></div>
    </div>
  </main>;
}
