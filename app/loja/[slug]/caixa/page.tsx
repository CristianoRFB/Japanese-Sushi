'use client';

import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { getFirebaseClient, hasFirebaseConfig } from '@/lib/firebase/client';
import { brlToCents } from '@/shared/money';
import { validTenantSlug } from '@/shared/tenancy';

type Register = {
  status: 'NOT_OPENED' | 'OPEN' | 'CLOSED';
  sessionId?: string;
  openingFloatCents?: number;
  expectedCashCents?: number;
  cashSalesCents?: number;
  salesCount?: number;
  cashRefundsCents?: number;
  refundCount?: number;
};
type ReadyOrder = { id: string; orderNumber: string; status: string; totalCents: number; customerName: string };
const brl = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
function parseCashAmount(value: string) {
  return /^(0|0[,.]00)$/.test(value.trim()) ? 0 : brlToCents(value);
}
function messageOf(error: unknown): string {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  if (/permission-denied|unauthenticated/.test(code)) return 'Sem permissão para esta operação.';
  if (/failed-precondition/.test(code)) return 'Estado inválido. Confira a fila e o caixa antes de repetir.';
  if (/unavailable|network/.test(code)) return 'Sem conexão. Confira o lançamento antes de repetir.';
  return error instanceof Error ? error.message : 'Operação não concluída.';
}

export default function TenantCashPage() {
  const params = useParams();
  const tenantId = typeof params.slug === 'string' ? params.slug : '';
  const ready = hasFirebaseConfig && validTenantSlug(tenantId) && tenantId !== 'teiko';
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<'tenant_owner' | 'staff' | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [register, setRegister] = useState<Register>({ status: 'NOT_OPENED' });
  const [orders, setOrders] = useState<ReadyOrder[]>([]);
  const [completedOrders, setCompletedOrders] = useState<ReadyOrder[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function refresh() {
    const functions = getFirebaseClient().functions;
    const [reg, queue] = await Promise.all([
      httpsCallable(functions, 'tenantGetPickupCashRegister')({ tenantId }),
      httpsCallable(functions, 'tenantListPickupOrders')({ tenantId }),
    ]);
    setRegister(reg.data as Register);
    const allOrders = (queue.data as { orders: ReadyOrder[] }).orders ?? [];
    setOrders(allOrders.filter(o => o.status === 'READY'));
    setCompletedOrders(allOrders.filter(o => o.status === 'COMPLETED'));
  }
  useEffect(() => {
    if (!ready) { setLoading(false); return; }
    let gen = 0;
    return onAuthStateChanged(getFirebaseClient().auth, current => {
      const seq = ++gen;
      const account = current?.isAnonymous ? null : current;
      setUser(account); setRole(null);
      if (!account) { setLoading(false); setOrders([]); return; }
      setLoading(true); setError('');
      void httpsCallable(getFirebaseClient().functions, 'getMyTenantAccess')({ tenantId }).then(async response => {
        if (seq !== gen) return;
        const nextRole = (response.data as { role?: string }).role;
        if (nextRole !== 'tenant_owner' && nextRole !== 'staff')
          throw new Error('Somente a equipe autorizada pode acessar o caixa.');
        await refresh();
        if (seq === gen) setRole(nextRole);
      }).catch(cause => { if (seq === gen) setError(messageOf(cause)); })
        .finally(() => { if (seq === gen) setLoading(false); });
    });
  }, [ready, tenantId]);

  async function execute(task: () => Promise<unknown>, success: string) {
    setBusy(true); setNotice(''); setError('');
    try {
      await task();
      await refresh();
      setNotice(success);
    } catch (cause) { setError(messageOf(cause)); }
    finally { setBusy(false); }
  }
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true); setError('');
    try {
      await signInWithEmailAndPassword(getFirebaseClient().auth,
        String(data.get('email')), String(data.get('password')));
    } catch { setError('Falha de autenticação. Confira usuário e senha.'); }
    finally { setBusy(false); }
  }
  async function openRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const openingFloatCents = parseCashAmount(String(data.get('float') ?? ''));
    if (openingFloatCents === null) { setError('Informe valor inicial válido em reais.'); return; }
    await execute(() => httpsCallable(getFirebaseClient().functions, 'tenantOpenPickupCashRegister')({
      tenantId, openingFloatCents,
    }), 'Caixa aberto para recebimentos presenciais.');
  }
  async function settle(event: FormEvent<HTMLFormElement>, order: ReadyOrder) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const cashReceivedCents = parseCashAmount(String(data.get('received') ?? ''));
    if (cashReceivedCents === null || cashReceivedCents < order.totalCents) {
      setError('O valor recebido deve cobrir o preço do pedido.'); return;
    }
    if (data.get('confirmed') !== 'on') { setError('Confirme o recebimento físico do dinheiro.'); return; }
    await execute(() => httpsCallable(getFirebaseClient().functions, 'tenantSettlePickupCash')({
      tenantId, orderId: order.id, cashReceivedCents, confirmCashReceived: true,
    }), 'Recebimento registrado uma vez no caixa e financeiro. Pedido concluído.');
  }
  async function refund(event: FormEvent<HTMLFormElement>, order: ReadyOrder) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const reason = String(fields.get('reason') ?? '').trim();
    if (reason.length < 8 || reason.length > 300) {
      setError('Informe um motivo entre 8 e 300 caracteres.');
      return;
    }
    if (fields.get('confirmed') !== 'on') {
      setError('Confirme a devolução física do valor integral.');
      return;
    }
    await execute(() => httpsCallable(getFirebaseClient().functions, 'tenantRefundPickupCash')({
      tenantId, orderId: order.id, reason, confirmCashReturned: true,
    }), 'Estorno integral lançado no financeiro e no caixa.');
  }

  async function close(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const countedCashCents = parseCashAmount(String(data.get('counted') ?? ''));
    if (countedCashCents === null) { setError('Informe a contagem física em reais.'); return; }
    setBusy(true); setNotice(''); setError('');
    try {
      const output = await httpsCallable(getFirebaseClient().functions, 'tenantClosePickupCashRegister')({
        tenantId, countedCashCents,
      });
      const result = output.data as { varianceCents: number };
      await refresh();
      setNotice('Caixa encerrado. Diferença registrada: ' + brl(result.varianceCents));
    } catch (cause) { setError(messageOf(cause)); }
    finally { setBusy(false); }
  }

  if (!ready) return <main role="alert" className="p-8">
    {tenantId === 'teiko' ? 'O caixa da Teiko continua no painel original /admin.' : 'Tenant indisponível.'}
  </main>;

  return <main className="min-h-screen bg-[#f3f0e8] p-4 text-[#111613] sm:p-8">
    <div className="mx-auto max-w-4xl">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-widest text-[#b5232b]">Caixa · {tenantId}</p>
          <h1 className="mt-1 text-3xl font-black">Recebimento presencial</h1>
          <Link href={'/loja/' + tenantId + '/financeiro'} className="mt-2 inline-block text-sm underline">
            Ver lançamentos financeiros recentes
          </Link></div>
        {user && <Button variant="outline" onClick={() => void signOut(getFirebaseClient().auth)}>Sair</Button>}
      </header>
      <p className="mt-3 text-sm text-gray-600">Apenas dinheiro recebido fisicamente. Não confirma PIX, cartão, reembolsos ou delivery. Nenhum pagamento é processado automaticamente.</p>
      {error && <p role="alert" className="mt-5 rounded-xl bg-red-100 p-4 text-red-900">{error}</p>}
      {notice && <p role="status" className="mt-5 rounded-xl bg-green-100 p-4 text-green-900">{notice}</p>}
      {loading && <p role="status" className="mt-5 rounded-xl bg-white p-4">Verificando acesso ao caixa…</p>}
      {!user && !loading && <form onSubmit={login} className="mt-6 grid max-w-md gap-3 rounded-xl bg-white p-5">
        <h2 className="font-bold">Entrar como equipe</h2>
        <label>E-mail<input required name="email" type="email" autoComplete="username" className="mt-1 w-full rounded-lg border p-3" /></label>
        <label>Senha<input required name="password" type="password" autoComplete="current-password" className="mt-1 w-full rounded-lg border p-3" /></label>
        <Button type="submit" disabled={busy}>Entrar</Button>
      </form>}
      {role && !loading && <div className="mt-6 grid gap-6">
        <section className="rounded-2xl bg-white p-5">
          <h2 className="text-xl font-bold">Situação do caixa</h2>
          <p className="mt-2 text-sm">Estado: <strong>{register.status}</strong></p>
          <p className="mt-1 text-sm">Vendas registradas: {register.salesCount ?? 0}</p>
          <p className="mt-1 text-sm">Estornos manuais: {register.refundCount ?? 0} · {brl(register.cashRefundsCents ?? 0)}</p>
          {register.status === 'OPEN' && <p className="mt-1 font-bold">Saldo esperado: {brl(register.expectedCashCents ?? 0)}</p>}
          {register.status !== 'OPEN' && role === 'tenant_owner' && <form onSubmit={openRegister} className="mt-4 flex flex-wrap items-end gap-3">
            <label>Fundo inicial (R$)<input name="float" required inputMode="decimal" defaultValue="0,00" className="mt-1 block rounded-lg border p-3" /></label>
            <Button type="submit" disabled={busy}>Abrir caixa</Button>
          </form>}
          {register.status === 'OPEN' && role === 'tenant_owner' && <form onSubmit={close} className="mt-4 flex flex-wrap items-end gap-3">
            <label>Dinheiro físico contado (R$)<input name="counted" required inputMode="decimal" className="mt-1 block rounded-lg border p-3" /></label>
            <Button variant="outline" type="submit" disabled={busy}>Fechar e registrar diferença</Button>
          </form>}
        </section>
        <section className="rounded-2xl bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold">Pedidos prontos, ainda não pagos</h2>
            <Button variant="outline" disabled={busy} onClick={() => void refresh().catch(() => setError('Falha ao atualizar os dados.'))}>Atualizar</Button>
          </div>
          {orders.length === 0 && <p className="mt-4 text-sm">Nenhum pedido pronto pendente.</p>}
          <div className="mt-4 grid gap-4">
            {orders.map(order => <article key={order.id} className="rounded-xl border p-4">
              <h3 className="font-bold">{order.orderNumber} · {order.customerName}</h3>
              <p className="mt-1 text-lg font-black">{brl(order.totalCents)}</p>
              <form onSubmit={event => void settle(event, order)} className="mt-3 grid gap-3 sm:grid-cols-2">
                <label>Dinheiro recebido (R$)<input name="received" required inputMode="decimal" defaultValue={(order.totalCents / 100).toFixed(2).replace('.', ',')} className="mt-1 w-full rounded-lg border p-3" /></label>
                <label className="flex items-center gap-2 text-sm"><input required type="checkbox" name="confirmed" />Confirmo que recebi o dinheiro fisicamente</label>
                <Button type="submit" disabled={busy || register.status !== 'OPEN'} className="sm:col-span-2">Confirmar e concluir pedido</Button>
              </form>
            </article>)}
          </div>
        </section>
        {role === 'tenant_owner' && register.status === 'OPEN' && <section className="rounded-2xl bg-white p-5">
          <h2 className="text-xl font-bold">Devoluções de dinheiro</h2>
          <p className="mt-2 text-sm text-gray-600">
            Estorno integral somente após você efetivamente devolver o dinheiro.
            Não estorna PIX/cartão, não movimenta conta bancária e não emite documento fiscal.
          </p>
          {completedOrders.length === 0 && <p className="mt-4 text-sm">Nenhuma venda concluída nas últimas 50 posições da fila.</p>}
          <div className="mt-4 grid gap-4">{completedOrders.map(order =>
            <article key={order.id} className="rounded-xl border p-4">
              <p className="font-bold">{order.orderNumber} · {order.customerName}</p>
              <p className="mt-1 text-sm font-semibold">Valor integral: {brl(order.totalCents)}</p>
              <form onSubmit={event => void refund(event, order)} className="mt-3 grid gap-3">
                <label className="text-sm">Motivo da devolução
                  <textarea required name="reason" minLength={8} maxLength={300} rows={2}
                    className="mt-1 w-full rounded-lg border p-3" />
                </label>
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" required name="confirmed" className="mt-1" />
                  Confirmei a devolução física de {brl(order.totalCents)} ao cliente.
                </label>
                <Button variant="outline" type="submit" disabled={busy || (register.expectedCashCents ?? 0) < order.totalCents}>
                  Registrar estorno integral
                </Button>
              </form>
            </article>
          )}</div>
        </section>}
      </div>}
    </div>
  </main>;
}