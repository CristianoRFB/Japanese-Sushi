import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Meus pedidos | Sushi SaaS',
  robots: { index: false, follow: false },
};

export default function CustomerHistoryLayout({ children }: { children: React.ReactNode }) {
  return children;
}
