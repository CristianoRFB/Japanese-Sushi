'use client';

import { deleteApp, initializeApp } from 'firebase/app';
import { createUserWithEmailAndPassword, deleteUser, initializeAuth, inMemoryPersistence, signOut } from 'firebase/auth';
import { collection, doc, limit, onSnapshot, query, runTransaction, serverTimestamp, where } from 'firebase/firestore';
import { Bike, Loader2, Pencil, Plus, Power, Save, ShieldCheck, UserRound } from 'lucide-react';
import { useEffect, useState, type FormEvent, type InputHTMLAttributes } from 'react';

import { AdminShell } from '@/components/admin-shell';
import { Button } from '@/components/ui/button';
import { getFirebaseClient } from '@/lib/firebase/client';
import { TEIKO_BRAND_ID } from '@/shared/domain';
import { driverStatusLabels, validateDriverDraft, type DeliveryDriver, type DeliveryDriverStatus } from '@/shared/delivery';

function normalizeName(value: string) { return value.trim().replace(/\s+/g, ' '); }
function normalizePhone(value: string) { return value.replace(/\D/g, ''); }
function friendlyCreateError(cause: unknown) {
  const code = typeof cause === 'object' && cause && 'code' in cause ? String(cause.code) : '';
  if (code === 'auth/email-already-in-use') return 'Este e-mail já está cadastrado. Use outro endereço ou reative o acesso existente.';
  if (code === 'auth/invalid-email') return 'O e-mail não é válido.';
  if (code === 'auth/weak-password') return 'A senha inicial precisa ter pelo menos 8 caracteres.';
  if (cause instanceof Error && cause.message.includes('permission-denied')) return 'Sua conta precisa ter permissão de administrador para cadastrar motoboys.';
  return 'Não foi possível criar o acesso. Confira sua conexão e tente novamente.';
}

export default function DriversPage() {
  const [drivers, setDrivers] = useState<DeliveryDriver[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DeliveryDriver | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    try {
      return onSnapshot(query(collection(getFirebaseClient().db, 'deliveryDrivers'), where('brandId', '==', TEIKO_BRAND_ID), limit(200)), (snapshot) => {
        setDrivers(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as DeliveryDriver).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')));
      }, () => setError('Não foi possível carregar os motoboys. Confira sua conexão.'));
    } catch { setError('Firebase da Teiko não está configurado neste ambiente.'); return undefined; }
  }, []);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const name = normalizeName(String(data.get('name') ?? ''));
    const phone = String(data.get('phone') ?? '').trim();
    const email = String(data.get('email') ?? '').trim().toLowerCase();
    const password = String(data.get('password') ?? '');
    const errors = validateDriverDraft({ name, phone, email, password });
    if (Object.keys(errors).length) { setError(Object.values(errors)[0] ?? 'Confira os dados do motoboy.'); return; }
    setBusy(true); setError(''); setNotice('');
    let provisionApp: ReturnType<typeof initializeApp> | null = null;
    let provisionAuth: ReturnType<typeof initializeAuth> | null = null;
    let createdUser: Awaited<ReturnType<typeof createUserWithEmailAndPassword>>['user'] | null = null;
    try {
      const primary = getFirebaseClient();
      provisionApp = initializeApp(primary.app.options, `teiko-driver-${crypto.randomUUID()}`);
      const auth = initializeAuth(provisionApp, { persistence: inMemoryPersistence });
      provisionAuth = auth;
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      createdUser = credential.user;
      await runTransaction(primary.db, async (transaction) => {
        const userRef = doc(primary.db, 'users', credential.user.uid);
        const driverRef = doc(primary.db, 'deliveryDrivers', credential.user.uid);
        const [userSnapshot, driverSnapshot] = await Promise.all([transaction.get(userRef), transaction.get(driverRef)]);
        if (userSnapshot.exists() || driverSnapshot.exists()) throw new Error('Este usuário já está cadastrado.');
        const now = serverTimestamp();
        transaction.set(userRef, { brandId: TEIKO_BRAND_ID, role: 'driver', active: true, name, phone: normalizePhone(phone), email, createdAt: now, updatedAt: now });
        transaction.set(driverRef, { brandId: TEIKO_BRAND_ID, name, phone: normalizePhone(phone), email, status: 'OFFLINE', enabled: true, createdAt: now, updatedAt: now });
      });
      form.reset(); setOpen(false); setNotice(`Acesso de ${name} criado. A senha inicial não será exibida novamente.`);
    } catch (cause) {
      if (createdUser) await deleteUser(createdUser).catch(() => undefined);
      setError(friendlyCreateError(cause));
    } finally {
      if (provisionAuth) await signOut(provisionAuth).catch(() => undefined);
      if (provisionApp) await deleteApp(provisionApp).catch(() => undefined);
      setBusy(false);
    }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const data = new FormData(event.currentTarget);
    const name = normalizeName(String(data.get('name') ?? ''));
    const phone = String(data.get('phone') ?? '').trim();
    const errors = validateDriverDraft({ name, phone, email: editing.email, password: '12345678' });
    if (errors.name || errors.phone || errors.email) { setError(errors.name || errors.phone || errors.email || 'Confira os dados.'); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      const db = getFirebaseClient().db;
      await runTransaction(db, async (transaction) => {
        const driverRef = doc(db, 'deliveryDrivers', editing.id);
        const userRef = doc(db, 'users', editing.id);
        const [driver, user] = await Promise.all([transaction.get(driverRef), transaction.get(userRef)]);
        if (!driver.exists() || !user.exists() || driver.data().brandId !== TEIKO_BRAND_ID) throw new Error('O cadastro não está disponível para edição.');
        const updatedAt = serverTimestamp();
        transaction.update(driverRef, { name, phone: normalizePhone(phone), updatedAt });
        transaction.update(userRef, { name, phone: normalizePhone(phone), updatedAt });
      });
      setEditing(null); setNotice('Cadastro atualizado. O e-mail de acesso continua o mesmo.');
    } catch { setError('Não foi possível atualizar o cadastro. Confira a conexão e o acesso administrativo.'); }
    finally { setBusy(false); }
  }

  async function toggle(driver: DeliveryDriver) {
    if (driver.currentDeliveryId) { setError('Reatribua ou conclua a entrega atual antes de suspender este acesso.'); return; }
    setBusyId(driver.id); setError(''); setNotice('');
    try {
      const db = getFirebaseClient().db;
      const enable = !driver.enabled;
      await runTransaction(db, async (transaction) => {
        const driverRef = doc(db, 'deliveryDrivers', driver.id);
        const userRef = doc(db, 'users', driver.id);
        const [driverSnapshot, userSnapshot] = await Promise.all([transaction.get(driverRef), transaction.get(userRef)]);
        if (!driverSnapshot.exists() || !userSnapshot.exists()) throw new Error('Cadastro não encontrado.');
        transaction.update(driverRef, { enabled: enable, status: enable ? 'OFFLINE' : 'INACTIVE', updatedAt: serverTimestamp() });
        transaction.update(userRef, { active: enable, updatedAt: serverTimestamp() });
      });
      setNotice(enable ? 'Acesso reativado. O motoboy precisa entrar e ficar disponível para receber uma corrida.' : 'Acesso suspenso.');
    } catch { setError('Não foi possível alterar o acesso deste motoboy.'); }
    finally { setBusyId(''); }
  }

  return <AdminShell adminOnly>
    <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-black uppercase tracking-[.18em] text-[#b5232b]">Equipe externa</p><h1 className="teiko-display mt-2 text-4xl tracking-[-.04em]">Motoboys</h1><p className="mt-2 max-w-2xl text-sm text-[#66716a]">Crie acessos individuais e acompanhe quem pode receber as entregas da unidade.</p></div><Button type="button" onClick={() => { setOpen((value) => !value); setEditing(null); setError(''); }} className="min-h-11 rounded-full bg-[#0b100e] text-white"><Plus className="size-4" /> Novo motoboy</Button></header>
    {(error || notice) && <p role={error ? 'alert' : 'status'} className={`mt-5 rounded-2xl p-4 text-sm font-bold ${error ? 'bg-[#fff0ef] text-[#9d1723]' : 'bg-[#e7f1df] text-[#27523a]'}`}>{error || notice}</p>}

    {open && <form onSubmit={create} className="mt-6 grid gap-4 rounded-[28px] bg-[#0b100e] p-5 text-white shadow-lg sm:grid-cols-2 sm:p-7"><div className="sm:col-span-2"><span className="grid size-10 place-items-center rounded-xl bg-[#c7a773] text-[#0b100e]"><ShieldCheck className="size-5" /></span><h2 className="mt-4 text-xl font-black">Novo acesso individual</h2><p className="mt-1 text-sm leading-6 text-white/60">O e-mail e a senha são usados somente para criar a conta. A senha não fica salva no cadastro nem aparece depois.</p></div><DriverField label="Nome" name="name" required maxLength={80} placeholder="Ex.: João Silva" /><DriverField label="Telefone" name="phone" required maxLength={24} inputMode="tel" placeholder="(17) 99999-9999" /><DriverField label="E-mail de acesso" name="email" required type="email" maxLength={254} placeholder="motoboy@email.com" /><DriverField label="Senha inicial" name="password" required type="password" minLength={8} maxLength={128} autoComplete="new-password" placeholder="Mínimo de 8 caracteres" /><div className="flex flex-wrap gap-2 sm:col-span-2"><Button type="submit" disabled={busy} className="min-h-11 rounded-full bg-[#c7a773] px-5 font-black text-[#0b100e]">{busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Criar acesso</Button><Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)} className="min-h-11 rounded-full border-white/20 bg-transparent text-white hover:bg-white/10">Cancelar</Button></div></form>}

    {editing && <form onSubmit={saveProfile} className="mt-6 grid gap-4 rounded-[28px] bg-white p-5 shadow-sm sm:grid-cols-2 sm:p-7"><div className="sm:col-span-2 flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-[.16em] text-[#b5232b]">Editar cadastro</p><h2 className="mt-1 text-xl font-black">{editing.name}</h2></div><button type="button" aria-label="Fechar edição" onClick={() => setEditing(null)} className="rounded-full px-3 py-2 text-sm font-bold">Fechar</button></div><DriverField label="Nome" name="name" required maxLength={80} defaultValue={editing.name} /><DriverField label="Telefone" name="phone" required maxLength={24} inputMode="tel" defaultValue={editing.phone} /><div className="sm:col-span-2 rounded-xl bg-[#f3f0e8] p-3 text-sm text-[#66716a]">E-mail de acesso: <strong className="text-[#111613]">{editing.email}</strong></div><Button type="submit" disabled={busy} className="min-h-11 w-fit rounded-full bg-[#b5232b] px-5 text-white"><Save className="size-4" /> Salvar cadastro</Button></form>}

    <section className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{drivers.map((driver) => <article key={driver.id} className="rounded-[24px] border border-[#070a08]/8 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-[#f3f0e8] text-[#b5232b]"><Bike className="size-5" /></span><span className={`rounded-full px-3 py-1.5 text-xs font-black ${driver.status === 'AVAILABLE' ? 'bg-[#e7f1df] text-[#27523a]' : driver.status === 'BUSY' ? 'bg-[#fff2d8] text-[#76510a]' : 'bg-[#f3f0e8] text-[#66716a]'}`}>{driverStatusLabels[driver.status as DeliveryDriverStatus] ?? 'Offline'}</span></div><h2 className="mt-4 text-lg font-black">{driver.name}</h2><p className="mt-1 text-sm text-[#66716a]">{driver.phone}</p><p className="mt-1 break-all text-xs text-[#66716a]">{driver.email}</p>{driver.currentDeliveryId && <a href="/admin/entregas" className="mt-3 inline-flex text-xs font-black text-[#b5232b]">Entrega em andamento</a>}<div className="mt-5 flex gap-2 border-t border-[#070a08]/8 pt-4"><button type="button" onClick={() => { setEditing(driver); setOpen(false); setError(''); }} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[#070a08]/10 px-4 text-xs font-black"><Pencil className="size-3.5" /> Editar</button><button type="button" disabled={busyId === driver.id || Boolean(driver.currentDeliveryId)} onClick={() => void toggle(driver)} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[#0b100e] px-4 text-xs font-black text-white disabled:opacity-50">{busyId === driver.id ? <Loader2 className="size-3.5 animate-spin" /> : <Power className="size-3.5" />}{driver.enabled ? 'Suspender' : 'Reativar'}</button></div></article>)}{!drivers.length && <div className="rounded-[24px] border border-dashed border-[#070a08]/15 bg-white p-9 text-center md:col-span-2 xl:col-span-3"><UserRound className="mx-auto size-8 text-[#b5232b]" /><h2 className="mt-3 font-black">Nenhum motoboy cadastrado</h2><p className="mt-1 text-sm text-[#66716a]">Crie o primeiro acesso para começar a distribuir as entregas.</p></div>}</section>
  </AdminShell>;
}

function DriverField(props: InputHTMLAttributes<HTMLInputElement> & { label: string; name: string }) {
  const { label, name, ...input } = props;
  return <label className="block text-sm font-bold">{label}<input name={name} {...input} className="mt-2 h-11 w-full rounded-xl border border-[#070a08]/15 bg-[#faf9f5] px-3 text-[#111613] outline-none focus:border-[#b5232b]" /></label>;
}
