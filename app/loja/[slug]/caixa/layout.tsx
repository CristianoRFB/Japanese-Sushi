import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Caixa | Sushi SaaS',
  robots: { index: false, follow: false },
};

export default function TenantCashLayout({ children }: { children: React.ReactNode }) {
  return children;
}
