'use client';

import {
  ArrowLeft,
  Copy,
  Minus,
  Pencil,
  Plus,
  ShoppingBag,
  Trash2,
} from 'lucide-react';
import { useMemo } from 'react';

import { PublicHeader } from '@/components/public-header';
import { useCart, useCatalog } from '@/components/providers';
import { Button } from '@/components/ui/button';
import { calculateCartPreview, formatBRL } from '@/shared/domain';

export default function CartPage() {
  const cart = useCart();
  const { catalog } = useCatalog();
  const preview = useMemo(() => {
    try {
      return calculateCartPreview(cart.items, catalog);
    } catch {
      return { items: [], subtotalCents: 0 };
    }
  }, [cart.items, catalog]);
  const previewValid = cart.items.length === preview.items.length;
  if (!cart.items.length)
    return (
      <main className="min-h-screen bg-[#fff8ef]">
        <PublicHeader />
        <div className="mx-auto grid max-w-lg place-items-center px-6 py-24 text-center">
          <span className="grid size-20 place-items-center rounded-full bg-[#f8e9ef] text-[#8c234f]">
            <ShoppingBag className="size-8" />
          </span>
          <h1 className="mt-6 text-3xl font-black tracking-[-.04em]">
            Seu carrinho está vazio
          </h1>
          <p className="mt-2 text-sm text-[#765665]">
            Escolha um item do cardápio para revisar seu pedido.
          </p>
          <Button
            className="mt-6 h-12 rounded-full bg-[#8c234f] px-6 text-white"
            nativeButton={false}
            render={<a href="/" />}
          >
            Ver cardápio
          </Button>
        </div>
      </main>
    );
  return (
    <main className="min-h-screen bg-[#fff8ef] pb-32 text-[#180e16]">
      <PublicHeader />
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_360px]">
        <div>
          <a
            href="/"
            className="inline-flex items-center gap-2 text-sm font-bold text-[#8c234f]"
          >
            <ArrowLeft className="size-4" /> Continuar pedindo
          </a>
          <h1 className="mt-5 text-4xl font-black tracking-[-.05em]">
            Seu carrinho
          </h1>
          <p className="mt-2 text-sm text-[#765665]">
            Revise cada item antes de finalizar.
          </p>
          {!previewValid && (
            <p role="alert" className="mt-5 rounded-2xl border border-[#d9b66f] bg-[#fff7ea] p-4 text-sm font-bold text-[#765665]">
              Um item ficou indisponível ou ainda está sem preço oficial. Remova-o ou aguarde a unidade publicar o valor.
            </p>
          )}
          <div className="mt-7 space-y-4">
            {cart.items.map((draft, index) => {
              const priced =
                preview.items[index] ??
                (() => {
                  try {
                    return calculateCartPreview([draft], catalog).items[0];
                  } catch {
                    return null;
                  }
                })();
              const product = catalog.products.find(
                (candidate) => candidate.id === draft.productId,
              );
              return (
                <article
                  key={draft.cartItemId}
                  className="rounded-[26px] border border-[#8c234f]/10 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-start gap-4">
                    {product?.imageUrl && (
                      <img
                        src={product.imageUrl}
                        alt=""
                        className="size-20 rounded-[18px] object-cover"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <h2 className="text-lg font-black">
                        {priced?.productName ??
                          product?.name ??
                          'Item indisponível'}
                      </h2>
                      {!priced && (
                        <p className="mt-2 text-sm font-bold text-[#765665]">
                          Este item não pode ser finalizado enquanto o preço não estiver disponível.
                        </p>
                      )}
                      <p className="mt-1 text-sm font-bold text-[#8c234f]">
                        {priced?.sizeLabel}
                      </p>
                      <div className="mt-2 space-y-1 text-xs text-[#765665]">
                        {priced?.modifierSelections
                          .filter((group) => group.items.length)
                          .map((group) => (
                            <p key={group.groupId}>
                              <strong className="text-[#381726]">
                                {group.groupName}:
                              </strong>{' '}
                              {group.items
                                .map(
                                  (item) =>
                                    `${item.quantity > 1 ? `${item.quantity}x ` : ''}${item.name}`,
                                )
                                .join(', ')}
                            </p>
                          ))}
                      </div>
                      {draft.notes && (
                        <p className="mt-2 text-xs italic text-[#765665]">
                          “{draft.notes}”
                        </p>
                      )}
                    </div>
                    <strong className="shrink-0 text-lg font-black text-[#8c234f]">
                      {priced ? formatBRL(priced.totalPriceCents) : '—'}
                    </strong>
                  </div>
                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#8c234f]/8 pt-4">
                    <div className="flex items-center rounded-full bg-[#f8e9ef] p-1">
                      <button
                        onClick={() =>
                          cart.setQuantity(draft.cartItemId, draft.quantity - 1)
                        }
                        className="grid size-8 place-items-center rounded-full"
                        aria-label="Diminuir quantidade"
                      >
                        <Minus className="size-3.5" />
                      </button>
                      <span className="w-7 text-center text-sm font-black">
                        {draft.quantity}
                      </span>
                      <button
                        onClick={() =>
                          cart.setQuantity(draft.cartItemId, draft.quantity + 1)
                        }
                        className="grid size-8 place-items-center rounded-full bg-white shadow-sm"
                        aria-label="Aumentar quantidade"
                      >
                        <Plus className="size-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center gap-1">
                      <a
                        href={`/montar/${draft.productId}?edit=${draft.cartItemId}`}
                        className="grid size-9 place-items-center rounded-full text-[#765665] hover:bg-[#f8e9ef]"
                        aria-label="Editar item"
                      >
                        <Pencil className="size-4" />
                      </a>
                      <button
                        onClick={() => cart.duplicate(draft.cartItemId)}
                        className="grid size-9 place-items-center rounded-full text-[#765665] hover:bg-[#f8e9ef]"
                        aria-label="Pedir outro igual"
                      >
                        <Copy className="size-4" />
                      </button>
                      <button
                        onClick={() => cart.remove(draft.cartItemId)}
                        className="grid size-9 place-items-center rounded-full text-[#c13a43] hover:bg-[#f8e9ef]"
                        aria-label="Remover item"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
        <aside className="hidden lg:block">
          <Summary subtotal={preview.subtotalCents} valid={previewValid} />
        </aside>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#8c234f]/10 bg-white/95 p-3 shadow-[0_-12px_35px_rgba(53,25,36,.1)] backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <div className="flex-1">
            <span className="block text-xs text-[#765665]">Subtotal</span>
            <strong className="text-xl font-black text-[#8c234f]">
              {formatBRL(preview.subtotalCents)}
            </strong>
          </div>
          {previewValid ? (
            <Button
              className="h-12 rounded-full bg-[#8c234f] px-6 font-black text-white"
              nativeButton={false}
              render={<a href="/checkout" />}
            >
              Finalizar pedido
            </Button>
          ) : (
            <span className="text-right text-xs font-bold text-[#765665]">Revise os itens acima</span>
          )}
        </div>
      </div>
    </main>
  );
}

function Summary({ subtotal, valid }: { subtotal: number; valid: boolean }) {
  return (
    <div className="sticky top-26 rounded-[28px] bg-[#180e16] p-6 text-white">
      <h2 className="text-xl font-black">Resumo</h2>
      <div className="mt-5 flex justify-between text-sm text-white/70">
        <span>Subtotal</span>
        <strong className="text-white">{formatBRL(subtotal)}</strong>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-white/50">
        Taxa de entrega, quando aplicável, é informada no checkout e confirmada
        pela unidade antes do preparo.
      </p>
      {valid ? (
        <Button
          className="mt-6 h-12 w-full rounded-full bg-[#d9ed55] font-black text-[#180e16] hover:bg-[#d9ed55]"
          nativeButton={false}
          render={<a href="/checkout" />}
        >
          Finalizar pedido
        </Button>
      ) : (
        <p className="mt-6 text-sm font-bold text-[#f5dfb1]">Revise os itens antes de finalizar.</p>
      )}
    </div>
  );
}
