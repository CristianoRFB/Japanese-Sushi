'use client';

import { signOut } from 'firebase/auth';
import { collection, doc, limit, onSnapshot, query, where } from 'firebase/firestore';
import { Bike, Check, Clock3, LogOut, MapPin, PackageCheck, Phone, RefreshCw, ShieldCheck, ToggleLeft, ToggleRight } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';

import { useAuth } from '@/components/providers';
import { Button } from '@/components/ui/button';
import { advanceDriverDelivery, respondToDelivery, setDriverAvailability, submitDeliveryCode } from '@/lib/delivery-operations';
import { getFirebaseClient, hasFirebaseConfig } from '@/lib/firebase/client';
import { TEIKO_BRAND_ID } from '@/shared/domain';
import { deliveryStatusLabels, driverStatusLabels, type DeliveryDriver, type DeliveryRecord, type DeliveryReceiptRequest } from '@/shared/delivery';

export default function DriverPortalPage() {
  const search = useSearchParams();
  const requestedDeliveryId = search.get('entrega');
  const { user, role, loading: authLoading } = useAuth();
  const [driver, setDriver] = useState<DeliveryDriver | null>(null);
  const [deliveries, setDeliveries] = useState<DeliveryRecord[]>([]);
  const [receipt, setReceipt] = useState<DeliveryReceiptRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!authLoading && !user) window.location.replace('/entregador/login');
    else if (!authLoading && user && role !== 'driver') window.location.replace(role ? '/admin' : '/entregador/login');
  }, [authLoading, user, role]);

  useEffect(() => {
    if (!user || role !== 'driver') return;
    const db = getFirebaseClient().db;
    const stopDriver = onSnapshot(doc(db, 'deliveryDrivers', user.uid), (snap) => {
      setDriver(snap.exists() ? ({ id: snap.id, ...snap.data() } as DeliveryDriver) : null);
      setLoading(false);
    }, () => { setError('Não foi possível carregar seu cadastro. Atualize ou procure a administração.'); setLoading(false); });
    const stopDeliveries = onSnapshot(query(collection(db, 'deliveries'), where('brandId', '==', TEIKO_BRAND_ID), where('driverId', '==', user.uid), limit(60)), (snap) => {
      setDeliveries(snap.docs.map((item) => ({ id: item.id, ...item.data() }) as DeliveryRecord));
    }, () => setError('Não foi possível atualizar sua fila de entregas.'));
    return () => { stopDriver(); stopDeliveries(); };
  }, [user, role]);

  const current = useMemo(() => deliveries.find((delivery) => delivery.id === driver?.currentDeliveryId) ?? null, [deliveries, driver?.currentDeliveryId]);
  const currentId = current?.id;
  const currentStatus = current?.status;
  useEffect(() => {
    if (!user || !currentId || currentStatus !== 'ARRIVED') { setReceipt(null); return; }
    return onSnapshot(doc(getFirebaseClient().db, 'deliveryReceiptRequests', currentId), (snap) => {
      setReceipt(snap.exists() ? ({ id: snap.id, ...snap.data() } as DeliveryReceiptRequest) : null);
    }, () => setError('Não foi possível consultar a validação. A corrida continua salva; atualize a página.'));
  }, [user, currentId, currentStatus]);

  useEffect(() => {
    if (requestedDeliveryId && currentId === requestedDeliveryId) {
      document.getElementById(`delivery-${requestedDeliveryId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [requestedDeliveryId, currentId]);

  async function perform(task: () => Promise<unknown>, message: string) {
    setBusy(true); setError(''); setNotice('');
    try { await task(); setNotice(message); }
    catch (cause) { setError(friendlyError(cause)); }
    finally { setBusy(false); }
  }

  async function sendCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !current) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    await perform(async () => {
      await submitDeliveryCode({ deliveryId: current.id, driverId: user.uid, code: String(data.get('code') ?? ''), paymentConfirmed: data.get('paymentConfirmed') === 'on' });
      form.reset();
    }, 'Código enviado com segurança para conferência da loja. Aguarde a confirmação antes de encerrar a corrida.');
  }

  if (!hasFirebaseConfig) return <main className="grid min-h-screen place-items-center bg-[#0b100e] p-6 text-center text-white"><p>Firebase dedicado da Teiko não está configurado.</p></main>;
  if (authLoading || loading || role !== 'driver') return <main className="grid min-h-screen place-items-center bg-[#0b100e]"><RefreshCw className="size-6 animate-spin text-[#c7a773]" /></main>;
  if (!driver) return <main className="grid min-h-screen place-items-center bg-[#0b100e] p-6 text-center text-white"><section><h1 className="teiko-display text-3xl">Cadastro indisponível</h1><p className="mt-3 text-sm text-white/70">Peça à administração para reativar seu acesso.</p><Button className="mt-5 rounded-full" onClick={() => void signOut(getFirebaseClient().auth)}>Sair</Button></section></main>;

  const available = driver.status === 'AVAILABLE';
  return <main className="min-h-screen bg-[#f3f0e8] text-[#111613]">
    <header className="bg-[#0b100e] px-4 py-5 text-white sm:px-7"><div className="mx-auto flex max-w-4xl items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-[#c7a773] text-[#0b100e]"><Bike /></span><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-[#c7a773]">Teiko Sushi · Entregas</p><h1 className="text-lg font-black">Olá, {driver.name.split(' ')[0]}</h1></div></div><button type="button" aria-label="Sair" onClick={() => void signOut(getFirebaseClient().auth)} className="grid size-10 place-items-center rounded-full bg-white/10"><LogOut className="size-4" /></button></div></header>
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-7 sm:py-8">
      {(error || notice) && <p role={error ? 'alert' : 'status'} className={`mb-5 rounded-2xl p-4 text-sm font-bold ${error ? 'bg-[#fff0ef] text-[#9d1723]' : 'bg-[#e7f1df] text-[#27523a]'}`}>{error || notice}</p>}
      <section className="flex flex-col justify-between gap-4 rounded-[26px] bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:p-6"><div><p className="text-xs font-black uppercase tracking-[.16em] text-[#b5232b]">Sua disponibilidade</p><h2 className="mt-1 text-xl font-black">{driverStatusLabels[driver.status]}</h2><p className="mt-1 text-sm text-[#66716a]">Fique disponível somente quando puder aceitar uma nova corrida.</p></div><Button type="button" disabled={busy || Boolean(driver.currentDeliveryId) || !driver.enabled} onClick={() => void perform(() => setDriverAvailability({ driverId: driver.id, available: !available }), available ? 'Você ficará offline e não receberá novas corridas.' : 'Você está disponível para receber uma corrida.')} className={`min-h-11 rounded-full px-5 font-black ${available ? 'bg-[#e7f1df] text-[#27523a] hover:bg-[#d8e9cc]' : 'bg-[#0b100e] text-white'}`}>{available ? <ToggleRight className="size-5" /> : <ToggleLeft className="size-5" />}{available ? 'Ficar offline' : 'Ficar disponível'}</Button></section>

      <div className="mt-7 flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-[.16em] text-[#b5232b]">Em tempo real</p><h2 className="teiko-display mt-1 text-3xl">{current ? 'Corrida atual' : 'Nenhuma corrida ativa'}</h2></div><span className="grid size-11 place-items-center rounded-2xl bg-[#0b100e] text-[#c7a773]"><Clock3 /></span></div>
      {current ? <DeliveryCard delivery={current} busy={busy} receipt={receipt} onPerform={perform} onSendCode={sendCode} driverId={driver.id} /> : <div className="mt-4 rounded-[28px] border border-dashed border-[#070a08]/15 bg-white p-9 text-center"><PackageCheck className="mx-auto size-9 text-[#b5232b]" /><h3 className="mt-4 text-lg font-black">Tudo em dia</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#66716a]">Quando a loja atribuir uma corrida, ela aparecerá aqui. Sua fila mostra somente pedidos ligados à sua conta.</p></div>}

      <section className="mt-8"><h2 className="text-lg font-black">Histórico recente</h2><div className="mt-3 grid gap-2">{deliveries.filter((delivery) => ['DELIVERED', 'CANCELLED', 'DELIVERY_FAILED'].includes(delivery.status)).slice(0, 8).map((delivery) => <article key={delivery.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white p-4"><div><strong className="text-sm">{delivery.orderNumber}</strong><p className="mt-1 text-xs text-[#66716a]">{delivery.customerName} · {delivery.address.neighborhood}</p></div><span className="rounded-full bg-[#f3f0e8] px-3 py-1.5 text-xs font-black">{deliveryStatusLabels[delivery.status]}</span></article>)}{!deliveries.some((delivery) => ['DELIVERED', 'CANCELLED', 'DELIVERY_FAILED'].includes(delivery.status)) && <p className="rounded-2xl bg-white p-5 text-sm text-[#66716a]">Suas entregas concluídas aparecerão aqui.</p>}</div></section>
    </div>
  </main>;
}

function DeliveryCard({ delivery, busy, receipt, onPerform, onSendCode, driverId }: { delivery: DeliveryRecord; busy: boolean; receipt: DeliveryReceiptRequest | null; onPerform: (task: () => Promise<unknown>, message: string) => Promise<void>; onSendCode: (event: FormEvent<HTMLFormElement>) => void; driverId: string }) {
  const [failureReason, setFailureReason] = useState('');
  const [showFailure, setShowFailure] = useState(false);
  return <article id={`delivery-${delivery.id}`} className="mt-4 scroll-mt-5 overflow-hidden rounded-[28px] bg-[#0b100e] text-white shadow-xl"><div className="border-b border-white/10 p-5 sm:p-7"><div className="flex flex-wrap items-start justify-between gap-3"><div><span className="rounded-full bg-[#c7a773] px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[#0b100e]">{deliveryStatusLabels[delivery.status]}</span><h3 className="teiko-display mt-3 text-3xl">{delivery.orderNumber}</h3><p className="mt-1 text-sm text-white/65">{delivery.customerName} · {delivery.paymentMethod === 'CASH' ? 'Dinheiro' : delivery.paymentMethod === 'CARD' ? 'Cartão' : 'Pix'}</p></div><strong className="rounded-2xl bg-white/8 px-3 py-2 text-sm">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(delivery.totalCents / 100)}</strong></div>
    <div className="mt-5 flex items-start gap-3 rounded-2xl bg-white/8 p-4"><MapPin className="mt-0.5 size-5 shrink-0 text-[#c7a773]" /><div className="min-w-0 flex-1"><strong>{delivery.address.street}, {delivery.address.number}</strong><p className="mt-1 text-sm text-white/70">{delivery.address.neighborhood}{delivery.address.complement ? ` · ${delivery.address.complement}` : ''}</p>{delivery.address.reference && <p className="mt-1 text-xs text-white/55">Referência: {delivery.address.reference}</p>}</div><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${delivery.address.street} ${delivery.address.number}, ${delivery.address.neighborhood}`)}`} target="_blank" rel="noreferrer" className="grid size-10 shrink-0 place-items-center rounded-full bg-[#c7a773] text-[#0b100e]" aria-label="Abrir endereço no mapa"><MapPin className="size-4" /></a></div>
    {delivery.customerWhatsapp && <a href={`https://wa.me/${delivery.customerWhatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-full bg-white/10 px-4 text-xs font-black"><Phone className="size-3.5" /> Contato do cliente</a>}
  </div><div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-7">
    {delivery.status === 'ASSIGNED' && <><Button disabled={busy} onClick={() => void onPerform(() => respondToDelivery({ deliveryId: delivery.id, driverId, accept: true }), 'Corrida aceita. Confirme a retirada quando estiver com o pedido.')} className="min-h-12 rounded-full bg-[#c7a773] font-black text-[#0b100e]"><Check className="size-4" /> Aceitar corrida</Button><Button disabled={busy} variant="outline" onClick={() => void onPerform(() => respondToDelivery({ deliveryId: delivery.id, driverId, accept: false }), 'Corrida recusada e devolvida à loja.')} className="min-h-12 rounded-full border-white/25 bg-transparent font-black text-white">Recusar corrida</Button></>}
    {delivery.status === 'ACCEPTED' && <Button disabled={busy} onClick={() => void onPerform(() => advanceDriverDelivery({ deliveryId: delivery.id, driverId, next: 'PICKED_UP' }), 'Retirada registrada. O pedido agora está em rota de entrega.')} className="min-h-12 rounded-full bg-[#c7a773] font-black text-[#0b100e] sm:col-span-2"><PackageCheck className="size-4" /> Confirmar retirada do pedido</Button>}
    {delivery.status === 'PICKED_UP' && <><Button disabled={busy} onClick={() => void onPerform(() => advanceDriverDelivery({ deliveryId: delivery.id, driverId, next: 'ON_THE_WAY' }), 'Deslocamento iniciado.')} className="min-h-12 rounded-full bg-[#c7a773] font-black text-[#0b100e]"><Bike className="size-4" /> Iniciar rota</Button><FailureForm show={showFailure} setShow={setShowFailure} reason={failureReason} setReason={setFailureReason} busy={busy} onSubmit={() => void onPerform(() => advanceDriverDelivery({ deliveryId: delivery.id, driverId, next: 'DELIVERY_FAILED', reason: failureReason }), 'Problema registrado. A loja receberá a corrida novamente.')} /></>}
    {delivery.status === 'ON_THE_WAY' && <><Button disabled={busy} onClick={() => void onPerform(() => advanceDriverDelivery({ deliveryId: delivery.id, driverId, next: 'ARRIVED' }), 'Chegada informada. Peça o código de entrega ao cliente.')} className="min-h-12 rounded-full bg-[#c7a773] font-black text-[#0b100e]"><MapPin className="size-4" /> Cheguei ao endereço</Button><FailureForm show={showFailure} setShow={setShowFailure} reason={failureReason} setReason={setFailureReason} busy={busy} onSubmit={() => void onPerform(() => advanceDriverDelivery({ deliveryId: delivery.id, driverId, next: 'DELIVERY_FAILED', reason: failureReason }), 'Problema registrado. A loja receberá a corrida novamente.')} /></>}
    {delivery.status === 'ARRIVED' && (receipt?.status === 'PENDING' ? <div className="rounded-2xl bg-white/10 p-4 text-sm leading-6 text-white/80 sm:col-span-2"><ShieldCheck className="mb-2 size-5 text-[#c7a773]" />Código e confirmação de pagamento enviados. Aguarde a loja validar antes de sair ou considerar a corrida concluída.</div> : <form onSubmit={onSendCode} className="grid gap-3 sm:col-span-2"><label className="text-sm font-bold">Código de quatro números do cliente<input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{4}" maxLength={4} required aria-describedby="delivery-code-help" className="mt-2 h-14 w-full rounded-xl border border-white/20 bg-white/10 px-4 text-center text-2xl font-black tracking-[.4em] text-white outline-none focus:border-[#c7a773]" placeholder="0000" /></label><p id="delivery-code-help" className="text-xs leading-5 text-white/60">Não fotografe nem anote o código. Digite apenas os quatro algarismos informados pelo cliente.</p><label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/15 p-3 text-xs font-bold leading-5"><input name="paymentConfirmed" type="checkbox" required className="mt-0.5 size-4 accent-[#c7a773]" />Confirmei que o cliente pagou pela forma escolhida no pedido.</label>{receipt?.status === 'REJECTED' && <p role="alert" className="rounded-xl bg-[#b5232b]/20 p-3 text-sm font-bold">A loja não conseguiu confirmar o código. Confira os números com o cliente e tente novamente.</p>}<Button disabled={busy} className="min-h-12 rounded-full bg-[#c7a773] font-black text-[#0b100e]"><ShieldCheck className="size-4" /> Enviar para validação da loja</Button></form>)}
    {(delivery.status === 'ACCEPTED' || delivery.status === 'ON_THE_WAY') && <FailureForm show={showFailure} setShow={setShowFailure} reason={failureReason} setReason={setFailureReason} busy={busy} onSubmit={() => void onPerform(() => advanceDriverDelivery({ deliveryId: delivery.id, driverId, next: 'DELIVERY_FAILED', reason: failureReason }), 'Problema registrado. A loja receberá a corrida novamente.')} />}
  </div></article>;
}

function FailureForm({ show, setShow, reason, setReason, busy, onSubmit }: { show: boolean; setShow: (show: boolean) => void; reason: string; setReason: (reason: string) => void; busy: boolean; onSubmit: () => void }) {
  if (!show) return <Button type="button" variant="outline" disabled={busy} onClick={() => setShow(true)} className="min-h-12 rounded-full border-white/25 bg-transparent font-bold text-white">Não consigo concluir</Button>;
  return <div className="grid gap-2 sm:col-span-2"><label className="text-xs font-bold">Explique o problema<textarea value={reason} onChange={(event) => setReason(event.target.value)} minLength={3} maxLength={200} required className="mt-1 min-h-20 w-full rounded-xl border border-white/20 bg-white/10 p-3 text-sm text-white" placeholder="Ex.: cliente ausente após contato" /></label><div className="flex gap-2"><Button type="button" disabled={busy || reason.trim().length < 3} onClick={onSubmit} className="min-h-10 rounded-full bg-[#b5232b] font-black text-white">Registrar problema</Button><Button type="button" variant="outline" onClick={() => setShow(false)} className="min-h-10 rounded-full border-white/25 bg-transparent text-white">Voltar</Button></div></div>;
}

function friendlyError(cause: unknown) {
  if (!(cause instanceof Error)) return 'Não foi possível salvar a atualização. Verifique a conexão e tente novamente.';
  if (/permission-denied|unauthenticated/i.test(cause.message)) return 'Seu acesso não permite esta ação. Saia e entre novamente ou procure a administração.';
  if (/unavailable|network|offline/i.test(cause.message)) return 'A conexão caiu. A atualização não foi confirmada; confira o status da corrida antes de repetir.';
  return cause.message.length < 220 ? cause.message : 'Não foi possível atualizar a corrida.';
}
