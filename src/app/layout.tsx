import './globals.css';
import React from 'react';
import type { Metadata } from 'next';
import { OvoCoreAccessGate } from '@/components/ovocore/OvoCoreAccessGate';
import { Toaster } from '@/components/ui/toaster';
import { PwaInstallPrompt } from '@/components/ovocore/PwaInstallPrompt';

export const metadata: Metadata = {
  title: 'OvoCore Farm Management | Autonomous Poultry Intelligence',
  description: 'Precision egg production, flock telemetry, silo tracking, and unit economics for modern commercial poultry farms.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'OvoCore',
  },
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
    apple: '/ovocore-icon.jpg',
  },
};

export default function OvoCoreRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-amber-500/30 selection:text-amber-200" suppressHydrationWarning>
        <OvoCoreAccessGate>
          {children}
        </OvoCoreAccessGate>
        <PwaInstallPrompt />
        <Toaster />
      </body>
    </html>
  );
}
