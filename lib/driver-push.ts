'use client';

import { deleteToken, getMessaging, getToken, isSupported } from 'firebase/messaging';
import { httpsCallable } from 'firebase/functions';
import { getFirebaseClient } from '@/lib/firebase/client';

export function pushAvailability(): string | null {
  if (typeof window === 'undefined' || !window.isSecureContext) return 'Notificações exigem HTTPS.';
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window))
    return 'Este navegador não suporta notificações em segundo plano.';
  if (!process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY) return 'Notificações aguardam configuração da loja.';
  return null;
}

export async function enableDriverPush(): Promise<void> {
  const reason = pushAvailability();
  if (reason) throw new Error(reason);
  if (!(await isSupported())) throw new Error('FCM indisponível neste navegador.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Permissão de notificações não concedida.');
  const { app, functions } = getFirebaseClient();
  const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  const token = await getToken(getMessaging(app), {
    vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
    serviceWorkerRegistration: registration,
  });
  if (!token) throw new Error('FCM não devolveu um token. Confira a configuração VAPID.');
  await httpsCallable(functions, 'registerDriverPushToken')({ token });
}

export async function disableDriverPush(): Promise<void> {
  const { app, functions } = getFirebaseClient();
  if (!(await isSupported())) return;
  const messaging = getMessaging(app);
  const token = await getToken(messaging, {
    vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
    serviceWorkerRegistration: await navigator.serviceWorker.ready,
  });
  if (token) await httpsCallable(functions, 'revokeDriverPushToken')({ token });
  await deleteToken(messaging);
}
