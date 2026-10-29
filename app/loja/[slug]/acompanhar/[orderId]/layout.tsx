import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Acompanhar retirada | Sushi SaaS',
  robots: { index: false, follow: false },
};

export default function TenantReceiptLayout({ children }: { children: React.ReactNode }) {
  return children;
}
