import { validTenantSlug } from './tenancy.js';

export type TenantCartItem = { productId: string; sizeId?: string; quantity: number };
export type TenantCartProduct = {
  id: string; tenantId: string; name: string; active: boolean;
  productType?: string;
  sizes?: Array<{ id?: string; label?: string; active?: boolean; basePriceCents: number }>;
  modifierGroupIds?: string[];
};
const validSize = (value: string) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= 64;
const key = (item: TenantCartItem) => item.productId + ':' + (item.sizeId ?? '');

export function orderableTenantSizes(tenantId: string, product: TenantCartProduct) {
  if (!validTenantSlug(product.id) || product.tenantId !== tenantId ||
    product.active !== true || !['SIMPLE', 'VARIANT'].includes(product.productType ?? '') ||
    !Array.isArray(product.modifierGroupIds) || product.modifierGroupIds.length !== 0 ||
    !Array.isArray(product.sizes) || product.sizes.length < 1 || product.sizes.length > 20 ||
    (product.productType === 'SIMPLE' && product.sizes.length !== 1)) return [];
  const ids = new Set<string>();
  for (const size of product.sizes) {
    if (!size.id || !validSize(size.id) || ids.has(size.id) ||
      !Number.isSafeInteger(size.basePriceCents) || size.basePriceCents < 1 ||
      size.basePriceCents > 10_000_000) return [];
    ids.add(size.id);
  }
  return product.sizes.filter(x => x.active === true);
}

export function isSimpleTenantProduct(tenantId: string, product: TenantCartProduct): boolean {
  return product.productType === 'SIMPLE' && orderableTenantSizes(tenantId, product).length === 1;
}
export function sanitizeTenantCart(value: unknown): TenantCartItem[] {
  if (!Array.isArray(value)) return [];
  const result: TenantCartItem[] = [], seen = new Set<string>();
  for (const entry of value.slice(0, 30)) {
    const id = entry && typeof entry.productId === 'string' ? entry.productId : '';
    const sizeId = typeof entry?.sizeId === 'string' ? entry.sizeId : undefined;
    const quantity = entry?.quantity;
    if (!validTenantSlug(id) || (sizeId !== undefined && !validSize(sizeId)) ||
      !Number.isInteger(quantity) || quantity < 1 || quantity > 20) continue;
    const item = sizeId ? { productId: id, sizeId, quantity } : { productId: id, quantity };
    if (seen.has(key(item))) continue;
    seen.add(key(item)); result.push(item);
  }
  return result;
}
export function changeTenantCart(
  cart: TenantCartItem[], id: string, delta: number, sizeId?: string,
): TenantCartItem[] {
  if (!validTenantSlug(id) || (sizeId !== undefined && !validSize(sizeId)) ||
    !Number.isInteger(delta) || ![-1, 1].includes(delta)) return cart;
  const current = sanitizeTenantCart(cart);
  const desired = sizeId ? { productId: id, sizeId, quantity: 1 } : { productId: id, quantity: 1 };
  const found = current.find(item => key(item) === key(desired));
  if (!found) return delta === 1 && current.length < 30 ? [...current, desired] : current;
  const quantity = found.quantity + delta;
  if (quantity < 1) return current.filter(item => key(item) !== key(desired));
  if (quantity > 20) return current;
  return current.map(item => key(item) === key(desired) ? { ...item, quantity } : item);
}
export function quoteTenantCart(
  tenantId: string, cart: TenantCartItem[], products: TenantCartProduct[],
): { items: TenantCartItem[]; totalCents: number; invalid: boolean } {
  const byId = new Map(products.map(item => [item.id, item]));
  let totalCents = 0;
  const valid: TenantCartItem[] = [];
  for (const item of sanitizeTenantCart(cart)) {
    const product = byId.get(item.productId);
    const sizes = product && orderableTenantSizes(tenantId, product);
    const selected = item.sizeId
      ? sizes?.find(size => size.id === item.sizeId)
      : sizes?.length === 1 ? sizes[0] : undefined;
    if (!selected || !Number.isSafeInteger(selected.basePriceCents))
      return { items: [], totalCents: 0, invalid: true };
    totalCents += selected.basePriceCents * item.quantity;
    if (!Number.isSafeInteger(totalCents) || totalCents > 10_000_000)
      return { items: [], totalCents: 0, invalid: true };
    valid.push(item);
  }
  return { items: valid, totalCents, invalid: valid.length !== cart.length };
}
