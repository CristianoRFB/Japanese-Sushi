import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';

import './globals.css';
import { AppProviders } from '@/components/providers';
import { PwaRegister } from '@/components/pwa-register';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Teiko Sushi | Santa Fé do Sul',
  description: 'Cardápio, pedidos e reservas da Teiko Sushi.',
  manifest: '/manifest.webmanifest',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body className={`${geistSans.variable} ${geistMono.variable} antialiased`}><PwaRegister /><AppProviders>{children}</AppProviders></body></html>;
}
