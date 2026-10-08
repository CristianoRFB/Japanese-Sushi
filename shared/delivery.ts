export type DeliveryStatus =
  | 'READY_FOR_DELIVERY'
  | 'ASSIGNED'
  | 'ACCEPTED'
  | 'PICKED_UP'
  | 'ON_THE_WAY'
  | 'ARRIVED'
  | 'DELIVERED'
  | 'DELIVERY_FAILED'
  | 'CANCELLED';

export type DeliveryDriverStatus = 'AVAILABLE' | 'BUSY' | 'OFFLINE' | 'INACTIVE';

export const DELIVERY_TRANSITIONS: Record<DeliveryStatus, DeliveryStatus[]> = {
  READY_FOR_DELIVERY: ['ASSIGNED', 'CANCELLED'],
  ASSIGNED: ['ACCEPTED', 'READY_FOR_DELIVERY', 'CANCELLED'],
  ACCEPTED: ['PICKED_UP', 'CANCELLED'],
  PICKED_UP: ['ON_THE_WAY', 'DELIVERY_FAILED'],
  ON_THE_WAY: ['ARRIVED', 'DELIVERY_FAILED'],
  ARRIVED: ['DELIVERY_FAILED'],
  DELIVERED: [],
  DELIVERY_FAILED: ['READY_FOR_DELIVERY', 'CANCELLED'],
  CANCELLED: [],
};

export const deliveryStatusLabels: Record<DeliveryStatus, string> = {
  READY_FOR_DELIVERY: 'Aguardando motoboy',
  ASSIGNED: 'Aguardando aceite',
  ACCEPTED: 'Aceita pelo motoboy',
  PICKED_UP: 'Pedido retirado',
  ON_THE_WAY: 'Em rota',
  ARRIVED: 'Chegou ao endereço',
  DELIVERED: 'Entregue',
  DELIVERY_FAILED: 'Entrega não concluída',
  CANCELLED: 'Cancelada',
};

export const driverStatusLabels: Record<DeliveryDriverStatus, string> = {
  AVAILABLE: 'Disponível',
  BUSY: 'Em entrega',
  OFFLINE: 'Offline',
  INACTIVE: 'Acesso suspenso',
};

export const MAX_DELIVERY_CODE_ATTEMPTS = 5;

export interface DeliveryAddress {
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  reference?: string;
}

const addressTextPattern = /^[\p{L}\p{M}\p{N}\s.,;'’()/#ºª°-]+$/u;

export function validateDeliveryAddress(input: DeliveryAddress): Partial<Record<keyof DeliveryAddress, string>> {
  const errors: Partial<Record<keyof DeliveryAddress, string>> = {};
  const fields: Array<[keyof DeliveryAddress, number, number, boolean]> = [
    ['street', 3, 120, true], ['number', 1, 20, false], ['neighborhood', 2, 80, true],
    ['complement', 0, 80, false], ['reference', 0, 120, false],
  ];
  for (const [field, min, max, needsLetter] of fields) {
    const value = String(input[field] ?? '').trim();
    if (value.length < min || value.length > max) {
      errors[field] = field === 'street' ? 'Rua deve ter de 3 a 120 caracteres.' : field === 'number' ? 'Número deve ter até 20 caracteres.' : field === 'neighborhood' ? 'Bairro deve ter de 2 a 80 caracteres.' : field === 'complement' ? 'Complemento pode ter até 80 caracteres.' : 'Referência pode ter até 120 caracteres.';
    } else if (value && (/\p{Cc}/u.test(value) || !addressTextPattern.test(value) || (needsLetter && !/\p{L}/u.test(value)))) {
      errors[field] = 'Remova emojis e caracteres especiais não aceitos neste endereço.';
    }
  }
  return errors;
}

export function validateDeliveryFailureReason(value: string): boolean {
  const reason = value.trim();
  return reason.length >= 3 && reason.length <= 200 && !/\p{Cc}/u.test(reason);
}

export function isValidHumanName(value: string, maxLength = 80): boolean {
  const name = value.trim().replace(/\s+/g, ' ');
  return Array.from(name).length >= 2
    && Array.from(name).length <= maxLength
    && /\p{L}/u.test(name)
    && /^[\p{L}\p{M}\s'’.-]+$/u.test(name);
}

export interface DeliveryRecord {
  id: string;
  brandId: string;
  unitId: string;
  orderId: string;
  orderNumber: string;
  status: DeliveryStatus;
  driverId?: string;
  driverName?: string;
  customerName: string;
  customerWhatsapp?: string;
  address: DeliveryAddress;
  totalCents: number;
  paymentMethod: 'PIX' | 'CARD' | 'CASH';
  createdAt?: unknown;
  updatedAt?: unknown;
  assignedAt?: unknown;
  acceptedAt?: unknown;
  pickedUpAt?: unknown;
  startedAt?: unknown;
  arrivedAt?: unknown;
  deliveredAt?: unknown;
  failedAt?: unknown;
  failureReason?: string;
}

export type DeliveryEventRole = 'admin' | 'driver';

export interface DeliveryEvent {
  id: string;
  brandId: string;
  deliveryId: string;
  orderId: string;
  driverId?: string;
  fromStatus?: DeliveryStatus;
  toStatus: DeliveryStatus;
  kind: string;
  actorUid: string;
  actorRole: DeliveryEventRole;
  reason?: string;
  occurredAt?: unknown;
}

export interface DeliveryDriver {
  id: string;
  brandId: string;
  name: string;
  email: string;
  phone: string;
  status: DeliveryDriverStatus;
  enabled: boolean;
  currentDeliveryId?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface DeliveryReceiptRequest {
  id: string;
  brandId: string;
  deliveryId: string;
  orderId: string;
  driverId: string;
  codeHash: string;
  paymentConfirmed: boolean;
  status: 'PENDING' | 'VERIFIED' | 'REJECTED';
  attempts: number;
  locked: boolean;
  createdAt?: unknown;
  reviewedAt?: unknown;
  reviewedBy?: string;
}

export function canTransitionDelivery(from: DeliveryStatus, to: DeliveryStatus): boolean {
  return DELIVERY_TRANSITIONS[from]?.includes(to) ?? false;
}

export function validateDriverDraft(input: { name: string; phone: string; email: string; password: string }): Partial<Record<keyof typeof input, string>> {
  const errors: Partial<Record<keyof typeof input, string>> = {};
  if (!isValidHumanName(input.name)) errors.name = 'Informe um nome válido, entre 2 e 80 caracteres.';
  const digits = input.phone.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 13) errors.phone = 'Informe um telefone com DDD.';
  const email = input.email.trim();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) errors.email = 'Informe um e-mail válido.';
  if (input.password.length < 8 || input.password.length > 128 || /\p{Cc}/u.test(input.password)) errors.password = 'A senha deve ter de 8 a 128 caracteres válidos.';
  return errors;
}

export function isDeliveryCode(value: string): boolean {
  return /^\d{4}$/u.test(value);
}

export function maskDeliveryCode(value: string): string {
  return isDeliveryCode(value) ? `${value.slice(0, 2)}••` : '••••';
}
