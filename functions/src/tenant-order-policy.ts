import { z } from 'zod';
import { validTenantSlug } from '../../shared/tenancy.js';

export const tenantPickupSchema = z.object({
  tenantId: z.string().refine(validTenantSlug),
  clientRequestId: z.uuid(),
  customerName: z.string().trim().min(2).max(80),
  clientPreviewTotalCents: z.number().int().min(1).max(10_000_000),
  items: z.array(z.object({
    productId: z.string().refine(validTenantSlug),
    sizeId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(64).optional(),
    quantity: z.number().int().min(1).max(20),
  }).strict()).min(1).max(30),
}).strict();

export interface PickupItem {
  productId: string;
  name: string;
  sizeId: string;
  sizeLabel: string;
  quantity: number;
  unitPriceCents: number;
  totalPriceCents: number;
}

export function priceTenantPickup(
  tenantId: string,
  requested: Array<{ productId: string; quantity: number; sizeId?: string }>,
  products: Map<string, Record<string, unknown>>,
): { items: PickupItem[]; totalCents: number } {
  const items: PickupItem[] = [];
  let totalCents = 0;
  for (const item of requested) {
    const product = products.get(item.productId);
    const sizes = product?.sizes;
    const modifierGroups = product?.modifierGroupIds;
    if (product?.tenantId !== tenantId || product.active !== true ||
      !['SIMPLE', 'VARIANT'].includes(String(product.productType)) ||
      !Array.isArray(modifierGroups) || modifierGroups.length !== 0 ||
      !Array.isArray(sizes) || sizes.length < 1 || sizes.length > 20 ||
      typeof product.name !== 'string' || product.name.trim().length < 2) {
      throw new Error('Produto indisponível ou com opções não suportadas.');
    }
    // A variant must be selected explicitly; a legacy SIMPLE item with one
    // size can keep its existing payload without sizeId.
    const selected = item.sizeId
      ? sizes.find(s => s?.id === item.sizeId)
      : sizes.length === 1 ? sizes[0] : undefined;
    const price = selected?.basePriceCents;
    if (!selected || selected.active !== true || !Number.isSafeInteger(price) ||
      price < 1 || price > 10_000_000 || typeof selected.id !== 'string' ||
      typeof selected.label !== 'string' ||
      (product.productType === 'SIMPLE' && sizes.length !== 1)) {
      throw new Error('Tamanho inválido, indisponível ou preço incorreto.');
    }
    const lineTotal = price * item.quantity;
    if (!Number.isSafeInteger(lineTotal) || totalCents + lineTotal > 10_000_000)
      throw new Error('Valor total fora do limite permitido.');
    totalCents += lineTotal;
    items.push({
      productId: item.productId,
      name: product.name,
      sizeId: String(selected.id),
      sizeLabel: selected.label,
      quantity: item.quantity,
      unitPriceCents: price,
      totalPriceCents: lineTotal,
    });
  }
  return { items, totalCents };
}
