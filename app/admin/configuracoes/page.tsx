'use client';

import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { Plus, Save, Trash2, X } from 'lucide-react';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';

import { AdminField, AdminTextarea } from '@/components/admin-form';
import { AdminShell } from '@/components/admin-shell';
import { Button } from '@/components/ui/button';
import { getFirebaseClient } from '@/lib/firebase/client';
import { parseBRLToCents } from '@/shared/finance';
import type { DeliveryZone, StoreDayHours, StoreHoursWindow, StorePublicConfig } from '@/shared/domain';

const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const defaultWindow: StoreHoursWindow = { open: '19:00', close: '23:00' };
const emptyHours = dayNames.map((_, day) => ({ day, closed: day === 0, windows: day === 0 ? [] : [{ ...defaultWindow }] }));
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

function copyHours(hours: StoreDayHours[]) {
  return hours.length === 7 ? hours.map((day) => ({ ...day, windows: day.windows.map((window) => ({ ...window })) })) : emptyHours.map((day) => ({ ...day, windows: day.windows.map((window) => ({ ...window })) }));
}

function copyZones(zones?: DeliveryZone[]) {
  return (zones ?? []).map((zone) => ({ ...zone }));
}

export default function SettingsPage() {
  const [config, setConfig] = useState<StorePublicConfig | null>(null);
  const [hours, setHours] = useState<StoreDayHours[]>(emptyHours);
  const [holidayDates, setHolidayDates] = useState<string[]>([]);
  const [holidayHours, setHolidayHours] = useState<StoreHoursWindow[]>([{ ...defaultWindow }]);
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [holidayInput, setHolidayInput] = useState('');
  const [zoneDraft, setZoneDraft] = useState({ name: '', feeCents: 0 });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => onSnapshot(doc(getFirebaseClient().db, 'storePublicConfig', 'main'), (snapshot) => {
    if (!snapshot.exists()) return;
    const next = snapshot.data() as StorePublicConfig;
    setConfig(next);
    setHours(copyHours(next.hours));
    setHolidayDates(next.holidayDates ?? []);
    setHolidayHours(next.holidayHours?.length ? next.holidayHours.map((window) => ({ ...window })) : [{ ...defaultWindow }]);
    setZones(copyZones(next.deliveryConfig.zones));
  }, (cause) => setError(friendlyAdminError(cause))), []);

  function updateDay(day: number, patch: Partial<StoreDayHours>) {
    setHours((current) => current.map((item) => item.day === day ? { ...item, ...patch } : item));
  }

  function updateWindow(day: number, index: number, patch: Partial<StoreHoursWindow>) {
    setHours((current) => current.map((item) => item.day === day ? { ...item, windows: item.windows.map((window, windowIndex) => windowIndex === index ? { ...window, ...patch } : window) } : item));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMessage('');
    const data = new FormData(event.currentTarget);
    const whatsappNumber = String(data.get('whatsappNumber') || '').replace(/\D/g, '');
    const whatsappEnabled = data.get('whatsappEnabled') === 'on';
    const deliveryMode = String(data.get('deliveryMode')) as StorePublicConfig['deliveryConfig']['mode'];
    const fixedFeeCents = parseBRLToCents(String(data.get('fixedFee') || '0'));
    try {
      if (!String(data.get('storeName') || '').trim()) throw new Error('Informe o nome da loja.');
      if (!hours.every((day) => day.closed || day.windows.length > 0 && day.windows.every((window) => timePattern.test(window.open) && timePattern.test(window.close)))) throw new Error('Revise os horários de atendimento.');
      if (holidayHours.some((window) => !timePattern.test(window.open) || !timePattern.test(window.close))) throw new Error('Revise os horários de feriado.');
      if (whatsappEnabled && (whatsappNumber.length < 12 || whatsappNumber.length > 13)) throw new Error('Para exibir o botão, informe o WhatsApp da Teiko com 55, DDD e número.');
      if (deliveryMode === 'FIXED' && fixedFeeCents <= 0) throw new Error('Informe uma taxa fixa válida.');
      const payload: StorePublicConfig & { updatedAt: unknown } = {
        ...config!,
        brandId: 'teiko',
        storeName: String(data.get('storeName') || '').trim(),
        instagramHandle: String(data.get('instagramHandle') || '').trim(),
        address: String(data.get('address') || '').trim(),
        city: String(data.get('city') || '').trim(),
        phoneDisplay: String(data.get('phoneDisplay') || '').trim(),
        whatsappNumber,
        whatsappEnabled,
        orderingEnabled: data.get('orderingEnabled') === 'on',
        pauseMessage: String(data.get('pauseMessage') || '').trim(),
        enforceHours: data.get('enforceHours') === 'on',
        hours,
        holidayDates: [...new Set(holidayDates)].sort(),
        holidayHours,
        fulfillmentModes: [data.get('pickup') === 'on' ? 'PICKUP' : null, data.get('delivery') === 'on' ? 'DELIVERY' : null].filter(Boolean) as StorePublicConfig['fulfillmentModes'],
        paymentMethods: [data.get('pix') === 'on' ? 'PIX' : null, data.get('card') === 'on' ? 'CARD' : null, data.get('cash') === 'on' ? 'CASH' : null].filter(Boolean) as StorePublicConfig['paymentMethods'],
        deliveryConfig: { mode: deliveryMode, ...(deliveryMode === 'FIXED' ? { fixedFeeCents } : {}), ...(deliveryMode === 'ZONES' ? { zones } : {}) },
        orderInstructions: String(data.get('orderInstructions') || '').trim(),
        deliveryEstimate: String(data.get('deliveryEstimate') || '').trim(),
        busyDeliveryEstimate: String(data.get('busyDeliveryEstimate') || '').trim(),
        holidayHoursNote: String(data.get('holidayHoursNote') || '').trim(),
        gratitudeMessage: String(data.get('gratitudeMessage') || '').trim(),
        privacyNotice: String(data.get('privacyNotice') || '').trim(),
        timezone: 'America/Sao_Paulo',
        updatedAt: serverTimestamp(),
      };
      if (!payload.fulfillmentModes.length || !payload.paymentMethods.length) throw new Error('Selecione ao menos uma modalidade e uma forma de pagamento.');
      await setDoc(doc(getFirebaseClient().db, 'storePublicConfig', 'main'), payload);
      setMessage('Configurações salvas e publicadas.');
    } catch (cause) { setError(friendlyAdminError(cause, 'Não foi possível salvar.')); }
  }

  function addHoliday() {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(holidayInput) || holidayDates.includes(holidayInput)) return;
    setHolidayDates((current) => [...current, holidayInput].sort());
    setHolidayInput('');
  }

  function addZone() {
    const name = zoneDraft.name.trim();
    if (!name || zoneDraft.feeCents < 0) return;
    setZones((current) => [...current, { id: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`, name, feeCents: zoneDraft.feeCents, active: true }]);
    setZoneDraft({ name: '', feeCents: 0 });
  }

  if (!config) return <AdminShell adminOnly><p>Carregando configurações…</p></AdminShell>;
  return <AdminShell adminOnly>
    <header><p className="text-xs font-black uppercase tracking-[.18em] text-[#8b1e2b]">Loja</p><h1 className="mt-2 text-3xl font-black tracking-[-.04em]">Configurações</h1><p className="mt-2 text-sm text-[#7b887d]">Atualize dados públicos e a rotina da unidade sem editar estruturas técnicas.</p></header>
    <form onSubmit={save} className="mt-7 max-w-5xl space-y-5">
      <SettingsSection title="Identificação"><div className="grid gap-4 sm:grid-cols-2"><AdminField label="Nome da loja" name="storeName" required defaultValue={config.storeName} /><AdminField label="Instagram" name="instagramHandle" defaultValue={config.instagramHandle} /><AdminField label="Endereço" name="address" defaultValue={config.address} /><AdminField label="Cidade/UF" name="city" defaultValue={config.city} /><AdminField label="Telefone exibido" name="phoneDisplay" defaultValue={config.phoneDisplay} /><AdminField label="WhatsApp da Teiko (55 + DDD + número)" name="whatsappNumber" defaultValue={config.whatsappNumber} placeholder="5517999999999" /></div><label className="mt-4 flex items-center gap-2 text-sm font-bold"><input type="checkbox" name="whatsappEnabled" defaultChecked={config.whatsappEnabled} /> Exibir botão visível de WhatsApp</label></SettingsSection>
      <SettingsSection title="Pedidos e recebimento"><div className="flex flex-wrap gap-5 text-sm font-bold"><label><input type="checkbox" name="orderingEnabled" defaultChecked={config.orderingEnabled} /> Pedidos habilitados</label><label><input type="checkbox" name="enforceHours" defaultChecked={config.enforceHours} /> Respeitar horário da loja</label></div><div className="mt-5 grid gap-5 sm:grid-cols-2"><ChoiceList title="Recebimento" options={[['pickup', 'Retirada', config.fulfillmentModes.includes('PICKUP')], ['delivery', 'Delivery', config.fulfillmentModes.includes('DELIVERY')]]} /><ChoiceList title="Pagamento informado" options={[['pix', 'Pix', config.paymentMethods.includes('PIX')], ['card', 'Cartão', config.paymentMethods.includes('CARD')], ['cash', 'Dinheiro', config.paymentMethods.includes('CASH')]]} /></div><div className="mt-5"><AdminField label="Mensagem quando os pedidos estiverem pausados" name="pauseMessage" defaultValue={config.pauseMessage} /></div></SettingsSection>
      <SettingsSection title="Horários de atendimento"><p className="text-sm text-[#7b887d]">O horário de fechamento é exclusivo: às 23:00 a unidade já aparece fechada.</p><div className="mt-5 divide-y divide-[#070a08]/10 rounded-2xl border border-[#070a08]/10">{hours.map((day) => <div key={day.day} className="grid gap-3 p-4 sm:grid-cols-[150px_110px_1fr] sm:items-start"><label className="flex items-center gap-2 pt-2 text-sm font-black"><input type="checkbox" checked={!day.closed} onChange={(event) => updateDay(day.day, { closed: !event.target.checked })} /> {dayNames[day.day]}</label><span className="pt-2 text-xs font-bold text-[#7b887d]">{day.closed ? 'Fechado' : 'Aberto'}</span><div className="space-y-2">{!day.closed && day.windows.map((window, index) => <div key={`${day.day}-${index}`} className="flex flex-wrap items-end gap-2"><label className="text-xs font-bold">Abre<input type="time" value={window.open} onChange={(event) => updateWindow(day.day, index, { open: event.target.value })} className="mt-1 h-10 rounded-xl border bg-[#f3f0e8] px-2 font-normal" /></label><label className="text-xs font-bold">Fecha<input type="time" value={window.close} onChange={(event) => updateWindow(day.day, index, { close: event.target.value })} className="mt-1 h-10 rounded-xl border bg-[#f3f0e8] px-2 font-normal" /></label><button type="button" onClick={() => updateDay(day.day, { windows: day.windows.filter((_, windowIndex) => windowIndex !== index) })} disabled={day.windows.length === 1} className="p-2 text-[#8b1e2b] disabled:opacity-30" aria-label="Remover faixa"><Trash2 className="size-4" /></button></div>)}{!day.closed && <button type="button" onClick={() => updateDay(day.day, { windows: [...day.windows, { ...defaultWindow }] })} className="mt-1 inline-flex items-center gap-1 text-xs font-black text-[#b5232b]"><Plus className="size-3.5" /> Outra faixa</button>}</div></div>)}</div></SettingsSection>
      <SettingsSection title="Feriados"><p className="text-sm text-[#7b887d]">Cadastre datas excepcionais e defina o horário usado nesses dias.</p><div className="mt-4 flex flex-wrap items-end gap-2"><label className="text-sm font-bold">Data<input type="date" value={holidayInput} onChange={(event) => setHolidayInput(event.target.value)} className="mt-2 h-11 rounded-xl border bg-[#f3f0e8] px-3 font-normal" /></label><Button type="button" variant="outline" onClick={addHoliday} className="h-11 rounded-full"><Plus /> Adicionar data</Button></div><div className="mt-4 flex flex-wrap gap-2">{holidayDates.map((date) => <span key={date} className="inline-flex items-center gap-2 rounded-full bg-[#e8efe5] px-3 py-2 text-sm font-bold">{date.split('-').reverse().join('/')}<button type="button" onClick={() => setHolidayDates((current) => current.filter((item) => item !== date))} aria-label={`Remover feriado ${date}`}><X className="size-3.5" /></button></span>)}{!holidayDates.length && <p className="text-sm text-[#7b887d]">Nenhuma data excepcional.</p>}</div><div className="mt-5"><h3 className="text-sm font-black">Horário nos feriados</h3><div className="mt-3 flex flex-wrap gap-2">{holidayHours.map((window, index) => <div key={index} className="flex items-end gap-2"><label className="text-xs font-bold">Abre<input type="time" value={window.open} onChange={(event) => setHolidayHours((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, open: event.target.value } : item))} className="mt-1 h-10 rounded-xl border bg-[#f3f0e8] px-2 font-normal" /></label><label className="text-xs font-bold">Fecha<input type="time" value={window.close} onChange={(event) => setHolidayHours((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, close: event.target.value } : item))} className="mt-1 h-10 rounded-xl border bg-[#f3f0e8] px-2 font-normal" /></label></div>)}</div></div></SettingsSection>
      <SettingsSection title="Delivery"><div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-bold">Estratégia<select name="deliveryMode" defaultValue={config.deliveryConfig.mode} className="mt-2 h-11 w-full rounded-xl border bg-[#f3f0e8] px-3 font-normal"><option value="NONE">Sem delivery</option><option value="CONFIRM">Taxa confirmada depois</option><option value="FIXED">Taxa fixa</option><option value="ZONES">Por bairro ou zona</option></select></label><AdminField label="Taxa fixa (R$)" name="fixedFee" type="number" min="0" step="0.01" defaultValue={((config.deliveryConfig.fixedFeeCents ?? 0) / 100).toFixed(2)} /></div><div className="mt-5 rounded-2xl border border-[#070a08]/10 bg-[#f3f0e8] p-4"><h3 className="font-black">Bairros e taxas</h3><div className="mt-3 grid gap-2 sm:grid-cols-[1fr_150px_auto]"><input value={zoneDraft.name} onChange={(event) => setZoneDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Nome do bairro" className="h-10 rounded-xl border bg-white px-3 text-sm" /><input type="number" min="0" step="0.01" value={(zoneDraft.feeCents / 100).toFixed(2)} onChange={(event) => setZoneDraft((current) => ({ ...current, feeCents: parseBRLToCents(event.target.value) }))} placeholder="Taxa em R$" className="h-10 rounded-xl border bg-white px-3 text-sm" /><Button type="button" onClick={addZone} variant="outline" className="h-10 rounded-full"><Plus /> Adicionar</Button></div><div className="mt-4 space-y-2">{zones.map((zone, index) => <div key={zone.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 text-sm"><span className="font-bold">{zone.name} <small className="font-normal text-[#7b887d]">· R$ {(zone.feeCents / 100).toFixed(2)}</small></span><div className="flex items-center gap-3"><label className="text-xs font-bold"><input type="checkbox" checked={zone.active} onChange={(event) => setZones((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, active: event.target.checked } : item))} /> Ativo</label><button type="button" onClick={() => setZones((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remover zona ${zone.name}`} className="text-[#8b1e2b]"><Trash2 className="size-4" /></button></div></div>)}{!zones.length && <p className="text-sm text-[#7b887d]">Nenhum bairro cadastrado.</p>}</div></div></SettingsSection>
      <SettingsSection title="Mensagens ao cliente"><div className="space-y-4"><AdminTextarea label="Instruções do pedido" name="orderInstructions" defaultValue={config.orderInstructions} /><div className="grid gap-4 sm:grid-cols-2"><AdminField label="Prazo normal" name="deliveryEstimate" defaultValue={config.deliveryEstimate} /><AdminField label="Prazo em dias movimentados" name="busyDeliveryEstimate" defaultValue={config.busyDeliveryEstimate} /><AdminField label="Nota sobre feriados" name="holidayHoursNote" defaultValue={config.holidayHoursNote} /></div><AdminTextarea label="Mensagem de agradecimento" name="gratitudeMessage" defaultValue={config.gratitudeMessage} /></div></SettingsSection>
      <SettingsSection title="Privacidade"><AdminTextarea label="Aviso operacional" name="privacyNotice" defaultValue={config.privacyNotice} /></SettingsSection>
      {error && <p role="alert" className="rounded-xl bg-[#e8efe5] p-3 text-sm text-[#e3262e]">{error}</p>}{message && <p role="status" className="rounded-xl bg-[#d6e7bf]/50 p-3 text-sm text-[#23452b]">{message}</p>}<Button type="submit" className="h-12 rounded-full bg-[#b5232b] px-6 font-black text-white"><Save /> Salvar configurações</Button>
    </form>
  </AdminShell>;
}

function ChoiceList({ title, options }: { title: string; options: Array<[string, string, boolean]> }) {
  return <div><h3 className="text-sm font-black">{title}</h3><div className="mt-3 space-y-2 text-sm">{options.map(([name, label, checked]) => <label key={name} className="block"><input type="checkbox" name={name} defaultChecked={checked} /> {label}</label>)}</div></div>;
}

function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  return <section className="rounded-[26px] bg-white p-5 shadow-sm sm:p-6"><h2 className="mb-5 text-xl font-black">{title}</h2>{children}</section>;
}

function friendlyAdminError(cause: unknown, fallback = 'Não foi possível carregar as configurações.') {
  const text = cause instanceof Error ? cause.message : '';
  if (/permission-denied|unauthenticated/i.test(text)) return 'Sua sessão não tem permissão para alterar as configurações.';
  if (/network|offline|unavailable/i.test(text)) return 'A conexão com a unidade caiu. Tente novamente em instantes.';
  return text && !/FirebaseError|failed-precondition/i.test(text) ? text : fallback;
}
