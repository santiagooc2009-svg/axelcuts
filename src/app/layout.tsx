import type { Metadata, Viewport } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'AxelCuts — Barberia',
    template: '%s · AxelCuts',
  },
  description:
    'Aparta tu corte en AxelCuts en menos de un minuto. Confirmacion por WhatsApp y tarjeta de fidelidad digital.',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, title: 'AxelCuts', statusBarStyle: 'black-translucent' },
  openGraph: {
    type: 'website',
    locale: 'es_MX',
    siteName: 'AxelCuts',
    title: 'AxelCuts — Barberia',
    description: 'Aparta tu corte en linea. Sin llamadas, sin esperas.',
  },
};

export const viewport: Viewport = {
  themeColor: '#0b0b0c',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
