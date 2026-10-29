import { validTenantSlug } from './tenancy.js';

export type TenantCartItem = { productId: string; quantity: number };
export type TenantCartProduct = {
  id: string; tenantId: string; name: string; active: boolean;
  productType?: string;
  sizes?: Array<{ id?: string; active?: boolean; basePriceCents: number }>;
  modifierGroupIds?: string[];
};

export function isSimpleTenantProduct(tenantId: string, product: TenantCartProduct): boolean {
  return validTenantSlug(product.id) && product.tenantId === tenantId &&
    product.active === true && product.productType === 'SIMPLE' &&
    Array.isArray(product.modifierGroupIds) && product.modifierGroupIds.length === 0 &&
    Array.isArray(product.sizes) && product.sizes.length === 1 &&
    product.sizes[0].active === true && Number.isSafeInteger(product.sizes[0].basePriceCents) &&
    product.sizes[0].basePriceCents > 0;
}

export function sanitizeTenantCart(value: unknown): TenantCartItem[] {
  if (!Array.isArray(value)) return [];
  const result: TenantCartItem[] = [];
  const seen = new Set<string>();
  for (const entry of value.slice(0, 30)) {
    const id = entry && typeof entry.productId === 'string' ? entry.productId : '';
    const quantity = entry?.quantity;
    if (!validTenantSlug(id) || seen.has(id) || !Number.isInteger(quantity) || quantity < 1 || quantity > 20)
      continue;
    seen.add(id);
    result.push({ productId: id, quantity });
  }
  return result;
}

export function changeTenantCart(cart: TenantCartItem[], id: string, delta: number): TenantCartItem[] {
  if (!validTenantSlug(id) || !Number.isInteger(delta) || ![-1, 1].includes(delta)) return cart;
  const current = sanitizeTenantCart(cart);
  const found = current.find(item => item.productId === id);
  if (!found) return delta === 1 && current.length < 30 ? [...current, { productId: id, quantity: 1 }] : current;
  const quantity = found.quantity + delta;
  if (quantity < 1) return current.filter(item => item.productId !== id);
  if (quantity > 20) return current;
  return current.map(item => item.productId === id ? { ...item, quantity } : item);
}

export function quoteTenantCart(
  tenantId: string, cart: TenantCartItem[], products: TenantCartProduct[],
): { items: TenantCartItem[]; totalCents: number; invalid: boolean } {
  const byId = new Map(products.map(item => [item.id, item]));
  let totalCents = 0;
  const valid: TenantCartItem[] = [];
  for (const item of sanitizeTenantCart(cart)) {
    const product = byId.get(item.productId);
    if (!product || !isSimpleTenantProduct(tenantId, product))
      return { items: [], totalCents: 0, invalid: true };
    totalCents += product.sizes![0].basePriceCents * item.quantity;
    if (!Number.isSafeInteger(totalCents) || totalCents > 10_000_000)
      return { items: [], totalCents: 0, invalid: true };
    valid.push(item);
  }
  return { items: valid, totalCents, invalid: valid.length !== cart.length };
}
