'use client';

import {
  addDoc,
  collection,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { ArrowRight, Loader2, ShoppingBag } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import { AdminShell } from '@/components/admin-shell';
import { useCatalog } from '@/components/providers';
import { Button } from '@/components/ui/button';
import {
  ensureAnonymousUser,
  getFirebaseClient,
  hasFirebaseConfig,
} from '@/lib/firebase/client';
import { calculateItemPrice, formatBRL } from '@/shared/domain';

export default function PosPage() {
  const { catalog, config } = useCatalog();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setResult('');
    const data = new FormData(event.currentTarget);
    const product = catalog.products.find(
      (candidate) => candidate.id === String(data.get('productId')),
    );
    const size = product?.sizes.find((candidate) => candidate.active);
    if (!product || !size) {
      setError('Cadastre um produto ativo antes de abrir o PDV.');
      setBusy(false);
      return;
    }
    const payload = {
      clientRequestId: crypto.randomUUID(),
      source: 'TABLET' as const,
      unitId: config.defaultUnitId,
      customer: {
        name: String(data.get('name') || 'Cliente balcão'),
        whatsapp: String(data.get('whatsapp') || '').trim(),
      },
      items: [
        {
          cartItemId: 'pdv',
          productId: product.id,
          sizeId: size.id,
          quantity: Number(data.get('quantity')),
          selections: [],
        },
      ],
      fulfillment: {
        mode: String(data.get('fulfillment')) as 'PICKUP' | 'DELIVERY',
      },
      payment: {
        method: String(data.get('payment')) as 'PIX' | 'CARD' | 'CASH',
        needsChange: false,
      },
      notes: String(data.get('notes') || '') || undefined,
    };
    try {
      if (!hasFirebaseConfig) throw new Error('Firebase não configurado.');
      const { db } = getFirebaseClient();
      const user = await ensureAnonymousUser();
      const priced = calculateItemPrice(payload.items[0], catalog);
      const publicCode = payload.clientRequestId.replace(/-/g, '');
      const orderNumber = `#T${publicCode.slice(0, 8).toUpperCase()}`;
      await addDoc(collection(db, 'orders'), {
        brandId: 'teiko',
        ownerUid: user.uid,
        ...payload,
        publicCode,
        orderNumber,
        notes: payload.notes ?? '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        items: [priced],
        pricing: {
          subtotalCents: priced.totalPriceCents,
          deliveryFeeCents: 0,
          totalCents: priced.totalPriceCents,
          currency: 'BRL',
          quoteType: 'CLIENT_PREVIEW',
        },
        status: 'NEW',
        customerApproval: 'NONE',
        statusHistory: [
          { status: 'NEW', at: Timestamp.now(), actor: user.uid },
        ],
      });
      setResult(`${orderNumber} criado · ${formatBRL(priced.totalPriceCents)}`);
      (event.target as HTMLFormElement).reset();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message.replace(/^FirebaseError:\s*/, '')
          : 'Não foi possível criar o pedido.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <AdminShell>
      <div>
        <p className="text-xs font-black uppercase tracking-[.18em] text-[#e3262e]">
          Atendimento interno
        </p>
        <h1 className="mt-2 flex items-center gap-3 text-3xl font-black">
          <ShoppingBag className="size-8" /> PDV
        </h1>
        <p className="mt-2 text-sm text-[#7b887d]">
          Crie um pedido de balcão usando o mesmo domínio do canal público.
        </p>
      </div>
      <form
        onSubmit={submit}
        className="mt-7 max-w-3xl rounded-[28px] bg-white p-5 shadow-sm sm:p-8"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Cliente" name="name" placeholder="Cliente balcão" />
          <Field
            label="WhatsApp (opcional)"
            name="whatsapp"
            placeholder="(17) 99999-9999"
          />
          <label className="block text-sm font-bold">
            Produto
            <select
              name="productId"
              required
              className="mt-2 h-12 w-full rounded-2xl border px-4 font-normal"
            >
              {catalog.products
                .filter((product) => product.active)
                .map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
            </select>
          </label>
          <Field
            label="Quantidade"
            name="quantity"
            type="number"
            min="1"
            max="20"
            defaultValue="1"
            required
          />
          <label className="block text-sm font-bold">
            Modalidade
            <select
              name="fulfillment"
              className="mt-2 h-12 w-full rounded-2xl border px-4 font-normal"
            >
              <option value="PICKUP">Balcão / retirada</option>
              <option value="DELIVERY">Delivery</option>
            </select>
          </label>
          <label className="block text-sm font-bold">
            Pagamento
            <select
              name="payment"
              className="mt-2 h-12 w-full rounded-2xl border px-4 font-normal"
            >
              <option value="PIX">Pix</option>
              <option value="CARD">Cartão presencial</option>
              <option value="CASH">Dinheiro</option>
            </select>
          </label>
        </div>
        <label className="mt-4 block text-sm font-bold">
          Observação
          <textarea
            name="notes"
            maxLength={500}
            className="mt-2 min-h-24 w-full rounded-2xl border p-4 font-normal"
          />
        </label>
        {error && (
          <p
            role="alert"
            className="mt-4 rounded-xl bg-[#e8efe5] p-3 text-sm text-[#e3262e]"
          >
            {error}
          </p>
        )}
        {result && (
          <p
            role="status"
            className="mt-4 rounded-xl bg-[#d6e7bf]/25 p-3 text-sm text-[#3a5b35]"
          >
            {result}
          </p>
        )}
        <Button
          type="submit"
          disabled={busy || !catalog.products.length}
          className="mt-6 h-12 rounded-full bg-[#070a08] px-6 font-black text-white"
        >
          {busy ? <Loader2 className="animate-spin" /> : <ArrowRight />} Criar
          pedido
        </Button>
      </form>
    </AdminShell>
  );
}

function Field(
  props: React.InputHTMLAttributes<HTMLInputElement> & {
    label: string;
    name: string;
  },
) {
  const { label, name, ...input } = props;
  return (
    <label className="block text-sm font-bold">
      {label}
      <input
        name={name}
        {...input}
        className="mt-2 h-12 w-full rounded-2xl border px-4 font-normal outline-none focus:border-[#e3262e]"
      />
    </label>
  );
}
