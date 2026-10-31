import { createHash } from 'node:crypto';

export const PUSH_TOKEN_LIMIT = 5;

export function driverPushTokenId(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function validFcmToken(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 40 && value.length <= 4096
    && /^[A-Za-z0-9:._-]+$/.test(value);
}

export interface AssignmentSnapshot {
  status?: string;
  driverId?: string;
  brandId?: string;
  tenantId?: string;
}

export function isPushAssignment(before: AssignmentSnapshot | null, after: AssignmentSnapshot | null) {
  return Boolean(after?.status === 'ASSIGNED'
    && typeof after.driverId === 'string' && after.driverId.length > 0
    && (before?.status !== 'ASSIGNED' || before.driverId !== after.driverId));
}

export function safeDeliveryPushData(deliveryId: string) {
  // Never put personal data, addresses, prices or confirmation codes in a lock-screen notification.
  return {
    title: 'Nova corrida atribuída',
    body: 'Abra seu portal para conferir a solicitação.',
    link: '/entregador?entrega=' + encodeURIComponent(deliveryId),
  };
}
