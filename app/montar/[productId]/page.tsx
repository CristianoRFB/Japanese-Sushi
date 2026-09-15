'use client';

import { ArrowLeft, Check, ChevronLeft, ChevronRight, Minus, Plus, ShoppingBag, Sparkles } from 'lucide-react';
import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { useCart, useCatalog } from '@/components/providers';
import { Button } from '@/components/ui/button';
import { calculateItemPrice, calculateModifierCharges, formatBRL, getEffectiveGroupRules, type GroupSelection } from '@/shared/domain';

export default function ConfiguratorPage() {
  const { productId } = useParams<{ productId: string }>();
  const search = useSearchParams();
  const editId = search.get('edit');
  const { catalog, loading, development } = useCatalog();
  const cart = useCart();
  const product = catalog.products.find((candidate) => candidate.id === productId);
  const editing = editId ? cart.items.find((item) => item.cartItemId === editId) : undefined;
  const [sizeId, setSizeId] = useState('');
  const [selections, setSelections] = useState<GroupSelection[]>([]);
  const [notes, setNotes] = useState('');
  const [activeGroupId, setActiveGroupId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!product || sizeId) return;
    setSizeId(editing?.sizeId ?? product.sizes.filter((size) => size.active).sort((a, b) => a.displayOrder - b.displayOrder)[0]?.id ?? '');
    setSelections(editing?.selections ?? []);
    setNotes(editing?.notes ?? '');
  }, [product, editing, sizeId]);

  const size = product?.sizes.find((candidate) => candidate.id === sizeId);
  const priceAvailable = Boolean(size && size.basePriceCents > 0);
  const groups = useMemo(() => product?.modifierGroupIds
    .map((id) => catalog.groups.find((group) => group.id === id))
    .filter((group) => group && getEffectiveGroupRules(group, sizeId))
    .sort((a, b) => (a?.displayOrder ?? 0) - (b?.displayOrder ?? 0)) ?? [], [product, catalog.groups, sizeId]);
  const modifierMap = useMemo(() => new Map(catalog.modifiers.map((modifier) => [modifier.id, modifier])), [catalog.modifiers]);

  useEffect(() => {
    if (!groups.length) return;
    if (!groups.some((group) => group?.id === activeGroupId)) setActiveGroupId(groups[0]!.id);
  }, [groups, activeGroupId]);

  const activeIndex = Math.max(0, groups.findIndex((group) => group?.id === activeGroupId));
  const activeGroup = groups[activeIndex];
  const itemCount = selections.reduce((total, group) => total + group.items.reduce((sum, item) => sum + item.quantity, 0), 0);
  const preview = useMemo(() => {
    if (!size) return 0;
    let total = size.basePriceCents;
    let remainingGlobalQuota = size.includedModifiersCount ?? 0;
    for (const group of groups) {
      if (!group) continue;
      const selected = selections.find((entry) => entry.groupId === group.id)?.items ?? [];
      const charges = calculateModifierCharges(group, size, selected, modifierMap, remainingGlobalQuota);
      remainingGlobalQuota = charges.remainingGlobalQuota;
      total += charges.items.reduce((sum, item) => sum + item.totalChargeCents, 0);
    }
    return total;
  }, [groups, modifierMap, selections, size]);
  const summaryGroups = useMemo(() => groups.flatMap((group) => {
    if (!group) return [];
    const items = selections.find((entry) => entry.groupId === group.id)?.items ?? [];
    const names = items.flatMap((item) => {
      const modifier = modifierMap.get(item.modifierId);
      return modifier ? [`${modifier.name}${item.quantity > 1 ? ` ×${item.quantity}` : ''}`] : [];
    });
    return names.length ? [{ id: group.id, name: group.name, names }] : [];
  }), [groups, modifierMap, selections]);

  function quantityFor(groupId: string, modifierId: string) {
    return selections.find((group) => group.groupId === groupId)?.items.find((item) => item.modifierId === modifierId)?.quantity ?? 0;
  }

  function groupTotal(groupId: string) {
    return selections.find((entry) => entry.groupId === groupId)?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
  }

  function chooseSize(nextSizeId: string) {
    if (!product) return;
    const validGroups = new Set(product.modifierGroupIds.filter((id) => {
      const group = catalog.groups.find((candidate) => candidate.id === id);
      return group && getEffectiveGroupRules(group, nextSizeId);
    }));
    setSizeId(nextSizeId);
    setSelections((old) => old.filter((selection) => validGroups.has(selection.groupId)));
    setError('');
  }

  function change(groupId: string, modifierId: string, delta: number, groupMax: number, maxPerModifier: number, allowDuplicate: boolean) {
    setError('');
    setSelections((old) => {
      const group = old.find((entry) => entry.groupId === groupId) ?? { groupId, items: [] };
      const current = group.items.find((entry) => entry.modifierId === modifierId)?.quantity ?? 0;
      const total = group.items.reduce((sum, item) => sum + item.quantity, 0);
      const max = allowDuplicate ? maxPerModifier : 1;
      const next = Math.max(0, Math.min(max, current + delta, current + Math.max(0, groupMax - total)));
      const items = [...group.items.filter((item) => item.modifierId !== modifierId), ...(next ? [{ modifierId, quantity: next }] : [])];
      return [...old.filter((entry) => entry.groupId !== groupId), { groupId, items }];
    });
  }

  function submit() {
    if (!product || !sizeId) return;
    if (!priceAvailable) {
      setError('Este item ainda está sem preço oficial. A unidade precisa configurar o valor antes do pedido.');
      return;
    }
    const draft = { productId: product.id, sizeId, selections, quantity: editing?.quantity ?? 1, notes: notes.trim() || undefined };
    try {
      calculateItemPrice({ ...draft, cartItemId: editId ?? 'validate' }, catalog);
      if (editId) cart.update(editId, draft); else cart.add(draft);
      window.location.href = '/carrinho';
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Revise suas escolhas.';
      setError(message);
      const missingGroup = groups.find((group) => group && message.includes(group.name));
      if (missingGroup) setActiveGroupId(missingGroup.id);
    }
  }

  if (loading) return <main className="grid min-h-screen place-items-center bg-[#fff8ef]"><p>Carregando cardápio…</p></main>;
  if (!product) return <main className="grid min-h-screen place-items-center bg-[#fff8ef] p-6 text-center"><div><h1 className="text-2xl font-black">Produto não encontrado</h1><a className="mt-4 inline-block text-[#8c234f] underline" href="/">Voltar ao cardápio</a></div></main>;

  return <main className="min-h-screen bg-[#fff8ef] pb-28 text-[#180e16] lg:pb-12">
    <header className="sticky top-0 z-30 border-b border-[#8c234f]/10 bg-[#fff8ef]/94 backdrop-blur-xl">
      <div className="mx-auto flex h-18 max-w-6xl items-center justify-between px-4 sm:px-6">
        <a className="grid size-10 place-items-center rounded-full bg-white shadow-sm" href="/" aria-label="Voltar"><ArrowLeft className="size-5" /></a>
        <div className="text-center"><strong className="block text-sm">Monte seu pedido</strong><span className="text-xs text-[#765665]">{product.name}</span></div>
        <a className="relative grid size-10 place-items-center rounded-full bg-[#180e16] text-white" href="/carrinho" aria-label="Ir para o carrinho"><ShoppingBag className="size-4" /></a>
      </div>
    </header>

    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:py-10">
      <div>
        <div className="overflow-hidden rounded-[28px] bg-[#381726] text-white">
          <div className="grid grid-cols-[1fr_120px] items-center gap-3 p-6 sm:grid-cols-[1fr_180px]">
            <div><span className="text-xs font-bold uppercase tracking-[.16em] text-[#d9b66f]">Do seu jeito</span><h1 className="mt-2 text-3xl font-black tracking-[-.04em]">{product.name}</h1><p className="mt-2 text-sm leading-relaxed text-white/70">{product.description}</p>{development && <span className="mt-3 inline-block rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold">DESENVOLVIMENTO</span>}</div>
            {product.imageUrl && <img className="aspect-square w-full rounded-[22px] object-cover" src={product.imageUrl} alt="Imagem do produto" />}
          </div>
        </div>

        <section className="mt-6">
          <div className="flex items-baseline justify-between"><div><p className="text-xs font-extrabold uppercase tracking-[.16em] text-[#b13b6b]">Passo 1</p><h2 className="mt-1 text-xl font-black">Escolha o tamanho</h2></div><span className="text-xs font-bold text-[#765665]">Obrigatório</span></div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">{product.sizes.filter((candidate) => candidate.active).sort((a, b) => a.displayOrder - b.displayOrder).map((candidate) => <button type="button" key={candidate.id} onClick={() => chooseSize(candidate.id)} className={`min-h-24 rounded-[22px] border-2 p-4 text-left transition ${sizeId === candidate.id ? 'border-[#8c234f] bg-[#f8e9ef] shadow-[0_8px_20px_rgba(130,32,79,.12)]' : 'border-transparent bg-white shadow-sm'}`}><span className="block text-lg font-black">{candidate.label}</span><span className="mt-1 block text-sm font-bold text-[#8c234f]">{candidate.basePriceCents > 0 ? formatBRL(candidate.basePriceCents) : 'Preço a confirmar'}</span>{candidate.includedModifiersCount !== undefined && <span className="mt-2 block text-[11px] text-[#765665]">{candidate.includedModifiersCount} {candidate.includedModifiersCount === 1 ? 'item incluído' : 'itens incluídos'}</span>}</button>)}</div>
        </section>

        {groups.length > 0 && <section className="mt-9 border-t border-[#8c234f]/10 pt-7">
          <div className="flex items-end justify-between gap-4"><div><p className="text-xs font-extrabold uppercase tracking-[.16em] text-[#b13b6b]">Passo {activeIndex + 2}</p><h2 className="mt-1 text-xl font-black">Crie sua combinação</h2><p className="mt-1 text-sm text-[#765665]">Avance pelas categorias e acompanhe o preço em tempo real.</p></div><strong className="shrink-0 text-sm text-[#8c234f]">{activeIndex + 1}/{groups.length}</strong></div>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#ead9e1]"><div className="h-full rounded-full bg-[#8c234f] transition-all" style={{ width: `${((activeIndex + 1) / groups.length) * 100}%` }} /></div>
          <div className="teiko-scrollbar-none -mx-4 mt-4 flex snap-x gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0" aria-label="Etapas de personalização">
            {groups.map((group, index) => { if (!group) return null; const total = groupTotal(group.id); const ready = total >= group.minSelections && (!group.required || total > 0); return <button type="button" key={group.id} onClick={() => { setActiveGroupId(group.id); setError(''); }} aria-current={activeGroupId === group.id ? 'step' : undefined} className={`flex shrink-0 snap-start items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-black transition ${activeGroupId === group.id ? 'border-[#8c234f] bg-[#8c234f] text-white' : 'border-[#8c234f]/12 bg-white text-[#765665]'}`}><span className={`grid size-5 place-items-center rounded-full text-[10px] ${ready && total ? 'bg-[#d9ed55] text-[#180e16]' : 'bg-current/10'}`}>{ready && total ? <Check className="size-3" /> : index + 1}</span>{group.name}{total > 0 && <span className="rounded-full bg-white/20 px-1.5 py-0.5">{total}</span>}</button>; })}
          </div>

          {activeGroup && <div className="mt-4 rounded-[26px] border border-[#8c234f]/10 bg-white p-4 shadow-sm sm:p-6">
            <div className="flex items-start justify-between gap-4"><div><h3 className="text-xl font-black">{activeGroup.name}</h3><p className="mt-1 text-sm text-[#765665]">{activeGroup.description || (activeGroup.required ? `Escolha de ${activeGroup.minSelections} a ${activeGroup.maxSelections}` : `Opcional • escolha até ${activeGroup.maxSelections}`)}{activeGroup.freeIncludedCount !== undefined ? ` • ${activeGroup.freeIncludedCount} incluído(s)` : ''}</p></div><span className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${groupTotal(activeGroup.id) >= activeGroup.minSelections && groupTotal(activeGroup.id) <= activeGroup.maxSelections ? 'bg-[#d9ed55]/25 text-[#65741f]' : 'bg-[#f8e9ef] text-[#8c234f]'}`}>{groupTotal(activeGroup.id)}/{activeGroup.maxSelections}</span></div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">{activeGroup.modifierIds.map((modifierId) => modifierMap.get(modifierId)).filter(Boolean).sort((a, b) => (a?.displayOrder ?? 0) - (b?.displayOrder ?? 0)).map((modifier) => { if (!modifier) return null; const quantity = quantityFor(activeGroup.id, modifier.id); const max = Math.min(activeGroup.maxPerModifier ?? 99, modifier.maxQuantity ?? 99); const priceLabel = !modifier.available ? 'Indisponível hoje' : modifier.premium ? `Acréscimo de ${formatBRL(modifier.priceCents)}` : !modifier.priceCents ? 'Sem acréscimo' : activeGroup.pricingMode === 'individual' ? `+${formatBRL(modifier.priceCents)} por unidade` : `Dentro da cota; extra +${formatBRL(modifier.priceCents)}`; return <div key={modifier.id} className={`flex min-h-20 items-center gap-3 rounded-[20px] border p-3.5 ${quantity ? 'border-[#8c234f]/40 bg-[#f8e9ef]' : 'border-[#8c234f]/8 bg-[#fff8ef]'} ${!modifier.available ? 'opacity-55' : ''}`}><button type="button" disabled={!modifier.available} onClick={() => change(activeGroup.id, modifier.id, quantity ? -quantity : 1, activeGroup.maxSelections, max, activeGroup.allowDuplicate)} className="flex min-w-0 flex-1 items-center gap-3 text-left"><span className={`grid size-7 shrink-0 place-items-center rounded-full border-2 ${quantity ? 'border-[#8c234f] bg-[#8c234f] text-white' : 'border-[#ead9e1]'}`}>{quantity ? <Check className="size-4" /> : null}</span><span className="min-w-0"><strong className="block truncate text-sm">{modifier.name}</strong><span className="mt-0.5 block text-xs text-[#765665]">{priceLabel}</span></span></button>{activeGroup.allowDuplicate && modifier.available && <div className="flex items-center rounded-full bg-white p-1 shadow-sm"><button type="button" className="grid size-8 place-items-center rounded-full disabled:opacity-30" disabled={!quantity} onClick={() => change(activeGroup.id, modifier.id, -1, activeGroup.maxSelections, max, true)} aria-label={`Remover ${modifier.name}`}><Minus className="size-3.5" /></button><span className="w-5 text-center text-sm font-black">{quantity}</span><button type="button" className="grid size-8 place-items-center rounded-full bg-[#180e16] text-white disabled:opacity-30" disabled={quantity >= max || groupTotal(activeGroup.id) >= activeGroup.maxSelections} onClick={() => change(activeGroup.id, modifier.id, 1, activeGroup.maxSelections, max, true)} aria-label={`Adicionar ${modifier.name}`}><Plus className="size-3.5" /></button></div>}</div>; })}</div>
            <div className="mt-5 flex items-center justify-between border-t border-[#8c234f]/8 pt-4"><Button type="button" variant="outline" disabled={activeIndex === 0} onClick={() => setActiveGroupId(groups[activeIndex - 1]!.id)} className="rounded-full"><ChevronLeft className="size-4" /> Anterior</Button>{activeIndex < groups.length - 1 ? <Button type="button" onClick={() => setActiveGroupId(groups[activeIndex + 1]!.id)} className="rounded-full bg-[#180e16] text-white">Próxima categoria <ChevronRight className="size-4" /></Button> : <span className="flex items-center gap-1 text-xs font-black text-[#65741f]"><Check className="size-4" /> Última categoria</span>}</div>
          </div>}
        </section>}

        <section className="mt-9 border-t border-[#8c234f]/10 pt-7"><label htmlFor="notes" className="text-xl font-black">Alguma observação?</label><textarea id="notes" maxLength={300} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Ex.: colocar a calda separada" className="mt-3 min-h-24 w-full rounded-[20px] border border-[#8c234f]/15 bg-white p-4 text-sm outline-none focus:border-[#8c234f]" /><p className="mt-1 text-right text-xs text-[#765665]">{notes.length}/300</p></section>
      </div>

      <aside className="hidden lg:block"><div className="sticky top-26 rounded-[28px] bg-[#180e16] p-6 text-white shadow-[0_24px_50px_rgba(53,25,36,.18)]"><Sparkles className="size-6 text-[#d9ed55]" /><h2 className="mt-4 text-2xl font-black">Sua combinação</h2><p className="mt-1 text-sm text-white/60">{size?.label ?? 'Escolha um tamanho'} • {itemCount} {itemCount === 1 ? 'item' : 'itens'}</p>{summaryGroups.length > 0 && <div className="mt-5 max-h-52 space-y-3 overflow-y-auto pr-1">{summaryGroups.map((group) => <div key={group.id}><strong className="block text-xs text-[#d9ed55]">{group.name}</strong><span className="mt-0.5 block text-xs leading-relaxed text-white/70">{group.names.join(', ')}</span></div>)}</div>}<strong className="mt-6 block text-3xl font-black text-[#d9b66f]">{priceAvailable ? formatBRL(preview) : 'Preço a confirmar'}</strong><span className="text-xs text-white/50">{priceAvailable ? 'Preço atualizado a cada escolha' : 'A unidade ainda não publicou este valor'}</span>{error && <p role="alert" className="mt-4 rounded-xl bg-[#c13a43]/15 p-3 text-sm text-[#ffe1e1]">{error}</p>}<Button onClick={submit} disabled={!priceAvailable} className="mt-5 h-12 w-full rounded-full bg-[#d9ed55] font-black text-[#180e16] hover:bg-[#d9ed55] disabled:bg-white/15 disabled:text-white/55">{editId ? 'Salvar alterações' : priceAvailable ? 'Adicionar ao carrinho' : 'Preço pendente'} <ChevronRight className="size-4" /></Button></div></aside>
    </div>

    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#8c234f]/10 bg-white/95 p-3 shadow-[0_-12px_35px_rgba(53,25,36,.1)] backdrop-blur-xl lg:hidden"><div className="mx-auto flex max-w-lg items-center gap-3"><div className="min-w-0 flex-1"><strong className="block truncate text-sm">{size?.label ?? 'Escolha um tamanho'} • {itemCount} itens</strong><span className="text-lg font-black text-[#8c234f]">{priceAvailable ? formatBRL(preview) : 'Preço a confirmar'}</span></div><Button onClick={submit} disabled={!priceAvailable} className="h-12 rounded-full bg-[#8c234f] px-5 font-black text-white disabled:bg-[#ead9e1] disabled:text-[#765665]">{editId ? 'Salvar' : priceAvailable ? 'Adicionar' : 'Indisponível'} <ChevronRight className="size-4" /></Button></div>{error && <p role="alert" className="mx-auto mt-2 max-w-lg text-xs font-bold text-[#c13a43]">{error}</p>}</div>
  </main>;
}
