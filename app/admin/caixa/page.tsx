'use client';

import {
  collection, doc, limit, onSnapshot, orderBy, query, where,
} from 'firebase/firestore';
import {
  ArrowDownToLine, ArrowUpFromLine, Banknote, CircleDollarSign, Clock3,
  CreditCard, History, Loader2, LockKeyhole, Plus, WalletCards,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';

import { AdminField, AdminTextarea } from '@/components/admin-form';
import { AdminShell } from '@/components/admin-shell';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/providers';
import { closeCashRegister, openCashRegister, recordCashMovement, recordLocalSale } from '@/lib/cash-register';
import { getFirebaseClient } from '@/lib/firebase/client';
import { formatBRL, TEIKO_BRAND_ID } from '@/shared/domain';
import { parseBRLToCents } from '@/shared/finance';
import {
  cashMovementLabel, cashPaymentLabel, isValidCashAmount, summarizeCashMovements,
  type CashMovement, type CashPaymentMethod, type CashRegister,
} from '@/shared/cash-register';

type CashAction = 'OPEN' | 'SALE' | 'WITHDRAWAL' | 'SUPPLY' | 'CLOSE';

function moneyCents(value: string, allowZero = false) {
  const trimmed = value.trim();
  const cents = trimmed === '' && allowZero ? 0 : parseBRLToCents(trimmed);
  if (!isValidCashAmount(cents, allowZero)) throw new Error(allowZero ? 'Informe um valor válido até R$ 100.000,00.' : 'Informe um valor maior que zero até R$ 100.000,00.');
  return cents;
}

function friendlyError(cause: unknown) {
  if (cause instanceof Error && !cause.message.includes('permission-denied')) return cause.message;
  return 'Não foi possível salvar no caixa. Confira sua permissão e conexão e tente novamente.';
}

export default function CashRegisterPage() {
  const { user } = useAuth();
  const [registers, setRegisters] = useState<CashRegister[]>([]);
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [openRegisterId, setOpenRegisterId] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [action, setAction] = useState<CashAction | null>(null);
  const pendingRequest = useRef<{ fingerprint: string; id: string } | null>(null);

  useEffect(() => {
    const db = getFirebaseClient().db;
    let settled = 0;
    const done = () => { settled += 1; if (settled >= 3) setLoading(false); };
    const stopControl = onSnapshot(doc(db, 'cashControl', 'main'), (snapshot) => {
      setOpenRegisterId(String(snapshot.data()?.openRegisterId ?? ''));
      done();
    }, () => { setError('Não foi possível consultar o estado do caixa.'); done(); });
    const stopRegisters = onSnapshot(query(collection(db, 'cashRegisters'), where('brandId', '==', TEIKO_BRAND_ID), orderBy('openedAt', 'desc'), limit(100)), (snapshot) => {
      setRegisters(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as CashRegister));
      done();
    }, () => { setError('Não foi possível carregar o histórico de turnos.'); done(); });
    const stopMovements = onSnapshot(query(collection(db, 'cashMovements'), where('brandId', '==', TEIKO_BRAND_ID), orderBy('createdAt', 'desc'), limit(500)), (snapshot) => {
      setMovements(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as CashMovement));
      done();
    }, () => { setError('Não foi possível carregar as movimentações.'); done(); });
    return () => { stopControl(); stopRegisters(); stopMovements(); };
  }, []);

  const current = registers.find((register) => register.id === openRegisterId && register.status === 'OPEN') ?? null;
  const currentMovements = useMemo(() => movements.filter((movement) => movement.registerId === current?.id), [movements, current?.id]);
  const summary = useMemo(() => {
    const movementSummary = summarizeCashMovements(current?.initialBalanceCents ?? 0, currentMovements);
    return current ? { ...movementSummary, expectedCashCents: current.expectedCashCents } : movementSummary;
  }, [current, currentMovements]);
  const history = registers.filter((register) => register.status === 'CLOSED').slice(0, 8);

  function requestId(fingerprint: string) {
    if (pendingRequest.current?.fingerprint === fingerprint) return pendingRequest.current.id;
    const id = crypto.randomUUID();
    pendingRequest.current = { fingerprint, id };
    return id;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) { setError('Sua sessão expirou. Entre novamente no painel.'); return; }
    const form = event.currentTarget;
    const data = new FormData(form);
    const operation = action;
    if (!operation) return;
    setError(''); setNotice(''); setBusy(true);
    try {
      if (operation === 'OPEN') {
        const initialBalanceCents = moneyCents(String(data.get('amount') ?? ''), true);
        const note = String(data.get('note') ?? '').trim();
        const id = requestId(JSON.stringify({ operation, initialBalanceCents, note }));
        await openCashRegister({ initialBalanceCents, note, clientRequestId: id, operatorUid: user.uid, operatorEmail: user.email ?? undefined });
        setNotice('Caixa aberto. O fundo inicial já aparece no saldo esperado.');
      } else if (operation === 'CLOSE' && current) {
        const countedCashCents = moneyCents(String(data.get('counted') ?? ''), true);
        const note = String(data.get('note') ?? '').trim();
        const id = requestId(JSON.stringify({ operation, registerId: current.id, countedCashCents, note }));
        await closeCashRegister({ registerId: current.id, clientRequestId: id, operatorUid: user.uid, operatorEmail: user.email ?? undefined, countedCashCents, note });
        setNotice('Turno fechado e diferença registrada no histórico.');
      } else if ((operation === 'SUPPLY' || operation === 'WITHDRAWAL') && current) {
        const amountCents = moneyCents(String(data.get('amount') ?? ''));
        const note = String(data.get('note') ?? '').trim();
        const id = requestId(JSON.stringify({ operation, registerId: current.id, amountCents, note }));
        await recordCashMovement({ registerId: current.id, clientRequestId: id, operatorUid: user.uid, operatorEmail: user.email ?? undefined, type: operation, amountCents, note });
        setNotice(operation === 'SUPPLY' ? 'Suprimento registrado.' : 'Sangria registrada.');
      } else if (operation === 'SALE' && current) {
        const amountCents = moneyCents(String(data.get('amount') ?? ''));
        const paymentMethod = String(data.get('payment') ?? '') as CashPaymentMethod;
        if (!['CASH', 'PIX', 'CARD', 'OTHER'].includes(paymentMethod)) throw new Error('Selecione uma forma de pagamento válida.');
        const description = String(data.get('description') ?? '').trim();
        const orderNumber = String(data.get('orderNumber') ?? '').trim();
        const note = String(data.get('note') ?? '').trim();
        const id = requestId(JSON.stringify({ operation, registerId: current.id, amountCents, paymentMethod, description, orderNumber, note }));
        await recordLocalSale({ registerId: current.id, clientRequestId: id, operatorUid: user.uid, operatorEmail: user.email ?? undefined, amountCents, paymentMethod, description, orderNumber, note });
        setNotice('Venda registrada uma única vez no turno e em Finanças.');
      }
      pendingRequest.current = null;
      form.reset();
      setAction(null);
    } catch (cause) { setError(friendlyError(cause)); }
    finally { setBusy(false); }
  }

  return <AdminShell adminOnly>
    <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div><p className="text-xs font-black uppercase tracking-[.18em] text-[#b5232b]">Gestão do turno</p><h1 className="teiko-display mt-2 text-4xl tracking-[-.04em]">Caixa</h1><p className="mt-2 max-w-2xl text-sm text-[#66716a]">Abertura, vendas do balcão, sangrias e fechamento com conferência física.</p></div>
      {current && <span className="inline-flex w-fit items-center gap-2 rounded-full bg-[#e7f1df] px-4 py-2 text-sm font-black text-[#27523a]"><span className="size-2 rounded-full bg-[#2d7c4b]" /> Turno aberto · {current.operatorEmail || 'Equipe Teiko'}</span>}
    </header>

    {(error || notice) && <p role={error ? 'alert' : 'status'} className={`mt-5 rounded-2xl border p-4 text-sm font-bold ${error ? 'border-[#b5232b]/20 bg-[#fff0ef] text-[#9d1723]' : 'border-[#2d7c4b]/20 bg-[#e7f1df] text-[#27523a]'}`}>{error || notice}</p>}

    {loading ? <section className="mt-7 grid gap-4 md:grid-cols-2"><div className="h-44 animate-pulse rounded-[26px] bg-white" /><div className="h-44 animate-pulse rounded-[26px] bg-white" /></section> : !current ? <section className="mt-7 grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
      <article className="overflow-hidden rounded-[30px] bg-[#0b100e] p-6 text-white shadow-xl sm:p-9">
        <span className="grid size-12 place-items-center rounded-2xl bg-[#c7a773] text-[#111613]"><WalletCards className="size-6" /></span>
        <p className="mt-6 text-xs font-black uppercase tracking-[.2em] text-[#c7a773]">Novo turno</p><h2 className="teiko-display mt-2 text-3xl">Abra o caixa</h2>
        <p className="mt-2 max-w-lg text-sm leading-6 text-white/65">Informe o dinheiro que ficou no fundo. A partir daí, cada venda e retirada entra no saldo do turno.</p>
        {action === 'OPEN' ? <CashForm onSubmit={submit} busy={busy} onCancel={() => setAction(null)}>
          <AdminField label="Fundo inicial (R$)" name="amount" inputMode="decimal" defaultValue="0,00" required />
          <AdminTextarea label="Observação (opcional)" name="note" placeholder="Ex.: fundo conferido pela gerente" />
          <Button disabled={busy} type="submit" className="min-h-12 rounded-full bg-[#c7a773] px-6 font-black text-[#111613]">{busy ? <Loader2 className="size-4 animate-spin" /> : <LockKeyhole className="size-4" />} Confirmar abertura</Button>
        </CashForm> : <Button type="button" onClick={() => { setAction('OPEN'); setError(''); setNotice(''); }} className="mt-6 min-h-12 rounded-full bg-[#c7a773] px-6 font-black text-[#111613]"><Plus className="size-4" /> Abrir turno</Button>}
      </article>
      <HistoryPanel history={history} movements={movements} />
    </section> : <>
      <section className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Dinheiro esperado" value={formatBRL(summary.expectedCashCents)} icon={<Banknote />} featured />
        <Metric label="Vendas do turno" value={formatBRL(summary.totalSalesCents)} icon={<CircleDollarSign />} />
        <Metric label="Vendas em dinheiro" value={formatBRL(summary.cashSalesCents)} icon={<Banknote />} />
        <Metric label="Pix e cartões" value={formatBRL(summary.pixSalesCents + summary.cardSalesCents + summary.otherSalesCents)} icon={<CreditCard />} />
      </section>

      <section className="mt-6 grid gap-5 xl:grid-cols-[.8fr_1.2fr]">
        <article className="rounded-[28px] bg-white p-5 shadow-sm sm:p-7">
          <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.16em] text-[#b5232b]">Atalhos do turno</p><h2 className="mt-2 text-2xl font-black">Movimentar caixa</h2></div><Clock3 className="size-6 text-[#b5232b]" /></div>
          {action ? <CashForm onSubmit={submit} busy={busy} onCancel={() => setAction(null)}>
            {action === 'SALE' && <>
              <AdminField label="Descrição" name="description" placeholder="Ex.: Combinado Teiko no balcão" minLength={2} maxLength={120} required />
              <div className="grid gap-3 sm:grid-cols-2"><AdminField label="Valor (R$)" name="amount" inputMode="decimal" placeholder="Ex.: 89,90" required /><label className="block text-sm font-bold">Pagamento<select name="payment" defaultValue="CASH" className="mt-2 h-11 w-full rounded-xl border border-[#070a08]/15 bg-[#faf9f5] px-3 font-normal"><option value="CASH">Dinheiro</option><option value="PIX">Pix</option><option value="CARD">Cartão</option><option value="OTHER">Outra forma</option></select></label></div>
              <AdminField label="Pedido relacionado (opcional)" name="orderNumber" maxLength={40} placeholder="Ex.: #T260924AB" />
              <AdminTextarea label="Observação (opcional)" name="note" maxLength={200} />
            </>}
            {(action === 'WITHDRAWAL' || action === 'SUPPLY') && <>
              <AdminField label="Valor (R$)" name="amount" inputMode="decimal" placeholder="Ex.: 20,00" required />
              <AdminTextarea label="Motivo" name="note" minLength={3} maxLength={200} required placeholder={action === 'WITHDRAWAL' ? 'Ex.: retirada para pagamento de fornecedor' : 'Ex.: recomposição do fundo inicial'} />
            </>}
            {action === 'CLOSE' && <>
              <div className="rounded-2xl bg-[#f3f0e8] p-4"><span className="text-sm font-bold text-[#66716a]">Dinheiro esperado</span><strong className="mt-1 block text-2xl font-black">{formatBRL(summary.expectedCashCents)}</strong></div>
              <AdminField label="Dinheiro contado (R$)" name="counted" inputMode="decimal" defaultValue={(summary.expectedCashCents / 100).toFixed(2).replace('.', ',')} required />
              <AdminTextarea label="Observação do fechamento (opcional)" name="note" maxLength={200} />
              <p className="text-xs leading-5 text-[#66716a]">A diferença entre o valor contado e o esperado ficará registrada no histórico deste turno.</p>
            </>}
            <Button disabled={busy} type="submit" className={`min-h-11 rounded-full px-5 font-black text-white ${action === 'CLOSE' ? 'bg-[#0b100e]' : 'bg-[#b5232b]'}`}>{busy ? <Loader2 className="size-4 animate-spin" /> : null}{action === 'SALE' ? 'Registrar venda' : action === 'SUPPLY' ? 'Registrar suprimento' : action === 'WITHDRAWAL' ? 'Registrar sangria' : 'Fechar turno'}</Button>
          </CashForm> : <div className="mt-5 grid grid-cols-2 gap-2">
            <ActionButton icon={<Plus />} label="Venda balcão" onClick={() => setAction('SALE')} />
            <ActionButton icon={<ArrowDownToLine />} label="Suprimento" onClick={() => setAction('SUPPLY')} />
            <ActionButton icon={<ArrowUpFromLine />} label="Sangria" onClick={() => setAction('WITHDRAWAL')} />
            <ActionButton icon={<LockKeyhole />} label="Fechar caixa" dark onClick={() => setAction('CLOSE')} />
          </div>}
          <div className="mt-5 grid grid-cols-2 gap-3 border-t border-[#070a08]/10 pt-4 text-sm"><span className="text-[#66716a]">Fundo inicial</span><strong className="text-right">{formatBRL(current.initialBalanceCents)}</strong><span className="text-[#66716a]">Vendas em dinheiro</span><strong className="text-right">{formatBRL(summary.cashSalesCents)}</strong><span className="text-[#66716a]">Sangrias / suprimentos</span><strong className="text-right">− {formatBRL(summary.withdrawalsCents)} / + {formatBRL(summary.suppliesCents)}</strong></div>
        </article>

        <article className="rounded-[28px] bg-white p-5 shadow-sm sm:p-7">
          <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.16em] text-[#b5232b]">Trilha do turno</p><h2 className="mt-2 text-2xl font-black">Últimas movimentações</h2></div><History className="size-6 text-[#b5232b]" /></div>
          <MovementList movements={currentMovements.slice(0, 20)} empty="Ainda não houve movimentação neste turno." />
        </article>
      </section>
      <div className="mt-6"><HistoryPanel history={history} movements={movements} /></div>
    </>}
  </AdminShell>;
}

function CashForm({ children, onSubmit, onCancel, busy }: { children: ReactNode; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onCancel: () => void; busy: boolean }) {
  return <form onSubmit={onSubmit} className="mt-5 grid gap-4"><div className="grid gap-4">{children}</div><Button type="button" variant="outline" disabled={busy} onClick={onCancel} className="min-h-10 rounded-full">Cancelar</Button></form>;
}

function Metric({ label, value, icon, featured = false }: { label: string; value: string; icon: ReactNode; featured?: boolean }) {
  return <article className={`rounded-[24px] p-5 shadow-sm ${featured ? 'bg-[#0b100e] text-white' : 'bg-white text-[#111613]'}`}><span className={`grid size-10 place-items-center rounded-xl ${featured ? 'bg-[#c7a773] text-[#111613]' : 'bg-[#f3f0e8] text-[#b5232b]'}`}>{icon}</span><p className={`mt-4 text-sm font-bold ${featured ? 'text-white/60' : 'text-[#66716a]'}`}>{label}</p><strong className="mt-1 block text-2xl font-black tracking-tight">{value}</strong></article>;
}

function ActionButton({ icon, label, onClick, dark = false }: { icon: ReactNode; label: string; onClick: () => void; dark?: boolean }) {
  return <button type="button" onClick={onClick} className={`flex min-h-12 items-center gap-2 rounded-2xl border px-3 text-left text-sm font-black transition hover:-translate-y-0.5 ${dark ? 'border-[#0b100e] bg-[#0b100e] text-white hover:bg-[#b5232b]' : 'border-[#070a08]/10 bg-[#faf9f5] text-[#111613] hover:border-[#b5232b]/40'}`}>{icon}<span>{label}</span></button>;
}

function MovementList({ movements, empty }: { movements: CashMovement[]; empty: string }) {
  if (!movements.length) return <p className="mt-6 rounded-2xl border border-dashed border-[#070a08]/15 p-8 text-center text-sm text-[#66716a]">{empty}</p>;
  return <div className="mt-5 divide-y divide-[#070a08]/8">{movements.map((movement) => <article key={movement.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 py-3"><span className={`grid size-10 place-items-center rounded-xl ${movement.direction === 'IN' ? 'bg-[#e7f1df] text-[#27523a]' : 'bg-[#fff0ef] text-[#b5232b]'}`}>{movement.type === 'SALE' ? <CircleDollarSign className="size-4" /> : movement.type === 'CLOSING' ? <LockKeyhole className="size-4" /> : movement.direction === 'IN' ? <ArrowDownToLine className="size-4" /> : <ArrowUpFromLine className="size-4" />}</span><div className="min-w-0"><strong className="block truncate text-sm">{movement.description || cashMovementLabel(movement.type)}</strong><span className="block truncate text-xs text-[#66716a]">{movement.paymentMethod ? cashPaymentLabel(movement.paymentMethod) : movement.note || cashMovementLabel(movement.type)}{movement.orderNumber ? ` · ${movement.orderNumber}` : ''}</span></div><strong className={`whitespace-nowrap text-sm ${movement.type === 'SALE' || movement.type === 'SUPPLY' ? 'text-[#27523a]' : movement.type === 'WITHDRAWAL' ? 'text-[#b5232b]' : ''}`}>{movement.type === 'SALE' ? '+' : movement.type === 'SUPPLY' ? '+' : movement.type === 'WITHDRAWAL' ? '−' : ''} {formatBRL(movement.amountCents)}</strong></article>)}</div>;
}

function HistoryPanel({ history, movements }: { history: CashRegister[]; movements: CashMovement[] }) {
  return <article className="rounded-[28px] bg-white p-5 shadow-sm sm:p-7"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[#f3f0e8] text-[#b5232b]"><History className="size-5" /></span><div><p className="text-xs font-black uppercase tracking-[.16em] text-[#b5232b]">Conferência</p><h2 className="text-xl font-black">Turnos encerrados</h2></div></div>{history.length ? <div className="mt-4 grid gap-3 md:grid-cols-2">{history.map((register) => { const items = movements.filter((movement) => movement.registerId === register.id); const total = summarizeCashMovements(register.initialBalanceCents, items); return <section key={register.id} className="rounded-2xl border border-[#070a08]/10 bg-[#faf9f5] p-4"><div className="flex items-start justify-between gap-3"><div><strong className="text-sm">{register.openingDate}</strong><p className="mt-1 text-xs text-[#66716a]">{register.operatorEmail || 'Equipe Teiko'}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-black ${register.differenceCents === 0 ? 'bg-[#e7f1df] text-[#27523a]' : 'bg-[#fff0ef] text-[#9d1723]'}`}>{formatBRL(register.differenceCents ?? 0)}</span></div><div className="mt-4 grid grid-cols-3 gap-2 text-xs"><div><span className="block text-[#66716a]">Vendas</span><strong>{formatBRL(total.totalSalesCents)}</strong></div><div><span className="block text-[#66716a]">Esperado</span><strong>{formatBRL(register.expectedCashCents)}</strong></div><div><span className="block text-[#66716a]">Contado</span><strong>{formatBRL(register.countedCashCents ?? 0)}</strong></div></div></section>; })}</div> : <p className="mt-4 rounded-2xl border border-dashed border-[#070a08]/15 p-6 text-sm text-[#66716a]">Nenhum turno foi fechado ainda.</p>}</article>;
}
