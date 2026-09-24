'use client';

import { useParams } from 'next/navigation';
import { useEffect } from 'react';

export default function DeliveryDetailRedirect() {
  const { id } = useParams<{ id: string }>();
  useEffect(() => {
    const safeId = String(id ?? '').trim();
    if (!/^[A-Za-z0-9_-]{1,150}$/u.test(safeId)) {
      window.location.replace('/entregador');
      return;
    }
    window.location.replace(`/entregador?entrega=${encodeURIComponent(safeId)}`);
  }, [id]);
  return <main className="grid min-h-screen place-items-center bg-[#0b100e] p-6 text-center text-white"><p>Carregando a corrida atribuída à sua conta…</p></main>;
}
