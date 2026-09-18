import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';

import './globals.css';
import { AppProviders } from '@/components/providers';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
<<<<<<< HEAD
  title: 'Teiko Sushi | Santa Fé do Sul',
  description: 'Cardápio, pedidos e reservas da Teiko Sushi.',
=======
  title: 'Teiko Sushi | Comida japonesa',
  description: 'Peça sushi, combinados e pratos quentes do Teiko Sushi.',
>>>>>>> origin/main
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body className={`${geistSans.variable} ${geistMono.variable} antialiased`}><AppProviders>{children}</AppProviders></body></html>;
}
