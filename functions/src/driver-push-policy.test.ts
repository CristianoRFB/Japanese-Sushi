import { describe, expect, it } from 'vitest';
import { driverPushTokenId, isPushAssignment, safeDeliveryPushData, validFcmToken } from './driver-push-policy.js';

describe('Web Push seguro para motoboy', () => {
  it('só emite em atribuição nova', () => {
    expect(isPushAssignment(null, { status: 'ASSIGNED', driverId: 'a' })).toBe(true);
    expect(isPushAssignment({ status: 'READY_FOR_DELIVERY' }, { status: 'ASSIGNED', driverId: 'a' })).toBe(true);
    expect(isPushAssignment({ status: 'ASSIGNED', driverId: 'a' }, { status: 'ASSIGNED', driverId: 'b' })).toBe(true);
    expect(isPushAssignment({ status: 'ASSIGNED', driverId: 'a' }, { status: 'ASSIGNED', driverId: 'a' })).toBe(false);
    expect(isPushAssignment({ status: 'ASSIGNED', driverId: 'a' }, { status: 'ACCEPTED', driverId: 'a' })).toBe(false);
  });
  it('não deixa PII nem segredo no payload', () => {
    const payload = safeDeliveryPushData('delivery-abc');
    expect(payload.link).toBe('/entregador?entrega=delivery-abc');
    expect(JSON.stringify(payload)).not.toMatch(/cliente|endereço|pagamento|código/i);
  });
  it('valida formato e usa hash estável para tokens', () => {
    const token = 'abcde:'.repeat(15);
    expect(validFcmToken(token)).toBe(true);
    expect(validFcmToken('a')).toBe(false);
    expect(validFcmToken('abc '.repeat(20))).toBe(false);
    expect(driverPushTokenId(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(driverPushTokenId(token)).toBe(driverPushTokenId(token));
  });
});
