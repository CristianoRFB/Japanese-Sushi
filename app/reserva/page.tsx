'use client';

import {
  addDoc,
  collection,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Copy,
  KeyRound,
  Loader2,
} from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';

import { PublicHeader } from '@/components/public-header';
import { useCatalog } from '@/components/providers';
import { Button } from '@/components/ui/button';
import {
  ensureAnonymousUser,
  getFirebaseClient,
  hasFirebaseConfig,
} from '@/lib/firebase/client';
import {
  normalizePhone,
  normalizeReservationName,
  RESERVATION_MAX_DATE,
  RESERVATION_MIN_DATE,
  validateReservationDraft,
  type ReservationField,
} from '@/shared/domain';

interface SavedReservation {
  id: string;
  code: string;
  name: string;
  whatsapp: string;
  date: string;
  time: string;
  people: number;
  notes?: string;
  savedAt: number;
}

function reservationCacheKey(uid: string) {
  return `teiko:reservation-cache:${uid}`;
}

export default function ReservationPage() {
  const { config, development } = useCatalog();
  const [sentReservation, setSentReservation] = useState<SavedReservation | null>(null);
  const [cachedReservation, setCachedReservation] = useState<SavedReservation | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<ReservationField, string>>>({});
  const [copiedCode, setCopiedCode] = useState('');

  useEffect(() => {
    if (!hasFirebaseConfig || typeof window === 'undefined') return;
    void ensureAnonymousUser().then((user) => {
      const raw = window.localStorage.getItem(reservationCacheKey(user.uid));
      if (!raw) return;
      try {
        const saved = JSON.parse(raw) as SavedReservation;
        if (saved?.code && saved?.date && saved?.name) setCachedReservation(saved);
      } catch {
        window.localStorage.removeItem(reservationCacheKey(user.uid));
      }
    }).catch(() => undefined);
  }, []);

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      window.setTimeout(() => setCopiedCode(''), 1800);
    } catch {
      setError('Não foi possível copiar automaticamente. Selecione o código e guarde-o em um local seguro.');
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setFieldErrors({});
    setBusy(true);
    const data = new FormData(event.currentTarget);
    const payload = {
      clientRequestId: crypto.randomUUID(),
      unitId: config.defaultUnitId,
      name: normalizeReservationName(String(data.get('name') ?? '')),
      whatsapp: String(data.get('whatsapp')),
      date: String(data.get('date')),
      time: String(data.get('time')),
      people: Number(data.get('people')),
      notes: String(data.get('notes') || '') || undefined,
    };
    const validation = validateReservationDraft(payload);
    if (Object.keys(validation).length) {
      setFieldErrors(validation);
      setError('Revise os campos destacados antes de enviar.');
      setBusy(false);
      return;
    }
    try {
      if (!hasFirebaseConfig)
        throw new Error(
          'A unidade ainda não está conectada ao serviço de reservas.',
        );
      const { db } = getFirebaseClient();
      const user = await ensureAnonymousUser();
      const reservation = await addDoc(collection(db, 'reservations'), {
        brandId: 'teiko',
        ownerUid: user.uid,
        ...payload,
        name: normalizeReservationName(payload.name),
        whatsapp: normalizePhone(payload.whatsapp),
        notes: payload.notes ?? '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        status: 'REQUESTED',
        statusHistory: [
          { status: 'REQUESTED', at: Timestamp.now(), actor: 'customer' },
        ],
      });
      const savedReservation: SavedReservation = {
        id: reservation.id,
        code: reservation.id,
        name: payload.name,
        whatsapp: normalizePhone(payload.whatsapp),
        date: payload.date,
        time: payload.time,
        people: payload.people,
        ...(payload.notes ? { notes: payload.notes } : {}),
        savedAt: Date.now(),
      };
      window.localStorage.setItem(reservationCacheKey(user.uid), JSON.stringify(savedReservation));
      setCachedReservation(savedReservation);
      setSentReservation(savedReservation);
    } catch (cause) {
      const code = cause && typeof cause === 'object' && 'code' in cause ? String(cause.code) : '';
      setError(
        code.includes('permission-denied')
          ? 'A solicitação não foi aceita. Confira se a data está dentro de 2026 e tente novamente.'
          : code.includes('unavailable')
            ? 'O serviço está temporariamente indisponível. Aguarde um instante e tente novamente.'
            : 'Não foi possível enviar a reserva agora. Confira os dados e tente novamente.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="min-h-screen bg-[#180e16] text-[#fff7ea]">
      <PublicHeader />
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-20">
        <a
          href="/"
          className="inline-flex items-center gap-2 text-sm font-bold text-[#d9b66f]"
        >
          <ArrowLeft className="size-4" /> Voltar ao cardápio
        </a>
        <div className="mt-8">
          <p className="text-xs font-black uppercase tracking-[.18em] text-[#d9b66f]">
            Teiko Sushi
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-[-.05em] sm:text-5xl">
            Reserve sua mesa
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-[#d9c4cf]">
            Envie uma solicitação para a unidade. A confirmação será feita pela
            equipe.
          </p>
          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-[#d9b66f]/35 bg-[#28121f] p-4 text-sm text-[#f5dfb1]">
            <CalendarDays className="mt-0.5 size-5 shrink-0 text-[#d9b66f]" />
            <p>
              Reservas disponíveis somente para datas de <strong>2026</strong>.
              Escolha um dia e horário válidos; a equipe confirmará a disponibilidade.
            </p>
          </div>
        </div>
        {sentReservation ? (
          <section className="mt-8 rounded-[28px] border-2 border-[#d9b66f] bg-[#381726] p-6 shadow-[0_18px_45px_rgba(24,14,22,.28)] sm:p-8">
            <div className="flex items-start gap-4">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#d9ed55] text-[#180e16]">
                <KeyRound className="size-6" />
              </span>
              <div>
                <span className="inline-flex items-center gap-2 rounded-full bg-[#d9ed55]/15 px-3 py-1 text-xs font-black text-[#d9ed55]">
                  <CheckCircle2 className="size-3.5" /> Solicitação recebida
                </span>
                <h2 className="mt-3 text-2xl font-black">Guarde este código</h2>
                <p className="mt-2 text-[#d9c4cf]">
                  Ele é a referência da sua reserva. Mantenha-o salvo para consultar com a unidade.
                </p>
              </div>
            </div>
            <div className="mt-6 rounded-2xl border border-[#d9b66f]/60 bg-[#180e16] p-4">
              <p className="text-xs font-black uppercase tracking-[.16em] text-[#d9b66f]">Código importante</p>
              <code className="mt-2 block break-all text-xl font-black tracking-[.12em] text-[#fff7ea]">{sentReservation.code}</code>
              <Button type="button" onClick={() => void copyCode(sentReservation.code)} className="mt-4 h-11 w-full rounded-full bg-[#d9ed55] font-black text-[#180e16] hover:bg-[#d9ed55]">
                <Copy className="size-4" /> {copiedCode === sentReservation.code ? 'Código copiado' : 'Copiar código'}
              </Button>
            </div>
            <p className="mt-4 text-sm text-[#d9c4cf]">
              Reserva para <strong className="text-[#fff7ea]">{sentReservation.date.split('-').reverse().join('/')}</strong> às <strong className="text-[#fff7ea]">{sentReservation.time}</strong> · {sentReservation.people} {sentReservation.people === 1 ? 'pessoa' : 'pessoas'}.
            </p>
            <Button
              className="mt-6 rounded-full bg-[#c13a43] text-white"
              nativeButton={false}
              render={<a href="/" />}
            >
              Voltar ao início
            </Button>
          </section>
        ) : (
          <>
          {cachedReservation && (
            <section className="mt-8 rounded-[24px] border border-[#d9b66f]/50 bg-[#fff7ea] p-5 text-[#180e16]">
              <div className="flex items-start gap-3">
                <KeyRound className="mt-0.5 size-5 shrink-0 text-[#8c234f]" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-black uppercase tracking-[.16em] text-[#8c234f]">Salvo neste dispositivo</p>
                  <h2 className="mt-1 text-lg font-black">Sua última reserva</h2>
                  <code className="mt-2 block break-all text-sm font-black tracking-[.08em] text-[#8c234f]">{cachedReservation.code}</code>
                  <p className="mt-2 text-sm text-[#765665]">{cachedReservation.date.split('-').reverse().join('/')} às {cachedReservation.time} · {cachedReservation.people} {cachedReservation.people === 1 ? 'pessoa' : 'pessoas'}</p>
                </div>
                <Button type="button" variant="outline" onClick={() => void copyCode(cachedReservation.code)} className="shrink-0 rounded-full border-[#8c234f]/25 text-[#8c234f]">
                  <Copy className="size-4" /> {copiedCode === cachedReservation.code ? 'Copiado' : 'Copiar'}
                </Button>
              </div>
            </section>
          )}
          <form
            onSubmit={submit}
            noValidate
            className="mt-8 space-y-5 rounded-[28px] bg-[#28121f] p-5 sm:p-8"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nome" name="name" required error={fieldErrors.name} />
              <Field label="WhatsApp" name="whatsapp" type="tel" required error={fieldErrors.whatsapp} />
              <Field
                label="Data"
                name="date"
                type="date"
                required
                min={RESERVATION_MIN_DATE}
                max={RESERVATION_MAX_DATE}
                error={fieldErrors.date}
              />
              <Field label="Horário" name="time" type="time" required error={fieldErrors.time} />
              <Field
                label="Pessoas"
                name="people"
                type="number"
                min="1"
                max="30"
                defaultValue="2"
                required
                error={fieldErrors.people}
              />
            </div>
            <label className="block text-sm font-bold">
              Observação
              <textarea
                name="notes"
                maxLength={500}
                aria-invalid={Boolean(fieldErrors.notes)}
                aria-describedby={fieldErrors.notes ? 'reservation-notes-error' : undefined}
                className="mt-2 min-h-28 w-full rounded-2xl border border-white/15 bg-[#180e16] p-4 font-normal text-[#fff7ea] outline-none focus:border-[#d9b66f]"
                placeholder="Alguma informação importante?"
              />
              {fieldErrors.notes && <span id="reservation-notes-error" className="mt-1 block text-xs font-bold text-[#ffb4b4]">{fieldErrors.notes}</span>}
            </label>
            {development && (
              <p className="rounded-xl border border-[#d9b66f]/30 bg-[#180e16] p-3 text-xs text-[#d9b66f]">
                Ambiente de desenvolvimento: a solicitação exige os emuladores
                Firebase.
              </p>
            )}
            {error && (
              <div
                role="alert"
                aria-live="assertive"
                className="flex items-start gap-3 rounded-2xl border border-[#ff8e8e]/35 bg-[#4b1523] p-4 text-sm text-[#ffe1e1]"
              >
                <AlertCircle className="mt-0.5 size-5 shrink-0 text-[#ffb4b4]" />
                <div>
                  <strong className="block text-[#fff7ea]">Não foi possível enviar</strong>
                  <span>{error}</span>
                  {Object.values(fieldErrors).length > 0 && (
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-[#ffcaca]">
                      {Object.values(fieldErrors).map((message) => <li key={message}>{message}</li>)}
                    </ul>
                  )}
                </div>
              </div>
            )}
            <Button
              type="submit"
              disabled={busy}
              className="h-12 w-full rounded-full bg-[#c13a43] font-black text-white hover:bg-[#c13a43]"
            >
              {busy ? (
                <>
                  <Loader2 className="animate-spin" /> Enviando…
                </>
              ) : (
                <>
                  <CalendarDays /> Solicitar reserva
                </>
              )}
            </Button>
          </form>
          </>
        )}
      </div>
    </main>
  );
}

function Field(
  props: React.InputHTMLAttributes<HTMLInputElement> & {
    label: string;
    name: string;
    error?: string;
  },
) {
  const { label, name, error, ...input } = props;
  const id = `reservation-${name}`;
  return (
    <label className="block text-sm font-bold">
      {label}
      <input
        id={id}
        name={name}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        {...input}
        className={`mt-2 h-12 w-full rounded-2xl border bg-[#180e16] px-4 font-normal text-[#fff7ea] outline-none focus:border-[#d9b66f] ${error ? 'border-[#ff8e8e]' : 'border-white/15'}`}
      />
      {error && <span id={`${id}-error`} className="mt-1 block text-xs font-bold text-[#ffb4b4]">{error}</span>}
    </label>
  );
}
