import type { Metadata } from 'next';
import './globals.css';
import { TooltipProvider } from '@/components/ui/tooltip';
export const metadata: Metadata = {
  title: 'Dune — Arrakis Table',
  description:
    'A multiplayer table for classic Dune. Gather your rivals and battle for Arrakis.',
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <TooltipProvider delay={200}>{children}</TooltipProvider>
      </body>
    </html>
  );
}
