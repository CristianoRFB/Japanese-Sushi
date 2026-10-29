import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Identidade visual | Sushi SaaS',
  robots: { index: false, follow: false },
};

export default function TenantBrandingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
