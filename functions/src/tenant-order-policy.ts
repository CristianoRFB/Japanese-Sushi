import { z } from 'zod';
import { validTenantSlug } from '../../shared/tenancy.js';

export const tenantPickupSchema = z.object({
  tenantId: z.string().refine(validTenantSlug),
  clientRequestId: z.uuid(),
  customerName: z.string().trim().min(2).max(80),
  clientPreviewTotalCents: z.number().int().min(1).max(10_000_000),
  items: z.array(z.object({
    productId: z.string().refine(validTenantSlug),
    quantity: z.number().int().min(1).max(20),
  }).strict()).min(1).max(30),
}).strict();

export interface PickupItem {
  productId: string;
  name: string;
  sizeId: string;
  quantity: number;
  unitPriceCents: number;
  totalPriceCents: number;
}

export function priceTenantPickup(
  tenantId: string,
  requested: Array<{ productId: string; quantity: number }>,
  products: Map<string, Record<string, unknown>>,
): { items: PickupItem[]; totalCents: number } {
  const items: PickupItem[] = [];
  let totalCents = 0;
  for (const item of requested) {
    const product = products.get(item.productId);
    const sizes = product?.sizes;
    const size = Array.isArray(sizes) && sizes.length === 1 ? sizes[0] : null;
    const groupIds = product?.modifierGroupIds;
    const price = size?.basePriceCents;
    if (product?.tenantId !== tenantId || product?.active !== true ||
      product?.productType !== 'SIMPLE' || !Array.isArray(groupIds) || groupIds.length !== 0 ||
      size?.active !== true || !Number.isSafeInteger(price) || price < 1 || price > 10_000_000 ||
      typeof product?.name !== 'string') {
      throw new Error('Produto indisponível ou com opções não suportadas.');
    }
    const lineTotal = price * item.quantity;
    if (!Number.isSafeInteger(lineTotal) || totalCents + lineTotal > 10_000_000)
      throw new Error('Valor total fora do limite permitido.');
    totalCents += lineTotal;
    items.push({
      productId: item.productId,
      name: product.name,
      sizeId: String(size.id),
      quantity: item.quantity,
      unitPriceCents: price,
      totalPriceCents: lineTotal,
    });
  }
  return { items, totalCents };
}
