import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Financeiro recente | Sushi SaaS',
  robots: { index: false, follow: false },
};

export default function TenantFinanceLayout({ children }: { children: React.ReactNode }) {
  return children;
}
