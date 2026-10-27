'use client';

import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { useEffect, useState, type FormEvent } from 'react';

import { getFirebaseClient, hasFirebaseConfig } from '@/lib/firebase/client';
import { Button } from '@/components/ui/button';

type TenantRow = { id: string; slug: string; status: 'ACTIVE' | 'SUSPENDED'; displayName: string };
type TenantRole = 'tenant_owner' | 'staff' | 'driver';

function friendlyError(error: unknown): string {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  if (/permission-denied|unauthenticated/.test(code)) return 'Sem permissão para esta operação.';
  if (/already-exists/.test(code)) return 'Identificador já utilizado.';
  if (/failed-precondition/.test(code)) return 'Operação não permitida neste estado.';
  if (/unavailable|network/.test(code)) return 'Conexão indisponível. Confira o estado antes de repetir.';
  return error instanceof Error ? error.message : 'Não foi possível concluir a operação.';
}

export default function PlatformPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [tenantId, setTenantId] = useState('');
  const [memberUid, setMemberUid] = useState('');
  const [memberRole, setMemberRole] = useState<TenantRole>('staff');
  const [memberActive, setMemberActive] = useState(true);

  async function refresh() {
    const { functions } = getFirebaseClient();
    const result = await httpsCallable(functions, 'platformListTenants')({});
    const data = result.data as { tenants?: TenantRow[] };
    setTenants(Array.isArray(data.tenants) ? data.tenants : []);
  }

  useEffect(() => {
    if (!hasFirebaseConfig) { setLoading(false); return; }
    let generation = 0;
    return onAuthStateChanged(getFirebaseClient().auth, (current) => {
      const gen = ++generation;
      setUser(current);
      setAuthorized(false);
      if (!current) { setLoading(false); setTenants([]); return; }
      setLoading(true);
      void current.getIdTokenResult().then(async (token) => {
        if (gen !== generation) return;
        if (token.claims.platform_owner !== true) {
          setError('Sua conta não possui autorização de Platform Owner.');
          setLoading(false);
          return;
        }
        try {
          await refresh(); // Callable checks the live Auth claims too.
          if (gen !== generation) return;
          setAuthorized(true);
          setError('');
        } catch (cause) {
          if (gen === generation) setError(friendlyError(cause));
        } finally {
          if (gen === generation) setLoading(false);
        }
      }).catch(() => { if (gen === generation) { setError('Não foi possível verificar suas permissões.'); setLoading(false); } });
    });
  }, []);

  async function perform(task: () => Promise<unknown>, message: string) {
    setBusy(true); setError(''); setNotice('');
    try { await task(); await refresh(); setNotice(message); }
    catch (cause) { setError(friendlyError(cause)); }
    finally { setBusy(false); }
  }
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hasFirebaseConfig) return;
    const form = new FormData(event.currentTarget);
    setBusy(true); setError('');
    try {
      await signInWithEmailAndPassword(getFirebaseClient().auth, String(form.get('email')), String(form.get('password')));
    } catch (cause) { setError(friendlyError(cause)); }
    finally { setBusy(false); }
  }
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await perform(async () => {
      await httpsCallable(getFirebaseClient().functions, 'platformCreateTenant')({
        slug: String(data.get('slug') || '').trim().toLowerCase(),
        displayName: String(data.get('displayName') || '').trim(),
      });
      event.currentTarget.reset();
    }, 'Tenant criado. Nenhum dado operacional foi migrado.');
  }
  async function setMembership(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await perform(async () => {
      await httpsCallable(getFirebaseClient().functions, 'platformSetMembership')({
        tenantId, userUid: memberUid.trim(), role: memberRole, active: memberActive,
      });
    }, memberActive ? 'Membership atualizada.' : 'Acesso revogado.');
  }
  if (!hasFirebaseConfig) return <main className="p-8">Firebase não configurado; plataforma indisponível.</main>;
  return <main className="min-h-screen bg-[#f3f0e8] p-4 text-[#111613] sm:p-8">
    <div className="mx-auto max-w-5xl">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-widest text-[#b5232b]">Sushi SaaS</p><h1 className="text-3xl font-black">Gestão da plataforma</h1></div>
        {user && <Button variant="outline" onClick={() => void signOut(getFirebaseClient().auth)}>Sair</Button>}
      </header>
      {loading ? <p role="status" className="mt-8">Validando sessão e permissões…</p> : null}
      {error && <p role="alert" className="mt-5 rounded-xl bg-red-100 p-4 text-red-900">{error}</p>}
      {notice && <p role="status" className="mt-5 rounded-xl bg-green-100 p-4 text-green-900">{notice}</p>}
      {!user && !loading && <form onSubmit={login} className="mt-8 grid max-w-md gap-4 rounded-2xl bg-white p-6">
        <h2 className="font-bold">Autenticação do proprietário da plataforma</h2>
        <label>E-mail<input required type="email" name="email" autoComplete="username" className="mt-1 w-full rounded-lg border p-3" /></label>
        <label>Senha<input required type="password" name="password" autoComplete="current-password" className="mt-1 w-full rounded-lg border p-3" /></label>
        <Button type="submit" disabled={busy}>Entrar</Button>
      </form>}
      {authorized && !loading && <div className="mt-8 grid gap-6">
        <section className="rounded-2xl bg-white p-5">
          <h2 className="text-xl font-bold">Tenants cadastrados</h2>
          <p className="mt-1 text-sm text-gray-600">Até 50 registros; a Teiko legada precisa de migração autorizada.</p>
          {tenants.length === 0 ? <p className="mt-4 text-sm">Nenhum tenant cadastrado no Core novo.</p> : <div className="mt-4 grid gap-2">{tenants.map((tenant) => <article key={tenant.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3">
            <div><strong>{tenant.displayName}</strong><p className="text-xs text-gray-600">{tenant.slug} · {tenant.status}</p></div>
            <Button variant="outline" disabled={busy} onClick={() => void perform(
              () => httpsCallable(getFirebaseClient().functions, 'platformSetTenantStatus')({ tenantId: tenant.id, status: tenant.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' }),
              tenant.status === 'ACTIVE' ? 'Tenant suspenso.' : 'Tenant reativado.',
            )}>{tenant.status === 'ACTIVE' ? 'Suspender' : 'Reativar'}</Button>
          </article>)}</div>}
        </section>
        <section className="rounded-2xl bg-white p-5">
          <h2 className="text-xl font-bold">Criar tenant de teste/novo restaurante</h2>
          <form onSubmit={create} className="mt-3 grid gap-3 sm:grid-cols-2">
            <label>Identificador<input required name="slug" minLength={3} maxLength={64} pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="restaurante-beta" className="mt-1 w-full rounded-lg border p-3" /></label>
            <label>Nome público<input required name="displayName" minLength={2} maxLength={90} className="mt-1 w-full rounded-lg border p-3" /></label>
            <Button type="submit" disabled={busy} className="sm:col-span-2">Criar tenant</Button>
          </form>
        </section>
        <section className="rounded-2xl bg-white p-5">
          <h2 className="text-xl font-bold">Acessos por tenant</h2>
          <p className="mt-1 text-sm text-gray-600">Use o UID real de um usuário existente no Auth. Nunca atribui Platform Owner por aqui.</p>
          <form onSubmit={setMembership} className="mt-3 grid gap-3 sm:grid-cols-2">
            <label>Tenant<select required value={tenantId} onChange={(e) => setTenantId(e.target.value)} className="mt-1 w-full rounded-lg border p-3">
              <option value="">Selecione</option>{tenants.map((t) => <option key={t.id} value={t.id}>{t.displayName}</option>)}
            </select></label>
            <label>UID do usuário<input required value={memberUid} onChange={(e) => setMemberUid(e.target.value)} maxLength={128} className="mt-1 w-full rounded-lg border p-3" /></label>
            <label>Papel<select value={memberRole} onChange={(e) => setMemberRole(e.target.value as TenantRole)} className="mt-1 w-full rounded-lg border p-3">
              <option value="tenant_owner">Proprietário da loja</option><option value="staff">Equipe</option><option value="driver">Entregador</option>
            </select></label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={memberActive} onChange={(e) => setMemberActive(e.target.checked)} />Acesso ativo</label>
            <Button type="submit" disabled={busy || !tenantId} className="sm:col-span-2">Salvar acesso</Button>
          </form>
        </section>
      </div>}
    </div>
  </main>;
}
