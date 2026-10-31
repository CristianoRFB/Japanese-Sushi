import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Cozinha | Sushi SaaS',
  robots: { index: false, follow: false },
};

export default function TenantKitchenLayout({ children }: { children: React.ReactNode }) {
  return children;
}
