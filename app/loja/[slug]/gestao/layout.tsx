import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Gestão de Catálogo | Sushi SaaS',
  robots: { index: false, follow: false },
};

export default function TenantManagementLayout({ children }: { children: React.ReactNode }) {
  return children;
}
