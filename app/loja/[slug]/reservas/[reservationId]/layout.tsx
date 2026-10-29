import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Reservas | Sushi SaaS', robots: { index: false, follow: false } };
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
